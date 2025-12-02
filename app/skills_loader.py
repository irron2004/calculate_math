diff --git a/app/skills_loader.py b/app/skills_loader.py
index 448d37c..be8ee20 100644
--- a/app/skills_loader.py
+++ b/app/skills_loader.py
@@ -13,7 +13,8 @@ from app.schemas.skill import EdgeType, SkillEdge, SkillGraphSpec, SkillKind, Sk
 
 _BASE_DIR = Path(__file__).resolve().parent
 _DOCS_PATH = _BASE_DIR.parent / "docs" / "dag.md"
-_JSON_EXPORT_PATH = _BASE_DIR / "data" / "skills.json"
+_JSON_EXPORT_PATH = _BASE_DIR / "data" / "skills.json"
+_LEGACY_JSON_EXPORT_PATH = _BASE_DIR / "data" / ".old" / "skills.json"
@@
-    if _JSON_EXPORT_PATH.exists():
-        try:
-            return json.loads(_JSON_EXPORT_PATH.read_text(encoding="utf-8"))
-        except json.JSONDecodeError as exc:
-            raise SkillSpecError("Packaged skill specification is invalid JSON") from exc
+    for candidate in (_JSON_EXPORT_PATH, _LEGACY_JSON_EXPORT_PATH):
+        if candidate.exists():
+            try:
+                return json.loads(candidate.read_text(encoding="utf-8"))
+            except json.JSONDecodeError as exc:
+                raise SkillSpecError("Packaged skill specification is invalid JSON") from exc
