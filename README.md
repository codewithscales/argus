# Argus

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/python-3.12%2B-blue.svg)](https://www.python.org/)
[![Node](https://img.shields.io/badge/node-18%2B-green.svg)](https://nodejs.org/)
[![Backend tests](https://img.shields.io/badge/backend%20tests-46%20passed-brightgreen.svg)](#)
[![Frontend tests](https://img.shields.io/badge/frontend%20tests-64%20passed-brightgreen.svg)](#)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/codewithscales/argus/pulls)

A self-hosted agent test bench. Inspect execution traces, visualize decision flows, and iterate on agent behavior — for any agent framework.

## What it does

- Run any HTTP-based or Python-callable agent from a minimal UI
- Stream execution traces in real time as the agent runs
- Visualize the execution as an interactive flow graph
- Inspect every span: inputs, outputs, token counts, latency
- Record runs and diff them against each other

## Getting Started

### Prerequisites

- Python 3.12+
- Node.js 18+

### 1. Start the backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -e .
uvicorn main:app --reload
```

The API is now available at `http://localhost:8000`.

### 2. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## Using Argus

### Register an agent

Go to the **Agents** page and click **New Agent**. Fill in a name, choose an adapter, and provide the config JSON for that adapter (see adapter details below).

### Trigger a run

Go to the **Runs** page, select an agent, and provide the input JSON. Argus forwards the input to your agent and streams spans back in real time.

### Inspect traces

Click any run to open the flow graph. Each node is a span — click it to see attributes, token counts, and timing.

---

## Adapter Reference

### HTTP adapter

Calls any agent exposed as an HTTP endpoint.

**Agent config:**
```json
{
  "url": "https://your-agent/invoke",
  "timeout_s": 60,
  "method": "POST",
  "headers": {
    "Authorization": "Bearer <token>",
    "Content-Type": "application/json"
  }
}
```

| Field | Required | Default | Description |
|---|---|---|---|
| `url` | yes | — | Agent endpoint URL |
| `timeout_s` | no | `60` | Request timeout in seconds |
| `method` | no | `POST` | HTTP method |
| `headers` | no | `{}` | Extra request headers (use for auth tokens, API keys, etc.) |

**Run input** — any JSON object you want forwarded to the agent:
```json
{
  "prompt": "summarise the latest report",
  "session_id": "abc-123",
  "max_results": 5
}
```

Argus merges a `run_id` field into the body before sending:
```json
{
  "run_id": "<argus-run-id>",
  "prompt": "summarise the latest report",
  "session_id": "abc-123",
  ...
}
```

### Python adapter

Calls a Python function in the same process as the backend.

**Agent config:**
```json
{
  "module": "my_agent",
  "callable": "run"
}
```

The callable must have the signature:
```python
def run(run_id: str, input: dict) -> dict:
    ...
```

Async functions are supported too.

### Claude adapter

Calls Claude directly (single-turn). Requires `ANTHROPIC_API_KEY` in the environment.

**Agent config:**
```json
{
  "model": "claude-sonnet-4-6",
  "system_prompt": "You are a helpful assistant.",
  "max_tokens": 1024
}
```

**Run input:**
```json
{
  "message": "Your prompt here"
}
```

---

## Sending spans from your agent (HTTP adapter)

Argus does **not** auto-generate spans for HTTP agents — your agent must emit them via OpenTelemetry.

### 1. Configure your OTel exporter to point at Argus

```bash
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:8000
OTEL_EXPORTER_OTLP_PROTOCOL=http/json
```

### 2. Tag every span with `argus.run_id`

Argus uses this attribute to associate spans with a run. The `run_id` is passed in the request body by Argus — read it and attach it as a span attribute:

```python
from opentelemetry import trace

tracer = trace.get_tracer(__name__)

def handle_request(body: dict):
    run_id = body["run_id"]  # injected by Argus

    with tracer.start_as_current_span("my-span") as span:
        span.set_attribute("argus.run_id", run_id)
        # ... your agent logic
```

You can also set it as a **resource attribute** to apply it to all spans automatically:

```python
from opentelemetry.sdk.resources import Resource

resource = Resource(attributes={"argus.run_id": run_id})
```

### Span kind inference

Argus infers the span kind from attributes — no manual tagging needed if you use standard OTel semantic conventions:

| Attribute present | Inferred kind |
|---|---|
| `gen_ai.system`, `gen_ai.request.model`, `llm.model` | `llm` |
| `tool.name` | `tool` |
| `db.system` | `retrieval` |
| `argus.kind` | value of the attribute (`llm`, `tool`, `agent`, `retrieval`, `custom`) |

---

## Design Documents

- [`docs/architecture/overview.md`](docs/architecture/overview.md) — system components and data flow
- [`docs/architecture/data-model.md`](docs/architecture/data-model.md) — SQLite schema
- [`docs/architecture/api-design.md`](docs/architecture/api-design.md) — REST + WebSocket API
- [`docs/architecture/adapter-pattern.md`](docs/architecture/adapter-pattern.md) — agent adapter abstraction
- [`docs/adr/`](docs/adr/) — Architecture Decision Records

## Stack

| Layer | Choice |
|---|---|
| Backend | Python 3.12, FastAPI, aiosqlite |
| Frontend | React 19, TypeScript, Vite, react-flow |
| Tracing | OpenTelemetry (OTLP ingest) + argus-sdk |
| Transport | WebSockets (real-time span streaming) |
| Storage | SQLite |