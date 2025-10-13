from pathlib import Path
import importlib
import sys

import httpx
import pytest

SERVICE_ROOT = Path(__file__).resolve().parents[1]

if str(SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(SERVICE_ROOT))

calculate_service_module = importlib.import_module("app")
create_app = calculate_service_module.create_app

pytestmark = pytest.mark.asyncio


@pytest.fixture(scope="session")
def app():
    return create_app()


@pytest.fixture
async def client(app):
    transport = httpx.ASGITransport(app=app, lifespan="on")
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as async_client:
        yield async_client


async def test_skill_tree_endpoint_returns_experiment_payload(client):
    response = await client.get("/api/v1/skills/tree")
    assert response.status_code == 200
    data = response.json()
    assert data["version"]
    assert isinstance(data["groups"], list) and data["groups"]
    assert isinstance(data["nodes"], list) and data["nodes"]
    assert isinstance(data["edges"], list)
    assert isinstance(data["skills"], list) and data["skills"]
    progress = data["progress"]
    assert progress["user_id"] is not None
    assert isinstance(progress["nodes"], dict)
    assert isinstance(progress["skills"], dict)
    first_node = data["nodes"][0]
    assert "requires" in first_node and "state" in first_node
    assert "session" in first_node
    assert first_node["state"]["value"] in {"locked", "available", "completed"}
    assert "experiment" in data
    experiment = data["experiment"]
    assert experiment["name"] == "skill_tree_layout"
    assert experiment["variant"] in {"tree", "list"}
    assert response.headers.get("X-Experiment-Skill-Tree-Layout") == experiment["variant"]
    cookie_value = response.cookies.get("exp_skill_tree_layout")
    assert cookie_value in {"tree", "list"}


async def test_skill_tree_respects_existing_cookie(client):
    first = await client.get("/api/v1/skills/tree")
    first_variant = first.json()["experiment"]["variant"]
    second = await client.get("/api/v1/skills/tree")
    second_variant = second.json()["experiment"]["variant"]
    assert second_variant == first_variant


async def test_skill_progress_update_mutates_snapshot(client):
    initial = await client.get("/api/v1/skills/tree")
    initial_data = initial.json()
    base_xp = initial_data["progress"]["nodes"].get("C01-S1", {}).get("xp_earned", 0)

    response = await client.post(
        "/api/v1/skills/progress",
        json={"course_step_id": "C01-S1", "user_id": "1", "correct": True},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["nodes"]["C01-S1"]["xp_earned"] >= base_xp + 10
    assert payload["skills"]["AS.PV.DECOMP"]["level"] >= 1
