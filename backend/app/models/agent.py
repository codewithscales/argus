from datetime import datetime, timezone
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field


class AgentAdapter(StrEnum):
    HTTP = "http"
    PYTHON = "python"
    CLAUDE = "claude"


class AgentBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)
    description: str | None = None
    adapter: AgentAdapter
    config: dict[str, Any] = Field(default_factory=dict)


class AgentCreate(AgentBase):
    pass


class AgentUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=128)
    description: str | None = None
    config: dict[str, Any] | None = None


class AgentRead(AgentBase):
    id: str
    created_at: datetime
    updated_at: datetime