from __future__ import annotations

import importlib
import sys
from pathlib import Path

import pytest

SERVICE_ROOT = Path(__file__).resolve().parents[1]

if str(SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(SERVICE_ROOT))

from testing_utils.sync_client import create_client  # noqa: E402


def _load_module(module_path: str):
    return importlib.import_module(module_path)


calculate_service_module = _load_module("app")
problem_bank_module = _load_module("app.problem_bank")
config_module = _load_module("app.config")
repositories_module = _load_module("app.repositories")

create_app = calculate_service_module.create_app
list_categories = problem_bank_module.list_categories
get_settings = config_module.get_settings
AttemptRepository = repositories_module.AttemptRepository


@pytest.fixture(scope="session")
def app():
    return create_app()


@pytest.fixture
def client(app):
    test_client = create_client(app)
    try:
        yield test_client
    finally:
        test_client.close()


@pytest.fixture
def category() -> str:
    return list_categories()[0]


def test_create_invite_returns_token_and_summary(client, category) -> None:
    response = client.post(
        "/api/invites",
        json={"category": category, "summary": {"total": 10, "correct": 8}},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["category"] == category
    assert body["token"]
    assert body["share_url"].endswith(body["token"])
    assert body["summary"] == {"total": 10, "correct": 8, "accuracy": 80}
    assert "expires_at" in body


def test_get_invite_returns_existing_state(client, category) -> None:
    create_response = client.post(
        "/api/invites",
        json={"category": category, "summary": {"total": 5, "correct": 5}},
    )
    assert create_response.status_code == 201
    payload = create_response.json()
    token = payload["token"]

    fetch_response = client.get(f"/api/invites/{token}")
    assert fetch_response.status_code == 200
    fetched = fetch_response.json()
    assert fetched["token"] == token
    assert fetched["summary"]["accuracy"] == 100

    share_response = client.get(f"/share/{token}")
    assert share_response.status_code == 200
    assert "초대장" in share_response.text
    assert share_response.headers["X-Robots-Tag"] == "noindex"


def test_invite_expire_flow(client, category) -> None:
    create_response = client.post(
        "/api/invites",
        json={"category": category, "summary": {"total": 4, "correct": 1}},
    )
    assert create_response.status_code == 201
    token = create_response.json()["token"]

    expire_response = client.delete(f"/api/invites/{token}")
    assert expire_response.status_code == 204

    lookup_response = client.get(f"/api/invites/{token}")
    assert lookup_response.status_code == 404

    share_response = client.get(f"/share/{token}")
    assert share_response.status_code == 410
    assert "만료" in share_response.text


def test_invite_with_invalid_category_returns_not_found(client) -> None:
    response = client.post(
        "/api/invites",
        json={"category": "NOT-A-CATEGORY", "summary": {"total": 1, "correct": 1}},
    )
    assert response.status_code == 404
