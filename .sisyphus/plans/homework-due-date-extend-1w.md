# Homework: Extend Due Date by 1 Week (Admin UI)

## TL;DR
> Add a single admin-only button next to the assignment due date in the Author "숙제 현황" detail view.
> When there exists at least one unsubmitted student for that assignment, clicking the button extends the **global** `dueAt` by **+7 days** via the existing admin PATCH endpoint.

**Deliverables**
- UI button near due date in `curriculum-viewer/src/pages/AuthorHomeworkStatusPage.tsx`
- Uses existing `PATCH /api/homework/admin/assignments/{assignment_id}` (no new endpoint)
- Automated tests added after implementation (frontend Vitest + backend pytest)

**Estimated Effort**: Short
**Parallel Execution**: YES (2 waves)
**Critical Path**: FE date calc/spec → FE button wiring → tests

---

## Context

### Original Request
- "숙제 현황에서 제출되지 않은 숙제에 대해서, 1주일 연장 버튼을 만들고 싶어."

### Confirmed Decisions
- **Extension scope**: 과제 전체 연장 (assignment-level global due date)
- **Button placement**: 마감일 옆에 1개
- **Testing**: 자동 테스트는 구현 후 추가

### Existing Implementation References
- Admin homework status page: `curriculum-viewer/src/pages/AuthorHomeworkStatusPage.tsx`
  - Due date display in assignment detail: `assignmentDetail.dueAt`
  - Existing save flow: `handleAssignmentUpdate()` → `updateAssignmentAdmin()` → reload list+detail
  - Unsubmitted detection available: `assignmentDetail.students[].submissionId` is missing/null
- Frontend admin API client:
  - `curriculum-viewer/src/lib/homework/api.ts:updateAssignmentAdmin()`
  - `curriculum-viewer/src/lib/homework/types.ts:UpdateAssignmentData`
- Backend admin endpoint already exists:
  - `backend/app/api.py:update_admin_assignment()` (`PATCH /api/homework/admin/assignments/{assignment_id}`)
  - `backend/app/db.py:update_homework_assignment()` updates `homework_assignments.due_at`
- Backend tests exist:
  - `backend/tests/test_homework_api.py`

### Guardrails (Scope Control)
- IN: UI button + calling existing admin PATCH + reload + error/success feedback + tests.
- OUT: per-student extensions, configurable durations, bulk multi-select, notification sending.
- OUT: changing backend datetime validation/timezone semantics; keep changes minimal.

---

## Work Objectives

### Core Objective
Enable an admin to extend an assignment's due date by 1 week from the homework status detail view, but only when there are unsubmitted students.

### Definition of Done
- Button appears in assignment detail view when conditions match.
- Clicking updates the assignment due date (+7 days) through existing API and refreshes UI.
- Errors are surfaced to the admin; repeated clicks are prevented while a request is in-flight.
- Automated tests pass.

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: YES
  - Frontend: Vitest (`cd curriculum-viewer && npm run test`)
  - Backend: pytest (`backend/requirements.txt` includes pytest; tests under `backend/tests/`)
- **Automated tests**: YES (tests-after)

### QA Policy (Agent-Executed)
Every task includes agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

---

## Execution Strategy

### Parallel Waves

Wave 1 (Foundation + independent tests)
- Task 1: Backend regression test for admin dueAt PATCH
- Task 2: Frontend date extension helper + unit tests

Wave 2 (UI wiring + component test)
- Task 3: Add "마감 1주일 연장" button + handler in AuthorHomeworkStatusPage
- Task 4: Add frontend component test to verify button gating + API call

Critical Path: Task 2 → Task 3 → Task 4

---

## TODOs

- [x] 1. Add backend regression test for admin dueAt update

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
  - **Category**: `quick`
  - **Skills**: none

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 2)
  - **Blocks**: none
  - **Blocked By**: none

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
    Expected Result: pytest exit code 0
    Evidence: .sisyphus/evidence/task-1-pytest-homework-dueat-patch.txt
  ```

- [x] 2. Implement +7 day dueAt calculation helper and unit tests (frontend)

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
  - **Category**: `quick`
  - **Skills**: none

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 1)
  - **Blocks**: Task 3, Task 4
  - **Blocked By**: none

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
    Expected Result: vitest run exit code 0
    Evidence: .sisyphus/evidence/task-2-vitest-date-helper.txt
  ```

- [x] 3. Add "마감 1주일 연장" button in assignment detail view and wire to PATCH

  **What to do**:
  - In `curriculum-viewer/src/pages/AuthorHomeworkStatusPage.tsx` assignment detail meta area (near line ~588), add a button next to the due date.
  - Visibility/enablement rules:
    - Show only if `assignmentDetail.dueAt` exists AND `assignmentDetail.students.some(s => !s.submissionId)` is true.
    - Disable while submitting to avoid double click.
  - On click:
    - Confirm via `window.confirm()` (consistent with delete pattern)
    - Compute new dueAt using Task 2 helper
    - Call `updateAssignmentAdmin(assignmentDetail.id, { title: assignmentDetail.title, dueAt: newDueAt })`
    - Reload list + detail via existing `loadAssignments` and `loadAssignmentDetail`
    - Show success/error message (can reuse `editMessage` or add a dedicated message state)

  **Defaults Applied (document in code/behavior)**:
  - If `dueAt` is missing/invalid: button is hidden (no API call).
  - Extension is based on the last saved `assignmentDetail.dueAt` (not unsaved `editDueAt` input).

  **Must NOT do**:
  - Do not alter per-student due dates.
  - Do not add a new backend endpoint.

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: none

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 4
  - **Blocked By**: Task 2

  **References**:
  - `curriculum-viewer/src/pages/AuthorHomeworkStatusPage.tsx` - insertion point near due date and existing `handleAssignmentUpdate()` reload pattern
  - `curriculum-viewer/src/lib/homework/api.ts:updateAssignmentAdmin()` - PATCH call
  - `backend/app/api.py:update_admin_assignment()` - expects `dueAt` string

  **Acceptance Criteria**:
  - [ ] When there is at least one unsubmitted student and `dueAt` is set, the button is visible.
  - [ ] Clicking the button triggers exactly one PATCH and updates the displayed due date after reload.
  - [ ] Button is disabled while the request is in-flight.
  - [ ] Errors from `HomeworkApiError` show a human-readable message.

  **QA Scenarios**:
  ```
  Scenario: UI build passes after adding button
    Tool: Bash
    Steps:
      1. Run: cd curriculum-viewer && npm run build
    Expected Result: build exits 0
    Evidence: .sisyphus/evidence/task-3-build-pass.txt
  ```

- [x] 4. Add frontend component test for button gating and PATCH payload

  **What to do**:
  - Add `curriculum-viewer/src/pages/AuthorHomeworkStatusPage.test.tsx` that:
    - Mocks homework API module (`updateAssignmentAdmin`, `getAssignmentAdmin`, `listAssignmentsAdmin`) and auth student list if needed.
    - Renders the page in assignment detail mode (or simulate selecting an assignment).
    - Asserts the button is shown only when unsubmitted exists and dueAt is present.
    - Simulates click (and confirm) then asserts `updateAssignmentAdmin` called with `dueAt` advanced by 7 days.

  **Must NOT do**:
  - Do not write brittle snapshot tests; assert by text/role.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: none

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2
  - **Blocks**: Final verification
  - **Blocked By**: Task 3

  **References**:
  - `curriculum-viewer/src/components/CurriculumGraphView.test.tsx` - mocking + RTL patterns
  - `curriculum-viewer/src/setupTests.ts` - test setup and jest-dom matchers
  - `curriculum-viewer/src/pages/AuthorHomeworkStatusPage.tsx` - component under test
  - `curriculum-viewer/src/lib/homework/api.ts` - functions to mock

  **Acceptance Criteria**:
  - [ ] `cd curriculum-viewer && npm run test` exits 0
  - [ ] Test asserts button visibility conditions
  - [ ] Test asserts `updateAssignmentAdmin()` called once with correct `dueAt`

  **QA Scenarios**:
  ```
  Scenario: Component test verifies extend flow
    Tool: Bash
    Steps:
      1. Run: cd curriculum-viewer && npm run test
      2. Confirm the new AuthorHomeworkStatusPage test passes
    Expected Result: vitest run exit code 0
    Evidence: .sisyphus/evidence/task-4-vitest-author-homework-status.txt
  ```

---

## Final Verification Wave

- [x] FV1. Build + tests
  - Run `pytest backend/tests/test_homework_api.py -q`
  - Run `cd curriculum-viewer && npm run test`
  - Run `cd curriculum-viewer && npm run build`

---

## Commit Strategy

- Commit 1: `test(backend): cover admin assignment dueAt patch`
- Commit 2: `feat(homework): add 1-week due date extend button for admins`
- Commit 3: `test(frontend): cover due date extend button`

---

## Success Criteria

- Admin can extend global due date by 7 days from homework status assignment detail screen.
- Button only appears when at least one student is unsubmitted and dueAt exists.
- All automated tests and build commands pass.
