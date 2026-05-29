from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, Field


class EvalLabel(StrEnum):
    PASS = "pass"
    FAIL = "fail"
    PARTIAL = "partial"


class EvalCreate(BaseModel):
    score: float | None = Field(default=None, ge=0.0, le=1.0)
    label: EvalLabel | None = None
    notes: str | None = None


class EvalRead(EvalCreate):
    id: str
    run_id: str
    created_at: datetime
    updated_at: datetime