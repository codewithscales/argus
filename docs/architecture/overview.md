# Argus — System Architecture Overview

## System Components

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Browser (React SPA)                        │
│                                                                     │
│  ┌──────────────┐  ┌──────────────────────────┐  ┌──────────────┐  │
│  │ Agent Panel  │  │   Flow Graph (ReactFlow)  │  │   Span       │  │
│  │  - Registry  │  │   live node/edge updates  │  │  Inspector   │  │
│  │  - Run form  │  │   dagre auto-layout        │  │  side panel  │  │
│  └──────┬───────┘  └────────────┬─────────────┘  └──────┬───────┘  │
│         │  REST                 │  WebSocket             │  REST    │
└─────────┼─────────────────────── ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┼─────────┘
          │                       │                         │
┌─────────▼─────────────────────────────────────────────────▼────────┐
│                         FastAPI Backend                             │
│                                                                     │
│  ┌───────────────┐  ┌────────────────┐  ┌────────────────────────┐ │
│  │  REST Router  │  │  WS Manager    │  │  OTLP Ingest Handler   │ │
│  │  /api/agents  │  │  /ws/runs/{id} │  │  POST /v1/traces       │ │
│  │  /api/runs    │  │  fan-out queue │  │  (OTel HTTP JSON)      │ │
│  │  /api/spans   │  └───────┬────────┘  └───────────┬────────────┘ │
│  └───────┬───────┘          │                        │              │
│          │          ┌───────▼────────────────────────▼────────────┐ │
│          │          │           Span Event Bus                    │ │
│          │          │  in-memory dict[run_id → list[Queue]]       │ │
│          │          └───────────────────┬─────────────────────────┘ │
│          │                              │                            │
│  ┌───────▼──────────────────────────────▼──────┐                    │
│  │              Service Layer                   │                    │
│  │  AgentService  RunService  TraceService      │                    │
│  └───────────────────────┬──────────────────────┘                   │
│                          │                                          │
│  ┌───────────────────────▼──────────────────────┐                   │
│  │           Repository Layer (aiosqlite)        │                   │
│  └───────────────────────┬──────────────────────┘                   │
└──────────────────────────┼───────────────────────────────────────── ┘
                           │
┌──────────────────────────▼──────────────────────┐
│                  SQLite (argus.db)               │
│  agents  │  runs  │  spans  │  evaluations       │
└──────────────────────────────────────────────────┘

           ┌──────────────────────────────────────┐
           │     Agent (user's code, external)    │
           │                                      │
           │  Option A: OTel-instrumented          │
           │    OTEL_EXPORTER_OTLP_ENDPOINT=       │
           │    http://localhost:8000/v1/traces     │
           │                                      │
           │  Option B: argus-sdk                  │
           │    @argus.trace(run_id=run_id)        │
           │    async def my_agent(input): ...     │
           └──────────────────────────────────────┘
```

## Request Flows

### Starting a Run (HTTP Adapter)

```
Browser                  Backend               Agent Endpoint
  │                         │                       │
  ├─POST /api/runs──────────►│                       │
  │                         ├─INSERT run(pending)   │
  │◄──── { run_id } ────────┤                       │
  │                         │                       │
  ├─WS /ws/runs/{run_id}────►│                       │
  │  (subscribe to stream)  │                       │
  │                         ├─POST {agent_url}─────►│
  │                         │◄────── response ───────┤
  │                         ├─UPDATE run(completed)  │
  │◄── { event:run_end } ───┤                       │
```

### OTel Span Ingest (Path A)

```
Agent (OTel SDK)          Backend               Browser
  │                          │                     │
  ├─POST /v1/traces──────────►│                     │
  │  (OTLP HTTP JSON)        ├─parse spans          │
  │                          ├─INSERT into spans    │
  │                          ├─publish to event bus │
  │                          │──{ event:span_end }─►│
  │                          │   (WS fan-out)       │
```

## Directory Structure (planned)

```
argus/
├── backend/
│   ├── app/
│   │   ├── api/          # FastAPI routers
│   │   ├── core/         # config, db connection, event bus
│   │   ├── models/       # Pydantic schemas
│   │   ├── repositories/ # aiosqlite query wrappers
│   │   ├── services/     # business logic
│   │   ├── adapters/     # agent adapter implementations
│   │   └── ingest/       # OTLP HTTP handler
│   ├── migrations/       # Alembic migration scripts
│   └── main.py
├── frontend/
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── pages/        # route-level views
│   │   ├── hooks/        # useWebSocket, useRun, useAgent
│   │   ├── stores/       # Zustand state
│   │   └── types/        # TypeScript interfaces
│   └── vite.config.ts
├── packages/
│   └── argus-sdk/        # pip-installable Python SDK
│       ├── argus_sdk/
│       └── pyproject.toml
└── docs/
    ├── adr/
    └── architecture/
```

## Key Design Principles

1. **Single process, no daemons.** Argus runs as one `uvicorn` process. No Redis, no Celery, no separate worker.
2. **OTel-first.** The internal span model mirrors OTel's data model exactly so both ingest paths produce identical storage.
3. **Stateless frontend.** All state (runs, spans, agents) lives in SQLite. The frontend holds only view state.
4. **Adapter isolation.** Each agent adapter (HTTP, Python callable, etc.) is a standalone class; adding a new adapter doesn't touch existing code.