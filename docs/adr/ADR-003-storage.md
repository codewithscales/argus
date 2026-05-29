# ADR-003: Storage

**Date:** 2026-05-29  
**Status:** Accepted

## Context

Argus stores:
- Agent registry entries (small, infrequently written)
- Run records (one per agent invocation)
- Spans (potentially hundreds per run for complex agents)
- Evaluation annotations (one per run, optional)

Data is local to the developer's machine. There is no multi-user access, no replication requirement, and no need for horizontal scaling.

## Decision

Use **SQLite** via **aiosqlite** (async driver).

- Zero config — a single `.db` file, no server process
- aiosqlite wraps SQLite in an async executor, keeping the FastAPI event loop unblocked
- SQLite's WAL mode handles concurrent reads (WebSocket stream + REST queries) without locking issues
- Portable: the entire database is one file, easy to back up or inspect with any SQLite GUI

Schema migrations will be handled with **Alembic** from day one, even for SQLite, so the path to PostgreSQL is a driver swap if scale ever demands it.

## Consequences

**Positive:**
- No Docker dependency for local development
- `aiosqlite` + `aiofiles` keeps the entire backend async
- Simple to inspect raw data during debugging (DB Browser for SQLite, DBeaver)

**Negative:**
- SQLite's JSON query support (e.g., `json_extract`) is available but less ergonomic than PostgreSQL's `jsonb`; complex span attribute queries will be done in Python after a simple `SELECT`
- Concurrent writes from multiple simultaneous agent runs may queue slightly; not a real constraint for a personal tool

## Upgrade Path

Swapping to PostgreSQL requires only:
1. Changing the aiosqlite connection string to asyncpg
2. Running `alembic upgrade head` against the new DB
3. Replacing `json_extract` helpers with `jsonb` operators in any raw queries

No ORM lock-in — queries are written in plain SQL via aiosqlite, so migration is mechanical.

## Alternatives Considered

| Option | Reason rejected |
|---|---|
| PostgreSQL | Requires a running server; overkill for v1 |
| MongoDB (motor) | Schema-free is a liability for structured trace data; already used in Orion |
| TinyDB | Pure-Python, no SQL query capability |