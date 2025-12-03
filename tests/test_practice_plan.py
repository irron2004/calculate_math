import httpx
import pytest

from app import create_app
from app.bipartite_loader import reset_bipartite_graph_cache
from app.config import get_settings
from app.problem_bank import reset_cache as reset_problem_cache
from app.progress_store import reset_progress_store
from app.template_engine import reset_engine as reset_template_engine

pytestmark = pytest.mark.asyncio


@pytest.fixture
def skill_app(tmp_path, monkeypatch):
    attempts_path = tmp_path / "attempts.db"
    monkeypatch.setenv("ATTEMPTS_DATABASE_PATH", str(attempts_path))
    monkeypatch.setenv("SESSION_TOKEN_SECRET", "test-secret")

    get_settings.cache_clear()  # type: ignore[attr-defined]
    reset_problem_cache()
    reset_template_engine()
    reset_progress_store()
    reset_bipartite_graph_cache()

    app = create_app()

    try:
        yield app
    finally:
        reset_problem_cache()
        reset_template_engine()
        reset_progress_store()
        reset_bipartite_graph_cache()
        get_settings.cache_clear()  # type: ignore[attr-defined]


@pytest.fixture
async def client(skill_app):
    transport = httpx.ASGITransport(app=skill_app, lifespan="on")
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as async_client:
        yield async_client


async def test_practice_plan_exposes_session_metadata(client: httpx.AsyncClient) -> None:
    tree_response = await client.get("/api/v1/skills/tree")
    assert tree_response.status_code == 200
    tree_payload = tree_response.json()
    assert tree_payload["nodes"], "skill tree must include nodes"
    target_node = tree_payload["nodes"][0]

    plan_response = await client.get(f"/api/v1/skills/nodes/{target_node['id']}/practice-plan")
    assert plan_response.status_code == 200
    plan = plan_response.json()

    assert plan["node"]["id"] == target_node["id"]
    assert "practice_launch" in plan
    assert plan["practice_launch"]["course_step_id"] == target_node["id"]
    assert "tier_label" in plan["node"]
    assert isinstance(plan["prerequisites"], list)
    assert "prerequisite_summary" in plan


async def test_practice_plan_for_unknown_node_returns_404(client: httpx.AsyncClient) -> None:
    response = await client.get("/api/v1/skills/nodes/UNKNOWN-NODE/practice-plan")
    assert response.status_code == 404
