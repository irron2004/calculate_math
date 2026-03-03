# Draft: Homework weekday-based publish defaults

## Requirements (confirmed)
- When the homework list is filtered to a specific weekday and the user clicks Publish, default values should be:
  - Scheduled publish time: that weekday at 08:00
  - Homework due time: that weekday at 23:59
- When the filter is All and the user clicks Publish, each homework should be scheduled/published using its own weekday.
- For filter=All, this means splitting selected problems by their `dayKey` and creating multiple assignments (one per weekday bucket).
- If a homework has no weekday info, default due time should be Friday 23:59 of the relevant week.

## Behavior Decisions (confirmed)
- Date basis: compute defaults against the *current week*.
- If computed scheduledAt/dueAt are in the past: allow past values (no auto-rollover).

## Technical Decisions
- Datetime storage appears to be ISO 8601 UTC strings (frontend normalizes via `Date.toISOString()`); UI uses `datetime-local` inputs (browser local time) and display via `toLocaleString('ko-KR', ...)`.
- Week selection exists in UI as `bankWeekKey` with ISO week format like `YYYY-Www`.
- User preference: compute defaults based on the *current week* (not `bankWeekKey`).

## Research Findings
- Publish UI entry point: `curriculum-viewer/src/pages/AuthorHomeworkPage.tsx` (form includes scheduledAt + dueAt fields; submit creates assignment).
- Weekday filter exists but it filters the *problem bank* list, not assignments:
  - State: `bankDayKey` (`""`=All, `mon|tue|wed|thu|fri`) and `bankWeekKey` (e.g. `2026-W04`).
  - Backend problem bank problem schema includes `dayKey`.
  - DB: `homework_problems.day_key TEXT` (nullable => missing weekday = NULL).
- Assignment create API:
  - Frontend: `curriculum-viewer/src/lib/homework/api.ts` (`createAssignment()`, `normalizeDateTimeInput()`)
  - Types: `curriculum-viewer/src/lib/homework/types.ts`
  - Backend route: `backend/app/api.py` POST `/homework/assignments`
  - DB insert: `backend/app/db.py` `create_homework_assignment()`
- Date/time libs: none (vanilla `Date` only); no existing "end of day" defaults.
- Test infra exists:
  - Frontend: Vitest (`curriculum-viewer/vite.config.ts`, `npm test`)
  - E2E: Playwright (`curriculum-viewer/playwright.config.ts`)
  - Backend: pytest (`backend/tests/test_homework_api.py`)
  - No existing tests cover weekday-based scheduling defaults (likely need new ones).

## Open Questions
- Filter=All behavior: when user clicks Publish, should we split into multiple assignments per weekday based on selected problems' `dayKey`? (Current implementation creates a single assignment.)
- When weekday info is missing (problem `day_key` is NULL): what should the default scheduled publish time be? (Due time requested as Fri 23:59.)
- For date computation, should we anchor to the selected `bankWeekKey` (recommended) vs current calendar week?
- Timezone expectations (KST vs browser-local vs UTC); storage is UTC ISO but defaults are computed in local time.
- If computed default datetime is in the past, should we roll forward to next week or keep as-is?

## Scope Boundaries
- INCLUDE: Default value logic for scheduled publish time + due time based on (a) current weekday filter, and (b) each homework's weekday (for All).
- EXCLUDE (unless required): changing homework content, grading logic, notifications, and unrelated list filtering.
