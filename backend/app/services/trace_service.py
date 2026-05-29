from datetime import datetime, timezone
from typing import Any

import aiosqlite

from app.core.event_bus import event_bus
from app.models.span import SpanKind, SpanStatusCode
from app.repositories import span_repo

# OTel SpanKind integers → argus kind
_OTEL_KIND_MAP = {1: "custom", 2: "custom", 3: "custom", 4: "custom", 5: "custom"}

# Attribute-based kind inference (checked in order; first match wins)
_KIND_SIGNALS: list[tuple[str, SpanKind]] = [
    ("llm.model", SpanKind.LLM),
    ("gen_ai.system", SpanKind.LLM),
    ("gen_ai.request.model", SpanKind.LLM),
    ("tool.name", SpanKind.TOOL),
    ("db.system", SpanKind.RETRIEVAL),
    ("argus.kind", None),  # use attribute value directly
]

_OTEL_STATUS_MAP = {0: SpanStatusCode.UNSET, 1: SpanStatusCode.OK, 2: SpanStatusCode.ERROR}


def _ns_to_iso(ns: int | str | None) -> str | None:
    if ns is None:
        return None
    ns_int = int(ns)
    if ns_int == 0:
        return None
    return datetime.fromtimestamp(ns_int / 1e9, tz=timezone.utc).isoformat()


def _flatten_attributes(attr_list: list[dict]) -> dict[str, Any]:
    """Convert OTel attribute array [{key, value}] → plain dict."""
    result: dict[str, Any] = {}
    for item in attr_list:
        key = item.get("key", "")
        value_obj = item.get("value", {})
        for vtype, val in value_obj.items():
            result[key] = val
            break
    return result


def _infer_kind(attrs: dict[str, Any]) -> SpanKind:
    for signal, kind in _KIND_SIGNALS:
        if signal in attrs:
            if kind is None:
                try:
                    return SpanKind(attrs[signal])
                except ValueError:
                    return SpanKind.CUSTOM
            return kind
    return SpanKind.CUSTOM


async def ingest_otlp(db: aiosqlite.Connection, payload: dict) -> int:
    """Parse OTLP HTTP JSON payload and store all spans. Returns span count."""
    count = 0
    for resource_span in payload.get("resourceSpans", []):
        resource_attrs = _flatten_attributes(
            resource_span.get("resource", {}).get("attributes", [])
        )
        resource_run_id = resource_attrs.get("argus.run_id")

        for scope_span in resource_span.get("scopeSpans", []):
            for raw_span in scope_span.get("spans", []):
                attrs = _flatten_attributes(raw_span.get("attributes", []))
                run_id = attrs.get("argus.run_id") or resource_run_id
                if not run_id:
                    continue

                otel_status = raw_span.get("status", {})
                status_code = _OTEL_STATUS_MAP.get(otel_status.get("code", 0), SpanStatusCode.UNSET)

                start_iso = _ns_to_iso(raw_span.get("startTimeUnixNano"))
                end_iso = _ns_to_iso(raw_span.get("endTimeUnixNano"))
                kind = _infer_kind(attrs)

                span = await span_repo.upsert_span(
                    db=db,
                    run_id=run_id,
                    span_id=raw_span.get("spanId", ""),
                    trace_id=raw_span.get("traceId", ""),
                    parent_span_id=raw_span.get("parentSpanId") or None,
                    name=raw_span.get("name", "unnamed"),
                    kind=kind,
                    start_time=start_iso or datetime.now(timezone.utc).isoformat(),
                    end_time=end_iso,
                    status_code=status_code,
                    status_message=otel_status.get("message"),
                    attributes=attrs,
                    events=raw_span.get("events", []),
                )

                event_type = "span_end" if end_iso else "span_start"
                await event_bus.publish(run_id, {
                    "event": event_type,
                    "span": {
                        "span_id": span.span_id,
                        "parent_span_id": span.parent_span_id,
                        "name": span.name,
                        "kind": span.kind,
                        "start_time": span.start_time.isoformat(),
                        "end_time": span.end_time.isoformat() if span.end_time else None,
                        "status_code": span.status_code,
                        "status_message": span.status_message,
                        "attributes": span.attributes,
                        "events": span.events,
                    },
                })
                count += 1
    return count