"""Shared pytest fixtures for Argus backend tests."""

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.core.config import settings
from app.core.database import create_tables
from main import app


@pytest_asyncio.fixture
async def client(tmp_path):
    """
    Provide an AsyncClient wired to the ASGI app with an isolated SQLite database.

    A fresh database file is created under pytest's tmp_path for each test,
    preventing state leakage between tests.
    """
    db_file = str(tmp_path / "test_argus.db")
    settings.database_path = db_file

    await create_tables()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
