# ADR-006: Real-time Span Transport

**Date:** 2026-05-29  
**Status:** Accepted

## Context

As an agent runs, spans are created and completed asynchronously. The UI should show each span appearing in the flow graph as it happens — not after the entire run completes. This requires a push-based transport from backend to frontend.

## Decision

Use **native WebSockets** via FastAPI's `WebSocket` support.

Each agent run gets a dedicated WebSocket endpoint at `/ws/runs/{run_id}`. The frontend connects before (or immediately after) triggering the run, and the backend pushes span events as JSON messages.

### Message protocol

```json
{ "event": "span_start",  "span": { "span_id": "...", "parent_span_id": "...", "name": "...", "kind": "llm", "start_time": "..." } }
{ "event": "span_end",    "span": { "span_id": "...", "end_time": "...", "status": "ok", "attributes": {} } }
{ "event": "run_end",     "run":  { "run_id": "...", "status": "completed", "ended_at": "..." } }
{ "event": "error",       "error": { "message": "..." } }
```

### Fan-out mechanism

The backend maintains an in-process `dict[run_id, list[asyncio.Queue]]`. When a span arrives (either from OTLP ingest or the SDK), it's placed on all queues for that run_id. Each active WebSocket connection drains its own queue. This supports multiple browser tabs watching the same run with no extra infrastructure.

### Reconnection

The frontend tracks the last received span index. On reconnect it calls `GET /api/runs/{run_id}/spans` to backfill all spans to date, then re-opens the WebSocket to catch new ones. This means no spans are lost on transient disconnects.

## Consequences

**Positive:**
- No additional library or server (no Redis, no Socket.io)
- Full-duplex: frontend can send control messages (e.g., cancel run) over the same socket
- Works in all modern browsers without polyfills

**Negative:**
- In-process queue dict means run state is lost on server restart; acceptable since runs are also persisted to SQLite and backfill covers it
- Does not scale beyond a single process; acceptable for a personal tool

## Alternatives Considered

| Option | Reason rejected |
|---|---|
| Server-Sent Events (SSE) | Unidirectional only; can't send cancel/control messages |
| Socket.io | Adds a JS library dependency; native WS is sufficient |
| Long polling | High latency between span events; poor UX for live graph updates |
| Redis pub/sub | Requires a Redis server; unnecessary complexity for single-user local tool |