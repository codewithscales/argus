import uuid
from datetime import datetime, timezone

import aiosqlite

from app.models.evaluation import EvalCreate, EvalRead


def _row_to_eval(row: aiosqlite.Row) -> EvalRead:
    return EvalRead(
        id=row["id"],
        run_id=row["run_id"],
        score=row["score"],
        label=row["label"],
        notes=row["notes"],
        created_at=datetime.fromisoformat(row["created_at"]),
        updated_at=datetime.fromisoformat(row["updated_at"]),
    )


async def get_for_run(db: aiosqlite.Connection, run_id: str) -> EvalRead | None:
    async with db.execute("SELECT * FROM evaluations WHERE run_id = ?", (run_id,)) as cursor:
        row = await cursor.fetchone()
    return _row_to_eval(row) if row else None


async def upsert(db: aiosqlite.Connection, run_id: str, payload: EvalCreate) -> EvalRead:
    existing = await get_for_run(db, run_id)
    now = datetime.now(timezone.utc).isoformat()

    if existing:
        await db.execute(
            "UPDATE evaluations SET score=?, label=?, notes=?, updated_at=? WHERE run_id=?",
            (payload.score, payload.label, payload.notes, now, run_id),
        )
    else:
        eval_id = str(uuid.uuid4())
        await db.execute(
            "INSERT INTO evaluations (id, run_id, score, label, notes, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (eval_id, run_id, payload.score, payload.label, payload.notes, now, now),
        )
    await db.commit()
    return await get_for_run(db, run_id)