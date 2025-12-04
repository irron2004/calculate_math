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

### 1. Regression test `/api/v1/skills/*`, practice-plan endpoint, and desktop/mobile Skill Tree UX; attach evidence for telemetry events.
- **우선순위**: high
- **마감일**: 2025-12-12
- **출처**: handoff
- **참고 노트**: Recover the broken Skill Tree router/tests, then implement the responsive viewport, tooltip/arrow fixes, and unified student flow that were missing from 2025-12-03-1.



### 📄 현재 파일 스냅샷 (읽기 전용)

#### app/routers/skills.py\n```\nRestored the entire router with UI-layout fallback helpers, new session/prerequisite normalisers, and the `/skills/nodes/{node_id}/practice-plan` endpoint that surfaces tier/group/practice metadata and progress diagnostics.\n```\n\n#### tests/test_practice_plan.py\n```\nimport httpx
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