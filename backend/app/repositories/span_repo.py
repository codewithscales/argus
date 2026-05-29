import json
import uuid
from datetime import datetime
from typing import Any

import aiosqlite

from app.models.span import SpanKind, SpanRead, SpanStatusCode


def _row_to_span(row: aiosqlite.Row) -> SpanRead:
    return SpanRead(
        id=row["id"],
        run_id=row["run_id"],
        span_id=row["span_id"],
        trace_id=row["trace_id"],
        parent_span_id=row["parent_span_id"],
        name=row["name"],
        kind=SpanKind(row["kind"]),
        start_time=datetime.fromisoformat(row["start_time"]),
        end_time=datetime.fromisoformat(row["end_time"]) if row["end_time"] else None,
        status_code=SpanStatusCode(row["status_code"]),
        status_message=row["status_message"],
        attributes=json.loads(row["attributes"]),
        events=json.loads(row["events"]),
    )


async def get_for_run(db: aiosqlite.Connection, run_id: str) -> list[SpanRead]:
    async with db.execute(
        "SELECT * FROM spans WHERE run_id = ? ORDER BY start_time ASC", (run_id,)
    ) as cursor:
        rows = await cursor.fetchall()
    return [_row_to_span(r) for r in rows]


async def upsert_span(
    db: aiosqlite.Connection,
    run_id: str,
    span_id: str,
    trace_id: str,
    parent_span_id: str | None,
    name: str,
    kind: SpanKind,
    start_time: str,
    end_time: str | None = None,
    status_code: SpanStatusCode = SpanStatusCode.UNSET,
    status_message: str | None = None,
    attributes: dict[str, Any] | None = None,
    events: list[dict[str, Any]] | None = None,
) -> SpanRead:
    row_id = str(uuid.uuid4())
    await db.execute(
        """
        INSERT INTO spans
            (id, run_id, span_id, trace_id, parent_span_id, name, kind,
             start_time, end_time, status_code, status_message, attributes, events)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(run_id, span_id) DO UPDATE SET
            end_time=excluded.end_time,
            status_code=excluded.status_code,
            status_message=excluded.status_message,
            attributes=excluded.attributes,
            events=excluded.events
        """,
        (
            row_id, run_id, span_id, trace_id, parent_span_id, name, kind,
            start_time, end_time, status_code, status_message,
            json.dumps(attributes or {}), json.dumps(events or []),
        ),
    )
    await db.commit()
    async with db.execute(
        "SELECT * FROM spans WHERE run_id=? AND span_id=?", (run_id, span_id)
    ) as cursor:
        row = await cursor.fetchone()
    return _row_to_span(row)