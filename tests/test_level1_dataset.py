from __future__ import annotations

import json
from pathlib import Path

import httpx
import pytest

from app import create_app
from app.config import get_settings
from app.level1_loader import (
    Level1ValidationError,
    get_level1_dataset,
    reset_level1_cache,
)
from app.problem_bank import reset_cache as reset_problem_cache

pytestmark = pytest.mark.asyncio


def _base_payload() -> dict:
    return {
        "version": "level1.v1",
        "skills": [
            {
                "skill_id": "SKILL-1",
                "title": "Skill One",
                "description": "Basic skill",
                "problem_ids": ["PROB-1", "PROB-2"],
            },
            {
                "skill_id": "SKILL-2",
                "title": "Skill Two",
                "description": "Second skill",
                "problem_ids": ["PROB-3"],
            },
        ],
        "problems": [
            {
                "problem_id": "PROB-1",
                "primary_skill_id": "SKILL-1",
                "order": 1,
                "prompt": "1 + 1 = ?",
                "answer": {"type": "number", "value": 2},
                "grading": {"mode": "numeric_equal"},
            },
            {
                "problem_id": "PROB-2",
                "primary_skill_id": "SKILL-1",
                "order": 2,
                "prompt": "Write two.",
                "answer": {"type": "string", "value": "two"},
                "grading": {"mode": "exact_string"},
            },
            {
                "problem_id": "PROB-3",
                "primary_skill_id": "SKILL-2",
                "order": 1,
                "prompt": "2 + 2 = ?",
                "answer": {"type": "number", "value": 4},
                "grading": {"mode": "numeric_equal"},
            },
        ],
    }


def _write_payload(path: Path, payload: dict) -> None:
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def _set_level1_env(monkeypatch: pytest.MonkeyPatch, dataset_path: Path) -> None:
    monkeypatch.setenv("LEVEL1_DATA_PATH", str(dataset_path))
    get_settings.cache_clear()  # type: ignore[attr-defined]
    reset_level1_cache()


def test_validation_missing_skill(tmp_path, monkeypatch) -> None:
    payload = _base_payload()
    payload["problems"][0]["primary_skill_id"] = "SKILL-404"
    dataset_path = tmp_path / "level1.json"
    _write_payload(dataset_path, payload)
    _set_level1_env(monkeypatch, dataset_path)

    with pytest.raises(Level1ValidationError) as exc:
        get_level1_dataset()

    issue = next(
        (issue for issue in exc.value.issues if issue.kind == "missing_skill"),
        None,
    )
    assert issue is not None
    assert issue.problem_id == "PROB-1"
    assert issue.skill_id == "SKILL-404"


def test_validation_missing_problem(tmp_path, monkeypatch) -> None:
    payload = _base_payload()
    payload["skills"][0]["problem_ids"].append("PROB-404")
    dataset_path = tmp_path / "level1.json"
    _write_payload(dataset_path, payload)
    _set_level1_env(monkeypatch, dataset_path)

    with pytest.raises(Level1ValidationError) as exc:
        get_level1_dataset()

    issue = next(
        (issue for issue in exc.value.issues if issue.kind == "missing_problem"),
        None,
    )
    assert issue is not None
    assert issue.skill_id == "SKILL-1"
    assert issue.problem_id == "PROB-404"


def test_validation_duplicate_order(tmp_path, monkeypatch) -> None:
    payload = _base_payload()
    payload["problems"][1]["order"] = 1
    dataset_path = tmp_path / "level1.json"
    _write_payload(dataset_path, payload)
    _set_level1_env(monkeypatch, dataset_path)

    with pytest.raises(Level1ValidationError) as exc:
        get_level1_dataset()

    issue = next(
        (issue for issue in exc.value.issues if issue.kind == "duplicate_order"),
        None,
    )
    assert issue is not None
    assert issue.skill_id == "SKILL-1"
    assert issue.order == 1
    assert "PROB-1" in (issue.problem_ids or [])
    assert "PROB-2" in (issue.problem_ids or [])


def test_validation_invalid_grading_mode(tmp_path, monkeypatch) -> None:
    payload = _base_payload()
    payload["problems"][1]["grading"]["mode"] = "unsupported"
    dataset_path = tmp_path / "level1.json"
    _write_payload(dataset_path, payload)
    _set_level1_env(monkeypatch, dataset_path)

    with pytest.raises(Level1ValidationError) as exc:
        get_level1_dataset()

    issue = next(
        (issue for issue in exc.value.issues if issue.kind == "invalid_grading_mode"),
        None,
    )
    assert issue is not None
    assert issue.problem_id == "PROB-2"


@pytest.fixture
def level1_app(tmp_path, monkeypatch):
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    problems_path = data_dir / "problems.json"
    problems_path.write_text(
        json.dumps(
            [{"id": "p1", "category": "Test", "question": "1+1?", "answer": 2}],
            indent=2,
        ),
        encoding="utf-8",
    )
    attempts_path = data_dir / "attempts.db"

    invalid_payload = _base_payload()
    invalid_payload["problems"][0]["primary_skill_id"] = "SKILL-404"
    invalid_payload["skills"][0]["problem_ids"].append("PROB-404")
    invalid_payload["problems"][1]["order"] = 1
    invalid_payload["problems"][1]["grading"]["mode"] = "unsupported"
    invalid_payload["problems"][2]["primary_skill_id"] = "SKILL-1"

    dataset_path = data_dir / "level1.json"
    _write_payload(dataset_path, invalid_payload)

    monkeypatch.setenv("PROBLEM_DATA_PATH", str(problems_path))
    monkeypatch.setenv("ATTEMPTS_DATABASE_PATH", str(attempts_path))
    monkeypatch.setenv("LEVEL1_DATA_PATH", str(dataset_path))

    get_settings.cache_clear()  # type: ignore[attr-defined]
    reset_problem_cache()
    reset_level1_cache()

    app = create_app()
    try:
        yield app
    finally:
        reset_problem_cache()
        reset_level1_cache()
        get_settings.cache_clear()  # type: ignore[attr-defined]


@pytest.fixture
def valid_level1_app(tmp_path, monkeypatch):
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    problems_path = data_dir / "problems.json"
    problems_path.write_text(
        json.dumps(
            [{"id": "p1", "category": "Test", "question": "1+1?", "answer": 2}],
            indent=2,
        ),
        encoding="utf-8",
    )
    attempts_path = data_dir / "attempts.db"
    dataset_path = data_dir / "level1.json"
    _write_payload(dataset_path, _base_payload())

    monkeypatch.setenv("PROBLEM_DATA_PATH", str(problems_path))
    monkeypatch.setenv("ATTEMPTS_DATABASE_PATH", str(attempts_path))
    monkeypatch.setenv("LEVEL1_DATA_PATH", str(dataset_path))

    get_settings.cache_clear()  # type: ignore[attr-defined]
    reset_problem_cache()
    reset_level1_cache()

    app = create_app()
    try:
        yield app
    finally:
        reset_problem_cache()
        reset_level1_cache()
        get_settings.cache_clear()  # type: ignore[attr-defined]


@pytest.fixture
async def client(level1_app):
    transport = httpx.ASGITransport(app=level1_app, lifespan="on")
    async with httpx.AsyncClient(
        transport=transport, base_url="http://testserver"
    ) as async_client:
        yield async_client


@pytest.fixture
async def valid_client(valid_level1_app):
    transport = httpx.ASGITransport(app=valid_level1_app, lifespan="on")
    async with httpx.AsyncClient(
        transport=transport, base_url="http://testserver"
    ) as async_client:
        yield async_client


async def test_level1_endpoint_returns_dataset(valid_client) -> None:
    response = await valid_client.get("/api/v1/level1")
    assert response.status_code == 200
    payload = response.json()
    assert payload["skills"]
    assert payload["problems"]


async def test_level1_endpoint_returns_actionable_errors(client) -> None:
    response = await client.get("/api/v1/level1")
    assert response.status_code == 422
    detail = response.json()["detail"]
    errors = detail["errors"]

    assert any(
        error.get("kind") == "missing_skill"
        and error.get("skill_id") == "SKILL-404"
        and error.get("problem_id") == "PROB-1"
        for error in errors
    )
    assert any(
        error.get("kind") == "missing_problem"
        and error.get("skill_id") == "SKILL-1"
        and error.get("problem_id") == "PROB-404"
        for error in errors
    )
    assert any(
        error.get("kind") == "duplicate_order"
        and error.get("skill_id") == "SKILL-1"
        and error.get("order") == 1
        for error in errors
    )
    assert any(
        error.get("kind") == "invalid_grading_mode"
        and error.get("problem_id") == "PROB-2"
        for error in errors
    )
