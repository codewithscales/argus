from datetime import datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field


class RunStatus(StrEnum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class RunCreate(BaseModel):
    agent_id: str
    input: dict[str, Any] = Field(default_factory=dict)
    metadata: dict[str, Any] = Field(default_factory=dict)


class RunRead(BaseModel):
    id: str
    agent_id: str
    status: RunStatus
    input: dict[str, Any]
    output: dict[str, Any] | None
    started_at: datetime
    ended_at: datetime | None
    metadata: dict[str, Any]


class RunListParams(BaseModel):
    agent_id: str | None = None
    status: RunStatus | None = None
    limit: int = Field(default=50, ge=1, le=200)
    offset: int = Field(default=0, ge=0)
    order: str = Field(default="desc", pattern="^(asc|desc)$")