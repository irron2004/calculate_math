diff --git a/scripts/generate_skill_ui_layout.py b/scripts/generate_skill_ui_layout.py
new file mode 100644
--- /dev/null
+++ b/scripts/generate_skill_ui_layout.py
+#!/usr/bin/env python3
+"""Generate ``skills.ui.json`` from the bipartite graph specification."""
+
+from __future__ import annotations
+
+import argparse
+import json
+from datetime import datetime, timezone
+from pathlib import Path
+import sys
+
+REPO_ROOT = Path(__file__).resolve().parents[1]
+if str(REPO_ROOT) not in sys.path:
+    sys.path.insert(0, str(REPO_ROOT))
+
+from app.schemas.bipartite import BipartiteGraphSpec  # noqa: E402
+from app.services.skill_tree_projection import build_skill_tree_projection  # noqa: E402
+from app.services.skill_ui_layout import build_ui_layout_from_projection  # noqa: E402
+
+
+def _load_graph(path: Path) -> BipartiteGraphSpec:
+    payload = json.loads(path.read_text(encoding="utf-8"))
+    return BipartiteGraphSpec.model_validate(payload)
+
+
+def _build_argument_parser() -> argparse.ArgumentParser:
+    parser = argparse.ArgumentParser(description="Generate app/data/skills.ui.json from the bipartite graph")
+    parser.add_argument(
+        "--graph",
+        default=str(REPO_ROOT / "graph.bipartite.json"),
+        help="Path to the bipartite graph JSON (defaults to repo root graph.bipartite.json)",
+    )
+    parser.add_argument(
+        "--out",
+        default=str(REPO_ROOT / "app" / "data" / "skills.ui.json"),
+        help="Destination path for the generated UI graph",
+    )
+    parser.add_argument(
+        "--force",
+        action="store_true",
+        help="Overwrite the output file even if it already exists",
+    )
+    return parser
+
+
+def main() -> int:
+    parser = _build_argument_parser()
+    args = parser.parse_args()
+
+    graph_path = Path(args.graph).resolve()
+    output_path = Path(args.out).resolve()
+
+    if not graph_path.exists():
+        parser.error(f"Graph file not found: {graph_path}")
+
+    if output_path.exists() and not args.force:
+        parser.error(f"Output file already exists: {output_path}. Use --force to overwrite.")
+
+    graph_spec = _load_graph(graph_path)
+    projection = build_skill_tree_projection(graph=graph_spec, node_progress={}, skill_progress={})
+    layout = build_ui_layout_from_projection(
+        projection,
+        fallback_reason="generated_via_cli",
+    )
+
+    meta = layout.setdefault("meta", {})
+    meta["generated_at"] = datetime.now(timezone.utc).isoformat()
+    meta["source_graph"] = str(graph_path)
+
+    output_path.parent.mkdir(parents=True, exist_ok=True)
+    output_path.write_text(json.dumps(layout, ensure_ascii=False, indent=2) + "
", encoding="utf-8")
+    print(f"[skill-ui] Generated layout with {len(layout['nodes'])} nodes â {output_path}")
+    return 0
+
+
+if __name__ == "__main__":
+    raise SystemExit(main())
