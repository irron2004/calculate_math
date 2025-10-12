import json
from pathlib import Path

import httpx
import pytest

from app import create_app
from app.config import get_settings
from app.dag_loader import reset_graph_cache
from app.problem_bank import reset_cache as reset_problem_cache
from app.progress_store import reset_progress_store
from app.template_engine import reset_engine as reset_template_engine

pytestmark = pytest.mark.asyncio


@pytest.fixture
def dag_app(tmp_path, monkeypatch):
    data_dir = tmp_path / "data"
    data_dir.mkdir()

    problems_path = data_dir / "problems.json"
    problems = [
        {
            "id": "sample-add-1",
            "category": "덧셈",
            "question": "1 + 2 = ?",
            "answer": 3,
        },
        {
            "id": "sample-sub-1",
            "category": "뺄셈",
            "question": "5 - 2 = ?",
            "answer": 3,
        },
    ]
    problems_path.write_text(
        json.dumps(problems, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    attempts_path = data_dir / "attempts.db"

    repo_root = Path(__file__).resolve().parent.parent
    dag_path = repo_root / "app" / "data" / "dag.json"
    progress_path = repo_root / "app" / "data" / "dag_progress.json"

    monkeypatch.setenv("PROBLEM_DATA_PATH", str(problems_path))
    monkeypatch.setenv("ATTEMPTS_DATABASE_PATH", str(attempts_path))
    monkeypatch.setenv("SESSION_TOKEN_SECRET", "test-secret")
    monkeypatch.setenv("DAG_DATA_PATH", str(dag_path))
    monkeypatch.setenv("DAG_PROGRESS_PATH", str(progress_path))

    get_settings.cache_clear()  # type: ignore[attr-defined]
    reset_problem_cache()
    reset_template_engine()
    reset_progress_store()
    reset_graph_cache()

    app = create_app()

    try:
        yield app
    finally:
        reset_problem_cache()
        reset_template_engine()
        reset_progress_store()
        reset_graph_cache()
        get_settings.cache_clear()  # type: ignore[attr-defined]


@pytest.fixture
async def client(dag_app):
    transport = httpx.ASGITransport(app=dag_app, lifespan="on")
    async with httpx.AsyncClient(
        transport=transport, base_url="http://testserver"
    ) as async_client:
        yield async_client


async def _login(client: httpx.AsyncClient) -> str:
    response = await client.post(
        "/api/v1/login",
        json={"nickname": "student01", "password": "secret"},
    )
    payload = response.json()
    return payload.get("session_token", "")


async def test_nodes_endpoint_returns_paginated_payload(client: httpx.AsyncClient) -> None:
    response = await client.get("/api/v1/dag/nodes", params={"page_size": 2})
    assert response.status_code == 200
    payload = response.json()
    assert payload["page"] == 1
    assert payload["page_size"] == 2
    assert payload["total"] >= len(payload["items"])
    assert "xp" in payload["meta"]
    assert "lrc" in payload["meta"]


async def test_nodes_filtering_by_type_and_lens(client: httpx.AsyncClient) -> None:
    response = await client.get(
        "/api/v1/dag/nodes",
        params={"type": "course_step", "lens": "transform"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["items"]
    for item in payload["items"]:
        assert item["type"] == "course_step"
        assert "transform" in item["lens"]


async def test_nodes_invalid_type_returns_validation_error(client: httpx.AsyncClient) -> None:
    response = await client.get("/api/v1/dag/nodes", params={"type": "invalid"})
    assert response.status_code == 422


async def test_edges_filtering_and_metadata(client: httpx.AsyncClient) -> None:
    response = await client.get(
        "/api/v1/dag/edges",
        params={"type": "requires", "source": "AS.MUL.POW10"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["items"]
    for item in payload["items"]:
        assert item["type"] == "requires"
        assert item["from"] == "AS.MUL.POW10"
    assert "xp" in payload["meta"]
    assert "lrc" in payload["meta"]


async def test_progress_requires_authentication(client: httpx.AsyncClient) -> None:
    response = await client.get("/api/v1/dag/progress")
    assert response.status_code == 401


async def test_progress_returns_snapshot_for_authenticated_user(
    client: httpx.AsyncClient,
) -> None:
    token = await _login(client)
    assert token

    response = await client.get(
        "/api/v1/dag/progress",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["user_id"] == "1"
    assert payload["nodes"]["C01-S1"]["lrc_status"] == "gold"
    assert "xp" in payload["meta"]
    assert "lrc" in payload["meta"]
