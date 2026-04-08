from __future__ import annotations

import json
from typing import Any

from fastapi.testclient import TestClient


def _auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _register_student(client: TestClient, *, student_id: str) -> str:
    response = client.post(
        "/api/auth/register",
        json={
            "username": student_id,
            "password": "password123",
            "name": f"{student_id} 이름",
            "grade": "3",
            "email": f"{student_id}@example.com",
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


def test_admin_daily_summary_filters_due_and_submission_status(
    client: tuple[TestClient, Any],
) -> None:
    test_client, _db_path = client

    student_token = _register_student(test_client, student_id="test")
    admin_token = _login_admin(test_client)

    create_due_response = test_client.post(
        "/api/homework/assignments",
        json={
            "title": "오늘까지 숙제",
            "dueAt": "2026-02-01T23:59:59",
            "targetStudentIds": ["test"],
            "problems": [
                {"id": "p1", "type": "subjective", "question": "1+1은?"}
            ],
        },
        headers=_auth_headers(admin_token),
    )
    assert create_due_response.status_code == 200, create_due_response.text
    due_assignment_id = create_due_response.json()["id"]

    create_future_response = test_client.post(
        "/api/homework/assignments",
        json={
            "title": "미래 숙제",
            "dueAt": "2026-02-03T23:59:59",
            "targetStudentIds": ["test"],
            "problems": [
                {"id": "p1", "type": "subjective", "question": "2+2는?"}
            ],
        },
        headers=_auth_headers(admin_token),
    )
    assert create_future_response.status_code == 200, create_future_response.text

    submit_response = test_client.post(
        f"/api/homework/assignments/{due_assignment_id}/submit",
        data={
            "studentId": "test",
            "answersJson": json.dumps({"p1": "2"}, ensure_ascii=False),
        },
        headers=_auth_headers(student_token),
    )
    assert submit_response.status_code == 200, submit_response.text
    submission_id = submit_response.json()["submissionId"]

    summary_response = test_client.get(
        "/api/homework/admin/students/test/daily-summary",
        params={"asOf": "2026-02-01T23:59:59"},
        headers=_auth_headers(admin_token),
    )
    assert summary_response.status_code == 200, summary_response.text
    summary_json = summary_response.json()
    assert summary_json["studentId"] == "test"
    assert summary_json["asOf"] == "2026-02-01T23:59:59"
    assert len(summary_json["assignments"]) == 1
    item = summary_json["assignments"][0]
    assert item["assignmentId"] == due_assignment_id
    assert item["submitted"] is True
    assert item["submissionId"] == submission_id
    assert item["submissionStatus"] == "submitted"
    assert item["problemCount"] == 1

    not_submitted_only_response = test_client.get(
        "/api/homework/admin/students/test/daily-summary",
        params={"asOf": "2026-02-01T23:59:59", "includeSubmitted": "false"},
        headers=_auth_headers(admin_token),
    )
    assert not_submitted_only_response.status_code == 200
    assert not_submitted_only_response.json()["assignments"] == []


def test_admin_assignment_submission_status_and_answer_check_detail(
    client: tuple[TestClient, Any],
) -> None:
    test_client, _db_path = client

    student_token = _register_student(test_client, student_id="daily_detail")
    admin_token = _login_admin(test_client)

    create_response = test_client.post(
        "/api/homework/assignments",
        json={
            "title": "답 체크용 숙제",
            "dueAt": "2026-02-01T23:59:59",
            "targetStudentIds": ["daily_detail"],
            "problems": [
                {
                    "id": "p1",
                    "type": "objective",
                    "question": "2 + 2 = ?",
                    "options": ["3", "4", "5"],
                    "answer": "4",
                },
                {
                    "id": "p2",
                    "type": "subjective",
                    "question": "풀이를 적으세요.",
                },
            ],
        },
        headers=_auth_headers(admin_token),
    )
    assert create_response.status_code == 200, create_response.text
    assignment_id = create_response.json()["id"]

    submit_response = test_client.post(
        f"/api/homework/assignments/{assignment_id}/submit",
        data={
            "studentId": "daily_detail",
            "answersJson": json.dumps(
                {"p1": "2", "p2": "더하기로 계산했습니다."}, ensure_ascii=False
            ),
        },
        headers=_auth_headers(student_token),
    )
    assert submit_response.status_code == 200, submit_response.text
    submission_id = submit_response.json()["submissionId"]

    review_response = test_client.post(
        f"/api/homework/submissions/{submission_id}/review",
        json={
            "status": "returned",
            "reviewedBy": "admin",
            "problemReviews": {
                "p2": {"needsRevision": True, "comment": "식 정리를 더 써주세요"}
            },
        },
        headers=_auth_headers(admin_token),
    )
    assert review_response.status_code == 200, review_response.text

    status_response = test_client.get(
        f"/api/homework/admin/students/daily_detail/assignments/{assignment_id}/submission-status",
        headers=_auth_headers(admin_token),
    )
    assert status_response.status_code == 200, status_response.text
    status_json = status_response.json()
    assert status_json["studentId"] == "daily_detail"
    assert len(status_json["assignments"]) == 1
    status_item = status_json["assignments"][0]
    assert status_item["id"] == assignment_id
    assert status_item["submitted"] is True
    assert status_item["reviewStatus"] == "returned"

    detail_response = test_client.get(
        f"/api/homework/admin/submissions/{submission_id}/answer-check",
        headers=_auth_headers(admin_token),
    )
    assert detail_response.status_code == 200, detail_response.text
    detail_json = detail_response.json()
    assert detail_json["submissionId"] == submission_id
    assert detail_json["assignmentId"] == assignment_id
    assert detail_json["studentId"] == "daily_detail"
    assert detail_json["submissionStatus"] == "submitted"
    assert detail_json["reviewStatus"] == "returned"
    assert len(detail_json["problems"]) == 2

    by_problem_id = {item["problemId"]: item for item in detail_json["problems"]}
    assert by_problem_id["p1"]["correctAnswer"] == "4"
    assert by_problem_id["p1"]["studentAnswer"] == "2"
    assert by_problem_id["p1"]["isCorrect"] is True

    assert by_problem_id["p2"]["correctAnswer"] is None
    assert by_problem_id["p2"]["studentAnswer"] == "더하기로 계산했습니다."
    assert by_problem_id["p2"]["isCorrect"] is None
    assert by_problem_id["p2"]["review"]["needsRevision"] is True
    assert "식 정리" in by_problem_id["p2"]["review"]["comment"]


def test_admin_assignment_submission_status_returns_404_when_not_assigned(
    client: tuple[TestClient, Any],
) -> None:
    test_client, _db_path = client

    _register_student(test_client, student_id="student_missing")
    admin_token = _login_admin(test_client)

    response = test_client.get(
        "/api/homework/admin/students/student_missing/assignments/unknown-assignment/submission-status",
        headers=_auth_headers(admin_token),
    )
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "ASSIGNMENT_NOT_FOUND"
