import json
import uuid
from datetime import datetime, timezone
from typing import Any

import aiosqlite

from app.models.run import RunCreate, RunListParams, RunRead, RunStatus


def _row_to_run(row: aiosqlite.Row) -> RunRead:
    return RunRead(
        id=row["id"],
        agent_id=row["agent_id"],
        status=RunStatus(row["status"]),
        input=json.loads(row["input"]),
        output=json.loads(row["output"]) if row["output"] else None,
        started_at=datetime.fromisoformat(row["started_at"]),
        ended_at=datetime.fromisoformat(row["ended_at"]) if row["ended_at"] else None,
        metadata=json.loads(row["metadata"]),
    )


async def get_by_id(db: aiosqlite.Connection, run_id: str) -> RunRead | None:
    async with db.execute("SELECT * FROM runs WHERE id = ?", (run_id,)) as cursor:
        row = await cursor.fetchone()
    return _row_to_run(row) if row else None


async def get_all(db: aiosqlite.Connection, params: RunListParams) -> list[RunRead]:
    clauses: list[str] = []
    values: list[Any] = []

    if params.agent_id:
        clauses.append("agent_id = ?")
        values.append(params.agent_id)
    if params.status:
        clauses.append("status = ?")
        values.append(params.status)

    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    order = "ASC" if params.order == "asc" else "DESC"
    query = f"SELECT * FROM runs {where} ORDER BY started_at {order} LIMIT ? OFFSET ?"
    values.extend([params.limit, params.offset])

    async with db.execute(query, values) as cursor:
        rows = await cursor.fetchall()
    return [_row_to_run(r) for r in rows]


async def create(db: aiosqlite.Connection, payload: RunCreate) -> RunRead:
    run_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    await db.execute(
        "INSERT INTO runs (id, agent_id, status, input, started_at, metadata) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (run_id, payload.agent_id, RunStatus.PENDING,
         json.dumps(payload.input), now, json.dumps(payload.metadata)),
    )
    await db.commit()
    return await get_by_id(db, run_id)


async def delete(db: aiosqlite.Connection, run_id: str) -> None:
    await db.execute("DELETE FROM runs WHERE id = ?", (run_id,))
    await db.commit()


async def update_status(
    db: aiosqlite.Connection,
    run_id: str,
    status: RunStatus,
    output: dict[str, Any] | None = None,
) -> None:
    now = datetime.now(timezone.utc).isoformat()
    terminal = status in (RunStatus.COMPLETED, RunStatus.FAILED, RunStatus.CANCELLED)
    await db.execute(
        "UPDATE runs SET status=?, output=?, ended_at=? WHERE id=?",
        (status, json.dumps(output) if output is not None else None,
         now if terminal else None, run_id),
    )
    await db.commit()