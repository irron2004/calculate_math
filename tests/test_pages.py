from __future__ import annotations

import importlib
import sys
from pathlib import Path

import httpx
import pytest

SERVICE_ROOT = Path(__file__).resolve().parents[1]

if str(SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(SERVICE_ROOT))


def _load_module(module_path: str):
    return importlib.import_module(module_path)


calculate_service_module = _load_module("app")
create_app = calculate_service_module.create_app
pages_module = calculate_service_module.pages

pytestmark = pytest.mark.asyncio


@pytest.fixture(scope="session")
def app():
    return create_app()


@pytest.fixture
async def client(app):
    transport = httpx.ASGITransport(app=app, lifespan="on")
    async with httpx.AsyncClient(
        transport=transport, base_url="http://testserver"
    ) as async_client:
        yield async_client


async def test_problems_page_without_categories_shows_invite_notice(client, monkeypatch):
    monkeypatch.setattr(pages_module, "resolve_allowed_categories", lambda: [])
    response = await client.get("/problems")
    assert response.status_code == 200
    body = response.text
    assert 'data-category-available="false"' in body
    assert "활성화된 문제 유형이 없습니다" in body
    assert "초대 링크를 생성할 수 없습니다" in body


async def test_home_redirects_to_skills(client):
    response = await client.get("/", follow_redirects=False)
    assert response.status_code == 302
    assert response.headers["location"] == "/skills"


async def test_home_page_route_hides_compliance_copy_for_learners(client):
    response = await client.get("/home")
    assert response.status_code == 200
    body = response.text
    assert "Web Vitals" not in body
    assert "WCAG" not in body
    assert "Tasks.md" not in body
    assert "로컬 개발 가이드" not in body
    assert "FE-01" not in body
    assert "Self → Invite → Aggregate" not in body
    assert "맞춤 학습 모드 활성화" in body
    assert "학습 준비 체크리스트" in body
    assert "읽기 → 풀이 → 피드백" in body
    assert "오늘의 문제" in body
    assert "학습 공유 링크만 생성" not in body


async def test_home_page_route_shows_compliance_copy_for_staff_toggle(client):
    response = await client.get("/home?staff=1")
    assert response.status_code == 200
    body = response.text
    assert "Web Vitals" in body
    assert "WCAG 2.2" in body
