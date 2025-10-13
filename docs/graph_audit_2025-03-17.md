# Bipartite Graph Audit · 2025-03-17

- **Nodes**: 64 atomic skills / 36 course steps (100 total)
- **Edges**: 73 `requires` / 69 `teaches` / 40 `enables`
- Every course step has at least one `requires` edge and at least one `teaches` edge.
- No edges reference missing nodes; dataset passes structural validation via `scripts/validate_skill_graph.py`.
- Next action: confirm teaches `delta_level` values and lens metadata with content team when new curriculum changes land.
