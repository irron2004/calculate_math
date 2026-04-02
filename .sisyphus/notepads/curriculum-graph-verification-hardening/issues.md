# Issues

- Local backend at `http://localhost:8000` was unreachable during Task 1, so endpoint smoke evidence is currently blocked-state only.
- Neo4j live schema audit is blocked in this session because `cypher-shell` is unavailable and `NEO4J_*` env variables are unset.
- Task 5 shows low overall skill-to-problem coverage (11.21%), especially outside gradeBand `1-2` and selected `5-6` GM nodes.
- Task 6 API smoke is fully blocked while local backend is offline; endpoint parity, traversal, and UI smoke tasks are blocked until backend startup.
- After backend startup, API smoke shows `backend=200`, `published=404(PUBLISHED_NOT_FOUND)`, `problems_known=200([])`, `unknown_node=404(NODE_NOT_FOUND)`.
- UI verification for Tasks 11-12 is blocked at `/author/research-graph` by admin login gate; graph canvas and editor controls are inaccessible without credentials.
- Final-wave gating remains REJECT in this session because Neo4j live verification (Tasks 2/7/8) is blocked by missing cypher-shell and unset NEO4J_* env.
- Neo4j live execution blocker is resolved via Railway SSH runner, but Task 2 now reveals schema drift between `CURRICULUM_GRAPH_SCHEMA_V2.md` (Unit/Skill/Problem) and deployed `GraphVersion/GraphNode` runtime model.
