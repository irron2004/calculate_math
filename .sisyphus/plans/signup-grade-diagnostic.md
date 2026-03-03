# Signup Grade-Based Diagnostic (Adjacent-Grade Node Test)

## TL;DR
Implement an immediate (post-signup) diagnostic that uses the signup grade to generate an 8-question NA-only test drawn from adjacent-grade nodes (pre=grade-1, post=grade+1). Save results to `student/profile` and show a simple pre/post diagnosis on the result page.

## Context
### Why
- You want a pedagogical flow at signup: confirm readiness (previous grade) and stretch (next grade) with a lightweight diagnosis.

### Current System (Repo Facts)
- Signup collects `grade`: `curriculum-viewer/src/pages/SignupPage.tsx`.
- Registration stores `grade` on user: `backend/app/api.py` `POST /api/auth/register`.
- Existing diagnostic flow is onboarding survey -> placement test:
  - Survey draft stored in sessionStorage key `onboarding:survey:v1` (`curriculum-viewer/src/pages/OnboardingSurveyPage.tsx`).
  - Placement test requires that draft; otherwise it redirects back to survey (`curriculum-viewer/src/pages/PlacementTestPage.tsx`).
  - Results stored in `POST /api/student/profile` as flexible dicts: `survey`, `placement` (`curriculum-viewer/src/lib/studentProfile/api.ts`, `backend/app/api.py`).
- Problem bank exists and is keyed by curriculum v1 node ids:
  - `curriculum-viewer/public/data/problems_v1.json` loaded by `curriculum-viewer/src/lib/learn/problems.ts`.
- Student UI curriculum uses v1 hierarchy:
  - `curriculum-viewer/public/data/curriculum_math_v1.json` loaded by `curriculum-viewer/src/lib/curriculum/CurriculumProvider.tsx`.

## Requirements (Confirmed)
- Trigger: immediately after signup success (skip onboarding survey step).
- Domain: NA only.
- Pre/Post definition: adjacent grades only.
- Length: 8 questions total.
  - Default: pre 4 + post 4.
  - Edge grades: if one side missing (G1 pre, G6 post), fill missing side with same-grade questions.

## Non-Goals / Guardrails
- Do not re-architect the entire onboarding pipeline.
- Do not switch student-facing diagnostic to 2022 research graph node ids unless we also build a 2022-keyed problem bank.
- Keep existing onboarding survey + placement flow working for non-signup entry points.

## Verification Strategy
### Automated Tests
- Frontend unit tests: `vitest` (existing).
- Frontend E2E: `playwright` (existing).
- Backend tests (only if we touch API contracts): `pytest` (existing).

### QA Policy
- Every task includes agent-executed QA scenarios (no human-only verification).
- Prefer deterministic test data and explicit selectors / expected text.

## Execution Strategy (Parallel Waves)

Wave 1 (Foundations)
- T1: Diagnostic selection + question assembly module (adjacent-grade, NA-only)
- T2: Ensure problem bank coverage for edge grades (add problems if needed)
- T3: Signup redirect to immediate diagnostic (seed sessionStorage draft + navigate)
- T4: PlacementTestPage supports "signup diagnostic mode" without breaking existing flow

Wave 2 (Diagnosis + UX)
- T5: Persist diagnosis breakdown (pre vs post) into `student/profile`
- T6: PlacementResultPage renders simple diagnosis for the new mode
- T7: Playwright E2E for signup -> diagnostic -> result
- T8: Docs update for authoring/maintaining diagnostic problems

Wave 3 (Hardening)
- T9: Negative/edge-case tests (invalid grade, missing problems, retries) + smoke in CI

---

## TODOs

- [x] T1. Build adjacent-grade diagnostic question generator (NA-only)

  **What to do**:
  - Add a small module `curriculum-viewer/src/lib/diagnostic/adjacentGradeDiagnostic.ts` to derive the diagnostic plan from grade:
    - Inputs: `grade (1..6)`, `desiredCount=8`, `domainCode='NA'`.
    - Output: `{ preNodeIds: string[], postNodeIds: string[], pickedProblemIds: string[] }`.
  - Use curriculum v1 ids + problem bank keys:
    - Curriculum: `curriculum-viewer/public/data/curriculum_math_v1.json` via `useCurriculum()` index.
    - Problems: `curriculum-viewer/public/data/problems_v1.json` via `loadProblemBank()`.
  - Selection rules:
    - Pre = (grade-1) NA standard nodes; Post = (grade+1) NA standard nodes.
    - If missing side (G1 pre / G6 post) fill from same-grade NA nodes.
    - Deterministic ordering (stable sort by nodeId + problemId).

  **Must NOT do**:
  - Do not depend on 2022 research graph ids (`2수01-...`) in this mode.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` (multi-module logic + correctness)
  - Skills: none

  **References**:
  - Curriculum index: `curriculum-viewer/src/lib/curriculum/indexing.ts`
  - Curriculum node shape: `curriculum-viewer/src/lib/curriculum/types.ts`
  - Problem bank loader: `curriculum-viewer/src/lib/learn/problems.ts`
  - Problem data: `curriculum-viewer/public/data/problems_v1.json`

  **Test References**:
  - Add unit tests: `curriculum-viewer/src/lib/diagnostic/adjacentGradeDiagnostic.test.ts`

  **Acceptance Criteria**:
  - [ ] Unit tests cover: grade=1, grade=6, grade=3 (normal case), deterministic output
  - [ ] No runtime errors when problems are missing (graceful error message, not blank screen)

  **QA Scenarios**:
  ```
  Scenario: Grade=3 generates pre/post plan
    Tool: vitest
    Steps:
      1. Run: cd curriculum-viewer && npm run test -- <new test file>
      2. Assert returned plan contains only node ids starting with MATH-2022-G-2-NA and MATH-2022-G-4-NA
    Evidence: .sisyphus/evidence/t1-grade3-plan.txt

  Scenario: Grade=1 has no pre, fills with grade=1
    Tool: vitest
    Steps:
      1. Run unit test
      2. Assert preNodeIds empty (or pre group empty) and total picked problems == 8 via grade=1+2
    Evidence: .sisyphus/evidence/t1-grade1-edge.txt
  ```

- [x] T2. Expand NA problem bank coverage to support 8-question adjacent-grade tests

  **What to do**:
  - Ensure `curriculum-viewer/public/data/problems_v1.json` has enough NA problems to satisfy the 8-question policy:
    - G5 and G6 currently have too few problems; add additional numeric problems.
    - Keep ids stable and unique; keep prompts short; keep numeric answers.
  - Add a validation unit test: `curriculum-viewer/src/lib/diagnostic/adjacentGradeDiagnosticData.test.ts` that loads `problems_v1.json` and asserts minimum availability per grade.

  **Recommended Agent Profile**:
  - Category: `quick`

  **References**:
  - Existing problems format: `curriculum-viewer/public/data/problems_v1.json`
  - Parser expectations: `curriculum-viewer/src/lib/learn/problems.ts`

  **Acceptance Criteria**:
  - [ ] JSON still parses with `loadProblemBank()`
  - [ ] For every grade 1..6, available NA problems are sufficient for the edge-grade rules to produce 8 questions

  **QA Scenarios**:
  ```
  Scenario: problems_v1.json parses
    Tool: node
    Steps:
      1. Run: cd curriculum-viewer && node -e "JSON.parse(require('fs').readFileSync('public/data/problems_v1.json','utf8')); console.log('ok')"
    Evidence: .sisyphus/evidence/t2-problems-parse.txt
  ```

- [x] T3. Redirect new signups into immediate diagnostic (skip survey)

  **What to do**:
  - After successful signup (in `curriculum-viewer/src/pages/SignupPage.tsx`), seed the sessionStorage survey draft key `onboarding:survey:v1` with:
    - grade = signup grade
    - confidence=null, recentHardTags=[], studyStyle=null
    - diagnosticMode flag to indicate adjacent-grade NA diagnostic
  - Navigate to `ROUTES.placement`.

  **Recommended Agent Profile**:
  - Category: `quick`

  **References**:
  - Signup: `curriculum-viewer/src/pages/SignupPage.tsx`
  - Survey storage key: `curriculum-viewer/src/pages/PlacementTestPage.tsx` (`SURVEY_STORAGE_KEY`)
  - Routes: `curriculum-viewer/src/routes.ts`

  **Acceptance Criteria**:
  - [ ] Signup success no longer lands on dashboard; it lands on `/onboarding/placement`
  - [ ] Placement page does not show "먼저 1분 설문" prompt

  **QA Scenarios**:
  ```
  Scenario: Signup -> immediate diagnostic navigation
    Tool: Playwright
    Steps:
      1. Go to /signup
      2. Fill inputs (userId/password/name/grade/email)
      3. Submit
      4. Assert URL matches /onboarding/placement
      5. Assert heading '3~5분 진단' visible
    Evidence: .sisyphus/evidence/t3-signup-to-placement.png
  ```

- [x] T4. Add "signup diagnostic mode" to PlacementTestPage

  **What to do**:
  - Extend the local SurveyDraft parsing in `curriculum-viewer/src/pages/PlacementTestPage.tsx` to allow an optional `diagnosticMode` field.
  - If `diagnosticMode === 'adjacent-grade-na-v1'`:
    - Build questions from the problem bank and adjacent grades (via T1).
    - Render as numeric subjective questions.
  - Else: keep existing `PLACEMENT_QUESTIONS_V1` behavior unchanged.

  **Recommended Agent Profile**:
  - Category: `unspecified-high`

  **References**:
  - Existing placement flow: `curriculum-viewer/src/pages/PlacementTestPage.tsx`
  - Existing question bank: `curriculum-viewer/src/lib/diagnostic/placementQuestions.ts`
  - Problem bank: `curriculum-viewer/src/lib/learn/problems.ts`

  **Acceptance Criteria**:
  - [ ] In diagnosticMode, total questions == 8 and prompts come from problems_v1.json
  - [ ] Without diagnosticMode, old question ids (q1_place_value_tens etc) still appear

  **QA Scenarios**:
  ```
  Scenario: Diagnostic mode uses problem bank prompts
    Tool: Playwright
    Steps:
      1. Seed sessionStorage onboarding:survey:v1 with diagnosticMode + grade=3
      2. Visit /onboarding/placement
      3. Assert first prompt contains text from problems_v1.json (e.g., '1,234에서')
    Evidence: .sisyphus/evidence/t4-diagnostic-mode.png

  Scenario: Normal mode unchanged
    Tool: Playwright
    Steps:
      1. Seed sessionStorage onboarding:survey:v1 without diagnosticMode
      2. Visit /onboarding/placement
      3. Assert prompt '372에서 십의 자리 숫자는?' is visible
    Evidence: .sisyphus/evidence/t4-normal-mode.png
  ```

- [x] T5. Persist pre/post diagnosis breakdown to student profile

  **What to do**:
  - When submitting placement in diagnosticMode:
    - Compute accuracy for pre group and post group.
    - Store in `placement` payload under explicit keys (e.g., `mode`, `adjacentGrade`, `groupStats`, `nodeIdsUsed`, `perQuestion`).
  - Keep existing fields (`estimatedLevel`, `weakTagsTop3`) compatible; add new fields without breaking.

  **Recommended Agent Profile**:
  - Category: `unspecified-high`

  **References**:
  - Submission logic: `curriculum-viewer/src/pages/PlacementTestPage.tsx` (upsertMyStudentProfile payload)
  - Student profile API: `curriculum-viewer/src/lib/studentProfile/api.ts`
  - Backend acceptance of dict payload: `backend/app/api.py` (`/api/student/profile`)

  **Acceptance Criteria**:
  - [ ] `GET /api/student/profile` includes the new placement.mode + pre/post stats after submission

  **QA Scenarios**:
  ```
  Scenario: Submit diagnostic mode writes groupStats
    Tool: Playwright
    Steps:
      1. Run signup->placement
      2. Answer a few correct/incorrect
      3. Submit
      4. Assert result page loads
      5. (Optional) Use API call to /api/student/profile and assert JSON contains placement.groupStats
    Evidence: .sisyphus/evidence/t5-profile-groupstats.json
  ```

- [x] T6. Show simple diagnosis on PlacementResultPage for diagnosticMode

  **What to do**:
  - If student profile placement.mode indicates adjacent-grade diagnostic:
    - Render "전학년 정확도" / "후학년 정확도".
    - Render a simple next-step message (e.g., "전학년이 약하면 해당 학년부터", "후학년이 약하면 현재 학년에서 시작").
  - Keep existing result UI for non-diagnostic mode.

  **Recommended Agent Profile**:
  - Category: `visual-engineering`
  - Skills: [`frontend-ui-ux`]

  **References**:
  - Result UI: `curriculum-viewer/src/pages/PlacementResultPage.tsx`
  - Profile fetch: `curriculum-viewer/src/lib/studentProfile/api.ts`

  **Acceptance Criteria**:
  - [ ] Diagnostic-mode result shows both pre/post metrics
  - [ ] Normal mode unchanged

  **QA Scenarios**:
  ```
  Scenario: Diagnostic result shows pre/post
    Tool: Playwright
    Steps:
      1. Complete diagnostic
      2. On result page, assert text '전학년' and '후학년' visible with percentages
    Evidence: .sisyphus/evidence/t6-result-prepost.png
  ```

- [x] T7. Add Playwright E2E covering signup -> diagnostic -> result

  **What to do**:
  - Add e2e spec: `curriculum-viewer/e2e/signup-adjacent-grade-diagnostic.spec.ts` covering:
    - Signup with grade=3 and complete diagnostic.
    - Assert 8 questions.
    - Assert result shows pre/post.
  - Add one edge-grade test (grade=6) to ensure fill rule works.

  **Recommended Agent Profile**:
  - Category: `unspecified-high`
  - Skills: [`playwright`]

  **References**:
  - Existing e2e patterns: `curriculum-viewer/e2e/*.spec.ts`
  - Signup page selectors: `curriculum-viewer/src/pages/SignupPage.tsx`

  **Acceptance Criteria**:
  - [ ] `cd curriculum-viewer && npm run test:e2e` passes

  **QA Scenarios**:
  ```
  Scenario: Full flow grade=3
    Tool: Playwright
    Steps:
      1. Run: cd curriculum-viewer && npx playwright test e2e/signup-adjacent-grade-diagnostic.spec.ts
      2. Assert pass
    Evidence: .sisyphus/evidence/t7-e2e-report.txt
  ```

- [x] T8. Document how to maintain adjacent-grade diagnostic content

  **What to do**:
  - Add a short doc: `curriculum-viewer/docs/signup-adjacent-grade-diagnostic.md` describing:
    - Selection rules (adjacent grades only, NA only, 8 questions).
    - Where problems live (`public/data/problems_v1.json`) and naming conventions.
    - How to validate counts.

  **Recommended Agent Profile**:
  - Category: `writing`

  **Acceptance Criteria**:
  - [ ] Doc exists and references the exact files + commands

- [x] T9. Harden edge cases + add tests

  **What to do**:
  - Handle invalid signup grade (non 1..6) with a clear error and fallback.
  - Handle insufficient problems gracefully (error message + link to dashboard) but keep tests ensuring bank is sufficient.
  - Ensure redirect loop does not occur if sessionStorage is blocked.

  **Recommended Agent Profile**:
  - Category: `unspecified-high`

  **Acceptance Criteria**:
  - [ ] No infinite redirects; clear user-facing error states
  - [ ] Unit tests cover invalid/missing storage cases

---

## Follow-on: Homework Due Date Extend (+7 days)

> Appended so the runner can continue automatically after T9 without switching plans.
> This implements: "숙제 현황에서 미제출 과제에 대해 마감 1주 연장 버튼" (global assignment due date).

- [x] H1. Add backend regression test for admin dueAt update (homework)

  **What to do**:
  - In `backend/tests/test_homework_api.py`, add a test that:
    - Creates an assignment with a known `dueAt`
    - Calls `PATCH /api/homework/admin/assignments/{assignment_id}` with a new `dueAt`
    - Fetches admin assignment detail (`GET /api/homework/admin/assignments/{assignment_id}`) and asserts `dueAt` changed
  - Use existing helpers: `_login_admin`, `_create_assignment`.

  **Must NOT do**:
  - Do not add new endpoints.
  - Do not change DB schema.

  **Recommended Agent Profile**:
  - Category: `quick`

  **References**:
  - `backend/app/api.py` - `update_admin_assignment()` PATCH behavior and route
  - `backend/app/db.py` - `update_homework_assignment()` writes `due_at`
  - `backend/tests/test_homework_api.py` - existing patterns for auth + assignment creation

  **Acceptance Criteria**:
  - [ ] `pytest backend/tests/test_homework_api.py -q` exits 0
  - [ ] New test asserts `dueAt` changes after PATCH

  **QA Scenarios**:
  ```
  Scenario: Admin can PATCH dueAt and see it reflected
    Tool: Bash
    Steps:
      1. Run: pytest backend/tests/test_homework_api.py -q
      2. Confirm the new test passes (0 failures)
    Evidence: .sisyphus/evidence/h1-pytest-homework-dueat-patch.txt
  ```

- [x] H2. Implement +7 day dueAt calculation helper and unit tests (frontend homework)

  **What to do**:
  - Add a small pure function in `curriculum-viewer/src/lib/homework/dueAt.ts` that:
    - Takes an input `dueAt` string
    - Parses it to a valid `Date` (fail gracefully if invalid)
    - Adds 7 days preserving local wall-clock time (e.g., `date.setDate(date.getDate() + 7)`)
    - Outputs a stable string suitable for backend storage and existing UI input: `YYYY-MM-DDTHH:mm`
  - Add unit tests in `curriculum-viewer/src/lib/homework/dueAt.test.ts` verifying:
    - ISO with timezone (`...Z`) advances correctly
    - `YYYY-MM-DDTHH:mm` advances correctly
    - Invalid input returns null/throws a handled error (per spec)

  **Must NOT do**:
  - Do not refactor unrelated datetime handling.

  **Recommended Agent Profile**:
  - Category: `quick`

  **References**:
  - `curriculum-viewer/src/pages/AuthorHomeworkStatusPage.tsx` - `toDateTimeLocalValue()` existing datetime-local formatting
  - `curriculum-viewer/src/lib/homework/api.ts` - `updateAssignmentAdmin()` sends `dueAt` without normalization
  - `curriculum-viewer/src/lib/homework/types.ts:UpdateAssignmentData` - dueAt field shape

  **Acceptance Criteria**:
  - [ ] `cd curriculum-viewer && npm run test` exits 0
  - [ ] Unit tests cover at least 3 cases (ISO Z, datetime-local, invalid)

  **QA Scenarios**:
  ```
  Scenario: Date helper adds 7 days reliably
    Tool: Bash
    Steps:
      1. Run: cd curriculum-viewer && npm run test
      2. Confirm the new helper test file passes
    Evidence: .sisyphus/evidence/h2-vitest-date-helper.txt
  ```

- [x] H3. Add "마감 1주일 연장" button in Author homework status assignment detail view

  **What to do**:
  - In `curriculum-viewer/src/pages/AuthorHomeworkStatusPage.tsx` assignment detail meta area, add a button next to the due date.
  - Visibility/enablement rules:
    - Show only if `assignmentDetail.dueAt` exists AND `assignmentDetail.students.some(s => !s.submissionId)` is true.
    - Disable while submitting to avoid double click.
  - On click:
    - Confirm via `window.confirm()` (consistent with delete pattern)
    - Compute new dueAt using H2 helper
    - Call `updateAssignmentAdmin(assignmentDetail.id, { title: assignmentDetail.title, dueAt: newDueAt })`
    - Reload list + detail via existing `loadAssignments` and `loadAssignmentDetail`
    - Show success/error message

  **Defaults Applied**:
  - If `dueAt` is missing/invalid: button is hidden (no API call).
  - Extension is based on the last saved `assignmentDetail.dueAt` (not unsaved input).

  **Recommended Agent Profile**:
  - Category: `quick`

  **References**:
  - `curriculum-viewer/src/pages/AuthorHomeworkStatusPage.tsx`
  - `curriculum-viewer/src/lib/homework/api.ts:updateAssignmentAdmin()`
  - `backend/app/api.py:update_admin_assignment()`

  **Acceptance Criteria**:
  - [ ] When there is at least one unsubmitted student and `dueAt` is set, the button is visible.
  - [ ] Clicking triggers exactly one PATCH and updates the displayed due date after reload.
  - [ ] Button is disabled while request is in-flight.

  **QA Scenarios**:
  ```
  Scenario: UI build passes after adding button
    Tool: Bash
    Steps:
      1. Run: cd curriculum-viewer && npm run build
    Evidence: .sisyphus/evidence/h3-build-pass.txt
  ```

- [x] H4. Add frontend component test for homework due-date extend button

  **What to do**:
  - Add `curriculum-viewer/src/pages/AuthorHomeworkStatusPage.test.tsx` that:
    - Mocks homework API module (`updateAssignmentAdmin`, `getAssignmentAdmin`, `listAssignmentsAdmin`)
    - Renders the page in assignment detail mode (or simulates selecting an assignment)
    - Asserts the button is shown only when unsubmitted exists and dueAt is present
    - Simulates click (and confirm) then asserts `updateAssignmentAdmin` called with `dueAt` advanced by 7 days

  **Must NOT do**:
  - Do not write brittle snapshot tests; assert by text/role.

  **Recommended Agent Profile**:
  - Category: `unspecified-high`

  **References**:
  - `curriculum-viewer/src/components/CurriculumGraphView.test.tsx` - mocking + RTL patterns
  - `curriculum-viewer/src/setupTests.ts` - test setup and matchers
  - `curriculum-viewer/src/pages/AuthorHomeworkStatusPage.tsx` - component under test
  - `curriculum-viewer/src/lib/homework/api.ts` - functions to mock

  **Acceptance Criteria**:
  - [ ] `cd curriculum-viewer && npm run test` exits 0
  - [ ] Test asserts button visibility conditions and PATCH payload

  **QA Scenarios**:
  ```
  Scenario: Component test verifies extend flow
    Tool: Bash
    Steps:
      1. Run: cd curriculum-viewer && npm run test
      2. Confirm the new AuthorHomeworkStatusPage test passes
    Evidence: .sisyphus/evidence/h4-vitest-author-homework-status.txt
  ```

## Final Verification Wave
- Run: `pytest backend/tests/test_homework_api.py -q`
- Run: `cd curriculum-viewer && npm run test && npm run build`
- Run: `cd curriculum-viewer && npm run test:e2e`
- Verify result stored: `GET /api/student/profile` contains new placement mode fields
- Verify UI: signup -> placement loads without survey prompt; result shows pre/post breakdown
- Verify UI: author homework status shows +7d extend button when unsubmitted exists, and updates due date after click

## Commit Strategy
- Commit 1: diagnostic feature (frontend + data + tests + docs)
- Commit 2: homework due-date extend (+7d) (frontend + backend test)

## Success Criteria
- New users are redirected from signup to diagnostic immediately.
- Diagnostic uses adjacent-grade node-based problems (NA only) and totals 8 questions.
- Results saved in student profile and rendered as a simple diagnosis (pre/post).
- Existing onboarding survey + placement path still works.
