"""Tests for /api/agents CRUD endpoints."""

import pytest
from httpx import AsyncClient


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _agent_payload(
    name: str = "echo-agent",
    adapter: str = "http",
    config: dict | None = None,
    description: str | None = None,
) -> dict:
    if config is None:
        config = {"url": "http://localhost:9000/invoke"}
    payload: dict = {"name": name, "adapter": adapter, "config": config}
    if description is not None:
        payload["description"] = description
    return payload


async def _create_agent(client: AsyncClient, **kwargs) -> dict:
    resp = await client.post("/api/agents", json=_agent_payload(**kwargs))
    assert resp.status_code == 201, resp.text
    return resp.json()


# ---------------------------------------------------------------------------
# POST /api/agents
# ---------------------------------------------------------------------------

async def test_create_agent_returns_201(client: AsyncClient):
    payload = _agent_payload(
        name="summariser",
        adapter="http",
        config={"url": "http://localhost:9000/summarise"},
        description="Summarises documents",
    )
    resp = await client.post("/api/agents", json=payload)

    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "summariser"
    assert body["adapter"] == "http"
    assert body["config"] == {"url": "http://localhost:9000/summarise"}
    assert body["description"] == "Summarises documents"
    assert "id" in body
    assert "created_at" in body
    assert "updated_at" in body


async def test_create_agent_minimal_config(client: AsyncClient):
    """Only required fields — no description."""
    resp = await client.post(
        "/api/agents",
        json={"name": "minimal-agent", "adapter": "http", "config": {"url": "http://localhost:9000/run"}},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["description"] is None


async def test_create_agent_duplicate_name_returns_409(client: AsyncClient):
    await _create_agent(client, name="dupe-agent")
    resp = await client.post("/api/agents", json=_agent_payload(name="dupe-agent"))
    assert resp.status_code == 409


async def test_create_agent_invalid_adapter_returns_400(client: AsyncClient):
    """http adapter requires a 'url' key; omitting it triggers 400."""
    resp = await client.post(
        "/api/agents",
        json={"name": "bad-agent", "adapter": "http", "config": {}},
    )
    assert resp.status_code == 400


async def test_create_agent_unknown_adapter_returns_422(client: AsyncClient):
    """Unrecognised adapter value is rejected by Pydantic validation."""
    resp = await client.post(
        "/api/agents",
        json={"name": "unknown-adapter-agent", "adapter": "ftp", "config": {}},
    )
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# GET /api/agents
# ---------------------------------------------------------------------------

async def test_list_agents_empty(client: AsyncClient):
    resp = await client.get("/api/agents")
    assert resp.status_code == 200
    assert resp.json() == []


async def test_list_agents_returns_created_agents(client: AsyncClient):
    await _create_agent(client, name="agent-alpha")
    await _create_agent(client, name="agent-beta")

    resp = await client.get("/api/agents")
    assert resp.status_code == 200
    names = {a["name"] for a in resp.json()}
    assert {"agent-alpha", "agent-beta"} == names


# ---------------------------------------------------------------------------
# GET /api/agents/{id}
# ---------------------------------------------------------------------------

async def test_get_agent_by_id_returns_200(client: AsyncClient):
    created = await _create_agent(client, name="get-by-id-agent")
    agent_id = created["id"]

    resp = await client.get(f"/api/agents/{agent_id}")
    assert resp.status_code == 200
    assert resp.json()["id"] == agent_id
    assert resp.json()["name"] == "get-by-id-agent"


async def test_get_agent_nonexistent_returns_404(client: AsyncClient):
    resp = await client.get("/api/agents/does-not-exist")
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# PUT /api/agents/{id}
# ---------------------------------------------------------------------------

async def test_update_agent_name_returns_200(client: AsyncClient):
    created = await _create_agent(client, name="old-name")
    agent_id = created["id"]

    resp = await client.put(f"/api/agents/{agent_id}", json={"name": "new-name"})
    assert resp.status_code == 200
    assert resp.json()["name"] == "new-name"
    # id and adapter are unchanged
    assert resp.json()["id"] == agent_id
    assert resp.json()["adapter"] == "http"


async def test_update_agent_config_returns_200(client: AsyncClient):
    created = await _create_agent(client, name="cfg-agent")
    agent_id = created["id"]

    new_config = {"url": "http://localhost:9001/invoke", "timeout_s": 30}
    resp = await client.put(f"/api/agents/{agent_id}", json={"config": new_config})
    assert resp.status_code == 200
    assert resp.json()["config"] == new_config


async def test_update_agent_nonexistent_returns_404(client: AsyncClient):
    resp = await client.put("/api/agents/ghost-id", json={"name": "ghost"})
    assert resp.status_code == 404


async def test_update_agent_name_conflict_returns_409(client: AsyncClient):
    await _create_agent(client, name="taken-name")
    agent2 = await _create_agent(client, name="other-name")

    resp = await client.put(f"/api/agents/{agent2['id']}", json={"name": "taken-name"})
    assert resp.status_code == 409


# ---------------------------------------------------------------------------
# DELETE /api/agents/{id}
# ---------------------------------------------------------------------------

async def test_delete_agent_returns_204(client: AsyncClient):
    created = await _create_agent(client, name="to-delete")
    agent_id = created["id"]

    resp = await client.delete(f"/api/agents/{agent_id}")
    assert resp.status_code == 204


async def test_delete_agent_double_delete_returns_404(client: AsyncClient):
    created = await _create_agent(client, name="double-delete-agent")
    agent_id = created["id"]

    first = await client.delete(f"/api/agents/{agent_id}")
    assert first.status_code == 204

    second = await client.delete(f"/api/agents/{agent_id}")
    assert second.status_code == 404


async def test_delete_agent_no_longer_in_list(client: AsyncClient):
    created = await _create_agent(client, name="vanishing-agent")
    agent_id = created["id"]

    await client.delete(f"/api/agents/{agent_id}")

    resp = await client.get("/api/agents")
    ids = [a["id"] for a in resp.json()]
    assert agent_id not in ids
