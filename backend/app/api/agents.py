from fastapi import APIRouter, Depends
import aiosqlite

from app.core.database import db_dep
from app.models.agent import AgentCreate, AgentRead, AgentUpdate
from app.services import agent_service

router = APIRouter(prefix="/agents", tags=["agents"])


@router.get("", response_model=list[AgentRead])
async def list_agents(db: aiosqlite.Connection = Depends(db_dep)):
    return await agent_service.list_agents(db)


@router.post("", response_model=AgentRead, status_code=201)
async def create_agent(payload: AgentCreate, db: aiosqlite.Connection = Depends(db_dep)):
    return await agent_service.create_agent(db, payload)


@router.get("/{agent_id}", response_model=AgentRead)
async def get_agent(agent_id: str, db: aiosqlite.Connection = Depends(db_dep)):
    return await agent_service.get_agent(db, agent_id)


@router.put("/{agent_id}", response_model=AgentRead)
async def update_agent(
    agent_id: str, payload: AgentUpdate, db: aiosqlite.Connection = Depends(db_dep)
):
    return await agent_service.update_agent(db, agent_id, payload)


@router.delete("/{agent_id}", status_code=204)
async def delete_agent(agent_id: str, db: aiosqlite.Connection = Depends(db_dep)):
    await agent_service.delete_agent(db, agent_id)