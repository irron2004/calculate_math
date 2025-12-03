diff --git a/app/routers/skills.py b/app/routers/skills.py
index 5349132..23ea69d 100644
--- a/app/routers/skills.py
+++ b/app/routers/skills.py
@@ -5,7 +5,7 @@ import logging
 from copy import deepcopy
 from functools import lru_cache
 from pathlib import Path
-from typing import Any, Dict, Optional
+from typing import Any, Dict, Iterable, Optional
 
 from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
 from pydantic import BaseModel, Field
@@ -36,6 +36,7 @@ logger = logging.getLogger("calculate_service.api.skills")
 
 _SKILL_UI_PATH = Path(__file__).resolve().parent.parent / "data" / "skills.ui.json"
 _LEGACY_SKILL_UI_PATH = _SKILL_UI_PATH.parent / ".old" / _SKILL_UI_PATH.name
+DEFAULT_PRACTICE_PROBLEM_COUNT = 6
 
 
 def _resolve_skill_ui_path() -> Path | None:
@@ -141,6 +142,60 @@ def _serialise_skill_progress(
     return progress
 
 
+def _normalise_problem_count(session_meta: Dict[str, Any]) -> int:
+    explicit = session_meta.get("problem_count")
+    if isinstance(explicit, int) and explicit > 0:
+        return explicit
+    candidate = session_meta.get("parameters", {}).get("count")
+    if isinstance(candidate, int) and candidate > 0:
+        return candidate
+    return DEFAULT_PRACTICE_PROBLEM_COUNT
+
+
+def _normalise_session_meta(session_meta: Dict[str, Any] | None) -> Dict[str, Any]:
+    meta = dict(session_meta or {})
+    normalised: Dict[str, Any] = {
+        "concept": meta.get("concept"),
+        "step": meta.get("step"),
+        "generator": meta.get("generator"),
+        "parameters": dict(meta.get("parameters") or {}),
+    }
+    normalised["problem_count"] = _normalise_problem_count({**meta, **normalised})
+    return normalised
+
+
+def _summarise_prerequisites(requirements: Optional[Iterable[Dict[str, Any]]]) -> Dict[str, Any]:
+    items = list(requirements or [])
+    met_count = sum(1 for requirement in items if requirement.get("met"))
+    unmet = [requirement for requirement in items if not requirement.get("met")]
+    return {
+        "total": len(items),
+        "met": met_count,
+        "all_met": len(items) == met_count,
+        "missing": [
+            {
+                "skill_id": requirement.get("skill_id"),
+                "label": requirement.get("label"),
+                "required_level": requirement.get("min_level"),
+                "current_level": requirement.get("current_level"),
+            }
+            for requirement in unmet
+        ],
+    }
+
+
+def _lookup_group(
+    group_id: Optional[str],
+    groups: Iterable[Dict[str, Any]],
+) -> Dict[str, Any] | None:
+    if not group_id:
+        return None
+    for group in groups:
+        if group.get("id") == group_id:
+            return group
+    return None
+
+
 @router.get("/skills/tree")
 async def api_get_skill_tree(
     request: Request,
@@ -284,4 +339,126 @@ async def api_update_skill_progress(
     }
 
 
+@router.get("/skills/nodes/{node_id}/practice-plan")
+async def api_get_practice_plan(
+    node_id: str,
+    request: Request,
+    user_id: Optional[str] = Query(None, description="Optional user id override"),
+    user: UserRecord | None = Depends(get_optional_user),
+) -> Dict[str, Any]:
+    try:
+        bipartite_graph = get_bipartite_graph()
+        course_steps = get_course_steps()
+        atomic_skills = get_atomic_skills()
+    except BipartiteSpecError as exc:  # pragma: no cover - validated via router tests
+        logger.exception("Failed to load bipartite graph for practice plan")
+        raise HTTPException(
+            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
+            detail={"message": "스킬 그래프를 불러오는 중 문제가 발생했습니다."},
+        ) from exc
+
+    store = _resolve_progress_store(request)
+    effective_user_id = user.id if user is not None else user_id
+    snapshot, progress_error = _select_snapshot(store, effective_user_id)
+    node_progress = _serialise_node_progress(course_steps, snapshot)
+    skill_progress = _serialise_skill_progress(atomic_skills, snapshot)
+
+    projection = build_skill_tree_projection(
+        graph=bipartite_graph,
+        node_progress=node_progress,
+        skill_progress=skill_progress,
+    )
+
+    target_node: Dict[str, Any] | None = None
+    for node in projection.get("nodes", []):
+        if node.get("id") == node_id:
+            target_node = node
+            break
+
+    if target_node is None:
+        raise HTTPException(
+            status_code=status.HTTP_404_NOT_FOUND,
+            detail={"message": f"스킬 노드 '{node_id}'를 찾을 수 없습니다."},
+        )
+
+    group_entry = _lookup_group(target_node.get("group"), projection.get("groups") or [])
+    tier_value = int(target_node.get("tier") or 0)
+    tier_payload = {
+        "value": tier_value,
+        "label": f"Tier {tier_value}" if tier_value else "Tier 미정",
+    }
+    group_payload = None
+    if group_entry:
+        group_payload = {
+            "id": group_entry.get("id"),
+            "label": group_entry.get("label"),
+            "order": group_entry.get("order"),
+        }
+    elif target_node.get("group"):
+        group_payload = {
+            "id": target_node.get("group"),
+            "label": target_node.get("group"),
+            "order": None,
+        }
+
+    prerequisites = list(target_node.get("requires") or [])
+    prereq_summary = _summarise_prerequisites(prerequisites)
+    teaches = list(target_node.get("teaches") or [])
+    session_config = target_node.get("session") or {}
+    session_summary = _normalise_session_meta(session_config if session_config else None)
+
+    skill_ids = [teach.get("skill_id") for teach in teaches if teach.get("skill_id")]
+    practice_launch = {
+        **session_summary,
+        "course_step_id": target_node.get("id"),
+        "skill_ids": skill_ids,
+    }
+    blocked_reasons: list[str] = []
+    if not session_config:
+        blocked_reasons.append("missing_session_config")
+    if not prereq_summary["all_met"]:
+        blocked_reasons.append("prerequisites_unmet")
+    practice_launch["ready"] = len(blocked_reasons) == 0
+    practice_launch["blocked_reasons"] = blocked_reasons
+
+    progress_meta = {
+        "user_id": snapshot.user_id if snapshot else effective_user_id,
+        "updated_at": snapshot.updated_at.isoformat() if snapshot else None,
+    }
+
+    diagnostics: Dict[str, Any] | None = None
+    if progress_error is not None:
+        diagnostics = {
+            "progress": {
+                "message": "진행도 정보를 불러올 수 없어 기본 값을 사용합니다.",
+                "kind": progress_error.__class__.__name__,
+            }
+        }
+
+    return {
+        "node": {
+            "id": target_node.get("id"),
+            "label": target_node.get("label"),
+            "course": target_node.get("course"),
+            "lens": target_node.get("lens"),
+            "tier": tier_payload["value"],
+            "tier_label": tier_payload["label"],
+            "group": group_payload,
+            "state": target_node.get("state"),
+            "xp": target_node.get("xp"),
+            "progress": target_node.get("progress"),
+        },
+        "session": session_config or None,
+        "session_summary": session_summary,
+        "practice_launch": practice_launch,
+        "prerequisites": prerequisites,
+        "prerequisite_summary": prereq_summary,
+        "teaches": teaches,
+        "lrc_min": target_node.get("lrc_min") or {},
+        "misconceptions": target_node.get("misconceptions") or [],
+        "progress_context": progress_meta,
+        "diagnostics": diagnostics,
+    }
+
+
 __all__ = ["router"]
