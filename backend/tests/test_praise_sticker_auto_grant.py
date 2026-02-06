from __future__ import annotations

import json
from typing import Any

from fastapi.testclient import TestClient

from app.db import list_praise_stickers


def _auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _register_student(client: TestClient, *, username: str) -> str:
    response = client.post(
        "/api/auth/register",
        json={
            "username": username,
            "password": "password123",
            "name": f"{username} 이름",
            "grade": "3",
            "email": f"{username}@example.com",
        },
    )
    assert response.status_code == 200, response.text
    return response.json()["accessToken"]


def _login_admin(client: TestClient) -> str:
    response = client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "admin"},
    )
    assert response.status_code == 200, response.text
    return response.json()["accessToken"]


def _create_assignment(client: TestClient, *, admin_token: str, student_id: str, due_at: str) -> str:
    response = client.post(
        "/api/homework/assignments",
        json={
            "title": "숙제 테스트",
            "description": "문제를 풀고 제출하세요",
            "dueAt": due_at,
            "targetStudentIds": [student_id],
            "problems": [
                {
                    "id": "p1",
                    "type": "subjective",
                    "question": "문제 1: 답을 작성하세요.",
                }
            ],
        },
        headers=_auth_headers(admin_token),
    )
    assert response.status_code == 200, response.text
    return response.json()["id"]


def _submit_homework(client: TestClient, *, student_token: str, assignment_id: str, student_id: str) -> str:
    response = client.post(
        f"/api/homework/assignments/{assignment_id}/submit",
        data={
            "studentId": student_id,
            "answersJson": json.dumps({"p1": "답안"}),
        },
        headers=_auth_headers(student_token),
    )
    assert response.status_code == 200, response.text
    return response.json()["submissionId"]


def _review_submission(
    client: TestClient,
    *,
    admin_token: str,
    submission_id: str,
    status: str,
    problem_reviews: dict[str, Any] | None = None,
) -> None:
    payload: dict[str, Any] = {"status": status}
    if problem_reviews is not None:
        payload["problemReviews"] = problem_reviews
    response = client.post(
        f"/api/homework/submissions/{submission_id}/review",
        json=payload,
        headers=_auth_headers(admin_token),
    )
    assert response.status_code == 200, response.text


def test_auto_grant_on_approved_on_time(client: tuple[TestClient, object], monkeypatch) -> None:
    test_client, _db_path = client
    monkeypatch.setenv("DEMO_MODE", "1")

    student_id = "sticker_auto_on_time"
    student_token = _register_student(test_client, username=student_id)
    admin_token = _login_admin(test_client)

    assignment_id = _create_assignment(
        test_client,
        admin_token=admin_token,
        student_id=student_id,
        due_at="2099-01-01T00:00:00",
    )
    submission_id = _submit_homework(
        test_client,
        student_token=student_token,
        assignment_id=assignment_id,
        student_id=student_id,
    )
    _review_submission(
        test_client,
        admin_token=admin_token,
        submission_id=submission_id,
        status="approved",
    )

    list_response = test_client.get(
        f"/api/students/{student_id}/stickers",
        headers=_auth_headers(student_token),
    )
    assert list_response.status_code == 200, list_response.text
    data = list_response.json()
    assert len(data["stickers"]) == 1
    sticker = data["stickers"][0]
    assert sticker["count"] == 2
    assert sticker["reasonType"] == "homework_excellent"
    assert sticker["homeworkId"] == assignment_id


def test_no_grant_when_late(client: tuple[TestClient, object], monkeypatch) -> None:
    test_client, _db_path = client
    monkeypatch.setenv("DEMO_MODE", "1")

    student_id = "sticker_auto_late"
    student_token = _register_student(test_client, username=student_id)
    admin_token = _login_admin(test_client)

    assignment_id = _create_assignment(
        test_client,
        admin_token=admin_token,
        student_id=student_id,
        due_at="2000-01-01T00:00:00",
    )
    submission_id = _submit_homework(
        test_client,
        student_token=student_token,
        assignment_id=assignment_id,
        student_id=student_id,
    )
    _review_submission(
        test_client,
        admin_token=admin_token,
        submission_id=submission_id,
        status="approved",
    )

    list_response = test_client.get(
        f"/api/students/{student_id}/stickers",
        headers=_auth_headers(student_token),
    )
    assert list_response.status_code == 200, list_response.text
    assert list_response.json()["stickers"] == []


def test_no_grant_when_not_approved(client: tuple[TestClient, object], monkeypatch) -> None:
    test_client, _db_path = client
    monkeypatch.setenv("DEMO_MODE", "1")

    student_id = "sticker_auto_returned"
    student_token = _register_student(test_client, username=student_id)
    admin_token = _login_admin(test_client)

    assignment_id = _create_assignment(
        test_client,
        admin_token=admin_token,
        student_id=student_id,
        due_at="2099-01-01T00:00:00",
    )
    submission_id = _submit_homework(
        test_client,
        student_token=student_token,
        assignment_id=assignment_id,
        student_id=student_id,
    )
    _review_submission(
        test_client,
        admin_token=admin_token,
        submission_id=submission_id,
        status="returned",
        problem_reviews={"p1": {"needsRevision": True, "comment": "다시 풀어주세요."}},
    )

    list_response = test_client.get(
        f"/api/students/{student_id}/stickers",
        headers=_auth_headers(student_token),
    )
    assert list_response.status_code == 200, list_response.text
    assert list_response.json()["stickers"] == []


def test_no_grant_when_demo_mode_off(client: tuple[TestClient, Any], monkeypatch) -> None:
    test_client, db_path = client
    monkeypatch.delenv("DEMO_MODE", raising=False)

    student_id = "sticker_auto_demo_off"
    student_token = _register_student(test_client, username=student_id)
    admin_token = _login_admin(test_client)

    assignment_id = _create_assignment(
        test_client,
        admin_token=admin_token,
        student_id=student_id,
        due_at="2099-01-01T00:00:00",
    )
    submission_id = _submit_homework(
        test_client,
        student_token=student_token,
        assignment_id=assignment_id,
        student_id=student_id,
    )
    _review_submission(
        test_client,
        admin_token=admin_token,
        submission_id=submission_id,
        status="approved",
    )

    assert list_praise_stickers(student_id, path=db_path) == []


def test_auto_grant_prevents_duplicates(client: tuple[TestClient, object], monkeypatch) -> None:
    test_client, _db_path = client
    monkeypatch.setenv("DEMO_MODE", "1")

    student_id = "sticker_auto_dup"
    student_token = _register_student(test_client, username=student_id)
    admin_token = _login_admin(test_client)

    assignment_id = _create_assignment(
        test_client,
        admin_token=admin_token,
        student_id=student_id,
        due_at="2099-01-01T00:00:00",
    )
    submission_id = _submit_homework(
        test_client,
        student_token=student_token,
        assignment_id=assignment_id,
        student_id=student_id,
    )
    _review_submission(
        test_client,
        admin_token=admin_token,
        submission_id=submission_id,
        status="approved",
    )
    _review_submission(
        test_client,
        admin_token=admin_token,
        submission_id=submission_id,
        status="approved",
    )

    list_response = test_client.get(
        f"/api/students/{student_id}/stickers",
        headers=_auth_headers(student_token),
    )
    assert list_response.status_code == 200, list_response.text
    assert len(list_response.json()["stickers"]) == 1
