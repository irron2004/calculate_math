import json
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
    transport = httpx.ASGITransport(app=app)
    lifespan_context = getattr(app.router, "lifespan_context", None)

    if lifespan_context is None:
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as async_client:
            yield async_client
        return

    async with lifespan_context(app):
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
    graph = data["graph"]
    assert graph is not None
    assert isinstance(graph.get("nodes"), list)
    unlocked = data["unlocked"]
    assert isinstance(unlocked, dict)
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


async def test_skill_tree_groups_cover_curriculum_domains(client):
    response = await client.get("/api/v1/skills/tree")
    assert response.status_code == 200
    groups = {group["id"]: group for group in response.json()["groups"]}
    expected_ids = {"arithmetic", "fraction_ratio", "algebra_geo_stats"}
    assert expected_ids.issubset(groups.keys())
    assert set(groups["arithmetic"]["course_ids"]).issuperset({"C01", "C02", "C03", "C04"})
    assert set(groups["fraction_ratio"]["course_ids"]).issuperset({"C05", "C06"})
    assert set(groups["algebra_geo_stats"]["course_ids"]).issuperset({"C07", "C08", "C09", "C10", "C11", "C12"})


async def test_skill_tree_respects_existing_cookie(client):
    first = await client.get("/api/v1/skills/tree")
    first_variant = first.json()["experiment"]["variant"]
    second = await client.get("/api/v1/skills/tree")
    second_variant = second.json()["experiment"]["variant"]
    assert second_variant == first_variant


async def test_skill_tree_keeps_graph_when_progress_missing(monkeypatch, client):
    from app.routers import skills as skills_module

    def broken_progress_store(request):
        raise skills_module.ProgressDataError("missing dataset")

    monkeypatch.setattr(skills_module, "_resolve_progress_store", broken_progress_store)

    response = await client.get("/api/v1/skills/tree")
    assert response.status_code == 200
    payload = response.json()

    assert payload["graph"] is not None
    assert isinstance(payload["progress"]["nodes"], dict) and payload["progress"]["nodes"]
    assert payload.get("error", {}).get("kind") == "ProgressDataError"


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


async def test_skill_tree_returns_error_when_ui_graph_invalid(monkeypatch, tmp_path, client):
    from app.routers import skills as skills_module

    invalid_ui_path = tmp_path / "skills.ui.json"
    invalid_ui_path.write_text(json.dumps({"version": "invalid", "nodes": [], "edges": []}), encoding="utf-8")

    monkeypatch.setattr(skills_module, "_SKILL_UI_PATH", invalid_ui_path)
    skills_module._load_skill_ui_graph.cache_clear()

    response = await client.get("/api/v1/skills/tree")
    assert response.status_code == 200
    payload = response.json()
    assert payload["graph"] is None
    assert payload["error"]["kind"] == "SkillSpecError"

    skills_module._load_skill_ui_graph.cache_clear()


async def test_skill_tree_payload_aligns_with_ui_graph_and_progress(client):
    response = await client.get("/api/v1/skills/tree")
    assert response.status_code == 200
    payload = response.json()

    graph = payload["graph"]
    assert graph is not None
    assert isinstance(graph["version"], str) and graph["version"]
    assert isinstance(graph["nodes"], list) and graph["nodes"]
    assert isinstance(graph["edges"], list)

    graph_node_ids = {node["id"] for node in graph["nodes"]}
    unlocked_map = payload["unlocked"]
    assert isinstance(unlocked_map, dict) and unlocked_map

    progress_nodes = payload["progress"]["nodes"]
    assert isinstance(progress_nodes, dict) and progress_nodes

    for node in payload["nodes"]:
        node_id = node["id"]
        assert node_id in graph_node_ids
        assert node_id in unlocked_map
        node_state = node["state"]
        assert isinstance(node_state, dict)
        assert unlocked_map[node_id] == bool(node_state.get("completed") or node_state.get("available"))

        node_progress = progress_nodes[node_id]
        assert node_progress["unlocked"] == node_state.get("unlocked")
        assert node_progress["completed"] == node_state.get("completed")

