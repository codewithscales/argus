# Argus — API Design

Base URL: `http://localhost:8000`  
All REST endpoints return `application/json`. Errors follow `{ "detail": "message" }`.

---

## REST API

### Agents

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/agents` | List all registered agents |
| `POST` | `/api/agents` | Register a new agent |
| `GET` | `/api/agents/{agent_id}` | Get agent by ID |
| `PUT` | `/api/agents/{agent_id}` | Update agent config |
| `DELETE` | `/api/agents/{agent_id}` | Remove agent (does not delete historical runs) |

**POST /api/agents**
```json
// Request
{
  "name": "my-search-agent",
  "description": "Web search agent using Tavily",
  "adapter": "http",
  "config": { "url": "http://localhost:9000/invoke", "timeout_s": 30 }
}

// Response 201
{
  "id": "018f3a2b-...",
  "name": "my-search-agent",
  "adapter": "http",
  "config": { "url": "...", "timeout_s": 30 },
  "created_at": "2026-05-29T10:00:00Z"
}
```

---

### Runs

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/runs` | Start a new run |
| `GET` | `/api/runs` | List runs (with filters) |
| `GET` | `/api/runs/{run_id}` | Get run by ID |
| `POST` | `/api/runs/{run_id}/cancel` | Cancel a running run |
| `GET` | `/api/runs/{run_id}/spans` | Get all spans for a run (backfill) |
| `POST` | `/api/runs/{run_id}/eval` | Set evaluation annotation |
| `GET` | `/api/runs/{run_id}/eval` | Get evaluation annotation |

**POST /api/runs**
```json
// Request
{
  "agent_id": "018f3a2b-...",
  "input": { "message": "What is the weather in Paris?" },
  "metadata": { "prompt_version": "v2" }
}

// Response 202
{
  "run_id": "019a4c8d-...",
  "status": "pending",
  "started_at": "2026-05-29T10:01:00Z"
}
```

**GET /api/runs** query params:
- `agent_id` — filter by agent
- `status` — `pending | running | completed | failed | cancelled`
- `limit` — default 50, max 200
- `offset` — for pagination
- `order` — `asc | desc` (by `started_at`, default `desc`)

**GET /api/runs/{run_id}/spans**
```json
// Response 200
{
  "run_id": "019a4c8d-...",
  "spans": [
    {
      "span_id": "abc123...",
      "parent_span_id": null,
      "name": "agent.run",
      "kind": "agent",
      "start_time": "2026-05-29T10:01:00.001Z",
      "end_time": "2026-05-29T10:01:03.412Z",
      "status_code": "OK",
      "attributes": { ... },
      "events": []
    }
  ]
}
```

---

### OTLP Ingest

| Method | Path | Description |
|---|---|---|
| `POST` | `/v1/traces` | OTLP HTTP JSON trace ingest |

This endpoint is compatible with any OpenTelemetry exporter configured to use HTTP JSON encoding. Spans must include the `argus.run_id` attribute or resource attribute to be associated with a run.

```
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:8000
OTEL_EXPORTER_OTLP_PROTOCOL=http/json
OTEL_RESOURCE_ATTRIBUTES=argus.run_id=<run_id>
```

---

### Health

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Liveness check |
| `GET` | `/health/ready` | Readiness (checks DB connection) |

---

## WebSocket API

### `/ws/runs/{run_id}`

Connect to receive real-time span events for a run. The frontend connects immediately after `POST /api/runs` returns.

**Connection lifecycle:**
```
Client connects
  → Server sends { "event": "connected", "run_id": "..." }
  → Server streams span events as they arrive
  → Server sends { "event": "run_end", ... } when run completes or fails
  → Server closes connection
```

**Event types:**

```jsonc
// Span started
{
  "event": "span_start",
  "span": {
    "span_id": "abc123",
    "parent_span_id": null,
    "name": "llm.complete",
    "kind": "llm",
    "start_time": "2026-05-29T10:01:00.100Z",
    "attributes": { "llm.model": "claude-sonnet-4-6" }
  }
}

// Span completed
{
  "event": "span_end",
  "span": {
    "span_id": "abc123",
    "end_time": "2026-05-29T10:01:01.823Z",
    "status_code": "OK",
    "attributes": { "llm.input_tokens": 400, "llm.output_tokens": 95 }
  }
}

// Run finished
{
  "event": "run_end",
  "run": {
    "run_id": "019a4c8d-...",
    "status": "completed",
    "ended_at": "2026-05-29T10:01:04.000Z",
    "output": { "answer": "The weather in Paris is..." }
  }
}

// Error during run
{
  "event": "error",
  "error": { "message": "Agent endpoint returned 500", "span_id": "abc123" }
}
```

**Client → Server messages (same socket):**

```jsonc
// Cancel run
{ "action": "cancel" }
```

---

## Error Codes

| HTTP Status | Meaning |
|---|---|
| 400 | Invalid request body (Pydantic validation failure) |
| 404 | Agent or run not found |
| 409 | Agent name already exists; run already has an evaluation |
| 422 | Unprocessable entity (FastAPI default for bad params) |
| 503 | Agent endpoint unreachable (HTTP adapter) |