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
create_app = calculate_service_module.create_app
pages_module = calculate_service_module.pages


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


def test_problems_page_without_categories_shows_invite_notice(client, monkeypatch):
    monkeypatch.setattr(pages_module, "resolve_allowed_categories", lambda: [])
    response = client.get("/problems")
    assert response.status_code == 200
    body = response.text
    assert 'data-category-available="false"' in body
    assert "활성화된 문제 유형이 없습니다" in body
    assert "초대 링크를 생성할 수 없습니다" in body
