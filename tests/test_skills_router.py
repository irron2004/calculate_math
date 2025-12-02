diff --git a/tests/test_skills_router.py b/tests/test_skills_router.py
index 2afef83..ad869a2 100644
--- a/tests/test_skills_router.py
+++ b/tests/test_skills_router.py
@@ -126,12 +126,35 @@ async def test_skill_tree_returns_error_when_ui_graph_invalid(monkeypatch, tmp_p
     invalid_ui_path.write_text(json.dumps({"version": "invalid", "nodes": [], "edges": []}), encoding="utf-8")
 
     monkeypatch.setattr(skills_module, "_SKILL_UI_PATH", invalid_ui_path)
+    monkeypatch.setattr(skills_module, "_LEGACY_SKILL_UI_PATH", invalid_ui_path)
     skills_module._load_skill_ui_graph.cache_clear()
 
     response = await client.get("/api/v1/skills/tree")
     assert response.status_code == 200
     payload = response.json()
-    assert payload["graph"] is None
+    assert payload["graph"] is not None
+    assert payload["graph"].get("meta", {}).get("fallback_reason") == "invalid_ui_spec"
+    assert payload["error"]["kind"] == "SkillSpecError"
+
+    skills_module._load_skill_ui_graph.cache_clear()
+
+
+async def test_skill_tree_uses_projection_layout_when_ui_missing(monkeypatch, tmp_path, client):
+    from app.routers import skills as skills_module
+
+    missing_path = tmp_path / "missing.json"
+    legacy_missing = tmp_path / "legacy.json"
+
+    monkeypatch.setattr(skills_module, "_SKILL_UI_PATH", missing_path)
+    monkeypatch.setattr(skills_module, "_LEGACY_SKILL_UI_PATH", legacy_missing)
+    skills_module._load_skill_ui_graph.cache_clear()
+
+    response = await client.get("/api/v1/skills/tree")
+    assert response.status_code == 200
+    payload = response.json()
+    assert payload["graph"] is not None
+    assert payload["graph"].get("meta", {}).get("fallback_reason") == "missing_ui_spec"
+    assert payload["graph"].get("meta", {}).get("derived_from_projection") is True
     assert payload["error"]["kind"] == "SkillSpecError"
 
     skills_module._load_skill_ui_graph.cache_clear()
