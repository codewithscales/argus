# ADR-004: Tracing Protocol

**Date:** 2026-05-29  
**Status:** Accepted

## Context

Argus must capture execution traces from agents. Three categories of agents need to work:

1. **Already-instrumented agents** — frameworks like LangChain, LlamaIndex, and CrewAI already emit OpenTelemetry spans
2. **Custom Python agents** — user-written code with no existing instrumentation
3. **HTTP agents** — black-box endpoints; Argus wraps the call and creates a root span itself

The tracing strategy must handle all three without requiring the user to rewrite their agent.

## Decision

Adopt a **dual-path tracing strategy**:

### Path A — OTLP HTTP Ingest
Run an OTLP-compatible HTTP endpoint at `/v1/traces` on the Argus backend. Any OTel-instrumented agent can point its `OTEL_EXPORTER_OTLP_ENDPOINT` at Argus and spans will arrive automatically. This covers already-instrumented frameworks with zero code changes in the agent.

### Path B — argus-sdk (Python)
Ship a thin Python package (`argus-sdk`) that provides:
- A `@argus.trace(run_id)` decorator to wrap any async/sync Python callable
- A context manager `with argus.span("name", attributes={...})` for manual sub-spans
- Auto-propagation of the `run_id` via context var so child spans self-associate

The SDK creates OTel spans internally and forwards them to the Argus backend via the same OTLP ingest path — so the storage layer only ever sees one span format.

### Span correlation
Both paths must tag spans with a `argus.run_id` attribute. For OTLP ingest, the user sets this as a resource attribute. For the SDK, it's injected automatically.

## Wire Format

OTLP HTTP JSON (`application/json`) for simplicity. Binary protobuf is not needed for a local tool and JSON is human-readable during debugging.

## Consequences

**Positive:**
- Existing LangChain/CrewAI/LlamaIndex agents work with a single env var change
- Custom agents get rich tracing with 2–3 lines of SDK code
- Single storage model: every span, regardless of source, is stored identically

**Negative:**
- Maintaining the SDK as a separate package adds overhead; version it with the backend in a monorepo `packages/argus-sdk/`
- OTLP HTTP JSON is verbose; for agents that emit thousands of spans per run, payload size may grow. Acceptable for a local tool; can switch to protobuf if needed

## Alternatives Considered

| Option | Reason rejected |
|---|---|
| Custom JSON trace format | No ecosystem compatibility; can't reuse OTel instrumentation libraries |
| Jaeger as trace backend | Jaeger is a full distributed tracing system; too heavy, misaligned with Argus's scope |
| LangSmith SDK only | Proprietary, LangChain-specific |