from __future__ import annotations

from pathlib import Path
from typing import Any

from fastapi.testclient import TestClient

from app.db import import_homework_problem_batch, list_homework_problem_ids_for_batch


def _auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _login_admin(client: TestClient) -> str:
    response = client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "admin"},
    )
    assert response.status_code == 200, response.text
    return response.json()["accessToken"]


def test_admin_problem_bank_labels_and_filtering(
    client: tuple[TestClient, Any],
) -> None:
    test_client, db_path = client
    admin_token = _login_admin(test_client)

    imported = import_homework_problem_batch(
        week_key="2026-W04",
        day_key="mon",
        payload={
            "title": "t",
            "problems": [
                {"type": "subjective", "question": "Q1", "answer": "A"},
                {"type": "subjective", "question": "Q2", "answer": "B"},
            ],
        },
        imported_by="admin",
        expected_problem_count=2,
        path=Path(db_path),
    )
    batch_id = imported["batchId"]
    problem_id = list_homework_problem_ids_for_batch(batch_id, path=Path(db_path))[0]

    create_label = test_client.post(
        "/api/homework/admin/problem-bank/labels",
        json={"key": "divide_basic", "label": "나눗셈-기초", "kind": "preset"},
        headers=_auth_headers(admin_token),
    )
    assert create_label.status_code == 200, create_label.text

    set_labels = test_client.put(
        f"/api/homework/admin/problem-bank/problems/{problem_id}/labels",
        json={"labelKeys": ["divide_basic"]},
        headers=_auth_headers(admin_token),
    )
    assert set_labels.status_code == 200, set_labels.text

    list_filtered = test_client.get(
        "/api/homework/admin/problem-bank/problems",
        params={"labelKey": "divide_basic"},
        headers=_auth_headers(admin_token),
    )
    assert list_filtered.status_code == 200, list_filtered.text
    problems = list_filtered.json()["problems"]
    assert len(problems) == 1
    assert problems[0]["id"] == problem_id


def test_admin_problem_bank_import_is_idempotent(
    client: tuple[TestClient, Any],
) -> None:
    test_client, _db_path = client
    admin_token = _login_admin(test_client)

    payload = {
        "title": "t",
        "problems": [
            {"type": "subjective", "question": f"Q{i}", "answer": "A"}
            for i in range(1, 21)
        ],
    }

    first = test_client.post(
        "/api/homework/admin/problem-bank/import",
        json={"weekKey": "2026-W04", "dayKey": "mon", "payload": payload},
        headers=_auth_headers(admin_token),
    )
    assert first.status_code == 200, first.text
    first_json = first.json()
    assert first_json["createdProblemCount"] == 20
    assert first_json["skippedProblemCount"] == 0

    second = test_client.post(
        "/api/homework/admin/problem-bank/import",
        json={"weekKey": "2026-W04", "dayKey": "mon", "payload": payload},
        headers=_auth_headers(admin_token),
    )
    assert second.status_code == 200, second.text
    second_json = second.json()
    assert second_json["batchId"] == first_json["batchId"]
    assert second_json["createdProblemCount"] == 0
    assert second_json["skippedProblemCount"] == 20
