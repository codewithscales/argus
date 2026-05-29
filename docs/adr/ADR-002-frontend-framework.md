# ADR-002: Frontend Framework

**Date:** 2026-05-29  
**Status:** Accepted

## Context

The frontend needs to:
- Render a minimal but information-dense UI for running agents and inspecting traces
- Display a live-updating flow graph as spans stream in over WebSocket
- Provide a span inspector side panel with raw JSON and formatted views
- Support session history browsing and run comparison

The project is a personal tool — no enterprise design system requirement, no SSR requirement.

## Decision

Use **React 19 + TypeScript + Vite**.

- **React 19**: concurrent rendering helps keep the flow graph responsive while new spans stream in
- **TypeScript**: strong types for span/trace data structures prevent a class of UI bugs; consistent with SVDS TaskManager
- **Vite**: fast HMR, simple config, no CRA baggage
- **No component library**: use Tailwind CSS for styling — avoids pulling in a heavy design system for a tool UI

## Consequences

**Positive:**
- Familiar stack, fast iteration
- TypeScript models for `Span`, `Run`, `Agent` will mirror the Pydantic backend schemas closely
- Vite proxy config handles CORS-free local dev against the FastAPI backend

**Negative:**
- No pre-built data grid components — the span list will need a lightweight custom implementation or a small library (e.g., TanStack Table)
- React 19 concurrent features are new; suspense boundaries need care around WebSocket state

## Alternatives Considered

| Option | Reason rejected |
|---|---|
| Next.js | SSR unnecessary; adds deployment complexity for a local tool |
| SvelteKit | Unfamiliar; no leverage from existing projects |
| Vue 3 | No existing project baseline in this workspace |