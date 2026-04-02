# Learnings

- 2026-03-21: Baseline Playwright evidence command is stable using `npm --prefix curriculum-viewer run test:e2e -- e2e/research-graph-verification-artifacts.spec.ts` and produces `task-11-render/happy.png` + `task-12-editor-flow/reload-check.png`.
- 2026-03-21: Current spacing baseline in `AuthorResearchGraphPage.tsx` is `GRID_GAP_X=40`, `GRID_GAP_Y=30`, `GRADE_BAND_GAP_Y=120`, `DOMAIN_LAYER_GAP_Y=160`, header gaps `12/10`, radial expression `NODE_WIDTH + 120`.
- 2026-03-21: Task 2 applied conservative layered updates: `GRID_GAP_X=30`, `GRID_GAP_Y=20`, `GRADE_BAND_GAP_Y=80`, `DOMAIN_LAYER_GAP_Y=100`, `DOMAIN_HEADER_GAP_Y=8`, `DEPTH_HEADER_GAP_Y=8` with node size constants unchanged.
- 2026-03-21: Task 3 updated radial spacing to `radiusStep = NODE_WIDTH + 90` and added deterministic neo4j mocks in Playwright to generate `task-3-radial-density.png` and `task-3-radial-empty-state.png`.
- 2026-03-22: Task 4 targeted tests passed with current spacing assertions (`13/13`) and adjacent smoke subset `viewMode.test.ts` passed (`6/6`); evidence files are `task-4-vitest-targeted.txt` and `task-4-smoke-regression.txt`.
- 2026-03-22: Task 5 final e2e replay passed (`4/4`) and regenerated `task-11-render/happy.png`, `task-12-editor-flow/reload-check.png`, and `task-11-render/filter-check.json` with non-zero label counts after filter/reset.
- 2026-03-23: Strong spacing pass for `/author/research-graph` set `GRID_GAP_X=20`, `GRID_GAP_Y=14`, `GRADE_BAND_GAP_Y=48`, `DOMAIN_LAYER_GAP_Y=64`, header gaps `6/6`, and radial `radiusStep = NODE_WIDTH + 50`.
