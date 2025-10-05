from __future__ import annotations

import json
from pathlib import Path

import pytest

from testing_utils.sync_client import create_client

from app import create_app
from app.config import get_settings
from app.problem_bank import reset_cache
from app.template_engine import reset_engine


@pytest.fixture
def curriculum_dataset(tmp_path, monkeypatch):
    data_dir = tmp_path / "data"
    data_dir.mkdir()

    problems_path = data_dir / "problems.json"
    attempts_path = data_dir / "attempts.db"
    concepts_path = data_dir / "concepts.json"
    templates_path = data_dir / "templates.json"

    problems = [
        {"id": "p1", "category": "덧셈", "question": "2+3?", "answer": 5}
    ]
    problems_path.write_text(json.dumps(problems, ensure_ascii=False), encoding="utf-8")

    concepts = [
        {
            "id": "TEST-CON",
            "name": "테스트 콘셉트",
            "lens": ["difference"],
            "prerequisites": [],
            "transfers": ["NEXT-CON"],
            "summary": "테스트 요약",
            "stage_span": ["S1", "S2", "S3"],
            "focus_keywords": ["시작값", "차이"],
        }
    ]
    concepts_path.write_text(json.dumps(concepts, ensure_ascii=False), encoding="utf-8")

    templates = [
        {
            "id": "TEST-TPL-S1",
            "concept": "TEST-CON",
            "step": "S1",
            "lens": ["difference"],
            "representation": "C",
            "context_pack": ["life", "table"],
            "parameters": {
                "left": {"type": "int", "min": 2, "max": 3},
                "right": {"type": "int", "min": 1, "max": 2}
            },
            "computed_values": {},
            "prompt": "{left} + {right} = ?",
            "explanation": "왼쪽 수에 오른쪽 수를 더합니다.",
            "answer_expression": "left + right",
            "option_offsets": [-1, 1, 2],
            "rubric_keywords": ["더한다"],
        }
    ]
    templates_path.write_text(json.dumps(templates, ensure_ascii=False), encoding="utf-8")

    monkeypatch.setenv("PROBLEM_DATA_PATH", str(problems_path))
    monkeypatch.setenv("ATTEMPTS_DATABASE_PATH", str(attempts_path))
    monkeypatch.setenv("CONCEPT_DATA_PATH", str(concepts_path))
    monkeypatch.setenv("TEMPLATE_DATA_PATH", str(templates_path))

    get_settings.cache_clear()  # type: ignore[attr-defined]
    reset_cache()
    reset_engine()

    try:
        yield {
            "problems_path": problems_path,
            "concepts_path": concepts_path,
            "templates_path": templates_path,
        }
    finally:
        reset_cache()
        reset_engine()
        get_settings.cache_clear()  # type: ignore[attr-defined]


@pytest.fixture
def app(curriculum_dataset):
    return create_app()


@pytest.fixture
def client(app):
    test_client = create_client(app)
    try:
        yield test_client
    finally:
        test_client.close()


def test_list_concepts_returns_node(client) -> None:
    response = client.get("/api/v1/concepts")
    assert response.status_code == 200
    payload = response.json()
    assert len(payload) == 1
    assert payload[0]["id"] == "TEST-CON"
    assert payload[0]["lens"] == ["difference"]


def test_list_concepts_filters_by_step(client) -> None:
    response = client.get("/api/v1/concepts", params={"step": "S2"})
    assert response.status_code == 200
    payload = response.json()
    assert len(payload) == 1
    response = client.get("/api/v1/concepts", params={"step": "S0"})
    assert response.status_code == 200
    assert response.json() == []


def test_get_concept_not_found(client) -> None:
    response = client.get("/api/v1/concepts/UNKNOWN")
    assert response.status_code == 404
    assert response.json()["detail"] == "concept not found"


def test_list_templates_filtered(client) -> None:
    response = client.get("/api/v1/templates", params={"concept": "TEST-CON"})
    assert response.status_code == 200
    payload = response.json()
    assert len(payload) == 1
    assert payload[0]["id"] == "TEST-TPL-S1"
    assert payload[0]["parameter_names"] == ["left", "right"]


def test_generate_template_returns_options(client) -> None:
    response = client.post(
        "/api/v1/templates/TEST-TPL-S1/generate",
        json={"seed": 123, "context": "life"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["template_id"] == "TEST-TPL-S1"
    assert payload["context"] == "life"
    assert len(payload["options"]) >= 3
    assert payload["answer"] in payload["options"]


def test_lrc_evaluate_promote(client) -> None:
    response = client.post(
        "/api/v1/lrc/evaluate",
        json={"accuracy": 0.95, "rt_percentile": 0.75, "rubric": 0.9},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["passed"] is True
    assert payload["recommendation"] == "promote"


def test_lrc_evaluate_near_miss(client) -> None:
    response = client.post(
        "/api/v1/lrc/evaluate",
        json={"accuracy": 0.88, "rt_percentile": 0.62, "rubric": 0.8},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["passed"] is False
    assert payload["status"] == "near-miss"
    assert payload["recommendation"] == "reinforce"


def test_lrc_evaluate_fail(client) -> None:
    response = client.post(
        "/api/v1/lrc/evaluate",
        json={"accuracy": 0.7, "rt_percentile": 0.4, "rubric": 0.5},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["passed"] is False
    assert payload["recommendation"] == "remediate"
