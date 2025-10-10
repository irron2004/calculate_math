from __future__ import annotations

import pytest

pytest_plugins = ["tests.test_curriculum"]
pytestmark = pytest.mark.asyncio


async def test_graph_current_exposes_palette(client) -> None:
    response = await client.get("/api/v1/graph/current")
    assert response.status_code == 200
    payload = response.json()
    assert "meta" in payload
    assert "nodes" in payload and len(payload["nodes"]) >= 30
    assert payload["meta"]["palette"]["difference"] == "#E4572E"


async def test_graph_home_copy_contains_tooltip(client) -> None:
    response = await client.get("/api/v1/graph/home-copy")
    assert response.status_code == 200
    payload = response.json()
    assert payload["version"] == "v0.1"
    assert payload["nodes"]["ALG-PR-S2"]["tooltip"].startswith("y=kx")


async def test_graph_user_endpoint_adds_user_metadata(client) -> None:
    user_id = "student-graph"
    response = await client.get(f"/api/v1/graph/user/{user_id}")
    assert response.status_code == 200
    payload = response.json()
    assert payload["meta"]["user"]["id"] == user_id
    nodes = payload["nodes"]
    assert len(nodes) >= 30
    assert all("mastery" in node for node in nodes)
    assert all("lrc" in node for node in nodes)
