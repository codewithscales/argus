import json
import uuid
from datetime import datetime, timezone

import aiosqlite

from app.models.agent import AgentCreate, AgentRead, AgentUpdate


def _row_to_agent(row: aiosqlite.Row) -> AgentRead:
    return AgentRead(
        id=row["id"],
        name=row["name"],
        description=row["description"],
        adapter=row["adapter"],
        config=json.loads(row["config"]),
        created_at=datetime.fromisoformat(row["created_at"]),
        updated_at=datetime.fromisoformat(row["updated_at"]),
    )


async def get_all(db: aiosqlite.Connection) -> list[AgentRead]:
    async with db.execute("SELECT * FROM agents ORDER BY created_at DESC") as cursor:
        rows = await cursor.fetchall()
    return [_row_to_agent(r) for r in rows]


async def get_by_id(db: aiosqlite.Connection, agent_id: str) -> AgentRead | None:
    async with db.execute("SELECT * FROM agents WHERE id = ?", (agent_id,)) as cursor:
        row = await cursor.fetchone()
    return _row_to_agent(row) if row else None


async def get_by_name(db: aiosqlite.Connection, name: str) -> AgentRead | None:
    async with db.execute("SELECT * FROM agents WHERE name = ?", (name,)) as cursor:
        row = await cursor.fetchone()
    return _row_to_agent(row) if row else None


async def create(db: aiosqlite.Connection, payload: AgentCreate) -> AgentRead:
    now = datetime.now(timezone.utc).isoformat()
    agent_id = str(uuid.uuid4())
    await db.execute(
        "INSERT INTO agents (id, name, description, adapter, config, created_at, updated_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
        (agent_id, payload.name, payload.description, payload.adapter,
         json.dumps(payload.config), now, now),
    )
    await db.commit()
    return await get_by_id(db, agent_id)


async def update(db: aiosqlite.Connection, agent_id: str, payload: AgentUpdate) -> AgentRead | None:
    agent = await get_by_id(db, agent_id)
    if agent is None:
        return None

    now = datetime.now(timezone.utc).isoformat()
    new_name = payload.name if payload.name is not None else agent.name
    new_desc = payload.description if payload.description is not None else agent.description
    new_config = json.dumps(payload.config) if payload.config is not None else json.dumps(agent.config)

    await db.execute(
        "UPDATE agents SET name=?, description=?, config=?, updated_at=? WHERE id=?",
        (new_name, new_desc, new_config, now, agent_id),
    )
    await db.commit()
    return await get_by_id(db, agent_id)


async def delete(db: aiosqlite.Connection, agent_id: str) -> bool:
    cursor = await db.execute("DELETE FROM agents WHERE id = ?", (agent_id,))
    await db.commit()
    return cursor.rowcount > 0