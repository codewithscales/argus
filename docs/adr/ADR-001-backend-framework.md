# ADR-001: Backend Framework

**Date:** 2026-05-29  
**Status:** Accepted

## Context

Argus needs a Python backend that can:
- Serve a REST API for agent/run/trace CRUD
- Handle persistent WebSocket connections to stream spans to the frontend in real time
- Proxy or invoke agents (HTTP calls, Python callables)
- Ingest OpenTelemetry spans via an OTLP HTTP endpoint
- Run async I/O without threading complexity

## Decision

Use **FastAPI** with **Uvicorn** as the ASGI server.

FastAPI is chosen over Flask/Django because:
- Native `async`/`await` throughout — critical for WebSocket streaming and concurrent agent invocations
- Built-in WebSocket support with no additional library
- Pydantic v2 for request/response validation (already familiar from Orion)
- Auto-generated OpenAPI docs are useful during development
- Uvicorn handles hot-reload cleanly in dev mode

## Consequences

**Positive:**
- Single process handles REST, WebSocket, and background trace ingestion without thread pools
- Pydantic models double as API schemas and internal data contracts
- Familiar pattern — consistent with the Orion project

**Negative:**
- FastAPI's WebSocket handling is lower-level than Socket.io; fan-out to multiple subscribers per run requires a manual pub/sub layer (in-memory dict of queues is sufficient for a single-process app)
- No built-in task queue — long-running agent calls are handled with `asyncio.create_task`, which is fine until agents take > 30s on slow hardware

## Alternatives Considered

| Option | Reason rejected |
|---|---|
| Flask + Flask-SocketIO | Sync-first, gevent patching is fragile |
| Django Channels | Heavy; overkill for a single-purpose tool |
| Litestar | Solid but less community familiarity |