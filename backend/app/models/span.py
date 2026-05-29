from datetime import datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel


class SpanKind(StrEnum):
    LLM = "llm"
    TOOL = "tool"
    AGENT = "agent"
    RETRIEVAL = "retrieval"
    CUSTOM = "custom"


class SpanStatusCode(StrEnum):
    UNSET = "UNSET"
    OK = "OK"
    ERROR = "ERROR"


class SpanRead(BaseModel):
    id: str
    run_id: str
    span_id: str
    trace_id: str
    parent_span_id: str | None
    name: str
    kind: SpanKind
    start_time: datetime
    end_time: datetime | None
    status_code: SpanStatusCode
    status_message: str | None
    attributes: dict[str, Any]
    events: list[dict[str, Any]]


# WebSocket event payloads

class SpanStartEvent(BaseModel):
    event: str = "span_start"
    span: dict[str, Any]


class SpanEndEvent(BaseModel):
    event: str = "span_end"
    span: dict[str, Any]


class RunEndEvent(BaseModel):
    event: str = "run_end"
    run: dict[str, Any]


class ErrorEvent(BaseModel):
    event: str = "error"
    error: dict[str, Any]


class ConnectedEvent(BaseModel):
    event: str = "connected"
    run_id: str