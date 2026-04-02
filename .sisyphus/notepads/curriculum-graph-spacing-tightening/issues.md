# Issues

- 2026-03-21: E2E run logs repeated `GET /api/graph/published 404` during startup/retries, but artifacts/test assertions still pass; keep monitoring after spacing changes.
- 2026-03-21: `npm --prefix curriculum-viewer run test -- AuthorResearchGraphPage.test.tsx` currently fails in existing test `creates a proposed node via the form with generated id` (expected `P_TU_` id). This appears pre-existing and not directly tied to spacing constant edits.
- 2026-03-22: Delegated `task()` execution for Task 5 failed due missing model (`opencode/gemini-3-pro`), so local orchestration commands were used to produce required evidence.
