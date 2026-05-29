from contextlib import asynccontextmanager
from typing import AsyncGenerator

import aiosqlite

from app.core.config import settings

_DDL = """
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS agents (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    description TEXT,
    adapter     TEXT NOT NULL,
    config      TEXT NOT NULL DEFAULT '{}',
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS runs (
    id          TEXT PRIMARY KEY,
    agent_id    TEXT NOT NULL REFERENCES agents(id),
    status      TEXT NOT NULL DEFAULT 'pending',
    input       TEXT NOT NULL DEFAULT '{}',
    output      TEXT,
    started_at  TEXT NOT NULL,
    ended_at    TEXT,
    metadata    TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_runs_agent_id ON runs(agent_id);
CREATE INDEX IF NOT EXISTS idx_runs_status   ON runs(status);
CREATE INDEX IF NOT EXISTS idx_runs_started  ON runs(started_at DESC);

CREATE TABLE IF NOT EXISTS spans (
    id              TEXT PRIMARY KEY,
    run_id          TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    span_id         TEXT NOT NULL,
    trace_id        TEXT NOT NULL,
    parent_span_id  TEXT,
    name            TEXT NOT NULL,
    kind            TEXT NOT NULL DEFAULT 'custom',
    start_time      TEXT NOT NULL,
    end_time        TEXT,
    status_code     TEXT NOT NULL DEFAULT 'UNSET',
    status_message  TEXT,
    attributes      TEXT NOT NULL DEFAULT '{}',
    events          TEXT NOT NULL DEFAULT '[]',
    UNIQUE(run_id, span_id)
);

CREATE INDEX IF NOT EXISTS idx_spans_run_id     ON spans(run_id);
CREATE INDEX IF NOT EXISTS idx_spans_parent     ON spans(parent_span_id);
CREATE INDEX IF NOT EXISTS idx_spans_start_time ON spans(start_time);

CREATE TABLE IF NOT EXISTS evaluations (
    id          TEXT PRIMARY KEY,
    run_id      TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE UNIQUE,
    score       REAL,
    label       TEXT,
    notes       TEXT,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);
"""


async def create_tables() -> None:
    async with aiosqlite.connect(settings.database_path) as db:
        await db.executescript(_DDL)
        await db.commit()


@asynccontextmanager
async def get_db() -> AsyncGenerator[aiosqlite.Connection, None]:
    async with aiosqlite.connect(settings.database_path) as db:
        db.row_factory = aiosqlite.Row
        await db.execute("PRAGMA journal_mode=WAL")
        await db.execute("PRAGMA foreign_keys=ON")
        yield db


async def db_dep() -> AsyncGenerator[aiosqlite.Connection, None]:
    async with get_db() as db:
        yield db