from __future__ import annotations

from fastapi.testclient import TestClient


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
    response = client.post("/api/auth/login", json={"username": "admin", "password": "admin"})
    assert response.status_code == 200, response.text
    return response.json()["accessToken"]


def test_student_profile_roundtrip(client: tuple[TestClient, object]) -> None:
    test_client, _db_path = client
    token = _register_student(test_client, username="student_profile_1")

    get_empty = test_client.get("/api/student/profile", headers=_auth_headers(token))
    assert get_empty.status_code == 200, get_empty.text
    assert get_empty.json()["profile"] is None

    upsert = test_client.post(
        "/api/student/profile",
        json={
            "survey": {"grade": "3", "confidence": 3},
            "placement": {"totalCount": 12, "correctCount": 8},
            "estimatedLevel": "E3-2",
            "weakTagsTop3": ["add_carry", "place_value", "word_problem"],
        },
        headers=_auth_headers(token),
    )
    assert upsert.status_code == 200, upsert.text
    profile = upsert.json()["profile"]
    assert profile["studentId"] == "student_profile_1"
    assert profile["estimatedLevel"] == "E3-2"
    assert profile["weakTagsTop3"] == ["add_carry", "place_value", "word_problem"]

    get_after = test_client.get("/api/student/profile", headers=_auth_headers(token))
    assert get_after.status_code == 200, get_after.text
    assert get_after.json()["profile"]["estimatedLevel"] == "E3-2"


def test_admin_students_includes_profile_summary(client: tuple[TestClient, object]) -> None:
    test_client, _db_path = client
    student_token = _register_student(test_client, username="student_profile_2")

    test_client.post(
        "/api/student/profile",
        json={
            "survey": {"grade": "3"},
            "placement": {"totalCount": 12, "correctCount": 6},
            "estimatedLevel": "E3-1",
            "weakTagsTop3": ["sub_borrow", "pattern", "fraction_basic"],
        },
        headers=_auth_headers(student_token),
    )

    admin_token = _login_admin(test_client)
    response = test_client.get("/api/admin/students", headers=_auth_headers(admin_token))
    assert response.status_code == 200, response.text
    data = response.json()
    assert isinstance(data.get("students"), list)
    match = next((s for s in data["students"] if s["id"] == "student_profile_2"), None)
    assert match is not None
    assert match["profile"]["estimatedLevel"] == "E3-1"
