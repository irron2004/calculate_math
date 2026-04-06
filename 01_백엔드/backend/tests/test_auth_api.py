from __future__ import annotations

from fastapi.testclient import TestClient


def _register_student(client: TestClient, *, username: str, password: str) -> dict:
    response = client.post(
        "/api/auth/register",
        json={
            "username": username,
            "password": password,
            "name": f"{username} 이름",
            "grade": "3",
            "email": f"{username}@example.com",
        },
    )
    assert response.status_code == 200, response.text
    return response.json()


def _auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_change_password_success(client: tuple[TestClient, object]) -> None:
    test_client, _db_path = client

    registration = _register_student(test_client, username="student1", password="password123")
    access_token = registration["accessToken"]

    response = test_client.post(
        "/api/auth/password",
        json={"currentPassword": "password123", "newPassword": "newpassword123"},
        headers=_auth_headers(access_token),
    )
    assert response.status_code == 200, response.text

    old_login = test_client.post(
        "/api/auth/login",
        json={"username": "student1", "password": "password123"},
    )
    assert old_login.status_code == 401

    new_login = test_client.post(
        "/api/auth/login",
        json={"username": "student1", "password": "newpassword123"},
    )
    assert new_login.status_code == 200


def test_change_password_rejects_invalid_current_password(client: tuple[TestClient, object]) -> None:
    test_client, _db_path = client

    registration = _register_student(test_client, username="student2", password="password123")
    access_token = registration["accessToken"]

    response = test_client.post(
        "/api/auth/password",
        json={"currentPassword": "wrongpassword", "newPassword": "newpassword123"},
        headers=_auth_headers(access_token),
    )
    assert response.status_code == 401
