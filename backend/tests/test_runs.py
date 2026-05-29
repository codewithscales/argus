"""Tests for /api/runs endpoints."""

import pytest
from httpx import AsyncClient


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _create_agent(client: AsyncClient, name: str = "test-agent") -> dict:
    resp = await client.post(
        "/api/agents",
        json={
            "name": name,
            "adapter": "http",
            "config": {"url": "http://localhost:9000/invoke"},
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _start_run(client: AsyncClient, agent_id: str, input_data: dict | None = None) -> dict:
    payload: dict = {"agent_id": agent_id}
    if input_data is not None:
        payload["input"] = input_data
    resp = await client.post("/api/runs", json=payload)
    assert resp.status_code == 202, resp.text
    return resp.json()


# ---------------------------------------------------------------------------
# POST /api/runs
# ---------------------------------------------------------------------------

async def test_start_run_returns_202_with_pending_status(client: AsyncClient):
    agent = await _create_agent(client, name="run-agent")

    resp = await client.post("/api/runs", json={"agent_id": agent["id"]})

    assert resp.status_code == 202
    body = resp.json()
    assert body["status"] == "pending"
    assert body["agent_id"] == agent["id"]
    assert "id" in body
    assert "started_at" in body
    assert body["output"] is None
    assert body["ended_at"] is None


async def test_start_run_with_input(client: AsyncClient):
    agent = await _create_agent(client, name="input-agent")
    input_data = {"query": "What is the capital of France?", "max_tokens": 256}

    resp = await client.post(
        "/api/runs",
        json={"agent_id": agent["id"], "input": input_data},
    )

    assert resp.status_code == 202
    body = resp.json()
    assert body["input"] == input_data


async def test_start_run_with_metadata(client: AsyncClient):
    agent = await _create_agent(client, name="meta-agent")

    resp = await client.post(
        "/api/runs",
        json={"agent_id": agent["id"], "metadata": {"env": "test", "version": "1.2.3"}},
    )

    assert resp.status_code == 202
    assert resp.json()["metadata"] == {"env": "test", "version": "1.2.3"}


async def test_start_run_nonexistent_agent_returns_404(client: AsyncClient):
    resp = await client.post("/api/runs", json={"agent_id": "non-existent-agent-id"})
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# GET /api/runs
# ---------------------------------------------------------------------------

async def test_list_runs_empty(client: AsyncClient):
    resp = await client.get("/api/runs")
    assert resp.status_code == 200
    assert resp.json() == []


async def test_list_runs_returns_all_runs(client: AsyncClient):
    agent = await _create_agent(client, name="list-runs-agent")
    await _start_run(client, agent["id"])
    await _start_run(client, agent["id"])

    resp = await client.get("/api/runs")
    assert resp.status_code == 200
    assert len(resp.json()) == 2


async def test_list_runs_filter_by_agent_id(client: AsyncClient):
    agent_a = await _create_agent(client, name="filter-agent-a")
    agent_b = await _create_agent(client, name="filter-agent-b")

    run_a = await _start_run(client, agent_a["id"])
    await _start_run(client, agent_b["id"])

    resp = await client.get("/api/runs", params={"agent_id": agent_a["id"]})
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 1
    assert body[0]["id"] == run_a["id"]
    assert body[0]["agent_id"] == agent_a["id"]


async def test_list_runs_filter_by_agent_id_returns_empty_for_other_agent(client: AsyncClient):
    agent_a = await _create_agent(client, name="solo-agent-a")
    agent_b = await _create_agent(client, name="solo-agent-b")
    await _start_run(client, agent_a["id"])

    resp = await client.get("/api/runs", params={"agent_id": agent_b["id"]})
    assert resp.status_code == 200
    assert resp.json() == []


async def test_list_runs_pagination(client: AsyncClient):
    agent = await _create_agent(client, name="page-agent")
    for _ in range(5):
        await _start_run(client, agent["id"])

    resp_page1 = await client.get("/api/runs", params={"limit": 3, "offset": 0})
    resp_page2 = await client.get("/api/runs", params={"limit": 3, "offset": 3})

    assert len(resp_page1.json()) == 3
    assert len(resp_page2.json()) == 2


# ---------------------------------------------------------------------------
# GET /api/runs/{id}
# ---------------------------------------------------------------------------

async def test_get_run_by_id_returns_200(client: AsyncClient):
    agent = await _create_agent(client, name="get-run-agent")
    run = await _start_run(client, agent["id"])

    resp = await client.get(f"/api/runs/{run['id']}")
    assert resp.status_code == 200
    assert resp.json()["id"] == run["id"]


async def test_get_run_nonexistent_returns_404(client: AsyncClient):
    resp = await client.get("/api/runs/no-such-run")
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# DELETE /api/runs/{id}
# ---------------------------------------------------------------------------

async def test_delete_run_returns_204(client: AsyncClient):
    agent = await _create_agent(client, name="del-run-agent")
    run = await _start_run(client, agent["id"])

    resp = await client.delete(f"/api/runs/{run['id']}")
    assert resp.status_code == 204


async def test_delete_run_no_longer_found(client: AsyncClient):
    agent = await _create_agent(client, name="gone-run-agent")
    run = await _start_run(client, agent["id"])
    run_id = run["id"]

    await client.delete(f"/api/runs/{run_id}")

    resp = await client.get(f"/api/runs/{run_id}")
    assert resp.status_code == 404


async def test_delete_nonexistent_run_returns_404(client: AsyncClient):
    resp = await client.delete("/api/runs/ghost-run-id")
    assert resp.status_code == 404


async def test_delete_run_removed_from_list(client: AsyncClient):
    agent = await _create_agent(client, name="list-del-agent")
    run1 = await _start_run(client, agent["id"])
    run2 = await _start_run(client, agent["id"])

    await client.delete(f"/api/runs/{run1['id']}")

    resp = await client.get("/api/runs")
    ids = [r["id"] for r in resp.json()]
    assert run1["id"] not in ids
    assert run2["id"] in ids


# ---------------------------------------------------------------------------
# GET /api/runs/{id}/spans
# ---------------------------------------------------------------------------

async def test_get_spans_empty_for_fresh_run(client: AsyncClient):
    agent = await _create_agent(client, name="spans-agent")
    run = await _start_run(client, agent["id"])

    resp = await client.get(f"/api/runs/{run['id']}/spans")
    assert resp.status_code == 200
    assert resp.json() == []


async def test_get_spans_nonexistent_run_returns_404(client: AsyncClient):
    resp = await client.get("/api/runs/no-run-here/spans")
    assert resp.status_code == 404
