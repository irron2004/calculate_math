# Curriculum Graph Spacing Tightening

## TL;DR

> **Quick Summary**: Apply conservative spacing compaction to the research graph layout so users can read structure faster without introducing node overlap or layout regressions.
>
> **Deliverables**:
> - Updated spacing constants and radial step tuning in `curriculum-viewer/src/pages/AuthorResearchGraphPage.tsx`
> - Focused tests updated/added with Vitest (tests-after)
> - Agent-executed QA evidence for overview, editor, and error/edge behavior
>
> **Estimated Effort**: Short
> **Parallel Execution**: YES - 2 waves + final verification
> **Critical Path**: Baseline capture -> spacing constants update -> tests -> QA replay

---

## Context

### Original Request
Continue with next steps and reduce graph spacing so the research graph is easier to read.

### Interview Summary
**Key Discussions**:
- User requested continuation with no unnecessary pause.
- User selected the conservative spacing profile.
- User selected test strategy: tests-after (recommended).

**Research Findings**:
- Spacing formulas and constants are centralized in `curriculum-viewer/src/pages/AuthorResearchGraphPage.tsx`.
- Conservative safe reductions were identified for horizontal/vertical/domain gaps.

### Metis Review
Metis consultation was attempted twice but timed out. Compensating controls were applied in this plan:
- Explicit guardrails to prevent scope creep.
- Concrete acceptance criteria and edge-case QA scenarios.

---

## Work Objectives

### Core Objective
Make the research graph denser in production-facing behavior while keeping labels readable and interactions stable.

### Concrete Deliverables
- Conservative spacing constants applied in `curriculum-viewer/src/pages/AuthorResearchGraphPage.tsx`.
- Radial spacing tuned conservatively for neo4j mode.
- Tests updated/added in relevant graph page/layout tests.
- Evidence files captured under `.sisyphus/evidence/`.

### Definition of Done
- [ ] `npm --prefix curriculum-viewer run test -- AuthorResearchGraphPage.test.tsx` passes.
- [ ] Build command for frontend passes.
- [ ] QA scenarios confirm denser layout without overlap in overview/editor modes.

### Must Have
- Conservative-only spacing changes.
- Tests-after workflow applied.
- Happy-path and negative/edge-case QA evidence per task.

### Must NOT Have (Guardrails)
- No unrelated auth/backend/domain changes.
- No redesign of node rendering component structure.
- No aggressive width/height shrink that risks label clipping.

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — verification must be agent-executed.

### Test Decision
- **Infrastructure exists**: YES
- **Automated tests**: Tests-after
- **Framework**: Vitest (+ existing e2e specs where needed)

### QA Policy
- Frontend/UI verification via Playwright flows and screenshot evidence.
- Unit/layout verification via Vitest assertions.
- Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.
- Playwright prerequisite: repo-root Python venv exists and backend deps are installed for `playwright.config.ts` webServer backend command.

---

## Execution Strategy

### Parallel Execution Waves

Wave 1 (baseline + implementation):
- T1 baseline capture + risk checks
- T2 conservative spacing update (grid/domain/header)
- T3 radial spacing conservative update

Wave 2 (validation):
- T4 tests-after updates for spacing expectations
- T5 QA evidence capture (overview/editor + edge case)

Wave FINAL:
- F1 plan compliance
- F2 quality + test pass audit
- F3 full QA replay
- F4 scope fidelity check

Critical Path: T1 -> T2 -> T4 -> T5 -> FINAL

---

## TODOs

- [x] 1. Capture spacing baseline and guardrails

  **What to do**:
  - Record current spacing constants and formula anchors in `curriculum-viewer/src/pages/AuthorResearchGraphPage.tsx`.
  - Capture baseline screenshots for overview/editor and one dense region for before/after comparison.
  - Ensure evidence path exists before captures: `mkdir -p .sisyphus/evidence`.
  - Use existing e2e navigation flow (`login -> 관리자 모드 -> Research`) and document produced evidence paths.
  - If evidence filenames differ from task naming, add mapping note in evidence markdown.
  - Confirm no concurrent scope changes are included.

  **Must NOT do**:
  - Do not edit implementation in this task.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: read-only baseline capture and validation.
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `playwright`: omitted for implementation; used later in QA task.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 1
  - **Blocks**: 2, 3, 4, 5
  - **Blocked By**: None

  **References**:
  - `curriculum-viewer/src/pages/AuthorResearchGraphPage.tsx` - source of constants and placement formulas.
  - `.sisyphus/evidence/` - location for baseline artifacts.

  **Acceptance Criteria**:
  - [ ] Baseline constants documented in evidence markdown.
  - [ ] Baseline screenshots stored using existing artifacts spec outputs.

  **QA Scenarios**:
  ```
  Scenario: Baseline overview capture
    Tool: Bash + Playwright CLI
    Preconditions: `cd curriculum-viewer && npm ci` completed, and repo-root `.venv` prepared with backend requirements installed
    Steps:
      1. Run `mkdir -p .sisyphus/evidence`
      2. Run `npm --prefix curriculum-viewer run test:e2e -- e2e/research-graph-verification-artifacts.spec.ts`
      3. Use generated screenshot `.sisyphus/evidence/task-11-render/happy.png` as baseline overview evidence
    Expected Result: Baseline screenshot saved with visible spacing
    Failure Indicators: Empty graph, missing nodes, or screenshot not produced
    Evidence: .sisyphus/evidence/task-11-render/happy.png

  Scenario: Baseline editor capture
    Tool: Bash + Playwright CLI
    Preconditions: Same Playwright config/webServer setup with repo-root `.venv` available
    Steps:
      1. Run `npm --prefix curriculum-viewer run test:e2e -- e2e/research-graph-verification-artifacts.spec.ts`
      2. Use generated screenshot `.sisyphus/evidence/task-12-editor-flow/reload-check.png` as baseline editor evidence
    Expected Result: Editor baseline screenshot saved
    Evidence: .sisyphus/evidence/task-12-editor-flow/reload-check.png
  ```

- [x] 2. Apply conservative grid and section spacing reductions

  **What to do**:
  - In `curriculum-viewer/src/pages/AuthorResearchGraphPage.tsx`, apply conservative constants:
    - `GRID_GAP_X`: 40 -> 30
    - `GRID_GAP_Y`: 30 -> 20
    - `GRADE_BAND_GAP_Y`: 120 -> 80
    - `DOMAIN_LAYER_GAP_Y`: 160 -> 100
    - `DOMAIN_HEADER_GAP_Y`: 12 -> 8
    - `DEPTH_HEADER_GAP_Y`: 10 -> 8
  - Keep `NODE_WIDTH`/`NODE_HEIGHT` unchanged.

  **Must NOT do**:
  - No aggressive reductions.
  - No node card typography or content truncation changes.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: bounded single-file constant update.
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 3)
  - **Blocks**: 4, 5
  - **Blocked By**: 1

  **References**:
  - `curriculum-viewer/src/pages/AuthorResearchGraphPage.tsx` - constants and header gap definitions.

  **Acceptance Criteria**:
  - [ ] All six conservative constants updated exactly as specified.
  - [ ] No other behavioral logic changed.

  **QA Scenarios**:
  ```
  Scenario: Conservative constants applied
    Tool: Bash
    Preconditions: Working tree contains spacing change
    Steps:
      1. Inspect target file values for six constants
      2. Compare against required conservative targets
      3. Save extracted values to evidence file
    Expected Result: Exact value match for all six constants
    Failure Indicators: Any mismatch or additional unrelated edits
    Evidence: .sisyphus/evidence/task-2-spacing-constants.txt

  Scenario: Negative guardrail check
    Tool: Bash
    Preconditions: Same changeset
    Steps:
      1. Verify NODE_WIDTH and NODE_HEIGHT remain unchanged
      2. Verify no changes in unrelated modules (auth/backend)
    Expected Result: Width/height unchanged and no scope creep files
    Evidence: .sisyphus/evidence/task-2-guardrail-check.txt
  ```

- [x] 3. Apply conservative radial spacing tightening

  **What to do**:
  - Reduce neo4j radial `radiusStep` conservatively in `curriculum-viewer/src/pages/AuthorResearchGraphPage.tsx` from `NODE_WIDTH + 120` to `NODE_WIDTH + 90`.
  - Keep formula structure intact; only adjust additive gap component.
  - Add deterministic QA setup in an e2e spec by mocking `**/api/graph/backend` to neo4j-ready and mocking graph payload variants (normal + empty).
  - Ensure evidence path exists before captures: `mkdir -p .sisyphus/evidence`.

  **Must NOT do**:
  - No radial algorithm rewrite.
  - No changes to node overlap avoidance logic.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: one localized formula-constant adjustment.
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 2)
  - **Blocks**: 4, 5
  - **Blocked By**: 1

  **References**:
  - `curriculum-viewer/src/pages/AuthorResearchGraphPage.tsx` - neo4j radial layout branch containing `radiusStep`.
  - `curriculum-viewer/e2e/research-graph-verification-artifacts.spec.ts` - existing artifact/screenshot writing pattern.
  - `curriculum-viewer/playwright.config.ts` - canonical agent-executable e2e runner with webServer.

  **Acceptance Criteria**:
  - [ ] Radial spacing is reduced via conservative constant change only.
  - [ ] `radiusStep` updated from `NODE_WIDTH + 120` to `NODE_WIDTH + 90`.
  - [ ] Existing radial mode still renders without collapsed overlap.

  **QA Scenarios**:
  ```
  Scenario: Radial spacing render sanity
    Tool: Bash + Playwright CLI
    Preconditions: e2e spec includes route mocks for `**/api/graph/backend` returning `{ backend: 'neo4j', ready: true, publishedGraphAvailable: true }`, and backend venv prerequisite satisfied
    Steps:
      1. Run `mkdir -p .sisyphus/evidence`
      2. Run `npm --prefix curriculum-viewer run test:e2e -- e2e/research-graph-verification-artifacts.spec.ts`
      3. Save radial capture artifact to `.sisyphus/evidence/task-3-radial-density.png`
    Expected Result: Denser radial spacing without collapsed center pileup
    Failure Indicators: Severe overlap or missing nodes
    Evidence: .sisyphus/evidence/task-3-radial-density.png

  Scenario: Radial error-state handling
    Tool: Bash + Playwright CLI
    Preconditions: Same spec also mocks graph payload to empty while backend remains neo4j, with backend venv prerequisite satisfied
    Steps:
      1. Run mocked empty-dataset test case in the same e2e spec
      2. Assert fallback empty/error UI appears, not crash
    Expected Result: Graceful no-data handling
    Evidence: .sisyphus/evidence/task-3-radial-empty-state.png
  ```

- [x] 4. Run tests-after updates for spacing behavior

  **What to do**:
  - Update or add focused tests for spacing/layout expectations in existing graph-page tests.
  - Prefer assertions around layout constants/derived positions rather than brittle snapshot-only checks.
  - Run targeted Vitest commands for changed tests.
  - Ensure evidence path exists before writing logs: `mkdir -p .sisyphus/evidence`.

  **Must NOT do**:
  - No broad test refactor unrelated to spacing.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: constrained test updates plus command execution.
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2
  - **Blocks**: 5, FINAL
  - **Blocked By**: 2, 3

  **References**:
  - `curriculum-viewer/src/pages/AuthorResearchGraphPage.test.tsx` - existing page behavior patterns.
  - `curriculum-viewer/src/lib/researchGraph/viewMode.test.ts` - mode-specific pattern references.

  **Acceptance Criteria**:
  - [ ] Relevant spacing tests are present/updated.
  - [ ] Targeted Vitest run passes.

  **QA Scenarios**:
  ```
  Scenario: Targeted test run pass
    Tool: Bash
    Preconditions: Test updates committed in working tree
    Steps:
      1. Run targeted Vitest command for changed graph tests
      2. Capture command output and pass/fail counts
    Expected Result: Zero failures for targeted tests
    Failure Indicators: Any failing test linked to spacing update
    Evidence: .sisyphus/evidence/task-4-vitest-targeted.txt

  Scenario: Negative regression check
    Tool: Bash
    Preconditions: Same test environment
    Steps:
      1. Run adjacent graph-related smoke tests (limited subset)
      2. Confirm no unrelated regressions triggered by spacing change
    Expected Result: Adjacent smoke subset remains green
    Evidence: .sisyphus/evidence/task-4-smoke-regression.txt
  ```

- [x] 5. Capture final QA evidence for denser but readable layout

  **What to do**:
  - Ensure evidence path exists before captures: `mkdir -p .sisyphus/evidence`.
  - Execute end-to-end UI QA for overview/editor with final spacing.
  - Compare with baseline captures and verify readability/no overlap.
  - Save final evidence package for handoff.

  **Must NOT do**:
  - Do not rely on manual verbal confirmation.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI-focused render quality validation.
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2
  - **Blocks**: FINAL
  - **Blocked By**: 2, 3, 4

  **References**:
  - `.sisyphus/evidence/task-11-render/happy.png` - comparison baseline from existing artifacts spec.
  - `.sisyphus/evidence/task-12-editor-flow/reload-check.png` - editor baseline from existing artifacts spec.

  **Acceptance Criteria**:
  - [ ] Final overview and editor screenshots captured via artifacts spec outputs.
  - [ ] Evidence note confirms denser spacing and no severe overlap.

  **QA Scenarios**:
  ```
  Scenario: Happy-path final overview/editor verification
    Tool: Bash + Playwright CLI
    Preconditions: Playwright config webServer starts backend + preview successfully with repo-root `.venv`
    Steps:
      1. Run `mkdir -p .sisyphus/evidence`
      2. Run `npm --prefix curriculum-viewer run test:e2e -- e2e/research-graph-verification-artifacts.spec.ts`
      3. Record final screenshots from `.sisyphus/evidence/task-11-render/happy.png` and `.sisyphus/evidence/task-12-editor-flow/reload-check.png`
    Expected Result: Denser layout than baseline, readable labels, no severe overlaps
    Failure Indicators: Text clipping, overlapping cards, hidden controls
    Evidence: .sisyphus/evidence/task-11-render/happy.png

  Scenario: Edge-case filtered density check
    Tool: Bash + Playwright CLI
    Preconditions: e2e spec includes filter-state assertions in dense/sparse subsets and backend venv prerequisite satisfied
    Steps:
      1. Run filter edge-case test case in e2e spec
      2. Assert graph remains navigable and does not collapse
    Expected Result: Layout remains stable across filter states
    Evidence: .sisyphus/evidence/task-11-render/filter-check.json
  ```

---

## Final Verification Wave

- [x] F1. Plan Compliance Audit

  **What to do**:
  - Validate that all Must Have items are implemented and all Must NOT items remain absent.
  - Verify required evidence artifacts exist.

  **QA Scenario**:
  ```
  Scenario: Plan compliance pass/fail
    Tool: Bash
    Preconditions: All implementation tasks marked complete
    Steps:
      1. Run `test -f .sisyphus/evidence/task-11-render/happy.png && test -f .sisyphus/evidence/task-12-editor-flow/reload-check.png`
      2. Run `grep -n "NODE_WIDTH + 90" curriculum-viewer/src/pages/AuthorResearchGraphPage.tsx`
      3. Run `git diff --name-only` and confirm changed files are in planned scope
    Expected Result: Evidence exists, radial step change found, no out-of-scope files
    Evidence: .sisyphus/evidence/final-f1-plan-compliance.txt
  ```

- [x] F2. Code Quality Review

  **What to do**:
  - Run build and targeted test commands.
  - Confirm no type/lint/test regressions in touched area.

  **QA Scenario**:
  ```
  Scenario: Quality gate command suite
    Tool: Bash
    Preconditions: Changes applied for tasks 2-5
    Steps:
      1. Run `npm --prefix curriculum-viewer run build`
      2. Run `npm --prefix curriculum-viewer run test -- AuthorResearchGraphPage.test.tsx`
      3. Run `npm --prefix curriculum-viewer run test:e2e -- e2e/research-graph-verification-artifacts.spec.ts`
    Expected Result: All commands exit 0
    Evidence: .sisyphus/evidence/final-f2-quality-gates.txt
  ```

- [x] F3. Real QA Replay

  **What to do**:
  - Re-run end-to-end scenarios and compare final evidence with baseline artifacts.

  **QA Scenario**:
  ```
  Scenario: Full QA replay
    Tool: Bash + Playwright CLI
    Preconditions: Build/test gates already green
    Steps:
      1. Run `npm --prefix curriculum-viewer run test:e2e -- e2e/research-graph-verification-artifacts.spec.ts`
      2. Verify `.sisyphus/evidence/task-11-render/filter-check.json` exists and contains non-zero node labels
      3. Verify `.sisyphus/evidence/task-12-editor-flow/export.json` and `.sisyphus/evidence/task-12-editor-flow/reload-check.png` exist
    Expected Result: Replay stable and artifacts regenerated
    Evidence: .sisyphus/evidence/final-f3-qa-replay.txt
  ```

- [x] F4. Scope Fidelity Check

  **What to do**:
  - Confirm all edits map directly to spacing + test/evidence scope.

  **QA Scenario**:
  ```
  Scenario: Scope containment audit
    Tool: Bash
    Preconditions: Final diff available
    Steps:
      1. Run `git diff --name-only`
      2. Assert files are limited to planned paths: research graph page, related tests/e2e, and plan/draft markdown
      3. Run `git diff -- curriculum-viewer/src/lib/auth backend` and confirm no unrelated edits
    Expected Result: No scope creep outside planned spacing/test domains
    Evidence: .sisyphus/evidence/final-f4-scope-fidelity.txt
  ```

---

## Commit Strategy

- Commit 1: `refactor(research-graph): tighten conservative spacing constants including radial step`
- Commit 2: `test(research-graph): add spacing assertions and deterministic e2e evidence flow`

## Success Criteria

- Graph is visibly denser in research view modes.
- No node overlap or unreadable labels introduced.
- Targeted tests and build pass.
