diff --git a/app/routers/skills.py b/app/routers/skills.py
index 06851fc..beb0a03 100644
--- a/app/routers/skills.py
+++ b/app/routers/skills.py
@@ -30,6 +30,7 @@ from ..dependencies.auth import get_optional_user
 from ..repositories import UserRecord
 from ..services import SkillProgressService
 from ..services.skill_tree_projection import build_skill_tree_projection
+from ..services.skill_ui_layout import build_ui_layout_from_projection
 
 router = APIRouter(prefix="/api/v1", tags=["skills"])
 
@@ -37,16 +38,28 @@ router = APIRouter(prefix="/api/v1", tags=["skills"])
 logger = logging.getLogger("calculate_service.api.skills")
 
 _SKILL_UI_PATH = Path(__file__).resolve().parent.parent / "data" / "skills.ui.json"
+_LEGACY_SKILL_UI_PATH = _SKILL_UI_PATH.parent / ".old" / _SKILL_UI_PATH.name
+
+
+def _resolve_skill_ui_path() -> Path | None:
+    if _SKILL_UI_PATH.exists():
+        return _SKILL_UI_PATH
+    if _LEGACY_SKILL_UI_PATH.exists():
+        return _LEGACY_SKILL_UI_PATH
+    return None
 
 
 @lru_cache(maxsize=1)
 def _load_skill_ui_graph() -> Dict[str, Any]:
-    if not _SKILL_UI_PATH.exists():
-        raise SkillSpecError(f"Skill UI graph not found at {_SKILL_UI_PATH}")
+    source_path = _resolve_skill_ui_path()
+    if source_path is None:
+        raise SkillSpecError(
+            f"Skill UI graph not found (searched {_SKILL_UI_PATH} and {_LEGACY_SKILL_UI_PATH})"
+        )
     try:
-        payload = json.loads(_SKILL_UI_PATH.read_text(encoding="utf-8"))
+        payload = json.loads(source_path.read_text(encoding="utf-8"))
     except json.JSONDecodeError as exc:  # pragma: no cover - defensive guard
-        raise SkillSpecError("Invalid skill UI graph specification") from exc
+        raise SkillSpecError(f"Invalid skill UI graph specification at {source_path}") from exc
@@ -202,7 +215,31 @@ async def api_get_skill_tree(
             "skills": skill_progress,
         }
 
-        ui_graph = deepcopy(_load_skill_ui_graph())
+        ui_graph_source = _resolve_skill_ui_path()
+        graph_error: SkillSpecError | None = None
+        fallback_reason: Optional[str] = None
+        ui_graph: Dict[str, Any] | None = None
+
+        if ui_graph_source is None:
+            graph_error = SkillSpecError(
+                f"Skill UI graph not found (searched {_SKILL_UI_PATH} and {_LEGACY_SKILL_UI_PATH})"
+            )
+        else:
+            try:
+                ui_graph = deepcopy(_load_skill_ui_graph())
+            except SkillSpecError as exc:
+                graph_error = exc
+
+        if ui_graph is None:
+            fallback_reason = "missing_ui_spec" if ui_graph_source is None else "invalid_ui_spec"
+            ui_graph = build_ui_layout_from_projection(
+                projection,
+                fallback_reason=fallback_reason or "unknown",
+            )
+            logger.warning(
+                "Skill UI graph unavailable (%s); delivering derived layout", fallback_reason
+            )
@@ -216,15 +253,32 @@ async def api_get_skill_tree(
             "edges": projection["edges"],
             "skills": projection["skills"],
             "progress": progress_payload,
-            "graph": deepcopy(ui_graph),
+            "graph": deepcopy(ui_graph) if ui_graph else None,
             "unlocked": unlocked_map,
             "experiment": assignment.to_payload(),
         }
+        issues: list[dict[str, Any]] = []
         if progress_error is not None:
-            payload["error"] = {
-                "message": "진행도 데이터를 불러오는 중 문제가 발생하여 기본 값을 표시합니다.",
-                "kind": progress_error.__class__.__name__,
+            issues.append(
+                {
+                    "message": "진행도 데이터를 불러오는 중 문제가 발생하여 기본 값을 표시합니다.",
+                    "kind": progress_error.__class__.__name__,
+                }
+            )
+        if graph_error is not None:
+            graph_issue = {
+                "message": "UI 레이아웃 데이터를 불러오지 못해 기본 레이아웃을 사용합니다.",
+                "kind": graph_error.__class__.__name__,
+                "detail": str(graph_error),
             }
+            if fallback_reason is not None:
+                graph_issue["meta"] = {"fallback_reason": fallback_reason}
+            issues.append(graph_issue)
+        if issues:
+            combined_issue = issues[0]
+            if len(issues) > 1:
+                combined_issue["causes"] = issues[1:]
+            payload["error"] = combined_issue
         return payload
     except (SkillSpecError, BipartiteSpecError) as exc:
         logger.exception("Failed to load skill tree payload")
