# Homework Submission Web Push (Android Status Bar)

## TL;DR
> Add stable Web Push notifications for admin when a student submits homework.
>
> Deliverables:
> - Backend Web Push subscription storage + send pipeline (VAPID)
> - Admin settings UI to register multiple devices + test/revoke devices
> - Push on submission with invalid-subscription cleanup
> - Automated tests (pytest + vitest + Playwright)
>
> Estimated effort: Medium (1-2 days)
> Parallel execution: YES (3 waves)
> Critical path: VAPID + subscription storage -> push send -> UI + tests

---

## Context

### Original Request
- "email 말고 안드로이드 상태창 위에서 알람이 뜨게"
- "안정적으로(여러 기기/만료 처리/설정 UI)까지" 할 수 있게 계획 수립

### Existing System Notes
- Backend is FastAPI + SQLite.
- Homework submission endpoint: `backend/app/api.py` `POST /api/homework/assignments/{assignment_id}/submit`.
- Email notification already exists (background task) via `backend/app/email_service.py`.
- Frontend is Vite + React in `curriculum-viewer/`.
- No service worker / Web Push implementation currently.

---

## Work Objectives

### Core Objective
Enable Android status-bar notifications for admin accounts when homework is submitted, using standard Web Push (Service Worker + VAPID), with multi-device support and reliable cleanup.

### Concrete Deliverables
- Backend:
  - Web Push subscription table + CRUD
  - Web Push send service (VAPID)
  - Admin APIs: subscribe/unsubscribe/list/test + public key
  - Submission pipeline sends push to the right admin(s)
- Frontend:
  - Service worker: handle `push` + `notificationclick`
  - Admin settings UI: enable push, list devices, revoke device, send test push
- Verification:
  - pytest coverage for subscription APIs + send error cleanup
  - vitest coverage for settings UI logic
  - Playwright E2E to register device + send test notification (agent-executed)

### Definition of Done
- A logged-in admin can register 2+ devices and see them in settings.
- When a student submits, admin receives a push notification (Android Chrome) with assignment + student summary.
- Invalid/expired subscriptions are automatically removed or disabled.
- Tests + build pass.

### Must NOT Have (Guardrails)
- Do not expose VAPID private key to the browser.
- Do not include sensitive student answers/images in push payload.
- No student-facing push notifications in v1.
- No iOS Safari/PWA install support in v1 (Android-focused).

---

## Verification Strategy

### Test Decision
- Infrastructure exists: YES
  - Backend: `pytest`
  - Frontend: `vitest`, `@testing-library/react`
  - E2E: `playwright`
- Automated tests: YES (tests-after)

### QA Policy
All tasks include agent-executed QA scenarios. Evidence saved under `.sisyphus/evidence/`.

---

## Execution Strategy

### Parallel Execution Waves (Planned)

Wave 1 (Foundation: contracts + storage + SW scaffolding)
- T1-T6

Wave 2 (Integration: send on submission + settings UI + tests)
- T7-T12

Wave 3 (Hardening: rate limits, cleanup, runbook)
- T13-T15

---

## TODOs

---

- [ ] 1. Decide notification recipients + payload privacy defaults

  **What to do**:
  - Define v1 defaults (document in code as constants, not config sprawl):
    - Recipients: admins who have at least one enabled subscription
    - Notification title/body: no student answers/images; keep lock-screen PII minimal
    - Click target: open Author UI and deep-link if possible
  - Add a small “defaults” section to backend response for the settings UI if needed.

  **Must NOT do**:
  - Do not include `answers_json` or attachment URLs in push payload.

  **Recommended Agent Profile**:
  - Category: `quick`
  - Skills: []

  **Parallelization**:
  - Can Run In Parallel: YES
  - Parallel Group: Wave 1 (with Tasks 2-6)
  - Blocks: 7-15
  - Blocked By: None

  **References**:
  - `backend/app/api.py` (submission flow + background notification task)
  - `backend/app/email_service.py` (existing “submission notification” content pattern)

  **Acceptance Criteria**:
  - [ ] Plan-level defaults are explicitly stated in code/constants.

  **QA Scenarios**:
  ```
  Scenario: Defaults are PII-minimal
    Tool: Bash (pytest)
    Steps:
      1. Run backend unit tests covering payload builder
      2. Assert payload fields exclude answers and attachments
    Evidence: .sisyphus/evidence/task-1-payload-privacy.txt

  Scenario: Click target is stable
    Tool: Bash (pytest)
    Steps:
      1. Build a sample notification payload
      2. Assert it contains a URL/path that exists in Author routes
    Evidence: .sisyphus/evidence/task-1-click-target.txt
  ```

- [ ] 2. Backend: add VAPID config + Web Push dependency

  **What to do**:
  - Add a Web Push library dependency (default: `pywebpush`) to `backend/requirements.txt`.
  - Add config helper to read env vars:
    - `VAPID_PUBLIC_KEY`
    - `VAPID_PRIVATE_KEY`
    - `VAPID_SUBJECT` (e.g. `mailto:admin@example.com`)
  - Add a small “sanity check” function used by push APIs to fail fast when misconfigured.

  **Must NOT do**:
  - Never return `VAPID_PRIVATE_KEY` via any API.

  **Recommended Agent Profile**:
  - Category: `quick`
  - Skills: []

  **Parallelization**:
  - Can Run In Parallel: YES
  - Parallel Group: Wave 1
  - Blocks: 5-6 (push APIs), 8-10 (frontend subscription)
  - Blocked By: Task 1

  **References**:
  - `backend/app/main.py` (env loading + app startup patterns)

  **Acceptance Criteria**:
  - [ ] Missing VAPID env vars produce a clear admin-only API error response.
  - [ ] `python -m compileall backend/app` succeeds.

  **QA Scenarios**:
  ```
  Scenario: Missing VAPID config returns clear error
    Tool: Bash (pytest)
    Steps:
      1. Run a test with VAPID env vars unset
      2. Call public-key endpoint; assert 500/400 with clear message
    Evidence: .sisyphus/evidence/task-2-missing-vapid.txt

  Scenario: Config present passes sanity check
    Tool: Bash (pytest)
    Steps:
      1. Run a test with VAPID env vars set
      2. Call public-key endpoint; assert it returns the public key
    Evidence: .sisyphus/evidence/task-2-vapid-public-key.txt
  ```

- [ ] 3. Backend: add SQLite tables + db helpers for push subscriptions

  **What to do**:
  - Extend `backend/app/db.py` `init_db()` to include a `push_subscriptions` table.
  - Store per-device subscription info:
    - `endpoint`, `p256dh`, `auth` (subscription keys)
    - `user_id` (admin username or user id)
    - `enabled`, `created_at`, `updated_at`, `last_seen_at`
    - optional: `user_agent`, `device_label`, `failure_count`, `last_failure_at`
  - Add db helpers (1 file concern): upsert by endpoint, list by admin, delete, disable, mark failure, cleanup 404/410.

  **Must NOT do**:
  - Do not store raw JWTs or passwords.

  **Recommended Agent Profile**:
  - Category: `unspecified-high`
  - Skills: []

  **Parallelization**:
  - Can Run In Parallel: YES
  - Parallel Group: Wave 1
  - Blocks: 5-6 (push APIs), 6 (send pipeline)
  - Blocked By: Task 1

  **References**:
  - `backend/app/db.py` `init_db` (table creation pattern)

  **Acceptance Criteria**:
  - [ ] Unique constraint prevents duplicate endpoints.
  - [ ] CRUD helper functions have unit tests.

  **QA Scenarios**:
  ```
  Scenario: Upsert + list + delete subscription
    Tool: Bash (pytest)
    Steps:
      1. Insert subscription for admin
      2. Upsert same endpoint with updated keys
      3. List shows 1 row with updated data
      4. Delete removes row
    Evidence: .sisyphus/evidence/task-3-db-crud.txt

  Scenario: Disable on 410
    Tool: Bash (pytest)
    Steps:
      1. Insert subscription
      2. Mark failure as gone (410)
      3. Assert row is deleted or disabled per policy
    Evidence: .sisyphus/evidence/task-3-db-gone-cleanup.txt
  ```

- [ ] 4. Backend: implement Web Push send service (with testable interface)

  **What to do**:
  - Add `backend/app/webpush_service.py` that:
    - Sends push via VAPID to a single subscription
    - Maps send outcomes to actions: success, delete on 404/410, retain on transient
    - Is injectable/mockable in tests (wrap third-party call)
  - Keep payload minimal; include a URL/path for click-through.

  **Must NOT do**:
  - Do not throw unhandled exceptions from the service into request handlers.

  **Recommended Agent Profile**:
  - Category: `unspecified-high`
  - Skills: []

  **Parallelization**:
  - Can Run In Parallel: YES
  - Parallel Group: Wave 1
  - Blocks: 6-7 (API + submission integration)
  - Blocked By: 2-3

  **References**:
  - `backend/app/api.py` `_send_notification_task` (existing background send pattern)
  - `backend/app/main.py` (rate limiting + env conventions)

  **Acceptance Criteria**:
  - [ ] Service returns structured result (success/deleted/failed) so callers can act.

  **QA Scenarios**:
  ```
  Scenario: 410 deletes subscription
    Tool: Bash (pytest)
    Steps:
      1. Mock webpush send to raise gone (410)
      2. Assert db helper deletes/disabled subscription
    Evidence: .sisyphus/evidence/task-4-send-410.txt

  Scenario: transient error does not delete
    Tool: Bash (pytest)
    Steps:
      1. Mock send to raise 503/timeout
      2. Assert subscription remains enabled; failure_count increments
    Evidence: .sisyphus/evidence/task-4-send-transient.txt
  ```

- [ ] 5. Backend: add admin push API router (subscribe/list/revoke/public-key/test)

  **What to do**:
  - Create `backend/app/push_api.py` with `APIRouter(prefix="/api/push")`.
  - Endpoints (admin-only):
    - `GET /public-key` -> VAPID public key
    - `GET /subscriptions` -> list this admin’s subscriptions
    - `POST /subscriptions` -> upsert subscription (store UA/device label)
    - `DELETE /subscriptions/{subscription_id}` -> revoke
    - `POST /test` -> send test push to all enabled subscriptions for this admin
  - Mount it from `backend/app/api.py` (or main router include) while keeping existing router prefixing consistent.
  - Add rate limits for `POST /test` (e.g. `5/minute`).

  **Must NOT do**:
  - Do not allow non-admin access (use `require_admin`).
  - Do not allow listing other admins’ devices.

  **Recommended Agent Profile**:
  - Category: `unspecified-high`
  - Skills: []

  **Parallelization**:
  - Can Run In Parallel: YES
  - Parallel Group: Wave 2 (with Tasks 7-10)
  - Blocks: 8-10 (frontend settings)
  - Blocked By: 2-4

  **References**:
  - `backend/app/auth.py` `require_admin` (auth guard)
  - `backend/app/api.py` `limiter` (rate limit decorator)

  **Acceptance Criteria**:
  - [ ] `POST /api/push/subscriptions` stores subscription; list returns it.
  - [ ] `POST /api/push/test` returns per-subscription result and cleans up gone endpoints.

  **QA Scenarios**:
  ```
  Scenario: Non-admin is forbidden
    Tool: Bash (pytest)
    Steps:
      1. Login as student
      2. Call /api/push/subscriptions
      3. Assert 403
    Evidence: .sisyphus/evidence/task-5-authz.txt

  Scenario: Test push rate limited
    Tool: Bash (pytest)
    Steps:
      1. Login as admin
      2. Call /api/push/test repeatedly
      3. Assert 429 appears after limit
    Evidence: .sisyphus/evidence/task-5-rate-limit.txt
  ```

- [ ] 6. Backend: trigger push send on homework submission (background)

  **What to do**:
  - Extend the existing submission notification background task flow to also send push.
  - Choose recipient policy per Task 1.
  - Ensure push send failures do not affect submission success response.

  **Must NOT do**:
  - Do not block the submission handler on network calls to push endpoints.

  **Recommended Agent Profile**:
  - Category: `unspecified-high`
  - Skills: []

  **Parallelization**:
  - Can Run In Parallel: YES
  - Parallel Group: Wave 2
  - Blocks: 11 (backend tests), 13 (hardening)
  - Blocked By: 1-5

  **References**:
  - `backend/app/api.py` `submit_homework` + `background_tasks.add_task(_send_notification_task, submission_id)`
  - `backend/app/db.py` `create_homework_submission` (submission creation)

  **Acceptance Criteria**:
  - [ ] When push send throws, submission still returns 200.
  - [ ] Successful submission triggers push send call (mocked in tests).

  **QA Scenarios**:
  ```
  Scenario: Submission triggers push send (mocked)
    Tool: Bash (pytest)
    Steps:
      1. Create assignment
      2. Register admin subscription
      3. Submit as student
      4. Assert push send called once
    Evidence: .sisyphus/evidence/task-6-submit-triggers-push.txt

  Scenario: Push failure does not fail submit
    Tool: Bash (pytest)
    Steps:
      1. Mock push send to raise exception
      2. Submit as student
      3. Assert response 200
    Evidence: .sisyphus/evidence/task-6-submit-survives-push-fail.txt
  ```

- [ ] 7. Frontend: add Service Worker for push + notification click handling

  **What to do**:
  - Add a minimal SW file at `curriculum-viewer/public/push-sw.js`.
  - Implement handlers:
    - `self.addEventListener('push', ...)` -> `registration.showNotification(...)`
    - `self.addEventListener('notificationclick', ...)` -> focus/open author page
  - Keep the SW scoped to the app origin; do not add offline caching.

  **Must NOT do**:
  - Do not add PWA offline caching / workbox in v1.

  **Recommended Agent Profile**:
  - Category: `quick`
  - Skills: []

  **Parallelization**:
  - Can Run In Parallel: YES
  - Parallel Group: Wave 2 (with Tasks 5-6, 8-10)
  - Blocks: 9-10 (settings)
  - Blocked By: 1

  **References**:
  - `curriculum-viewer/vite.config.ts` (public asset + build assumptions)

  **Acceptance Criteria**:
  - [ ] SW file is served at `/push-sw.js` in `vite preview`.

  **QA Scenarios**:
  ```
  Scenario: SW push handler calls showNotification (unit)
    Tool: Bash (vitest)
    Steps:
      1. Run vitest with a service-worker mock
      2. Dispatch push event with JSON payload
      3. Assert showNotification invoked with expected title/body
    Evidence: .sisyphus/evidence/task-7-sw-push.txt

  Scenario: notificationclick opens/focuses app
    Tool: Bash (vitest)
    Steps:
      1. Dispatch notificationclick event
      2. Assert clients.openWindow/focus called with expected URL
    Evidence: .sisyphus/evidence/task-7-sw-click.txt
  ```

- [ ] 8. Frontend: implement push client utilities + API wrapper

  **What to do**:
  - Add `curriculum-viewer/src/lib/push/` module(s):
    - register SW
    - request Notification permission
    - subscribe/unsubscribe with VAPID public key
    - normalize subscription object for backend
  - Add API wrapper functions that call backend `/api/push/*` (use `authFetch` pattern).

  **Must NOT do**:
  - Do not store VAPID private key or any secrets.

  **Recommended Agent Profile**:
  - Category: `quick`
  - Skills: []

  **Parallelization**:
  - Can Run In Parallel: YES
  - Parallel Group: Wave 2
  - Blocks: 9-10
  - Blocked By: 5, 7

  **References**:
  - `curriculum-viewer/src/lib/homework/api.ts` (authFetch + error handling style)

  **Acceptance Criteria**:
  - [ ] Utility functions handle: unsupported browser, denied permission, already subscribed.

  **QA Scenarios**:
  ```
  Scenario: subscribe flow hits backend with normalized keys
    Tool: Bash (vitest)
    Steps:
      1. Mock PushManager.subscribe -> returns subscription
      2. Mock backend POST /api/push/subscriptions
      3. Assert correct request body
    Evidence: .sisyphus/evidence/task-8-subscribe-flow.txt

  Scenario: denied permission results in clean UI state
    Tool: Bash (vitest)
    Steps:
      1. Mock Notification.requestPermission -> 'denied'
      2. Assert subscribe is not attempted
    Evidence: .sisyphus/evidence/task-8-denied.txt
  ```

- [ ] 9. Frontend: add admin settings UI page (device list + test push)

  **What to do**:
  - Add `curriculum-viewer/src/pages/AuthorPushSettingsPage.tsx`.
  - UI features:
    - Toggle: enable/disable push for this browser/device
    - Device list (from backend): show label + user-agent summary + last seen + enabled
    - Actions: revoke device; send test push; rename device label
  - Integrate toast feedback via existing `ToastProvider`.

  **Must NOT do**:
  - Do not require any student account flows.

  **Recommended Agent Profile**:
  - Category: `visual-engineering`
  - Skills: []

  **Parallelization**:
  - Can Run In Parallel: YES
  - Parallel Group: Wave 2
  - Blocks: 10 (routing), 12-13 (E2E)
  - Blocked By: 5, 8

  **References**:
  - `curriculum-viewer/src/components/AuthorLayout.tsx` (admin nav style)
  - `curriculum-viewer/src/components/Toast.tsx` (toast usage)

  **Acceptance Criteria**:
  - [ ] Page renders for admins and shows current device status.
  - [ ] “Test push” triggers backend and shows per-device outcome summary.

  **QA Scenarios**:
  ```
  Scenario: Admin can enable push and sees device entry
    Tool: Playwright
    Steps:
      1. Login as admin
      2. Visit /author/push
      3. Mock Notification + PushManager
      4. Enable push
      5. Assert device appears in list
    Evidence: .sisyphus/evidence/task-9-ui-enable.txt

  Scenario: Admin revokes device
    Tool: Playwright
    Steps:
      1. Click revoke on a device
      2. Assert backend DELETE called and device disappears
    Evidence: .sisyphus/evidence/task-9-ui-revoke.txt
  ```

- [ ] 10. Frontend: wire routes + nav entry for Push Settings

  **What to do**:
  - Add route in `curriculum-viewer/src/routes.ts` + `curriculum-viewer/src/App.tsx`.
  - Add nav item in `curriculum-viewer/src/components/AuthorLayout.tsx`.

  **Must NOT do**:
  - Do not change existing author routes behavior.

  **Recommended Agent Profile**:
  - Category: `quick`
  - Skills: []

  **Parallelization**:
  - Can Run In Parallel: YES
  - Parallel Group: Wave 2
  - Blocks: 13 (E2E)
  - Blocked By: 9

  **References**:
  - `curriculum-viewer/src/components/AuthorLayout.tsx` (nav links)
  - `curriculum-viewer/src/App.tsx` (author route nesting)

  **Acceptance Criteria**:
  - [ ] Route is protected by existing author/admin guard.
  - [ ] Build succeeds.

  **QA Scenarios**:
  ```
  Scenario: Route is only accessible to admin
    Tool: Playwright
    Steps:
      1. Login as student
      2. Visit /author/push
      3. Assert redirected / forbidden message
    Evidence: .sisyphus/evidence/task-10-auth-guard.txt

  Scenario: Admin can navigate to push settings via nav
    Tool: Playwright
    Steps:
      1. Login as admin
      2. Click nav item
      3. Assert URL matches and page heading visible
    Evidence: .sisyphus/evidence/task-10-nav.txt
  ```

- [ ] 11. Backend tests: subscription API + submit triggers push + cleanup

  **What to do**:
  - Add pytest coverage:
    - subscription CRUD + authz
    - test push behavior and rate limiting
    - submit triggers push (mock sender)
    - 404/410 cleanup path

  **Recommended Agent Profile**:
  - Category: `deep`
  - Skills: []

  **Parallelization**:
  - Can Run In Parallel: YES
  - Parallel Group: Wave 2 (with Tasks 9-10)
  - Blocks: 15
  - Blocked By: 3-6

  **References**:
  - `backend/tests/test_homework_api.py` (existing auth + homework test patterns)
  - `backend/tests/conftest.py` (TestClient fixture patterns)

  **Acceptance Criteria**:
  - [ ] `pytest -q` passes.

  **QA Scenarios**:
  ```
  Scenario: CRUD + authz
    Tool: Bash (pytest)
    Steps:
      1. Run the new push test module
      2. Ensure 403 for students, 200 for admin
    Evidence: .sisyphus/evidence/task-11-pytest-push.txt

  Scenario: Submit triggers push
    Tool: Bash (pytest)
    Steps:
      1. Run submit->push test
      2. Assert mocked sender called
    Evidence: .sisyphus/evidence/task-11-pytest-submit-trigger.txt
  ```

- [ ] 12. Frontend unit tests: push utils + settings UI

  **What to do**:
  - Add vitest tests for:
    - permission denied path
    - unsupported browser path
    - subscribe/unsubscribe calls backend correctly
    - settings page renders device list + handles actions

  **Recommended Agent Profile**:
  - Category: `unspecified-high`
  - Skills: []

  **Parallelization**:
  - Can Run In Parallel: YES
  - Parallel Group: Wave 2
  - Blocks: 15
  - Blocked By: 8-10

  **References**:
  - `curriculum-viewer/src/pages/AuthorHomeworkStatusPage.test.tsx` (RTL patterns)

  **Acceptance Criteria**:
  - [ ] `npm --prefix curriculum-viewer test -- --run` passes.

  **QA Scenarios**:
  ```
  Scenario: Permission denied path
    Tool: Bash (vitest)
    Steps:
      1. Mock Notification.requestPermission -> denied
      2. Assert UI shows blocked state and no backend call
    Evidence: .sisyphus/evidence/task-12-denied.txt

  Scenario: Subscribe/unsubscribe
    Tool: Bash (vitest)
    Steps:
      1. Mock PushManager subscribe/unsubscribe
      2. Assert backend calls fire with correct payload
    Evidence: .sisyphus/evidence/task-12-subscribe-unsub.txt
  ```

- [ ] 13. Playwright E2E: push settings page behavior (mocked push primitives)

  **What to do**:
  - Add E2E tests that:
    - navigate to push settings page as admin
    - mock `Notification` + `PushManager` in browser context
    - verify UI flows call backend endpoints

  **Recommended Agent Profile**:
  - Category: `visual-engineering`
  - Skills: [`playwright`]

  **Parallelization**:
  - Can Run In Parallel: YES
  - Parallel Group: Wave 3
  - Blocks: 15
  - Blocked By: 5, 9-10

  **References**:
  - `curriculum-viewer/e2e/` (existing test structure)

  **Acceptance Criteria**:
  - [ ] `npm --prefix curriculum-viewer run test:e2e -- <new-spec>` passes.

  **QA Scenarios**:
  ```
  Scenario: Enable push toggles subscribe
    Tool: Playwright
    Steps:
      1. Login as admin
      2. Visit push settings
      3. Toggle enable
      4. Assert POST /api/push/subscriptions
    Evidence: .sisyphus/evidence/task-13-e2e-enable.txt

  Scenario: Test push calls backend
    Tool: Playwright
    Steps:
      1. Click test push
      2. Assert POST /api/push/test
      3. Assert toast shows results
    Evidence: .sisyphus/evidence/task-13-e2e-test-push.txt
  ```

- [ ] 14. Hardening: device metadata, enable/disable semantics, cleanup policy

  **What to do**:
  - Ensure each device/subscription has:
    - a stable id
    - user-visible label (editable)
    - enabled flag
    - last_seen + last_failure
  - Policy:
    - 404/410: delete
    - other errors: increment failure_count, keep
  - Confirm list view shows meaningful device identity (UA summary) without leaking secrets.

  **Recommended Agent Profile**:
  - Category: `unspecified-high`
  - Skills: []

  **Parallelization**:
  - Can Run In Parallel: YES
  - Parallel Group: Wave 3
  - Blocks: 15
  - Blocked By: 3-6, 9

  **References**:
  - `backend/app/db.py` (schema + helper patterns)

  **Acceptance Criteria**:
  - [ ] UI can manage multiple devices reliably.

  **QA Scenarios**:
  ```
  Scenario: Duplicate endpoint upserts not duplicates
    Tool: Bash (pytest)
    Steps:
      1. POST same subscription twice
      2. GET list
      3. Assert single row
    Evidence: .sisyphus/evidence/task-14-upsert.txt

  Scenario: Gone endpoint is cleaned up
    Tool: Bash (pytest)
    Steps:
      1. Mock send -> 410
      2. Trigger test push
      3. Assert device removed
    Evidence: .sisyphus/evidence/task-14-cleanup.txt
  ```

- [ ] 15. Final integration verification + deployment checklist (agent-executed)

  **What to do**:
  - Run all backend + frontend tests/build.
  - Verify required env vars exist in production and are not logged.
  - Validate CORS includes the production frontend origin if different.

  **Recommended Agent Profile**:
  - Category: `deep`
  - Skills: []

  **Parallelization**:
  - Can Run In Parallel: NO
  - Parallel Group: Final integration
  - Blocks: Final Verification Wave
  - Blocked By: 1-14

  **Acceptance Criteria**:
  - [ ] `pytest -q` PASS
  - [ ] `npm --prefix curriculum-viewer test -- --run` PASS
  - [ ] `npm --prefix curriculum-viewer run build` PASS

  **QA Scenarios**:
  ```
  Scenario: Full test suite green
    Tool: Bash
    Steps:
      1. Run backend tests
      2. Run frontend tests
      3. Run frontend build
    Evidence: .sisyphus/evidence/task-15-green.txt

  Scenario: Env var audit
    Tool: Bash
    Steps:
      1. Print required env var names (not values)
      2. Confirm app fails fast when missing
    Evidence: .sisyphus/evidence/task-15-env-audit.txt
  ```

## Final Verification Wave

- [ ] F1. Plan compliance audit (oracle)
- [ ] F2. Code quality + tests (unspecified-high)
- [ ] F3. Agent-executed E2E validation (unspecified-high + playwright)
- [ ] F4. Scope fidelity check (deep)

---

## Commit Strategy
- Commit 1: backend webpush foundation (db + service + endpoints)
- Commit 2: frontend SW + settings UI
- Commit 3: submission integration + tests + runbook

---

## Success Criteria

### Verification Commands
```bash
# backend
python -m compileall backend/app && pytest -q

# frontend
cd curriculum-viewer && npm test -- --run && npm run build
```

### Final Checklist
- [ ] Admin can register devices and revoke them.
- [ ] Push notifications sent on submission.
- [ ] Invalid subscriptions cleaned up on send.
- [ ] No secrets leaked; payload is minimal.
- [ ] Tests/build pass.
