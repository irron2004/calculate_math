# Task 2025-12-04-1 — Skill Tree UX Fix Follow-up

## Problem Summary
The prior attempt to deliver responsive Skill Tree improvements left the repo in a broken state and did not implement the planned UX changes:
- `app/routers/skills.py` and `tests/test_practice_plan.py` contain literal diff text instead of executable code, so the API/server cannot start and pytest fails immediately.
- No frontend work landed; the Skill Tree still has the same narrow viewport, overlapping tooltips, floating arrows, and the student dashboard remains disconnected.
- Because of the broken router file, even the new practice-plan endpoint does not run or integrate with the student flow, so none of the acceptance criteria were met.

## Objectives
1. Restore the codebase to a working state (revert the accidental diffs, ensure `/api/v1/skills/*` endpoints import correctly, tests run).
2. Re-implement the responsive Skill Tree layout and interaction fixes per the spec:
   - Auto-fit viewport on load, responsive widths, detail panel behavior.
   - Increased node spacing, collision-free tooltips/hover states, arrow rendering to node boundaries.
3. Unify the student dashboard with the Skill Tree practice flow (embed skill overview, skill-scoped practice CTA + confirmation modal, retire legacy S1/S2/S3 copy).
4. Ensure practice session launch accepts the selected skill/course step and surfaces metadata (prereqs, XP) to the UI.
5. Add regression tests covering the restored router, practice-plan endpoint (if kept), and visual/interaction changes where feasible.

## Acceptance Criteria
- `app/routers/skills.py` contains valid FastAPI router code; `/api/v1/skills/tree` and any new practice-plan endpoint work under pytest and manual smoke tests.
- `tests/test_practice_plan.py` (or equivalent) exists as valid Python and passes.
- Opening `/skills` shows the full Skill Tree auto-fitted to the viewport; tooltips never overlap neighboring nodes, and arrows terminate on node bodies.
- StudentDashboard displays the Skill Tree (or summary) and launches a skill-specific practice session via a confirmation modal; legacy S1/S2/S3 references are removed.
- Telemetry events for viewport fit, hover, and practice launch fire with expected payloads.
- QA evidence demonstrates desktop + mobile behavior, and the broken state (diff text in source files) is fully resolved.

## Risks & Notes
- Need to carefully restore files to avoid losing legitimate work; consider using `git restore` plus selective reapplication of intended changes.
- UX alignment still required for merged dashboard; coordinate with design before coding.
- Large change set: ensure incremental commits and reviewers for backend + frontend portions.


## 🎯 당신에게 할당된 작업 (Action Items)

### 1. Restore app/routers/skills.py to valid FastAPI router implementations for /api/v1/skills/tree and practice-plan, ensuring telemetry hooks work and removing embedded diff text.
- **우선순위**: high
- **마감일**: TBD
- **출처**: qa_release

### 2. Replace the diff artifact in tests/test_api.py with the actual pytest suite so CI can cover login and skills flows again.
- **우선순위**: high
- **마감일**: TBD
- **출처**: qa_release

### 3. Fix app/routers/practice.py by removing prose placeholders and reinstating executable practice-session logic so practice-plan tests can load the router.
- **우선순위**: high
- **마감일**: TBD
- **출처**: qa_release



### 📄 현재 파일 스냅샷 (읽기 전용)

#### app/routers/practice.py\n```\nReinstated the arithmetic practice router to the working baseline so FastAPI startup succeeds.\n```\n\n#### app/routers/skills.py\n```\nRecovered the full router implementation and added helper routines plus `/skills/nodes/{node_id}/practice-plan` for downstream practice metadata.\n```\n\n#### tests/test_api.py\n```\ndiff --git a/tests/test_api.py b/tests/test_api.py
index 16701ff..058bb86 100644
--- a/tests/test_api.py
+++ b/tests/test_api.py
@@ -1,13 +1,15 @@
-from __future__ import annotations
-
-import importlib
-import json
-import sys
-from datetime import datetime, timezone
-from pathlib import Path
-
-import httpx
-import pytest
+from __future__ import annotations
+
+import importlib
+import json
+import sys
+from dataclasses import replace
+from datetime import datetime, timezone
+from pathlib import Path
+import hashlib
+
+import httpx
+import pytest
@@
 problem_bank_module = _load_module("app.problem_bank")
 config_module = _load_module("app.config")
 repositories_module = _load_module("app.repositories")
 progress_store_module = _load_module("app.progress_store")
+rate_limiter_module = _load_module("app.security.rate_limiter")
 create_app = calculate_service_module.create_app
 list_categories = problem_bank_module.list_categories
 reset_problem_cache = problem_bank_module.reset_cache
 get_settings = config_module.get_settings
 AttemptRepository = repositories_module.AttemptRepository
 SessionRepository = repositories_module.SessionRepository
+UserRepository = repositories_module.UserRepository
+SlidingWindowRateLimiter = rate_limiter_module.SlidingWindowRateLimiter
 template_engine_module = _load_module("app.template_engine")
 reset_template_engine = template_engine_module.reset_engine
 reset_progress_store = progress_store_module.reset_progress_store
@@
-    monkeypatch.setenv("PROBLEM_DATA_PATH", str(problems_path))
-    monkeypatch.setenv("ATTEMPTS_DATABASE_PATH", str(attempts_path))
-    monkeypatch.setenv("SESSION_TOKEN_SECRET", "integration-secret")
-    monkeypatch.setenv("DAG_PROGRESS_PATH", str(progress_path))
-
-    get_settings.cache_clear()  # type: ignore[attr-defined]
+    monkeypatch.setenv("PROBLEM_DATA_PATH", str(problems_path))
+    monkeypatch.setenv("ATTEMPTS_DATABASE_PATH", str(attempts_path))
+    monkeypatch.setenv("SESSION_TOKEN_SECRET", "inte\n... [truncated] ...\nacy_passwords(client, dataset) -> None:
+    repository = UserRepository(dataset["attempts_path"])
+    legacy_hash = hashlib.sha256("legacy-password".encode("utf-8")).hexdigest()
+    repository.create_user(
+        nickname="legacy-user",
+        password_hash=legacy_hash,
+        role="student",
+    )
+
+    response = await client.post(
+        "/api/v1/login",
+        json={"nickname": "legacy-user", "password": "legacy-password"},
+    )
+    assert response.status_code == 200
+    refreshed = repository.get_by_nickname("legacy-user")
+    assert refreshed is not None
+    assert refreshed.password_hash.startswith("$argon2")
+
+
+async def test_login_rate_limit_blocks_after_multiple_failures(app, client) -> None:
+    creation = await client.post(
+        "/api/v1/login",
+        json={"nickname": "rate-user", "password": "correct"},
+    )
+    assert creation.status_code == 200
+
+    app.state.login_rate_limiter = SlidingWindowRateLimiter(max_attempts=2, window_seconds=60)
+
+    for _ in range(2):
+        failure = await client.post(
+            "/api/v1/login",
+            json={"nickname": "rate-user", "password": "wrong"},
+        )
+        assert failure.status_code == 401
+
+    blocked = await client.post(
+        "/api/v1/login",
+        json={"nickname": "rate-user", "password": "wrong"},
+    )
+    assert blocked.status_code == 429
+    assert blocked.json()["detail"]["message"].startswith("로그인 시도가 너무 많습니다")
+
+
+async def test_login_requires_https_when_secure_cookie(app, client) -> None:
+    settings = app.state.settings
+    app.state.settings = replace(settings, session_cookie_secure=True)
+    try:
+        response = await client.post(
+            "/api/v1/login",
+            json={"nickname": "https-user", "password": "secret"},
+        )
+        assert response.status_code == 400
+        detail = response.json()["detail"]["message"]
+        assert "HTTPS" in detail
+    finally:
+        app.state.settings = settings
\n```\n\n#### tests/test_practice_plan.py\n```\nimport httpx
import pytest

from app import create_app
from app.bipartite_loader import reset_bipartite_graph_cache
from app.config import get_settings
from app.problem_bank import reset_cache as reset_problem_cache
from app.progress_store import reset_progress_store
from app.template_engine import reset_engine as reset_template_engine

pytestmark = pytest.mark.asyncio


@pytest.fixture
def skill_app(tmp_path, monkeypatch):
    attempts_path = tmp_path / "attempts.db"
    monkeypatch.setenv("ATTEMPTS_DATABASE_PATH", str(attempts_path))
    monkeypatch.setenv("SESSION_TOKEN_SECRET", "test-secret")

    get_settings.cache_clear()  # type: ignore[attr-defined]
    reset_problem_cache()
    reset_template_engine()
    reset_progress_store()
    reset_bipartite_graph_cache()

    app = create_app()

    try:
        yield app
    finally:
        reset_problem_cache()
        reset_template_engine()
        reset_progress_store()
        reset_bipartite_graph_cache()
        get_settings.cache_clear()  # type: ignore[attr-defined]


@pytest.fixture
async def client(skill_app):
    transport = httpx.ASGITransport(app=skill_app, lifespan="on")
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as async_client:
        yield async_client


async def test_practice_plan_exposes_session_metadata(client: httpx.AsyncClient) -> None:
    tree_response = await client.get("/api/v1/skills/tree")
    assert tree_response.status_code == 200
    tree_payload = tree_response.json()
    assert tree_payload["nodes"], "skill tree must include nodes"
    target_node = tree_payload["nodes"][0]

    plan_response = await client.get(f"/api/v1/skills/nodes/{target_node['id']}/practice-plan")
    assert plan_response.status_code == 200
    plan = plan_response.json()

    assert plan["node"]["id"] == target_node["id"]
    assert "practice_launch" in plan
    assert plan["practice_launch"]["course_step_id"] == target_node["id"]
    assert "tier_label" in plan["node"]
    assert isinstance(plan["prerequisites"], list)
    assert "prerequisite_summary" in plan


async def test_practice_plan_for_unknown_node_returns_404(client: httpx.AsyncClient) -> None:
    response = await client.get("/api/v1/skills/nodes/UNKNOWN-NODE/practice-plan")
    assert response.status_code == 404
\n```