from __future__ import annotations

import json
from typing import Any

from fastapi.testclient import TestClient

MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024


def _create_assignment(client: TestClient, *, student_ids: list[str]) -> str:
    response = client.post(
        "/api/homework/assignments",
        json={
            "title": "숙제 테스트",
            "description": "문제를 풀고 제출하세요",
            "dueAt": "2026-02-01T23:59:59",
            "targetStudentIds": student_ids,
            "problems": [
                {
                    "id": "p1",
                    "type": "subjective",
                    "question": "문제 1: 답을 작성하세요.",
                }
            ],
        },
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert isinstance(data.get("id"), str)
    return data["id"]


def test_homework_create_list_and_detail(client: tuple[TestClient, Any]) -> None:
    test_client, _db_path = client

    assignment_id = _create_assignment(test_client, student_ids=["student1"])

    list_response = test_client.get("/api/homework/assignments", params={"studentId": "student1"})
    assert list_response.status_code == 200
    list_data = list_response.json()
    assert list_data["assignments"], "Expected at least one assignment"
    assert any(item["id"] == assignment_id for item in list_data["assignments"])

    detail_response = test_client.get(
        f"/api/homework/assignments/{assignment_id}",
        params={"studentId": "student1"},
    )
    assert detail_response.status_code == 200
    detail_data = detail_response.json()
    assert detail_data["id"] == assignment_id
    assert detail_data["submission"] is None


def test_homework_submit_rejects_large_file(client: tuple[TestClient, Any]) -> None:
    test_client, _db_path = client

    assignment_id = _create_assignment(test_client, student_ids=["student2"])

    too_large = b"x" * (MAX_FILE_SIZE_BYTES + 1)
    response = test_client.post(
        f"/api/homework/assignments/{assignment_id}/submit",
        data={
            "studentId": "student2",
            "answersJson": json.dumps({"p1": "답안"}),
        },
        files=[("images", ("large.jpg", too_large, "image/jpeg"))],
    )

    assert response.status_code == 400
    data = response.json()
    assert data["error"]["code"] == "FILE_TOO_LARGE"

    detail_response = test_client.get(
        f"/api/homework/assignments/{assignment_id}",
        params={"studentId": "student2"},
    )
    assert detail_response.status_code == 200
    assert detail_response.json()["submission"] is None


def test_homework_submit_rejects_invalid_file_type(client: tuple[TestClient, Any]) -> None:
    test_client, _db_path = client

    assignment_id = _create_assignment(test_client, student_ids=["student3"])

    response = test_client.post(
        f"/api/homework/assignments/{assignment_id}/submit",
        data={
            "studentId": "student3",
            "answersJson": json.dumps({"p1": "답안"}),
        },
        files=[("images", ("note.txt", b"hello", "text/plain"))],
    )

    assert response.status_code == 400
    data = response.json()
    assert data["error"]["code"] == "INVALID_FILE_TYPE"

    detail_response = test_client.get(
        f"/api/homework/assignments/{assignment_id}",
        params={"studentId": "student3"},
    )
    assert detail_response.status_code == 200
    assert detail_response.json()["submission"] is None
