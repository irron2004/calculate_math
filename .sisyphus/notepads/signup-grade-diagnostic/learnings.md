# Learnings

- T1 implemented as a pure selector over `problemsByNodeId` (no hooks/fetch); it parses v1 standard node ids like `MATH-2022-G-3-NA-001`.
- Determinism achieved by stable sorting (nodeId -> problemId) and explicit group ordering (pre -> fill -> post).
- Error handling: invalid grade/desiredCount throws; insufficient bank returns `{ ok: false, error }` for UI-level graceful handling.

- T2: Expanded NA problem counts for grades 5/6 (added 2 problems each) and added a policy test ensuring all grades 1..6 can generate an 8-question NA-only adjacent-grade plan.

- T3: Signup now seeds `onboarding:survey:v1` (including `diagnosticMode: 'adjacent-grade-na-v1'`) and redirects authenticated new users to `ROUTES.placement`.

- T4: PlacementTestPage supports `survey.diagnosticMode === 'adjacent-grade-na-v1'` by loading `problems_v1.json`, generating 8 NA questions via `buildAdjacentGradeDiagnostic`, and showing a loading/error screen if bank/plan is not ready.
