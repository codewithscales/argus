"""Tests for the OTLP HTTP JSON ingest endpoint (/v1/traces)."""

import pytest
from httpx import AsyncClient


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _otel_attr(key: str, value: str) -> dict:
    """Build a single OTel attribute object with a stringValue."""
    return {"key": key, "value": {"stringValue": value}}


def _make_span(
    span_id: str = "aaaa000000000001",
    trace_id: str = "dddddddddddddddddddddddddddddddd",
    name: str = "test-span",
    start_ns: int = 1_700_000_000_000_000_000,
    end_ns: int = 1_700_000_001_000_000_000,
    attributes: list[dict] | None = None,
    parent_span_id: str | None = None,
    status_code: int = 0,
) -> dict:
    span: dict = {
        "spanId": span_id,
        "traceId": trace_id,
        "name": name,
        "startTimeUnixNano": str(start_ns),
        "endTimeUnixNano": str(end_ns),
        "attributes": attributes or [],
        "status": {"code": status_code},
    }
    if parent_span_id:
        span["parentSpanId"] = parent_span_id
    return span


def _make_otlp_payload(
    spans: list[dict],
    resource_attributes: list[dict] | None = None,
) -> dict:
    """Wrap spans in a minimal OTLP resourceSpans / scopeSpans envelope."""
    return {
        "resourceSpans": [
            {
                "resource": {"attributes": resource_attributes or []},
                "scopeSpans": [
                    {
                        "scope": {"name": "test-instrumentation"},
                        "spans": spans,
                    }
                ],
            }
        ]
    }


async def _create_agent_and_run(client: AsyncClient, agent_name: str = "otlp-agent") -> tuple[str, str]:
    """Create an agent + run and return (agent_id, run_id)."""
    agent_resp = await client.post(
        "/api/agents",
        json={
            "name": agent_name,
            "adapter": "http",
            "config": {"url": "http://localhost:9000/invoke"},
        },
    )
    assert agent_resp.status_code == 201, agent_resp.text
    agent_id = agent_resp.json()["id"]

    run_resp = await client.post("/api/runs", json={"agent_id": agent_id})
    assert run_resp.status_code == 202, run_resp.text
    run_id = run_resp.json()["id"]

    return agent_id, run_id


# ---------------------------------------------------------------------------
# Basic ingest
# ---------------------------------------------------------------------------

async def test_ingest_span_with_span_attribute_run_id(client: AsyncClient):
    """argus.run_id as a span attribute → span is stored and retrievable."""
    _, run_id = await _create_agent_and_run(client, agent_name="span-attr-agent")

    span = _make_span(
        span_id="bbbb000000000001",
        name="llm-call",
        attributes=[_otel_attr("argus.run_id", run_id)],
    )
    payload = _make_otlp_payload(spans=[span])

    resp = await client.post("/v1/traces", json=payload)
    assert resp.status_code == 200
    assert resp.json() == {"partialSuccess": {}}

    spans_resp = await client.get(f"/api/runs/{run_id}/spans")
    assert spans_resp.status_code == 200
    spans = spans_resp.json()
    assert len(spans) == 1
    assert spans[0]["name"] == "llm-call"
    assert spans[0]["run_id"] == run_id


async def test_ingest_span_with_resource_attribute_run_id(client: AsyncClient):
    """argus.run_id as a resource attribute → span is stored for that run."""
    _, run_id = await _create_agent_and_run(client, agent_name="resource-attr-agent")

    span = _make_span(span_id="cccc000000000001", name="retrieval-step")
    # run_id on the resource, not the span
    payload = _make_otlp_payload(
        spans=[span],
        resource_attributes=[_otel_attr("argus.run_id", run_id)],
    )

    resp = await client.post("/v1/traces", json=payload)
    assert resp.status_code == 200

    spans_resp = await client.get(f"/api/runs/{run_id}/spans")
    spans = spans_resp.json()
    assert len(spans) == 1
    assert spans[0]["name"] == "retrieval-step"


async def test_ingest_span_attribute_overrides_resource_attribute(client: AsyncClient):
    """When both resource and span carry argus.run_id, the span attribute wins."""
    _, run_id_resource = await _create_agent_and_run(client, agent_name="override-resource-agent")
    _, run_id_span = await _create_agent_and_run(client, agent_name="override-span-agent")

    span = _make_span(
        span_id="dddd000000000001",
        name="override-span",
        attributes=[_otel_attr("argus.run_id", run_id_span)],
    )
    payload = _make_otlp_payload(
        spans=[span],
        resource_attributes=[_otel_attr("argus.run_id", run_id_resource)],
    )

    await client.post("/v1/traces", json=payload)

    # Span should appear under run_id_span, not run_id_resource
    spans_span = (await client.get(f"/api/runs/{run_id_span}/spans")).json()
    spans_resource = (await client.get(f"/api/runs/{run_id_resource}/spans")).json()

    assert len(spans_span) == 1
    assert len(spans_resource) == 0


async def test_ingest_multiple_spans_for_same_run(client: AsyncClient):
    """Multiple spans in one payload all land under the same run."""
    _, run_id = await _create_agent_and_run(client, agent_name="multi-span-agent")

    spans = [
        _make_span(
            span_id=f"eeee00000000000{i}",
            name=f"step-{i}",
            attributes=[_otel_attr("argus.run_id", run_id)],
        )
        for i in range(1, 4)
    ]
    payload = _make_otlp_payload(spans=spans)

    resp = await client.post("/v1/traces", json=payload)
    assert resp.status_code == 200

    spans_resp = await client.get(f"/api/runs/{run_id}/spans")
    assert len(spans_resp.json()) == 3


# ---------------------------------------------------------------------------
# Missing argus.run_id → silently skipped
# ---------------------------------------------------------------------------

async def test_ingest_spans_without_run_id_are_skipped(client: AsyncClient):
    """Spans that carry no argus.run_id (neither span nor resource) are silently dropped."""
    span = _make_span(
        span_id="ffff000000000001",
        name="orphan-span",
        attributes=[_otel_attr("http.method", "POST")],
    )
    payload = _make_otlp_payload(spans=[span])

    resp = await client.post("/v1/traces", json=payload)
    # Still returns 200 — partial success
    assert resp.status_code == 200
    assert resp.json() == {"partialSuccess": {}}


async def test_ingest_empty_payload_returns_200(client: AsyncClient):
    """Empty resourceSpans list is a no-op."""
    resp = await client.post("/v1/traces", json={"resourceSpans": []})
    assert resp.status_code == 200


async def test_ingest_mixed_spans_stores_only_tagged(client: AsyncClient):
    """A batch with some tagged and some untagged spans — only tagged ones are stored."""
    _, run_id = await _create_agent_and_run(client, agent_name="mixed-spans-agent")

    tagged = _make_span(
        span_id="1111000000000001",
        name="tagged-span",
        attributes=[_otel_attr("argus.run_id", run_id)],
    )
    untagged = _make_span(
        span_id="2222000000000001",
        name="untagged-span",
        attributes=[],
    )
    payload = _make_otlp_payload(spans=[tagged, untagged])

    await client.post("/v1/traces", json=payload)

    spans_resp = await client.get(f"/api/runs/{run_id}/spans")
    names = [s["name"] for s in spans_resp.json()]
    assert "tagged-span" in names
    assert "untagged-span" not in names


# ---------------------------------------------------------------------------
# Kind inference
# ---------------------------------------------------------------------------

async def test_kind_inferred_as_llm_for_gen_ai_system(client: AsyncClient):
    """Span with gen_ai.system attribute → kind=llm."""
    _, run_id = await _create_agent_and_run(client, agent_name="llm-kind-agent")

    span = _make_span(
        span_id="3333000000000001",
        name="openai-chat",
        attributes=[
            _otel_attr("argus.run_id", run_id),
            _otel_attr("gen_ai.system", "openai"),
        ],
    )
    payload = _make_otlp_payload(spans=[span])

    await client.post("/v1/traces", json=payload)

    spans_resp = await client.get(f"/api/runs/{run_id}/spans")
    assert spans_resp.json()[0]["kind"] == "llm"


async def test_kind_inferred_as_llm_for_llm_model(client: AsyncClient):
    """Span with llm.model attribute → kind=llm."""
    _, run_id = await _create_agent_and_run(client, agent_name="llm-model-kind-agent")

    span = _make_span(
        span_id="4444000000000001",
        name="llm-inference",
        attributes=[
            _otel_attr("argus.run_id", run_id),
            _otel_attr("llm.model", "gpt-4o"),
        ],
    )
    payload = _make_otlp_payload(spans=[span])

    await client.post("/v1/traces", json=payload)

    spans_resp = await client.get(f"/api/runs/{run_id}/spans")
    assert spans_resp.json()[0]["kind"] == "llm"


async def test_kind_inferred_as_tool_for_tool_name(client: AsyncClient):
    """Span with tool.name attribute → kind=tool."""
    _, run_id = await _create_agent_and_run(client, agent_name="tool-kind-agent")

    span = _make_span(
        span_id="5555000000000001",
        name="web-search-tool",
        attributes=[
            _otel_attr("argus.run_id", run_id),
            _otel_attr("tool.name", "web_search"),
        ],
    )
    payload = _make_otlp_payload(spans=[span])

    await client.post("/v1/traces", json=payload)

    spans_resp = await client.get(f"/api/runs/{run_id}/spans")
    assert spans_resp.json()[0]["kind"] == "tool"


async def test_kind_defaults_to_custom_without_signals(client: AsyncClient):
    """Span with no recognised kind-signal attributes → kind=custom."""
    _, run_id = await _create_agent_and_run(client, agent_name="custom-kind-agent")

    span = _make_span(
        span_id="6666000000000001",
        name="generic-step",
        attributes=[
            _otel_attr("argus.run_id", run_id),
            _otel_attr("some.unrecognised.attr", "value"),
        ],
    )
    payload = _make_otlp_payload(spans=[span])

    await client.post("/v1/traces", json=payload)

    spans_resp = await client.get(f"/api/runs/{run_id}/spans")
    assert spans_resp.json()[0]["kind"] == "custom"


# ---------------------------------------------------------------------------
# Span field round-trips
# ---------------------------------------------------------------------------

async def test_span_fields_are_stored_correctly(client: AsyncClient):
    """Verify that span_id, trace_id, name, and attributes survive the round-trip."""
    _, run_id = await _create_agent_and_run(client, agent_name="round-trip-agent")

    span = _make_span(
        span_id="7777000000000001",
        trace_id="aaaabbbbccccddddaaaabbbbccccdddd",
        name="detailed-span",
        start_ns=1_700_000_100_000_000_000,
        end_ns=1_700_000_102_000_000_000,
        attributes=[
            _otel_attr("argus.run_id", run_id),
            _otel_attr("http.method", "POST"),
            _otel_attr("http.url", "http://localhost:9000/invoke"),
        ],
        status_code=1,  # OK
    )
    payload = _make_otlp_payload(spans=[span])

    await client.post("/v1/traces", json=payload)

    spans_resp = await client.get(f"/api/runs/{run_id}/spans")
    stored = spans_resp.json()[0]

    assert stored["span_id"] == "7777000000000001"
    assert stored["trace_id"] == "aaaabbbbccccddddaaaabbbbccccdddd"
    assert stored["name"] == "detailed-span"
    assert stored["attributes"]["http.method"] == "POST"
    assert stored["attributes"]["http.url"] == "http://localhost:9000/invoke"
    assert stored["status_code"] == "OK"


async def test_upsert_updates_existing_span(client: AsyncClient):
    """Re-ingesting the same span_id + run_id updates rather than duplicates."""
    _, run_id = await _create_agent_and_run(client, agent_name="upsert-agent")

    span_v1 = _make_span(
        span_id="8888000000000001",
        name="evolving-span",
        end_ns=0,  # end time = 0 → treated as None (span still in-flight)
        attributes=[_otel_attr("argus.run_id", run_id)],
    )
    span_v2 = _make_span(
        span_id="8888000000000001",  # same id
        name="evolving-span",
        end_ns=1_700_000_003_000_000_000,
        attributes=[
            _otel_attr("argus.run_id", run_id),
            _otel_attr("result", "done"),
        ],
        status_code=1,
    )

    await client.post("/v1/traces", json=_make_otlp_payload([span_v1]))
    await client.post("/v1/traces", json=_make_otlp_payload([span_v2]))

    spans_resp = await client.get(f"/api/runs/{run_id}/spans")
    spans = spans_resp.json()
    # Should still be exactly one span (upserted, not duplicated)
    assert len(spans) == 1
    assert spans[0]["status_code"] == "OK"
    assert spans[0]["attributes"]["result"] == "done"
