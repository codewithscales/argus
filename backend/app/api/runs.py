from fastapi import APIRouter, Depends, Query
import aiosqlite

from app.core.database import db_dep
from app.models.evaluation import EvalCreate, EvalRead
from app.models.run import RunCreate, RunListParams, RunRead, RunStatus
from app.models.span import SpanRead
from app.repositories import eval_repo, span_repo
from app.services import run_service

router = APIRouter(prefix="/runs", tags=["runs"])


@router.get("", response_model=list[RunRead])
async def list_runs(
    agent_id: str | None = Query(default=None),
    status: RunStatus | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    order: str = Query(default="desc", pattern="^(asc|desc)$"),
    db: aiosqlite.Connection = Depends(db_dep),
):
    params = RunListParams(
        agent_id=agent_id, status=status, limit=limit, offset=offset, order=order
    )
    return await run_service.list_runs(db, params)


@router.post("", response_model=RunRead, status_code=202)
async def start_run(payload: RunCreate, db: aiosqlite.Connection = Depends(db_dep)):
    return await run_service.start_run(db, payload)


@router.get("/{run_id}", response_model=RunRead)
async def get_run(run_id: str, db: aiosqlite.Connection = Depends(db_dep)):
    return await run_service.get_run(db, run_id)


@router.post("/{run_id}/cancel", response_model=RunRead)
async def cancel_run(run_id: str, db: aiosqlite.Connection = Depends(db_dep)):
    return await run_service.cancel_run(db, run_id)


@router.delete("/{run_id}", status_code=204)
async def delete_run(run_id: str, db: aiosqlite.Connection = Depends(db_dep)):
    await run_service.delete_run(db, run_id)


@router.get("/{run_id}/spans", response_model=list[SpanRead])
async def get_spans(run_id: str, db: aiosqlite.Connection = Depends(db_dep)):
    await run_service.get_run(db, run_id)  # 404 if not found
    return await span_repo.get_for_run(db, run_id)


@router.put("/{run_id}/eval", response_model=EvalRead)
async def upsert_eval(
    run_id: str, payload: EvalCreate, db: aiosqlite.Connection = Depends(db_dep)
):
    await run_service.get_run(db, run_id)
    return await eval_repo.upsert(db, run_id, payload)


@router.get("/{run_id}/eval", response_model=EvalRead | None)
async def get_eval(run_id: str, db: aiosqlite.Connection = Depends(db_dep)):
    await run_service.get_run(db, run_id)
    return await eval_repo.get_for_run(db, run_id)
