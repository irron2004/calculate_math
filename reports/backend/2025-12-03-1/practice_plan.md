diff --git a/reports/backend/2025-12-03-1/practice_plan.md b/reports/backend/2025-12-03-1/practice_plan.md
new file mode 100755
index 0000000..28b3529
--- /dev/null
+++ b/reports/backend/2025-12-03-1/practice_plan.md
@@ -0,0 +1,12 @@
+# Practice Plan Endpoint Summary
+
+## Changes
+- Added helper utilities in `app/routers/skills.py` for normalising session metadata and prerequisite summaries.
+- Introduced `GET /api/v1/skills/nodes/{node_id}/practice-plan` to surface tier/group labels, prerequisites, and launch parameters for the selected skill node.
+- Added `tests/test_practice_plan.py` to cover the new endpoint's happy path and 404 behaviour using the full FastAPI stack.
+
+## Testing
+```
+pytest tests/test_practice_plan.py
+```
+Result: **blocked** — FastAPI app import fails because `app/routers/practice.py` currently contains a diff artifact and raises `SyntaxError`. Tests for the new endpoint could not run until the practice router module is restored to valid Python.
