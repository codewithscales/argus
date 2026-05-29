import asyncio

from fastapi import HTTPException

import aiosqlite

from app.adapters.base import AdapterError, RunInput
from app.adapters.registry import get_adapter
from app.core.database import get_db
from app.core.event_bus import event_bus
from app.models.run import RunCreate, RunListParams, RunRead, RunStatus
from app.repositories import agent_repo, run_repo


async def list_runs(db: aiosqlite.Connection, params: RunListParams) -> list[RunRead]:
    return await run_repo.get_all(db, params)


async def get_run(db: aiosqlite.Connection, run_id: str) -> RunRead:
    run = await run_repo.get_by_id(db, run_id)
    if run is None:
        raise HTTPException(status_code=404, detail=f"Run '{run_id}' not found")
    return run


async def start_run(db: aiosqlite.Connection, payload: RunCreate) -> RunRead:
    agent = await agent_repo.get_by_id(db, payload.agent_id)
    if agent is None:
        raise HTTPException(status_code=404, detail=f"Agent '{payload.agent_id}' not found")

    run = await run_repo.create(db, payload)
    asyncio.create_task(_execute_run(run.id, agent.adapter, agent.config, payload.input))
    return run


async def delete_run(db: aiosqlite.Connection, run_id: str) -> None:
    run = await run_repo.get_by_id(db, run_id)
    if run is None:
        raise HTTPException(status_code=404, detail=f"Run '{run_id}' not found")
    await run_repo.delete(db, run_id)


async def cancel_run(db: aiosqlite.Connection, run_id: str) -> RunRead:
    run = await run_repo.get_by_id(db, run_id)
    if run is None:
        raise HTTPException(status_code=404, detail=f"Run '{run_id}' not found")
    if run.status not in (RunStatus.PENDING, RunStatus.RUNNING):
        raise HTTPException(status_code=409, detail=f"Run is already {run.status}")

    await run_repo.update_status(db, run_id, RunStatus.CANCELLED)
    await event_bus.publish(run_id, {"event": "run_end", "run": {"run_id": run_id, "status": "cancelled"}})
    return await run_repo.get_by_id(db, run_id)


async def _execute_run(
    run_id: str, adapter_type: str, adapter_config: dict, input_data: dict
) -> None:
    """Background task: invokes the agent adapter and updates the run record."""
    async with get_db() as db:
        await run_repo.update_status(db, run_id, RunStatus.RUNNING)
        await event_bus.publish(run_id, {"event": "run_start", "run": {"run_id": run_id, "status": "running"}})

        try:
            adapter = get_adapter(adapter_type, adapter_config)
            output = await adapter.invoke(run_id, RunInput(data=input_data))
            await run_repo.update_status(db, run_id, RunStatus.COMPLETED, output=output.data)
            await event_bus.publish(run_id, {
                "event": "run_end",
                "run": {"run_id": run_id, "status": "completed", "output": output.data},
            })
        except AdapterError as exc:
            await run_repo.update_status(db, run_id, RunStatus.FAILED)
            await event_bus.publish(run_id, {
                "event": "error",
                "error": {"message": str(exc), "run_id": run_id},
            })
        except Exception as exc:
            await run_repo.update_status(db, run_id, RunStatus.FAILED)
            await event_bus.publish(run_id, {
                "event": "error",
                "error": {"message": f"Unexpected error: {exc}", "run_id": run_id},
            })