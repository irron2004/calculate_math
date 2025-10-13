from __future__ import annotations

import importlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import httpx
import pytest

SERVICE_ROOT = Path(__file__).resolve().parents[1]

if str(SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(SERVICE_ROOT))

# NOTE: Telemetry exporters are validated in integration smoke tests. These
# tests focus on ensuring middleware behaviour remains backwards compatible.


def _load_module(module_path: str):
    return importlib.import_module(module_path)


calculate_service_module = _load_module("app")
problem_bank_module = _load_module("app.problem_bank")
config_module = _load_module("app.config")
repositories_module = _load_module("app.repositories")
progress_store_module = _load_module("app.progress_store")
create_app = calculate_service_module.create_app
list_categories = problem_bank_module.list_categories
reset_problem_cache = problem_bank_module.reset_cache
get_settings = config_module.get_settings
AttemptRepository = repositories_module.AttemptRepository
SessionRepository = repositories_module.SessionRepository
template_engine_module = _load_module("app.template_engine")
reset_template_engine = template_engine_module.reset_engine
reset_progress_store = progress_store_module.reset_progress_store

pytestmark = pytest.mark.asyncio


@pytest.fixture
def dataset(tmp_path, monkeypatch):
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    problems_path = data_dir / "problems.json"
    attempts_path = data_dir / "attempts.db"
    progress_path = data_dir / "dag_progress.json"
    sample_problems = [
        {
            "id": "sample-add-1",
            "category": "덧셈",
            "question": "10 + 5 = ?",
            "answer": 15,
        },
        {
            "id": "sample-sub-1",
            "category": "뺄셈",
            "question": "10 - 3 = ?",
            "answer": 7,
        },
        {
            "id": "sample-add-2",
            "category": "덧셈",
            "question": "20 + 10 = ?",
            "answer": 30,
        },
    ]
    problems_path.write_text(
        json.dumps(sample_problems, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    progress_payload = {
        "meta": {
            "xp": {"daily_target": 5},
        },
        "users": [
            {
                "user_id": "1",
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "total_xp": 120,
                "nodes": {
                    "ALG-AP-S1": {
                        "unlocked": True,
                        "completed": True,
                    },
                    "ALG-AP-S2": {
                        "unlocked": True,
                        "completed": False,
                    },
                },
                "skills": {
                    "addition": {
                        "level": 2,
                        "xp": 40,
                    }
                },
            }
        ],
    }
    progress_path.write_text(
        json.dumps(progress_payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    monkeypatch.setenv("PROBLEM_DATA_PATH", str(problems_path))
    monkeypatch.setenv("ATTEMPTS_DATABASE_PATH", str(attempts_path))
    monkeypatch.setenv("SESSION_TOKEN_SECRET", "integration-secret")
    monkeypatch.setenv("DAG_PROGRESS_PATH", str(progress_path))

    get_settings.cache_clear()  # type: ignore[attr-defined]
    reset_problem_cache()
    reset_template_engine()
    reset_progress_store()

    try:
        yield {
            "problems_path": problems_path,
            "attempts_path": attempts_path,
            "problems": sample_problems,
            "progress_path": progress_path,
            "progress_payload": progress_payload,
        }
    finally:
        reset_problem_cache()
        reset_template_engine()
        get_settings.cache_clear()  # type: ignore[attr-defined]
        reset_progress_store()


@pytest.fixture
def app(dataset):
    return create_app()


@pytest.fixture
async def client(app):
    transport = httpx.ASGITransport(app=app, lifespan="on")
    async with httpx.AsyncClient(
        transport=transport, base_url="http://testserver"
    ) as async_client:
        yield async_client


async def _login_and_get_token(
    client: httpx.AsyncClient, nickname: str = "student01", password: str = "secret"
) -> tuple[str, httpx.Response]:
    response = await client.post(
        "/api/v1/login",
        json={"nickname": nickname, "password": password},
    )
    payload = response.json()
    return payload.get("session_token", ""), response


async def test_health_endpoint_returns_status(client) -> None:
    response = await client.get("/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "healthy"
    assert "version" in payload
    assert "details" in payload
    assert "dependencies" in payload["details"]


async def test_healthz_endpoint_reports_dependencies(client) -> None:
    response = await client.get("/healthz")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "healthy"
    dependencies = payload["details"]["dependencies"]
    assert dependencies["jinja2"]["status"] == "ok"


async def test_readyz_endpoint_reports_readiness(client) -> None:
    response = await client.get("/readyz")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ready"
    readiness = payload["details"]["readiness"]
    assert readiness["templates"]["status"] == "ok"
    assert readiness["problem_bank"]["status"] == "ok"


async def test_default_problem_category_is_returned(client) -> None:
    response = await client.get("/api/problems")
    assert response.status_code == 200
    body = response.json()
    assert body["category"] == list_categories()[0]
    assert body["total"] == len(body["items"])
    assert body["operation"] in {"add", "sub", "mul", "div"}
    assert 1 <= body["digits"] <= 4
    assert body["seed"] is None
    for item in body["items"]:
        assert "id" in item
        assert "question" in item
        assert "answer" not in item


async def test_invalid_category_returns_problem_detail(client) -> None:
    response = await client.get("/api/problems", params={"category": "INVALID"})
    assert response.status_code == 404
    body = response.json()
    assert body["type"].endswith("invalid-category")
    assert body["status"] == 404


async def test_generate_endpoint_is_deterministic_with_seed(client) -> None:
    params = {"op": "add", "digits": 2, "count": 3, "seed": 42, "reveal_answers": True}
    first = await client.get("/api/problems/generate", params=params)
    second = await client.get("/api/problems/generate", params=params)
    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["items"] == second.json()["items"]


async def test_generated_problem_attempt_is_scored(client) -> None:
    response = await client.get(
        "/api/problems/generate",
        params={"op": "sub", "digits": 2, "count": 1, "seed": 11, "reveal_answers": True},
    )
    assert response.status_code == 200
    payload = response.json()
    problem = payload["items"][0]
    answer = problem["answer"]

    attempt = await client.post(
        f"/api/problems/{problem['id']}/attempts",
        json={"answer": answer},
    )
    assert attempt.status_code == 201
    attempt_payload = attempt.json()
    assert attempt_payload["is_correct"] is True
    assert attempt_payload["correct_answer"] == answer
    assert attempt_payload["category"] == "뺄셈"


async def test_problem_listing_can_expose_answers_for_staff(client) -> None:
    response = await client.get("/api/problems", params={"reveal_answers": True})
    assert response.status_code == 200
    payload = response.json()
    assert payload["items"]
    assert "answer" in payload["items"][0]


async def test_request_id_is_preserved(client) -> None:
    """RequestContextMiddleware should echo back caller provided IDs."""

    request_id = "test-request-id"
    response = await client.get(
        "/api/problems", headers={"X-Request-ID": request_id}
    )
    assert response.status_code == 200
    assert response.headers["X-Request-ID"] == request_id


async def test_html_routes_emit_noindex_header(client) -> None:
    response = await client.get("/problems")
    assert response.status_code == 200
    assert response.headers["X-Robots-Tag"] == "noindex"


async def test_skills_page_renders_and_is_hidden_from_indexing(client) -> None:
    response = await client.get("/skills")
    assert response.status_code == 200
    assert response.headers["X-Robots-Tag"] == "noindex"
    assert "스킬 트리" in response.text


def test_submit_correct_attempt_records_success(client, dataset) -> None:
    target = dataset["problems"][0]
    assert str(client._app.state.problem_repository.source_path) == str(
        dataset["problems_path"]
    )
    response = client.post(
        f"/api/problems/{target['id']}/attempts",
        json={"answer": target["answer"]},
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["is_correct"] is True
    assert payload["correct_answer"] == target["answer"]
    assert payload["submitted_answer"] == target["answer"]

    repository = AttemptRepository(dataset["attempts_path"])
    attempts = repository.list_attempts(target["id"])
    assert len(attempts) == 1
    assert attempts[0].is_correct is True
    assert attempts[0].submitted_answer == target["answer"]


async def test_metrics_endpoint_requires_authentication(client) -> None:
    response = await client.get("/api/v1/metrics/me")
    assert response.status_code == 401


async def test_metrics_endpoint_returns_personalised_stats(client, dataset) -> None:
    token, _ = await _login_and_get_token(client)
    first = dataset["problems"][0]
    second = dataset["problems"][1]

    await client.post(
        f"/api/problems/{first['id']}/attempts",
        json={"answer": first["answer"]},
        headers={"Authorization": f"Bearer {token}"},
    )
    await client.post(
        f"/api/problems/{second['id']}/attempts",
        json={"answer": 0},
        headers={"Authorization": f"Bearer {token}"},
    )

    response = await client.get(
        "/api/v1/metrics/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["user_id"] == "1"
    assert payload["attempts"]["total"] == 2
    assert payload["attempts"]["correct"] == 1
    assert payload["progress"]["total_xp"] == dataset["progress_payload"]["users"][0]["total_xp"]
    assert payload["progress"]["completed_nodes"] == 1
    assert payload["progress"]["unlocked_nodes"] == 2


def test_submit_incorrect_attempt_is_logged(client, dataset) -> None:
    target = dataset["problems"][1]
    assert str(client._app.state.problem_repository.source_path) == str(
        dataset["problems_path"]
    )
    wrong_answer = target["answer"] + 5
    response = client.post(
        f"/api/problems/{target['id']}/attempts",
        json={"answer": wrong_answer},
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["is_correct"] is False
    assert payload["correct_answer"] == target["answer"]
    assert payload["submitted_answer"] == wrong_answer

    repository = AttemptRepository(dataset["attempts_path"])
    attempts = repository.list_attempts(target["id"])
    assert len(attempts) == 1
    assert attempts[0].is_correct is False
    assert attempts[0].submitted_answer == wrong_answer


def test_submit_attempt_without_answer_returns_validation_error(client, dataset) -> None:
    target = dataset["problems"][2]
    response = client.post(
        f"/api/problems/{target['id']}/attempts",
        json={},
    )

    assert response.status_code == 422
    payload = response.json()
    assert payload["detail"][0]["loc"][-1] == "answer"


async def test_login_creates_and_returns_user(client, dataset) -> None:
    token, response = await _login_and_get_token(
        client, nickname="student01", password="secret"
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["nickname"] == "student01"
    assert payload["role"] == "student"
    assert payload["message"].startswith("새 계정")
    assert payload["session_token"] == token
    assert payload["expires_at"] > 0
    assert response.cookies.get("session_token") == token

    repository = SessionRepository(dataset["attempts_path"])
    sessions = repository.list_active_sessions_for_user(payload["user_id"])
    assert len(sessions) == 1


async def test_login_trims_whitespace_and_reuses_account(client) -> None:
    first_token, first_response = await _login_and_get_token(
        client, nickname="  spaced-user  ", password="secret"
    )
    assert first_response.status_code == 200
    created = first_response.json()
    assert created["nickname"] == "spaced-user"
    assert first_token

    second_token, second_response = await _login_and_get_token(
        client, nickname="\t spaced-user\n", password="secret"
    )
    assert second_response.status_code == 200
    payload = second_response.json()

    assert payload["user_id"] == created["user_id"]
    assert payload["nickname"] == "spaced-user"
    assert payload["message"] == "로그인 성공"
    assert second_token
    assert second_token != first_token


async def test_login_with_wrong_password_returns_error(client) -> None:
    success_token, success_response = await _login_and_get_token(
        client, nickname="student02", password="secret"
    )
    assert success_response.status_code == 200
    assert success_token

    failure = await client.post(
        "/api/v1/login",
        json={"nickname": "student02", "password": "bad"},
    )
    assert failure.status_code == 401
    payload = failure.json()
    assert payload["detail"]["message"] == "비밀번호가 일치하지 않습니다."


async def test_create_session_returns_twenty_problems(client) -> None:
    token, login_response = await _login_and_get_token(client)
    assert login_response.status_code == 200

    response = await client.post(
        "/api/v1/sessions",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["session_id"]
    assert len(payload["problems"]) == 20
    first = payload["problems"][0]
    assert set(first.keys()) == {"id", "left", "right", "answer", "options"}
    assert len(first["options"]) == 4


async def test_create_session_requires_authentication(client) -> None:
    response = await client.post("/api/v1/sessions")
    assert response.status_code == 401


async def test_create_session_reuses_token_across_requests(client) -> None:
    token, login_response = await _login_and_get_token(client)
    assert login_response.status_code == 200
    headers = {"Authorization": f"Bearer {token}"}

    first = await client.post("/api/v1/sessions", headers=headers)
    assert first.status_code == 200

    second = await client.post("/api/v1/sessions", headers=headers)
    assert second.status_code == 200
    assert second.json()["session_id"] != first.json()["session_id"]


async def test_create_session_rejects_unknown_token(client) -> None:
    response = await client.post(
        "/api/v1/sessions",
        headers={"Authorization": "Bearer invalid-token"},
    )
    assert response.status_code == 401


def test_daily_stats_endpoint_returns_summary(client) -> None:
    response = client.get("/api/v1/stats/daily", params={"days": 30})
    assert response.status_code == 200
    payload = response.json()
    assert "total_sessions" in payload
    assert "total_problems" in payload
