# Research Graph Readability (Overview-First)

## TL;DR

> Make `/author/research-graph` readable at-a-glance by defaulting to an **Overview mode** that reduces label/text density and edge clutter (default: **prereq-only edges**, minimal node labels, no edge labels), while keeping a one-click switch to the existing **Editor** experience.

**Deliverables**
- Overview/Editor mode toggle on `curriculum-viewer/src/pages/AuthorResearchGraphPage.tsx`
- Overview defaults: minimal labels + prereq-only edges + edge labels hidden
- Editor-only panels hidden in Overview (Suggestions / Export / Proposed-node form / prereq connect & delete)
- Tests-after: add/adjust Vitest unit tests; optionally add a Playwright smoke spec

**Estimated Effort**: Medium
**Parallel Execution**: YES (3 waves)
**Critical Path**: Task 1 (mode defaults) -> Task 6 (page integration) -> Task 7 (unit tests)

---

## Context

### Original Request
- “Research 화면에서 그래프는 가독성이 너무 떨어져. 그래서 전체적인 그림을 파악하는 것이 어려워.”

### Repo Findings
- Route: `/author/research-graph` (`curriculum-viewer/src/routes.ts`)
- Page: `curriculum-viewer/src/pages/AuthorResearchGraphPage.tsx`
- Graph lib: React Flow (`reactflow`), with `Controls`, `MiniMap`, `Background`, `fitView`
- Current state: already has many filters + hover highlight + hover panel + suggestions/export/proposed editing UI

### Confirmed Decisions
- Approach: **overview-first** (fix label/text density + edge complexity first)
- Default on first load: **Overview mode**
- Overview default edges: **prereq only**
- Automated tests: **YES (tests after)**

### Metis Guardrails (Applied)
- Do not change graph data semantics (patch load/apply, prereq edit logic, cycle detection). Only presentation + defaults.
- Preserve hover highlight + debounce + hover panel behavior (unless explicitly changed).
- Minimize refactors in `curriculum-viewer/src/pages/AuthorResearchGraphPage.tsx`; keep changes scoped.
- Ensure prereq is enabled by default (especially avoid persistence accidentally turning it OFF).

---

## Work Objectives

### Core Objective
Reduce cognitive load so users can understand the graph’s “big picture” on first load, while keeping the existing authoring workflow available.

### Concrete Deliverables
- Mode toggle: `Overview` / `Editor`
- Overview behavior:
  - Only prereq edges visible by default
  - Edge labels hidden
  - Node labels simplified (remove id/type/depth lines; keep the primary title)
  - Hide heavy editor panels/controls (Suggestions, Export, Proposed-node add, connect/delete prereq)
- Editor behavior:
  - Restores the existing UI panels and editing affordances
- Tests to lock behavior:
  - Default mode is Overview
  - Prereq-only default in Overview
  - Mode switch reveals Editor-only sections

### Definition of Done
- `cd curriculum-viewer && npm run test` passes
- `cd curriculum-viewer && npm run build` passes
- Manual QA scenarios in each task executed and evidence saved under `.sisyphus/evidence/`

### Must Have
- Overview is the default experience
- Overview significantly reduces label + edge clutter
- One-click switch to Editor (no broken workflows)

### Must NOT Have (Guardrails)
- No changes to research patch semantics or prereq mutation logic
- No “blank canvas” confusion in Overview (must have an explicit empty state when nothing is visible)
- No breaking of existing hover panel/highlight behavior

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: YES (Vitest + Playwright)
- **Automated tests**: YES (tests-after)
- **Framework**: Vitest (`curriculum-viewer/package.json`)

### QA Policy
Every task includes agent-executed QA scenarios (Playwright for UI). Evidence saved to:
- `.sisyphus/evidence/task-{N}-{scenario-slug}.png`
- `.sisyphus/evidence/task-{N}-{scenario-slug}.txt`

Recommended commands:
```bash
cd curriculum-viewer
npm run dev
npm run test
npm run test:e2e
```

---

## Execution Strategy

### Parallel Execution Waves

Wave 1 (Foundation — can run in parallel)
- Task 1: View mode contract + defaults
- Task 2: Mode toggle UI component
- Task 3: Node label LOD helpers
- Task 4: Edge LOD helpers
- Task 5: CSS support for overview labels

Wave 2 (Integration)
- Task 6: Integrate Overview/Editor mode into `AuthorResearchGraphPage.tsx`
- Task 7: Update/add Vitest tests for mode + defaults
- Task 8: Add Playwright smoke spec for Overview mode (optional but recommended)

Wave 3 (Hardening)
- Task 9: Empty-state + responsive + a11y hardening

Critical Path: 1 -> 6 -> 7

### Dependency Matrix
- 1 -> 6, 7
- 2 -> 6, 7, 8
- 3 -> 6
- 4 -> 6
- 5 -> 6, 9
- 6 -> 7, 8, 9
- 7 -> 9, Final Verification
- 8 -> 9, Final Verification

---

## TODOs

- [x] 1. Define Research Graph View Mode Contract

  **What to do**:
  - Add a small, pure TypeScript module to define the view-mode contract and defaults:
    - New: `curriculum-viewer/src/lib/researchGraph/viewMode.ts`
    - Export `ResearchGraphViewMode = 'overview' | 'editor'`
    - Export defaults that encode confirmed decisions:
      - Overview default edges: `['prereq']`
      - Editor default edges: `['contains', 'alignsTo', 'prereq']`
      - Overview edge labels: hidden
      - Prereq must never be missing from defaults
  - Add unit tests for the contract:
    - New: `curriculum-viewer/src/lib/researchGraph/viewMode.test.ts`

  **Must NOT do**:
  - Do not import React / React Flow here; keep it framework-agnostic.
  - Do not change existing graph semantics (this is just defaults + types).

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Small isolated TypeScript module + tests.
  - **Skills**: (none)
  - **Skills Evaluated but Omitted**:
    - `playwright`: Not needed for pure unit tests.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2-5)
  - **Blocks**: Task 6, Task 7
  - **Blocked By**: None

  **References**:
  - Pattern: `curriculum-viewer/src/pages/AuthorResearchGraphPage.tsx` (edge types: `contains`, `alignsTo`, `prereq`)
  - Tests: `curriculum-viewer/src/pages/AuthorResearchGraphPage.test.tsx` (Vitest + Testing Library conventions)
  - Scripts: `curriculum-viewer/package.json` (`npm run test`)

  **Acceptance Criteria**:
  - [ ] `curriculum-viewer/src/lib/researchGraph/viewMode.ts` exports mode type + defaults
  - [ ] Defaults encode: Overview = prereq-only, Editor = all 3
  - [ ] `cd curriculum-viewer && npx vitest run src/lib/researchGraph/viewMode.test.ts` -> PASS

  **QA Scenarios**:
  ```
  Scenario: Verify view mode defaults
    Tool: Bash
    Steps:
      1. cd curriculum-viewer
      2. npx vitest run src/lib/researchGraph/viewMode.test.ts | tee ../.sisyphus/evidence/task-1-viewmode-tests.txt
    Expected Result: test run PASS
    Evidence: .sisyphus/evidence/task-1-viewmode-tests.txt

  Scenario: Guard against missing prereq default
    Tool: Bash
    Steps:
      1. cd curriculum-viewer
      2. npx vitest run src/lib/researchGraph/viewMode.test.ts -t "prereq" | tee ../.sisyphus/evidence/task-1-viewmode-prereq.txt
    Expected Result: test asserting prereq presence PASS
    Evidence: .sisyphus/evidence/task-1-viewmode-prereq.txt
  ```

  **Commit**: YES (can group with Task 2)
  - Message: `feat(research-graph): define overview/editor view mode defaults`

- [x] 2. Build Mode Toggle UI Component

  **What to do**:
  - Create a small reusable toggle for `Overview` / `Editor`:
    - New: `curriculum-viewer/src/components/ResearchGraphModeToggle.tsx`
    - Props: `{ mode: ResearchGraphViewMode; onChange: (mode) => void; disabled?: boolean }`
    - Accessibility:
      - Provide an accessible group label (e.g., `aria-label="View mode"`)
      - Buttons must have deterministic names: `Overview`, `Editor`
      - Add stable hooks for tests: `data-testid="research-graph-mode-overview"` / `...-editor`
    - Styling: reuse existing `.button`, `.button-small`, `.button-primary`, `.button-ghost`.
  - Add unit tests:
    - New: `curriculum-viewer/src/components/ResearchGraphModeToggle.test.tsx`
    - Must include a disabled-state test (no interaction when `disabled` is true)

  **Must NOT do**:
  - No localStorage in this component.
  - No changes to page layout yet (integration happens in Task 6).

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Small UI component + tests using existing design tokens.
  - **Skills**: (none)
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: Not needed; component uses existing button system.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3, 4, 5)
  - **Blocks**: Task 6, Task 7, Task 8
  - **Blocked By**: Task 1 (type import) — optional (can inline type if needed)

  **References**:
  - Pattern (button toggles): `curriculum-viewer/src/pages/AuthorResearchGraphPage.tsx` (depth filter buttons)
  - Pattern (tab-like buttons): `curriculum-viewer/src/pages/StudentStageMapPage.tsx`
  - Styles: `curriculum-viewer/src/index.css` (`.button*`)

  **Acceptance Criteria**:
  - [ ] Toggle renders and calls `onChange` correctly
  - [ ] `cd curriculum-viewer && npx vitest run src/components/ResearchGraphModeToggle.test.tsx` -> PASS

  **QA Scenarios**:
  ```
  Scenario: Toggle emits change
    Tool: Bash
    Steps:
      1. cd curriculum-viewer
      2. npx vitest run src/components/ResearchGraphModeToggle.test.tsx | tee ../.sisyphus/evidence/task-2-toggle-tests.txt
    Expected Result: PASS
    Evidence: .sisyphus/evidence/task-2-toggle-tests.txt

  Scenario: Disabled state blocks interaction
    Tool: Bash
    Steps:
      1. cd curriculum-viewer
      2. npx vitest run src/components/ResearchGraphModeToggle.test.tsx -t "disabled" | tee ../.sisyphus/evidence/task-2-toggle-disabled.txt
    Expected Result: PASS
    Evidence: .sisyphus/evidence/task-2-toggle-disabled.txt
  ```

  **Commit**: YES (group with Task 1)
  - Message: `feat(research-graph): add overview/editor mode toggle`

- [x] 3. Implement Node Label LOD Helper (Overview vs Editor)

  **What to do**:
  - Introduce a single place that defines node label content per mode:
    - New: `curriculum-viewer/src/lib/researchGraph/nodeLabel.tsx`
    - Export a function like `buildResearchNodeLabel({ mode, nodeType, label, id, depth, proposed, description })`
      - **Overview**: show only the primary title + optional `proposed` badge
      - **Editor**: preserve current rich label (type/depth + title + optional description + id)
    - Ensure Overview output uses stable classNames for CSS clamping (wired in Task 5)
  - Add unit tests:
    - New: `curriculum-viewer/src/lib/researchGraph/nodeLabel.test.tsx`
    - Include test names containing `Overview` and `Editor` (so `vitest -t` targeting works)

  **Must NOT do**:
  - Do not change how hover panel data is computed (panel stays as the detail-on-demand).
  - Do not change the underlying node/edge filtering semantics.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Pure rendering helper + unit tests.
  - **Skills**: (none)

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: Task 6
  - **Blocked By**: Task 1 (mode type) — optional

  **References**:
  - Current label markup: `curriculum-viewer/src/pages/AuthorResearchGraphPage.tsx` (node label JSX around `layeredNodes.push({ id: node.id, data: { label: (...) } })`)
  - Existing label patterns: `curriculum-viewer/src/components/CurriculumGraphView.tsx` (`.graph-node-label`)
  - Tokens/classes: `curriculum-viewer/src/index.css` (`.mono`, `.muted`, `.badge`)

  **Acceptance Criteria**:
  - [ ] Overview label renders without node id/type/depth lines
  - [ ] Editor label includes existing metadata lines
  - [ ] `cd curriculum-viewer && npx vitest run src/lib/researchGraph/nodeLabel.test.tsx` -> PASS

  **QA Scenarios**:
  ```
  Scenario: Overview label is compact
    Tool: Bash
    Steps:
      1. cd curriculum-viewer
      2. npx vitest run src/lib/researchGraph/nodeLabel.test.tsx | tee ../.sisyphus/evidence/task-3-nodelabel-tests.txt
    Expected Result: PASS
    Evidence: .sisyphus/evidence/task-3-nodelabel-tests.txt

  Scenario: Editor label contains metadata
    Tool: Bash
    Steps:
      1. cd curriculum-viewer
      2. npx vitest run src/lib/researchGraph/nodeLabel.test.tsx -t "Editor" | tee ../.sisyphus/evidence/task-3-nodelabel-editor.txt
    Expected Result: PASS
    Evidence: .sisyphus/evidence/task-3-nodelabel-editor.txt
  ```

  **Commit**: YES (can group with Task 4)
  - Message: `feat(research-graph): add node label LOD helpers`

- [x] 4. Implement Edge LOD Helper (Prereq-Only + Hide Edge Labels)

  **What to do**:
  - Centralize “which edges are allowed in which mode” in a tiny helper:
    - New: `curriculum-viewer/src/lib/researchGraph/edgeLod.ts`
    - Export functions like:
      - `isEdgeTypeVisibleInMode({ mode, edgeType })` (Overview => only `prereq`)
      - `getEdgeLabelForMode({ mode, edgeType })` (Overview => `undefined`)
  - Add unit tests:
    - New: `curriculum-viewer/src/lib/researchGraph/edgeLod.test.ts`
    - Include test names containing `Editor` (so `vitest -t` targeting works)

  **Must NOT do**:
  - Do not change `getEdgeStyle` semantics in `curriculum-viewer/src/lib/curriculum2022/view.ts`.
  - Do not add new edge types or alter patch data.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Small pure helper + unit tests.
  - **Skills**: (none)

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: Task 6
  - **Blocked By**: Task 1 (mode type) — optional

  **References**:
  - Edge styles: `curriculum-viewer/src/lib/curriculum2022/view.ts` (`getEdgeStyle()`)
  - Current edge build: `curriculum-viewer/src/pages/AuthorResearchGraphPage.tsx` (`edges` useMemo)

  **Acceptance Criteria**:
  - [ ] Overview mode rules: only prereq edges; no edge labels
  - [ ] `cd curriculum-viewer && npx vitest run src/lib/researchGraph/edgeLod.test.ts` -> PASS

  **QA Scenarios**:
  ```
  Scenario: Edge visibility and label rules
    Tool: Bash
    Steps:
      1. cd curriculum-viewer
      2. npx vitest run src/lib/researchGraph/edgeLod.test.ts | tee ../.sisyphus/evidence/task-4-edgelod-tests.txt
    Expected Result: PASS
    Evidence: .sisyphus/evidence/task-4-edgelod-tests.txt

  Scenario: Editor mode keeps edge labels available
    Tool: Bash
    Steps:
      1. cd curriculum-viewer
      2. npx vitest run src/lib/researchGraph/edgeLod.test.ts -t "Editor" | tee ../.sisyphus/evidence/task-4-edgelod-editor.txt
    Expected Result: PASS
    Evidence: .sisyphus/evidence/task-4-edgelod-editor.txt
  ```

  **Commit**: YES (group with Task 3)
  - Message: `feat(research-graph): add edge LOD helpers`

- [x] 5. Add CSS Support for Overview Labels (Clamp + Less Noise)

  **What to do**:
  - Update CSS to support compact node labels in Overview mode:
    - Update: `curriculum-viewer/src/index.css`
    - Add small, scoped classes used only by the research graph label helper, e.g.:
      - `.research-node-title` (line clamp, overflow-wrap)
      - `.research-node-meta` (Editor-only metadata)
      - `.research-node--overview` (optional: tighter line-height)
    - Ensure styles don’t affect other pages (prefix with `research-` and use only where class is applied).

  **Must NOT do**:
  - Do not restyle the entire app; keep changes local to research graph labels.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: CSS tweaks with UX impact; must be verified in browser.
  - **Skills**: [`playwright`]
    - `playwright`: Visual verification + screenshot evidence.
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: Not needed if staying within existing tokens.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: Task 6, Task 9
  - **Blocked By**: Task 3 (needs the class names it will apply)

  **References**:
  - Tokens/classes: `curriculum-viewer/src/index.css` (`.mono`, `.muted`, `.badge`, `--space-*`)
  - Node label patterns: `curriculum-viewer/src/components/CurriculumGraphView.tsx`

  **Acceptance Criteria**:
  - [ ] New CSS classes exist and are scoped
  - [ ] `cd curriculum-viewer && npm run build` -> PASS

  **QA Scenarios**:
  ```
  Scenario: Build passes with CSS changes
    Tool: Bash
    Steps:
      1. cd curriculum-viewer
      2. npm run build | tee ../.sisyphus/evidence/task-5-css-build.txt
    Expected Result: PASS
    Evidence: .sisyphus/evidence/task-5-css-build.txt

  Scenario: Regression check (GraphPage tests still pass)
    Tool: Bash
    Steps:
      1. cd curriculum-viewer
      2. npx vitest run src/pages/GraphPage.test.tsx | tee ../.sisyphus/evidence/task-5-graphpage-tests.txt
    Expected Result: PASS
    Evidence: .sisyphus/evidence/task-5-graphpage-tests.txt
  ```

  **Commit**: YES (can group with Task 6)
  - Message: `style(research-graph): clamp overview node labels`

- [x] 6. Integrate Overview/Editor Mode Into AuthorResearchGraphPage

  **What to do**:
  - Update the page to default to Overview and reduce clutter:
    - Update: `curriculum-viewer/src/pages/AuthorResearchGraphPage.tsx`
  - Mode state + toggle:
    - Add `viewMode` state (default: `overview`)
    - Render `ResearchGraphModeToggle` near the top of the page controls
    - Do NOT rename the page heading unless you also update tests (tests currently assert it)
    - Default persistence: **no persistence** (always start in Overview)
  - Overview defaults:
    - Enforce prereq-only edges by default in Overview
    - Hide edge labels in Overview
    - Use `buildResearchNodeLabel()` to simplify node label content in Overview
    - Disable editing affordances in Overview:
      - `nodesConnectable={false}`
      - Hide/disable prereq connect/delete UI
    - Reduce top-level UI noise:
      - In Overview, show only: mode toggle, track select, and a compact meta line (node/edge counts)
      - Provide a single collapsed “Filters” control in Overview that can reveal:
        - Domain layers
        - Depth filter
        - Grade-band filter
      - Keep edge-type toggles and all editing actions Editor-only
    - Optional (if it meaningfully reduces clutter): hide depth header nodes in Overview (keep domain headers).
  - Editor mode:
    - Restore current authoring panels/controls:
      - Edge filter controls
      - Research Suggestions panel
      - Export JSON panel
      - Proposed 노드 추가 form
      - prereq connect/delete UI
    - On switch to Editor, default edge visibility should be the Editor default (all 3) unless the user already changed edge toggles in this session.
  - Practical UX defaults:
    - When switching **to Overview**, close transient editor UI (export panel / proposed form / selected prereq) to reduce noise.
    - Keep prereq always enabled by default (guardrail).

  **Must NOT do**:
  - Do not change research patch semantics:
    - `curriculum-viewer/src/lib/research/loaders.ts`
    - `curriculum-viewer/src/lib/research/applyResearchPatch.ts`
    - `curriculum-viewer/src/lib/curriculum2022/prereqEdit.ts`
  - Do not break hover panel behavior (`data-testid="research-hover-panel"`).

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Large single-file integration with multiple UI sections and state interactions.
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Keep the UI intentional while reducing clutter; avoid breaking author workflow.
  - **Skills Evaluated but Omitted**:
    - `playwright`: Better used in Task 8 & Final QA.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2 (must complete before Tasks 7-9 finalize)
  - **Blocks**: Task 7, Task 8, Task 9
  - **Blocked By**: Tasks 1-5

  **References**:
  - Main page: `curriculum-viewer/src/pages/AuthorResearchGraphPage.tsx`
  - Toggle component: `curriculum-viewer/src/components/ResearchGraphModeToggle.tsx`
  - Node label helper: `curriculum-viewer/src/lib/researchGraph/nodeLabel.tsx`
  - Edge helper: `curriculum-viewer/src/lib/researchGraph/edgeLod.ts`
  - Existing edge styles: `curriculum-viewer/src/lib/curriculum2022/view.ts`
  - Existing hover behavior tests: `curriculum-viewer/src/pages/AuthorResearchGraphPage.test.tsx`

  **Acceptance Criteria**:
  - [ ] First load shows Overview mode active
  - [ ] Overview hides: Research Suggestions / Export JSON / Proposed 노드 추가 / prereq connect+delete UI
  - [ ] Overview: `latestReactFlowProps.nodesConnectable === false` (validated via unit tests in Task 7)
  - [ ] Overview edges: only prereq edges passed to ReactFlow
  - [ ] Overview edges: no edge labels rendered
  - [ ] `cd curriculum-viewer && npm run build` -> PASS

  **QA Scenarios**:
  ```
  Scenario: Build the app after integration
    Tool: Bash
    Steps:
      1. cd curriculum-viewer
      2. npm run build | tee ../.sisyphus/evidence/task-6-build.txt
    Expected Result: PASS
    Evidence: .sisyphus/evidence/task-6-build.txt

  Scenario: Overview behavior verified by tests (after Task 7)
    Tool: Bash
    Steps:
      1. cd curriculum-viewer
      2. npx vitest run src/pages/AuthorResearchGraphPage.test.tsx | tee ../.sisyphus/evidence/task-6-page-tests.txt
    Expected Result: PASS
    Evidence: .sisyphus/evidence/task-6-page-tests.txt

  Scenario: E2E verifies overview/editor switch (after Task 8)
    Tool: Bash
    Steps:
      1. cd curriculum-viewer
      2. npx playwright test e2e/research-graph-overview.spec.ts | tee ../.sisyphus/evidence/task-6-e2e.txt
    Expected Result: PASS
    Evidence: .sisyphus/evidence/task-6-e2e.txt
  ```

  **Commit**: YES
  - Message: `feat(research-graph): default to overview mode for readability`

- [x] 7. Update Vitest Unit Tests for Overview/Editor Behavior

  **What to do**:
  - Update existing tests to reflect the new default mode and to explicitly switch to Editor mode when testing authoring features:
    - Update: `curriculum-viewer/src/pages/AuthorResearchGraphPage.test.tsx`
  - Add new assertions:
    - Default mode is Overview (mode toggle state)
    - Overview hides Editor-only UI (e.g., `Research Suggestions`, `Export JSON`, `Proposed 노드 추가`)
    - Overview enforces prereq-only edges:
      - `latestReactFlowProps.edges` contains only `id` starting with `prereq:`
      - `latestReactFlowProps.edges` have `label === undefined` (edge labels hidden in Overview)
    - Overview disables editing:
      - `latestReactFlowProps.nodesConnectable === false`
  - Update existing authoring tests (proposed node creation, prereq connect/delete) to:
    - Click `Editor` in the mode toggle first

  **Must NOT do**:
  - Do not weaken tests into “smoke-only”. Keep meaningful assertions.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Focused test updates in a single file.
  - **Skills**: (none)

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (parallel with Task 8)
  - **Blocks**: Task 9, Final Verification
  - **Blocked By**: Task 6

  **References**:
  - Test file: `curriculum-viewer/src/pages/AuthorResearchGraphPage.test.tsx`
  - ReactFlow mock pattern: same file (`vi.mock('reactflow', ...)`)

  **Acceptance Criteria**:
  - [ ] New tests cover default Overview + prereq-only + edit disabled
  - [ ] Existing tests updated to switch to Editor when needed
  - [ ] `cd curriculum-viewer && npx vitest run src/pages/AuthorResearchGraphPage.test.tsx` -> PASS

  **QA Scenarios**:
  ```
  Scenario: Page unit tests pass
    Tool: Bash
    Steps:
      1. cd curriculum-viewer
      2. npx vitest run src/pages/AuthorResearchGraphPage.test.tsx | tee ../.sisyphus/evidence/task-7-page-tests.txt
    Expected Result: PASS
    Evidence: .sisyphus/evidence/task-7-page-tests.txt

  Scenario: Editor-only authoring flow still works (targeted)
    Tool: Bash
    Steps:
      1. cd curriculum-viewer
      2. npx vitest run src/pages/AuthorResearchGraphPage.test.tsx -t "proposed node" | tee ../.sisyphus/evidence/task-7-editor-authoring.txt
    Expected Result: PASS
    Evidence: .sisyphus/evidence/task-7-editor-authoring.txt
  ```

  **Commit**: YES
  - Message: `test(research-graph): cover overview/editor defaults`

- [x] 8. Add Playwright E2E Smoke Spec for Overview Mode

  **What to do**:
  - Add an E2E spec that validates the real browser behavior end-to-end:
    - New: `curriculum-viewer/e2e/research-graph-overview.spec.ts`
  - Flow (match existing auth approach in e2e suite):
    - (Edge case) Add a test with title containing `redirect` to verify unauthenticated access redirects to `/login`
    - Login as `admin` / `admin`
    - Enter author mode (click `관리자 모드`)
    - Navigate via author nav: click `Research`
    - Assert:
      - Heading visible: `Research Graph Editor`
      - Overview mode active by default
      - Editor-only panels hidden
    - Switch to Editor:
      - Assert Suggestions visible + `Export JSON` button visible
    - Capture screenshots to `.sisyphus/evidence/`:
      - `../.sisyphus/evidence/task-8-overview-default.png`
      - `../.sisyphus/evidence/task-8-editor.png`

  **Must NOT do**:
  - Avoid brittle selectors (no deep CSS chains). Prefer role/name + `data-testid` from Task 6.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: E2E with auth + routing + UI state.
  - **Skills**: [`playwright`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (parallel with Task 7)
  - **Blocks**: Final Verification
  - **Blocked By**: Task 6

  **References**:
  - Existing E2E auth flow: `curriculum-viewer/e2e/homework-problem-bank.spec.ts`
  - Author nav link name: `curriculum-viewer/src/components/AuthorLayout.tsx` (link text `Research`)
  - Playwright config: `curriculum-viewer/playwright.config.ts`

  **Acceptance Criteria**:
  - [ ] `cd curriculum-viewer && npx playwright test e2e/research-graph-overview.spec.ts` -> PASS
  - [ ] Evidence screenshots exist:
    - `.sisyphus/evidence/task-8-overview-default.png`
    - `.sisyphus/evidence/task-8-editor.png`

  **QA Scenarios**:
  ```
  Scenario: E2E overview smoke
    Tool: Bash
    Steps:
      1. cd curriculum-viewer
      2. npx playwright test e2e/research-graph-overview.spec.ts | tee ../.sisyphus/evidence/task-8-e2e.txt
    Expected Result: PASS
    Evidence: .sisyphus/evidence/task-8-e2e.txt

  Scenario: Redirect when unauthenticated
    Tool: Bash
    Steps:
      1. cd curriculum-viewer
      2. npx playwright test e2e/research-graph-overview.spec.ts -g "redirect" | tee ../.sisyphus/evidence/task-8-e2e-redirect.txt
    Expected Result: PASS
    Evidence: .sisyphus/evidence/task-8-e2e-redirect.txt
  ```

  **Commit**: YES
  - Message: `test(e2e): add research graph overview smoke`

- [x] 9. Hardening: Empty State + Responsive + A11y in Overview

  **What to do**:
  - Ensure Overview never looks “broken”:
    - If filters result in no visible nodes, show a clear empty-state message + a reset action.
    - Decide and document cycle alert behavior (recommend: keep cycle alert visible in both modes).
  - Responsive:
    - Ensure mode toggle + track select remain usable on narrow viewports.
    - Prefer collapsing advanced controls in Overview (e.g., via `<details>` or a simple “Advanced” toggle).
    - Extend the E2E spec with a mobile-viewport check (test name includes `mobile`) and capture a screenshot:
      - `../.sisyphus/evidence/task-9-mobile.png`
  - Accessibility:
    - Ensure controls have stable labels and the canvas retains `aria-label="Research graph canvas"`.

  **Must NOT do**:
  - No broad redesign; keep within existing visual language.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Responsive + a11y polish is UX-heavy.
  - **Skills**: [`playwright`, `frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (final hardening)
  - **Blocks**: Final Verification
  - **Blocked By**: Tasks 6-8

  **References**:
  - Canvas and hover panel CSS: `curriculum-viewer/src/index.css` (`.graph-canvas`, `.research-hover-panel`)
  - Page status messages/cycle alert: `curriculum-viewer/src/pages/AuthorResearchGraphPage.tsx`

  **Acceptance Criteria**:
  - [ ] Overview empty state is explicit (no silent blank canvas)
  - [ ] Narrow viewport still usable (toggle + track visible)
  - [ ] `cd curriculum-viewer && npm run test` -> PASS
  - [ ] `cd curriculum-viewer && npx playwright test e2e/research-graph-overview.spec.ts` -> PASS
  - [ ] Mobile evidence screenshot exists: `.sisyphus/evidence/task-9-mobile.png`

  **QA Scenarios**:
  ```
  Scenario: Full test pass after hardening
    Tool: Bash
    Steps:
      1. cd curriculum-viewer
      2. npm run test | tee ../.sisyphus/evidence/task-9-vitest.txt
      3. npx playwright test e2e/research-graph-overview.spec.ts | tee ../.sisyphus/evidence/task-9-e2e.txt
    Expected Result: All PASS
    Evidence: .sisyphus/evidence/task-9-vitest.txt and .sisyphus/evidence/task-9-e2e.txt

  Scenario: Mobile viewport usable (screenshot)
    Tool: Bash
    Steps:
      1. cd curriculum-viewer
      2. npx playwright test e2e/research-graph-overview.spec.ts -g "mobile" | tee ../.sisyphus/evidence/task-9-mobile.txt
    Expected Result: PASS and screenshot written
    Evidence: .sisyphus/evidence/task-9-mobile.txt and .sisyphus/evidence/task-9-mobile.png
  ```

  **Commit**: YES (optional)
  - Message: `chore(research-graph): harden overview UX and responsiveness`

---

## Final Verification Wave (MANDATORY)

- [x] F1. Plan Compliance Audit

  **Recommended Agent Profile**:
  - **Category**: `subagent_type=oracle`
  - **Skills**: (none)

  **What to do**:
  - Read the plan end-to-end and verify each “Must Have / Must NOT Have” against the implemented code.
  - Confirm evidence files exist under `.sisyphus/evidence/` for Tasks 1-9.
  - Verify Overview is default and prereq-only/label-minimal behavior is present.
  - Confirm no patch semantic changes by scanning diffs for:
    - `curriculum-viewer/src/lib/research/`
    - `curriculum-viewer/src/lib/curriculum2022/prereqEdit.ts`

  **Output**:
  - `Must Have [N/N] | Must NOT Have [N/N] | Evidence [N/N] | VERDICT: APPROVE/REJECT`

- [x] F2. Code Quality Review

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: (none)

  **What to do**:
  - Run:
    - `cd curriculum-viewer && npm run build`
    - `cd curriculum-viewer && npm run test`
  - Review changed files for:
    - Over-complicated state transitions
    - Unstable selectors in tests
    - Accidental global CSS impact
    - Console noise / dead code

  **Output**:
  - `Build [PASS/FAIL] | Tests [PASS/FAIL] | Notes [..] | VERDICT`

- [x] F3. Real QA Run (Playwright)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: [`playwright`]

  **What to do**:
  - Execute ALL QA scenarios from Tasks 6-9.
  - Run the E2E spec and confirm screenshots are captured.
  - Validate responsiveness by running at least one narrow viewport run.
  - Save additional evidence to `.sisyphus/evidence/final-qa/`.

  **Output**:
  - `Scenarios [N/N pass] | E2E [PASS/FAIL] | Responsive [PASS/FAIL] | VERDICT`

- [x] F4. Scope Fidelity Check

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: (none)

  **What to do**:
  - Confirm changes map 1:1 to this plan (no scope creep).
  - Ensure Overview improvements are in place without altering authoring logic.
  - Flag any unrelated refactors, renames, or behavior changes.

  **Output**:
  - `Tasks [N/N compliant] | Scope creep [CLEAN/N issues] | VERDICT`

---

## Commit Strategy
- Commit 1: `feat(research-graph): add overview mode defaults`
- Commit 2: `test(research-graph): cover overview/editor behavior`
- Commit 3 (optional): `test(e2e): add overview smoke`

---

## Success Criteria
- Overview mode is default and clearly reduces clutter (labels + edges)
- Editor mode remains fully functional
- Unit tests + build pass
- Evidence files exist for each QA scenario
