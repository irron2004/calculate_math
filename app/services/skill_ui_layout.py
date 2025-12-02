diff --git a/app/services/skill_ui_layout.py b/app/services/skill_ui_layout.py
new file mode 100644
--- /dev/null
+++ b/app/services/skill_ui_layout.py
+"""Helpers for deriving a UI-ready layout from the skill tree projection."""
+
+from __future__ import annotations
+
+from collections import defaultdict
+from typing import Any, Dict, Iterable, List
+
+
+def _normalise_groups(groups: Iterable[dict[str, Any]]) -> List[dict[str, Any]]:
+    payload: List[dict[str, Any]] = []
+    for index, group in enumerate(groups, start=1):
+        group_id = str(group.get("id") or f"group-{index}")
+        payload.append(
+            {
+                "id": group_id,
+                "label": group.get("label") or group_id,
+                "order": int(group.get("order") or index),
+            }
+        )
+    if not payload:
+        payload.append({"id": "general", "label": "전체", "order": 1})
+    payload.sort(key=lambda item: (item["order"], item["id"]))
+    return payload
+
+
+def _serialise_requires(requirements: Iterable[dict[str, Any]] | None) -> List[dict[str, Any]]:
+    payload: List[dict[str, Any]] = []
+    if not requirements:
+        return payload
+    for requirement in requirements:
+        skill_id = requirement.get("skill_id")
+        if not skill_id:
+            continue
+        payload.append(
+            {
+                "skill_id": skill_id,
+                "min_level": int(requirement.get("min_level") or 0),
+            }
+        )
+    return payload
+
+
+def build_ui_layout_from_projection(
+    projection: Dict[str, Any],
+    *,
+    fallback_reason: str | None = None,
+) -> Dict[str, Any]:
+    """Derive a coarse UI layout for the skill tree response."""
+
+    groups = _normalise_groups(projection.get("groups") or [])
+    projection_nodes: List[dict[str, Any]] = list(projection.get("nodes") or [])
+    edges = projection.get("edges") or []
+    group_lookup = {group["id"]: [] for group in groups}
+    default_group_id = next(iter(group_lookup))
+
+    for node in projection_nodes:
+        node_group = node.get("group")
+        if node_group in group_lookup:
+            group_lookup[node_group].append(node)
+            continue
+        # Assign ungrouped nodes to the first group to keep them visible.
+        group_lookup[default_group_id].append(node)
+
+    layout_nodes: List[dict[str, Any]] = []
+    for group in groups:
+        tier_positions = defaultdict(int)
+        for node in sorted(
+            group_lookup[group["id"]],
+            key=lambda item: (int(item.get("tier") or 0), item.get("id") or ""),
+        ):
+            tier = int(node.get("tier") or 0)
+            row = tier if tier > 0 else 1
+            tier_positions[row] += 1
+            session_meta = node.get("session") or {}
+            layout_nodes.append(
+                {
+                    "id": node.get("id"),
+                    "tree": group["id"],
+                    "tier": tier,
+                    "label": node.get("label") or node.get("id"),
+                    "lens": list(node.get("lens") or []),
+                    "boss": bool(session_meta.get("boss")),
+                    "requires": _serialise_requires(node.get("requires")),
+                    "xp": node.get("xp") or {},
+                    "grid": {
+                        "row": row,
+                        "col": tier_positions[row],
+                    },
+                }
+            )
+
+    layout_edges = [
+        {"from": edge.get("from"), "to": edge.get("to")}
+        for edge in edges
+        if edge.get("from") and edge.get("to")
+    ]
+
+    meta = {
+        "derived_from_projection": True,
+        "fallback_reason": fallback_reason,
+        "projection_version": projection.get("version"),
+    }
+    meta = {key: value for key, value in meta.items() if value is not None}
+
+    return {
+        "version": projection.get("version"),
+        "trees": groups,
+        "nodes": layout_nodes,
+        "edges": layout_edges,
+        "meta": meta,
+    }
+
+
+__all__ = ["build_ui_layout_from_projection"]
