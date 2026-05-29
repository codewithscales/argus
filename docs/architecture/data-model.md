# Argus — Data Model

## Entity Relationship

```
agents ──< runs ──< spans
               └──< evaluations
```

## Schema (SQLite)

### `agents`

Stores registered agent configurations.

```sql
CREATE TABLE agents (
    id          TEXT PRIMARY KEY,          -- UUID v4
    name        TEXT NOT NULL UNIQUE,
    description TEXT,
    adapter     TEXT NOT NULL,             -- 'http' | 'python' | 'claude'
    config      TEXT NOT NULL,             -- JSON: adapter-specific config
    created_at  TEXT NOT NULL,             -- ISO 8601
    updated_at  TEXT NOT NULL
);
```

**`config` shape by adapter:**

```jsonc
// adapter = "http"
{ "url": "http://localhost:9000/invoke", "method": "POST", "headers": {}, "timeout_s": 60 }

// adapter = "python"
{ "module": "my_agent.agent", "callable": "run_agent" }

// adapter = "claude"
{ "model": "claude-sonnet-4-6", "system_prompt": "...", "tools": [] }
```

---

### `runs`

One record per agent invocation.

```sql
CREATE TABLE runs (
    id          TEXT PRIMARY KEY,          -- UUID v4
    agent_id    TEXT NOT NULL REFERENCES agents(id),
    status      TEXT NOT NULL,             -- 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
    input       TEXT NOT NULL,             -- JSON: the input sent to the agent
    output      TEXT,                      -- JSON: final agent response (null until completed)
    started_at  TEXT NOT NULL,
    ended_at    TEXT,
    metadata    TEXT                       -- JSON: arbitrary key-value pairs set by caller
);

CREATE INDEX idx_runs_agent_id ON runs(agent_id);
CREATE INDEX idx_runs_status   ON runs(status);
CREATE INDEX idx_runs_started  ON runs(started_at DESC);
```

---

### `spans`

One record per OTel span. Mirrors the OTel data model.

```sql
CREATE TABLE spans (
    id              TEXT PRIMARY KEY,      -- internal UUID (not span_id)
    run_id          TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    span_id         TEXT NOT NULL,         -- OTel 16-char hex span ID
    trace_id        TEXT NOT NULL,         -- OTel 32-char hex trace ID
    parent_span_id  TEXT,                  -- null for root span
    name            TEXT NOT NULL,
    kind            TEXT NOT NULL,         -- 'llm' | 'tool' | 'agent' | 'retrieval' | 'custom'
    start_time      TEXT NOT NULL,         -- ISO 8601 with microseconds
    end_time        TEXT,                  -- null if span still running
    status_code     TEXT NOT NULL DEFAULT 'UNSET',  -- 'OK' | 'ERROR' | 'UNSET'
    status_message  TEXT,
    attributes      TEXT NOT NULL DEFAULT '{}',     -- JSON: OTel attributes + argus.* attrs
    events          TEXT NOT NULL DEFAULT '[]',     -- JSON array of OTel span events
    UNIQUE(run_id, span_id)
);

CREATE INDEX idx_spans_run_id        ON spans(run_id);
CREATE INDEX idx_spans_parent        ON spans(parent_span_id);
CREATE INDEX idx_spans_start_time    ON spans(start_time);
```

**Key `attributes` fields (by kind):**

```jsonc
// kind = "llm"
{
  "llm.model": "claude-sonnet-4-6",
  "llm.input_tokens": 512,
  "llm.output_tokens": 128,
  "llm.total_tokens": 640,
  "llm.temperature": 0.7,
  "argus.run_id": "<run_id>"
}

// kind = "tool"
{
  "tool.name": "search_web",
  "tool.input": "{ ... }",
  "tool.output": "{ ... }",
  "argus.run_id": "<run_id>"
}
```

---

### `evaluations`

Human-annotated quality scores per run.

```sql
CREATE TABLE evaluations (
    id          TEXT PRIMARY KEY,
    run_id      TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE UNIQUE,
    score       REAL,                      -- 0.0 – 1.0, null if not scored
    label       TEXT,                      -- 'pass' | 'fail' | 'partial'
    notes       TEXT,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);
```

---

## Derived / Computed Values

These are not stored; computed at query time or in the service layer:

| Value | How |
|---|---|
| Run duration | `ended_at - started_at` |
| Total token usage per run | `SUM(json_extract(attributes,'$.llm.total_tokens'))` over spans where `kind='llm'` |
| Span depth | Walk `parent_span_id` chain |
| Span tree (for ReactFlow) | Recursive query or Python tree construction from flat span list |

---

## Migrations

Alembic manages schema versions. Migration files live in `backend/migrations/versions/`.

Initial migration: `0001_initial_schema.py` — creates all four tables above.

Convention: one migration per structural change (no "fix typo in column" migrations).