# Node Goal + Example Problems Guide (Research Graph)

## TL;DR
> Add a repo-managed, curriculum-aligned per-node guide (summary goal + problem-generation guide) for 2022 Research Graph nodes, and display it in `/author/research-graph` hover panel alongside existing derived goals + example prompts.

**Deliverables**
- New guide data file (versioned) keyed by 2022 nodeId
- Loader/indexer utilities for fast lookup by nodeId
- Hover panel UI additions: `요약 목표`, `문제 생성 가이드`
- Minimal Vitest coverage (tests-after) + agent-executed QA scenarios
- Authoring instructions (how to derive objectives from curriculum + how to write guides)

**Estimated Effort**: Medium
**Parallel Execution**: YES (2-3 waves)
**Critical Path**: Data schema → loader/index → UI rendering → tests

---

## Context

### Original Request (Korean)
- Research graph readability is improved; now author wants a guide for generating per-node "목표" and "예시문제".
- Need to inspect 2022 curriculum to determine unit-by-unit objectives.
- Write a problem-generation guide aligned to those objectives.
- Display guide on the node in the UI.

### Key Repo Facts (verified)
- Hover panel already exists and renders:
  - `목표`: derived from aligned `achievement` nodes (`label + text`)
  - `예시 문제`: prompt list derived from `curriculum-viewer/public/data/problems_2022_v1.json`
  - File: `curriculum-viewer/src/pages/AuthorResearchGraphPage.tsx` (`data-testid="research-hover-panel"`)
- 2022 curriculum graph data: `curriculum-viewer/public/data/curriculum_math_2022.json`
- Problem generation automation doc exists: `curriculum-viewer/docs/problem-generation.md`

### Confirmed Decisions
- Target first: Research Graph (`/author/research-graph`) 2022 node IDs like `2수01-A`, `2수01-01`
- Guide authoring/storage: separate repo-managed data file (NOT in-app editor)
- Hover panel: keep existing derived goals + add `요약 목표` and `문제 생성 가이드`
- Tests: YES (tests-after, minimal)
- Content coverage (this execution): Seed only (10 achievements + 3 units)

### Metis Review (applied)
- Avoid scope creep into "bulk authoring for all nodes"; deliver schema + UI + samples + workflow.
- Add explicit fallbacks for missing guide entries.
- Prefer plain text rendering (preserve newlines) to avoid XSS/markdown complexity.
- Define precedence/mapping rules: exact nodeId lookup first; unit-level guide does not auto-merge from achievements unless explicitly enabled.

---

## Work Objectives

### Core Objective
Enable curriculum-aligned per-node guide content (summary objective + problem-generation guide) to be authored in-repo and surfaced in the research hover panel with deterministic fallbacks.

### Concrete Deliverables
- New file: `curriculum-viewer/public/data/research/node_guides_2022_v1.json` (name can change, keep stable once chosen)
- New/updated code to load + index the guide file and show it in hover panel
- New/updated docs: authoring guide (derive objectives from curriculum + write guide)
- Tests: minimal Vitest coverage for hover panel rendering + fallbacks

### Must Have
- Guide data file is versioned + keyed by 2022 nodeId
- Hover panel shows two new sections:
  - `요약 목표` (single short sentence, authored)
  - `문제 생성 가이드` (plain text w/ newlines preserved)
- Missing guide entry never crashes; shows a clear `(준비중)` fallback
- Existing `목표` + `예시 문제` behavior remains unchanged

### Must NOT Have (Guardrails)
- Do NOT introduce an in-app editor / DB persistence for guides
- Do NOT move guide content into `problems_2022_v1.json` (keep example problems separate)
- Do NOT duplicate long official curriculum wording; guide should be operational (how to generate problems)
- Do NOT render unsafe HTML from guide content

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: YES (Vitest + Playwright in repo)
- **Automated tests**: YES (tests-after)
- **Primary**: Vitest component/page tests around `AuthorResearchGraphPage` hover panel

### QA Policy (agent-executed)
- Every task includes QA scenarios with exact commands and evidence paths.
- Evidence saved under `.sisyphus/evidence/`.

---

## Execution Strategy

### Parallel Execution Waves

Wave 1 (Data contracts + scaffolding — start immediately)
- Task 1: Define guide JSON schema + file location + sample entries
- Task 2: Seed initial curriculum-aligned content set (10 achievements + 3 units)
- Task 3: Add TypeScript types + runtime-safe parsing helpers (no new deps)
- Task 4: Implement loader/repository for guide file (cached)
- Task 5: Implement lookup + fallback policy helper

Wave 2 (UI integration + docs — after Wave 1)
- Task 6: Add hover panel sections (`요약 목표`, `문제 생성 가이드`) + formatting
- Task 7: Add authoring docs + tie into existing problem generation doc

Wave 3 (Verification — after Wave 2)
- Task 8: Add minimal Vitest coverage + non-regression assertions

---

## TODOs

---

- [x] 1. Define guide JSON schema + file location (Research Graph 2022)

  **What to do**:
  - Choose one stable path for the guide file.
    - Recommended: `curriculum-viewer/public/data/research/node_guides_2022_v1.json`
  - Define a minimal, versioned JSON schema (no HTML/markdown needed):
    - `meta.schemaVersion` (number)
    - `meta.curriculumVersion` ("KR-MATH-2022")
    - `nodes` object keyed by exact 2022 `nodeId`
    - Each node entry:
      - `summaryGoal` (string)
      - `learningObjectives` (string[] optional)
      - `problemGenerationGuideText` (string; multi-line)
      - optional: `updatedAt`, `tags`
  - Decide missing-data policy strings:
    - Fallback summary: `(준비중)`
    - Fallback guide: `(준비중)`

  **Must NOT do**:
  - Do not add an in-app editor.
  - Do not introduce markdown/HTML rendering complexity.

  **Recommended Agent Profile**:
  - **Category**: `writing`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 3, 4)
  - **Blocks**: Task 5-8

  **References**:
  - `curriculum-viewer/public/data/curriculum_math_2022.json` - valid node IDs and node types
  - `curriculum-viewer/src/pages/AuthorResearchGraphPage.tsx` - hover panel placement and UX constraints

  **Acceptance Criteria**:
  - [ ] Guide file path is finalized and documented in plan + doc tasks
  - [ ] Schema includes version metadata and nodes map

  **QA Scenarios**:

  ```
  Scenario: Guide file schema sanity via jq
    Tool: Bash
    Steps:
      1. jq -e '.meta.schemaVersion and .meta.curriculumVersion and .nodes' curriculum-viewer/public/data/research/node_guides_2022_v1.json
    Expected Result: jq exits 0
    Evidence: .sisyphus/evidence/task-1-guide-schema-jq.txt
  ```

- [x] 2. Seed initial curriculum-aligned guides (small coverage set)

  **What to do**:
  - Add initial entries to `nodes`:
    - 10 `achievement` ids (like `2수01-01`)
    - 3 `textbookUnit` ids (like `2수01-A`)
  - If you want full coverage in this same execution, add a follow-up “bulk backfill” task after Task 8 (see note in Summary).
  - Authoring rules (apply consistently):
    - `summaryGoal`: 1 sentence, <= 120 chars
    - `learningObjectives`: 0-5 bullets
    - `problemGenerationGuideText`: 8-15 lines preferred; <= 25 lines
    - Avoid pasting official text verbatim; paraphrase and focus on *what to assess*
  - For textbookUnit entries, do not attempt to list all achievements; keep to a unit-level summary + “참고: 해당 단원 alignsTo 성취기준 가이드” note.

  **Recommended Agent Profile**:
  - **Category**: `writing`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 3, 4)
  - **Blocked By**: Task 1

  **References**:
  - `curriculum-viewer/public/data/curriculum_math_2022.json` - achievement label/text for context
  - `curriculum-viewer/public/data/problems_2022_v1.json` - existing example prompts (keep consistent with objectives)

  **Acceptance Criteria**:
  - [ ] At least 13 total entries exist (10 achievement + 3 unit)
  - [ ] Each seeded id exists in `curriculum_math_2022.json`

  **QA Scenarios**:

  ```
  Scenario: Seeded nodeIds exist in curriculum (sample)
    Tool: Bash
    Steps:
      1. jq -r '.nodes | keys[]' curriculum-viewer/public/data/research/node_guides_2022_v1.json | head -n 20
      2. For each sampled id, verify it appears in curriculum-viewer/public/data/curriculum_math_2022.json
    Expected Result: No missing ids in sample
    Evidence: .sisyphus/evidence/task-2-seeded-ids-exist.txt
  ```

- [x] 3. Add TypeScript types + runtime-safe parsing helpers

  **What to do**:
  - Define TS types for guide schema.
  - Add minimal runtime validation (no new deps):
    - check `meta.schemaVersion` is a number
    - check `nodes` is an object
    - coerce missing optional fields
  - Ensure guide text is treated as plain text.

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 2, 4)
  - **Blocked By**: Task 1

  **References**:
  - `curriculum-viewer/src/lib/learn/problems.ts` - pattern for JSON typing + loading

  **Acceptance Criteria**:
  - [ ] Types compile; parsing helper returns typed object or throws a clear error

  **QA Scenarios**:

  ```
  Scenario: Typecheck path (local)
    Tool: Bash
    Steps:
      1. cd curriculum-viewer
      2. npm run build
    Expected Result: Build succeeds
    Evidence: .sisyphus/evidence/task-3-build-ok.txt
  ```

- [x] 4. Implement guide loader/repository (cached)

  **What to do**:
  - Load the guide JSON from `public/data/research/...`.
  - Cache parsed result; avoid repeated parsing on every hover.
  - Expose API: `loadNodeGuideIndex(signal?)` returning `{ guideByNodeId }`.

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 2, 3)
  - **Blocked By**: Task 1

  **References**:
  - `curriculum-viewer/src/lib/repository/problemRepository.ts` - existing repository patterns

  **Acceptance Criteria**:
  - [ ] Loader returns index map with >= 13 entries
  - [ ] Loader supports abort via AbortSignal (if pattern exists in repo)

  **QA Scenarios**:

  ```
  Scenario: Loader smoke via existing test harness
    Tool: Bash
    Steps:
      1. Run the targeted page test after integrating loader (see Task 8)
    Expected Result: PASS
    Evidence: .sisyphus/evidence/task-4-loader-covered-by-tests.txt
  ```

- [x] 5. Implement guide lookup + fallback policy helper

  **What to do**:
  - Provide a single helper:
    - `getNodeGuideOrFallback(nodeId)` -> `{ summaryGoalText, guideText, hasGuide }`
  - Fallbacks are stable strings: `(준비중)`.
  - No implicit cross-node merging (no alignsTo aggregation) unless explicitly enabled later.

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocked By**: Task 4
  - **Blocks**: Task 6, Task 8

  **Acceptance Criteria**:
  - [ ] Known seeded id returns `hasGuide=true`
  - [ ] Unknown id returns `hasGuide=false` and both texts equal `(준비중)`

  **QA Scenarios**:

  ```
  Scenario: Fallback policy sanity
    Tool: Vitest
    Steps:
      1. Add a small unit test OR assert through the page test that unknown node shows "(준비중)"
    Expected Result: PASS
    Evidence: .sisyphus/evidence/task-5-fallback-covered.txt
  ```

- [x] 6. Add hover panel sections (`요약 목표`, `문제 생성 가이드`) + formatting

  **What to do**:
  - In `curriculum-viewer/src/pages/AuthorResearchGraphPage.tsx`, extend the hover panel:
    - Insert `요약 목표` section above existing `목표` (or immediately after title block).
    - Insert `문제 생성 가이드` section near `예시 문제` (prefer: between `목표` and `예시 문제`).
  - Render guide text as plain text with newlines preserved (`white-space: pre-wrap`).
  - Keep existing `목표` and `예시 문제` computation unchanged.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2
  - **Blocked By**: Task 4, Task 5
  - **Blocks**: Task 8

  **References**:
  - `curriculum-viewer/src/pages/AuthorResearchGraphPage.tsx` - current hover panel structure

  **Acceptance Criteria**:
  - [ ] Hover panel shows the two new headers and correct content/fallback
  - [ ] No console errors added

  **QA Scenarios**:

  ```
  Scenario: Visual smoke in dev
    Tool: Playwright
    Steps:
      1. Start dev server
      2. Visit /author/research-graph
      3. Hover one seeded node id and capture screenshot
    Expected Result: New sections visible and readable
    Evidence: .sisyphus/evidence/task-6-hover-smoke.png
  ```

- [x] 7. Documentation: objectives + guide authoring workflow

  **What to do**:
  - Create a concise doc (recommended location): `curriculum-viewer/docs/node-guide-authoring.md`.
  - Include:
    - schema definition + example entry
    - how to derive objectives from `curriculum_math_2022.json` (achievement text as context)
    - how to write `problemGenerationGuideText` (focus/constraints/item types/pitfalls/answer format)
    - how to generate/refresh example problems using `docs/problem-generation.md`

  **Recommended Agent Profile**:
  - **Category**: `writing`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Task 6)

  **Acceptance Criteria**:
  - [ ] Doc references the exact guide JSON path and hover panel page
  - [ ] Includes one achievement id and one textbookUnit id walkthrough

  **QA Scenarios**:

  ```
  Scenario: Doc reference sanity
    Tool: Bash
    Steps:
      1. Ensure the doc includes both file paths and at least one concrete nodeId example
    Expected Result: Actionable doc
    Evidence: .sisyphus/evidence/task-7-doc-sanity.txt
  ```

- [x] 8. Tests-after: update `AuthorResearchGraphPage` hover tests

  **What to do**:
  - Add/extend tests in `curriculum-viewer/src/pages/AuthorResearchGraphPage.test.tsx` to assert:
    - seeded id shows `요약 목표` and `문제 생성 가이드` with expected text snippet
    - unseeded id shows `(준비중)` for both
    - existing `목표` and `예시 문제` still show
  - Keep tests deterministic by mocking ReactFlow hover and selecting a known node id.

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3
  - **Blocked By**: Task 6

  **References**:
  - `curriculum-viewer/src/pages/AuthorResearchGraphPage.test.tsx`
  - `curriculum-viewer/src/pages/AuthorResearchGraphPage.tsx`

  **Acceptance Criteria**:
  - [ ] `cd curriculum-viewer && npm run test -- src/pages/AuthorResearchGraphPage.test.tsx` passes
  - [ ] `cd curriculum-viewer && npm run test` passes

  **QA Scenarios**:

  ```
  Scenario: Targeted test run
    Tool: Bash
    Steps:
      1. cd curriculum-viewer
      2. npm run test -- src/pages/AuthorResearchGraphPage.test.tsx
    Expected Result: PASS
    Evidence: .sisyphus/evidence/task-8-vitest-targeted.txt
  ```

## Final Verification Wave

- Run full frontend unit tests and build.
- Validate hover behavior on a node with a guide entry and a node without one.

---

## Commit Strategy

- Commit A: data schema + loader + UI integration
- Commit B: tests + docs

---

## Success Criteria

- `/author/research-graph` hover panel shows `요약 목표` + `문제 생성 가이드` for a known nodeId with guide data.
- Hover panel shows `(준비중)` fallbacks for missing guide entries without breaking existing sections.
- `cd curriculum-viewer && npm test` passes.
