from __future__ import annotations

import json
from typing import Any

from fastapi.testclient import TestClient

MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024


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


def _create_assignment(client: TestClient, *, student_ids: list[str]) -> str:
    admin_token = _login_admin(client)
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
        headers=_auth_headers(admin_token),
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert isinstance(data.get("id"), str)
    return data["id"]


def test_homework_create_list_and_detail(client: tuple[TestClient, Any]) -> None:
    test_client, _db_path = client

    student_token = _register_student(test_client, student_id="student1")
    assignment_id = _create_assignment(test_client, student_ids=["student1"])

    list_response = test_client.get(
        "/api/homework/assignments",
        params={"studentId": "student1"},
        headers=_auth_headers(student_token),
    )
    assert list_response.status_code == 200
    list_data = list_response.json()
    assert list_data["assignments"], "Expected at least one assignment"
    assert any(item["id"] == assignment_id for item in list_data["assignments"])

    detail_response = test_client.get(
        f"/api/homework/assignments/{assignment_id}",
        params={"studentId": "student1"},
        headers=_auth_headers(student_token),
    )
    assert detail_response.status_code == 200
    detail_data = detail_response.json()
    assert detail_data["id"] == assignment_id
    assert detail_data["submission"] is None


def test_homework_submit_rejects_large_file(client: tuple[TestClient, Any]) -> None:
    test_client, _db_path = client

    student_token = _register_student(test_client, student_id="student2")
    assignment_id = _create_assignment(test_client, student_ids=["student2"])

    too_large = b"x" * (MAX_FILE_SIZE_BYTES + 1)
    response = test_client.post(
        f"/api/homework/assignments/{assignment_id}/submit",
        data={
            "studentId": "student2",
            "answersJson": json.dumps({"p1": "답안"}),
        },
        files=[("images", ("large.jpg", too_large, "image/jpeg"))],
        headers=_auth_headers(student_token),
    )

    assert response.status_code == 400
    data = response.json()
    assert data["error"]["code"] == "FILE_TOO_LARGE"

    detail_response = test_client.get(
        f"/api/homework/assignments/{assignment_id}",
        params={"studentId": "student2"},
        headers=_auth_headers(student_token),
    )
    assert detail_response.status_code == 200
    assert detail_response.json()["submission"] is None


def test_homework_submit_rejects_invalid_file_type(
    client: tuple[TestClient, Any],
) -> None:
    test_client, _db_path = client

    student_token = _register_student(test_client, student_id="student3")
    assignment_id = _create_assignment(test_client, student_ids=["student3"])

    response = test_client.post(
        f"/api/homework/assignments/{assignment_id}/submit",
        data={
            "studentId": "student3",
            "answersJson": json.dumps({"p1": "답안"}),
        },
        files=[("images", ("note.txt", b"hello", "text/plain"))],
        headers=_auth_headers(student_token),
    )

    assert response.status_code == 400
    data = response.json()
    assert data["error"]["code"] == "INVALID_FILE_TYPE"

    detail_response = test_client.get(
        f"/api/homework/assignments/{assignment_id}",
        params={"studentId": "student3"},
        headers=_auth_headers(student_token),
    )
    assert detail_response.status_code == 200
    assert detail_response.json()["submission"] is None


def _assert_no_key(obj: Any, forbidden_key: str) -> None:
    if isinstance(obj, dict):
        assert forbidden_key not in obj
        for value in obj.values():
            _assert_no_key(value, forbidden_key)
        return
    if isinstance(obj, list):
        for item in obj:
            _assert_no_key(item, forbidden_key)


def test_student_homework_responses_do_not_include_answer(
    client: tuple[TestClient, Any],
) -> None:
    test_client, _db_path = client

    student_token = _register_student(test_client, student_id="student_answer")
    admin_token = _login_admin(test_client)

    create_response = test_client.post(
        "/api/homework/assignments",
        json={
            "title": "정답 비노출 테스트",
            "targetStudentIds": ["student_answer"],
            "problems": [
                {
                    "id": "p1",
                    "type": "objective",
                    "question": "2 + 2 = ?",
                    "options": ["3", "4", "5"],
                    "answer": "4",
                }
            ],
        },
        headers=_auth_headers(admin_token),
    )
    assert create_response.status_code == 200, create_response.text
    assignment_id = create_response.json()["id"]

    list_response = test_client.get(
        "/api/homework/assignments",
        params={"studentId": "student_answer"},
        headers=_auth_headers(student_token),
    )
    assert list_response.status_code == 200, list_response.text
    _assert_no_key(list_response.json(), "answer")

    detail_response = test_client.get(
        f"/api/homework/assignments/{assignment_id}",
        params={"studentId": "student_answer"},
        headers=_auth_headers(student_token),
    )
    assert detail_response.status_code == 200, detail_response.text
    _assert_no_key(detail_response.json(), "answer")


def test_homework_create_from_problem_ids(client: tuple[TestClient, Any]) -> None:
    test_client, db_path = client

    student_token = _register_student(test_client, student_id="student_bank")
    admin_token = _login_admin(test_client)

    from pathlib import Path

    from app.db import (
        import_homework_problem_batch,
        list_homework_problem_ids_for_batch,
    )

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
    problem_ids = list_homework_problem_ids_for_batch(
        imported["batchId"], path=Path(db_path)
    )

    create_response = test_client.post(
        "/api/homework/assignments",
        json={
            "title": "은행 기반 출제",
            "targetStudentIds": ["student_bank"],
            "problemIds": problem_ids,
        },
        headers=_auth_headers(admin_token),
    )
    assert create_response.status_code == 200, create_response.text
    assignment_id = create_response.json()["id"]

    detail_response = test_client.get(
        f"/api/homework/assignments/{assignment_id}",
        params={"studentId": "student_bank"},
        headers=_auth_headers(student_token),
    )
    assert detail_response.status_code == 200, detail_response.text
    detail_json = detail_response.json()
    assert [p["question"] for p in detail_json["problems"]] == ["Q1", "Q2"]


def test_admin_can_list_wrong_problems_for_student(
    client: tuple[TestClient, Any],
) -> None:
    test_client, _db_path = client

    student_token = _register_student(test_client, student_id="student_wrong")
    admin_token = _login_admin(test_client)

    create_response = test_client.post(
        "/api/homework/assignments",
        json={
            "title": "오답 조회 테스트",
            "targetStudentIds": ["student_wrong"],
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
                    "question": "풀이를 간단히 설명하세요.",
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
            "studentId": "student_wrong",
            "answersJson": json.dumps(
                {"p1": "3", "p2": "잘 모르겠어요"}, ensure_ascii=False
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
                "p2": {"needsRevision": True, "comment": "분배법칙 힌트 참고"}
            },
        },
        headers=_auth_headers(admin_token),
    )
    assert review_response.status_code == 200, review_response.text

    wrong_response = test_client.get(
        "/api/homework/admin/students/student_wrong/wrong-problems",
        headers=_auth_headers(admin_token),
    )
    assert wrong_response.status_code == 200, wrong_response.text
    wrong_json = wrong_response.json()
    assert wrong_json["studentId"] == "student_wrong"
    assert len(wrong_json["wrongProblems"]) == 2

    by_problem_id = {item["problemId"]: item for item in wrong_json["wrongProblems"]}
    assert set(by_problem_id.keys()) == {"p1", "p2"}
    assert by_problem_id["p1"]["type"] == "objective"
    assert by_problem_id["p1"]["studentAnswer"] == "3"
    assert by_problem_id["p1"]["correctAnswer"] == "4"

    assert by_problem_id["p2"]["type"] == "subjective"
    assert by_problem_id["p2"]["review"]["needsRevision"] is True
    assert "힌트" in by_problem_id["p2"]["review"]["comment"]

    filtered_response = test_client.get(
        "/api/homework/admin/students/student_wrong/wrong-problems",
        params={"assignmentId": assignment_id},
        headers=_auth_headers(admin_token),
    )
    assert filtered_response.status_code == 200, filtered_response.text
    assert len(filtered_response.json()["wrongProblems"]) == 2


def test_admin_wrong_problem_grading_accepts_objective_option_number(
    client: tuple[TestClient, Any],
) -> None:
    test_client, _db_path = client

    student_token = _register_student(test_client, student_id="student_objective_index")
    admin_token = _login_admin(test_client)

    create_response = test_client.post(
        "/api/homework/assignments",
        json={
            "title": "객관식 번호 채점 테스트",
            "targetStudentIds": ["student_objective_index"],
            "problems": [
                {
                    "id": "p1",
                    "type": "objective",
                    "question": "정답이 8인 선택지를 고르세요.",
                    "options": ["2", "5", "8", "11"],
                    "answer": "8",
                }
            ],
        },
        headers=_auth_headers(admin_token),
    )
    assert create_response.status_code == 200, create_response.text
    assignment_id = create_response.json()["id"]

    submit_response = test_client.post(
        f"/api/homework/assignments/{assignment_id}/submit",
        data={
            "studentId": "student_objective_index",
            "answersJson": json.dumps({"p1": "3"}, ensure_ascii=False),
        },
        headers=_auth_headers(student_token),
    )
    assert submit_response.status_code == 200, submit_response.text

    wrong_response = test_client.get(
        "/api/homework/admin/students/student_objective_index/wrong-problems",
        headers=_auth_headers(admin_token),
    )
    assert wrong_response.status_code == 200, wrong_response.text
    wrong_json = wrong_response.json()
    assert wrong_json["studentId"] == "student_objective_index"
    assert wrong_json["wrongProblems"] == []


def test_admin_assignment_due_at_patch_updates_due_date(
    client: tuple[TestClient, Any],
) -> None:
    test_client, _db_path = client

    _register_student(test_client, student_id="student_due_patch")
    assignment_id = _create_assignment(test_client, student_ids=["student_due_patch"])
    admin_token = _login_admin(test_client)

    patch_response = test_client.patch(
        f"/api/homework/admin/assignments/{assignment_id}",
        json={"dueAt": "2026-02-08T23:59:59"},
        headers=_auth_headers(admin_token),
    )
    assert patch_response.status_code == 200, patch_response.text

    detail_response = test_client.get(
        f"/api/homework/admin/assignments/{assignment_id}",
        headers=_auth_headers(admin_token),
    )
    assert detail_response.status_code == 200, detail_response.text
    detail_json = detail_response.json()
    assert detail_json["dueAt"] == "2026-02-08T23:59:59"
