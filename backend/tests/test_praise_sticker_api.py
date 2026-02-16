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


def test_stickers_empty_list(client: tuple[TestClient, object], monkeypatch) -> None:
    test_client, _db_path = client

    student_id = "sticker_student_empty"
    token = _register_student(test_client, username=student_id)
    admin_token = _login_admin(test_client)
    enable_response = test_client.patch(
        f"/api/admin/students/{student_id}/features",
        json={"praiseStickerEnabled": True},
        headers=_auth_headers(admin_token),
    )
    assert enable_response.status_code == 200, enable_response.text

    response = test_client.get(
        f"/api/students/{student_id}/stickers",
        headers=_auth_headers(token),
    )
    assert response.status_code == 200, response.text
    assert response.json() == {"stickers": []}


def test_bonus_sticker_create_and_list(client: tuple[TestClient, object], monkeypatch) -> None:
    test_client, _db_path = client

    student_id = "sticker_student_bonus"
    student_token = _register_student(test_client, username=student_id)
    admin_token = _login_admin(test_client)
    enable_response = test_client.patch(
        f"/api/admin/students/{student_id}/features",
        json={"praiseStickerEnabled": True},
        headers=_auth_headers(admin_token),
    )
    assert enable_response.status_code == 200, enable_response.text

    create_response = test_client.post(
        f"/api/students/{student_id}/stickers",
        json={"count": 2, "reason": "보너스 지급"},
        headers=_auth_headers(admin_token),
    )
    assert create_response.status_code == 200, create_response.text
    created = create_response.json()
    assert created["studentId"] == student_id
    assert created["count"] == 2
    assert created["reason"] == "보너스 지급"
    assert created["reasonType"] == "bonus"
    assert created["grantedBy"] == "admin"
    assert isinstance(created["grantedAt"], str)

    list_response = test_client.get(
        f"/api/students/{student_id}/stickers",
        headers=_auth_headers(student_token),
    )
    assert list_response.status_code == 200, list_response.text
    data = list_response.json()
    assert len(data["stickers"]) == 1
    assert data["stickers"][0]["id"] == created["id"]


def test_sticker_summary_returns_total_and_recent(client: tuple[TestClient, object], monkeypatch) -> None:
    test_client, _db_path = client

    student_id = "sticker_student_summary"
    student_token = _register_student(test_client, username=student_id)
    admin_token = _login_admin(test_client)
    enable_response = test_client.patch(
        f"/api/admin/students/{student_id}/features",
        json={"praiseStickerEnabled": True},
        headers=_auth_headers(admin_token),
    )
    assert enable_response.status_code == 200, enable_response.text

    test_client.post(
        f"/api/students/{student_id}/stickers",
        json={"count": 1, "reason": "첫 보너스"},
        headers=_auth_headers(admin_token),
    )
    test_client.post(
        f"/api/students/{student_id}/stickers",
        json={"count": 2, "reason": "두번째 보너스"},
        headers=_auth_headers(admin_token),
    )

    summary_response = test_client.get(
        f"/api/students/{student_id}/sticker-summary",
        headers=_auth_headers(student_token),
    )
    assert summary_response.status_code == 200, summary_response.text
    summary = summary_response.json()
    assert summary["totalCount"] == 3
    assert len(summary["recent"]) == 2
    reasons = {item["reason"] for item in summary["recent"]}
    assert {"첫 보너스", "두번째 보너스"} <= reasons


def test_sticker_validation_errors(client: tuple[TestClient, object], monkeypatch) -> None:
    test_client, _db_path = client

    student_id = "sticker_student_invalid"
    _register_student(test_client, username=student_id)
    admin_token = _login_admin(test_client)

    count_response = test_client.post(
        f"/api/students/{student_id}/stickers",
        json={"count": 0, "reason": "보너스"},
        headers=_auth_headers(admin_token),
    )
    assert count_response.status_code == 400, count_response.text
    assert count_response.json()["error"]["code"] == "INVALID_COUNT"

    reason_response = test_client.post(
        f"/api/students/{student_id}/stickers",
        json={"count": 1, "reason": "   "},
        headers=_auth_headers(admin_token),
    )
    assert reason_response.status_code == 400, reason_response.text
    assert reason_response.json()["error"]["code"] == "INVALID_REASON"


def test_sticker_endpoints_blocked_when_feature_disabled(client: tuple[TestClient, object], monkeypatch) -> None:
    test_client, _db_path = client

    student_id = "sticker_student_blocked"
    token = _register_student(test_client, username=student_id)

    response = test_client.get(
        f"/api/students/{student_id}/stickers",
        headers=_auth_headers(token),
    )
    assert response.status_code == 403, response.text
    assert response.json()["error"]["code"] == "FEATURE_DISABLED"
