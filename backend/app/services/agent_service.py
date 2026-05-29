from fastapi import HTTPException

import aiosqlite

from app.adapters.registry import get_adapter
from app.models.agent import AgentCreate, AgentRead, AgentUpdate
from app.repositories import agent_repo


async def list_agents(db: aiosqlite.Connection) -> list[AgentRead]:
    return await agent_repo.get_all(db)


async def get_agent(db: aiosqlite.Connection, agent_id: str) -> AgentRead:
    agent = await agent_repo.get_by_id(db, agent_id)
    if agent is None:
        raise HTTPException(status_code=404, detail=f"Agent '{agent_id}' not found")
    return agent


async def create_agent(db: aiosqlite.Connection, payload: AgentCreate) -> AgentRead:
    existing = await agent_repo.get_by_name(db, payload.name)
    if existing:
        raise HTTPException(status_code=409, detail=f"Agent name '{payload.name}' already exists")

    try:
        get_adapter(payload.adapter, payload.config)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return await agent_repo.create(db, payload)


async def update_agent(
    db: aiosqlite.Connection, agent_id: str, payload: AgentUpdate
) -> AgentRead:
    agent = await agent_repo.get_by_id(db, agent_id)
    if agent is None:
        raise HTTPException(status_code=404, detail=f"Agent '{agent_id}' not found")

    if payload.name and payload.name != agent.name:
        conflict = await agent_repo.get_by_name(db, payload.name)
        if conflict:
            raise HTTPException(status_code=409, detail=f"Agent name '{payload.name}' already exists")

    updated = await agent_repo.update(db, agent_id, payload)
    return updated


async def delete_agent(db: aiosqlite.Connection, agent_id: str) -> None:
    deleted = await agent_repo.delete(db, agent_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Agent '{agent_id}' not found")