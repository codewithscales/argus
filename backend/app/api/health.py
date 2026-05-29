from fastapi import APIRouter, Depends
import aiosqlite

from app.core.database import db_dep

router = APIRouter(tags=["health"])


@router.get("/health")
async def liveness():
    return {"status": "ok"}


@router.get("/health/ready")
async def readiness(db: aiosqlite.Connection = Depends(db_dep)):
    await db.execute("SELECT 1")
    return {"status": "ready"}