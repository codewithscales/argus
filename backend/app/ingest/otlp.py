from fastapi import APIRouter, Depends, Request, Response
import aiosqlite

from app.core.database import db_dep
from app.services import trace_service

router = APIRouter(tags=["ingest"])


@router.post("/v1/traces", status_code=200)
async def ingest_traces(request: Request, db: aiosqlite.Connection = Depends(db_dep)):
    """
    OTLP HTTP JSON ingest endpoint.
    Compatible with any OTel exporter using:
        OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:8000
        OTEL_EXPORTER_OTLP_PROTOCOL=http/json
    Spans must carry 'argus.run_id' as a span or resource attribute.
    """
    payload = await request.json()
    count = await trace_service.ingest_otlp(db, payload)
    # OTLP spec: respond with empty success object
    return {"partialSuccess": {}}
