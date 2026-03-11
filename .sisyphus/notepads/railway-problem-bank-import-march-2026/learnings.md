# Learnings

- 2026-03-08: For variable-count imports, `api.import_problem_bank` can opt out of fixed-size validation by passing `expected_problem_count=None` into `import_homework_problem_batch`.
- 2026-03-08: Keep validator strict even with variable count by enforcing `problems` as a non-empty list with a hard cap constant `MAX_IMPORT_PROBLEM_COUNT = 200`.

- Task 3 tests now assert API import idempotency for a 10-problem payload: first import returns createdProblemCount=10, second import returns createdProblemCount=0 and skippedProblemCount=10.
- Added API-level invalid import coverage for empty problems and >200 problems, asserting 400 with error.code=INVALID_IMPORT.
- Added validator unit coverage for non-empty and max-200 constraints with expected_problem_count=None to match import route behavior.
- 2026-03-08: `scripts/import_problem_bank_from_files.py` derives `weekKey`/`dayKey` from `homework_YYYY-MM-DD.json` using ISO week (`YYYY-WNN`) and weekday mapping `mon..sun` from `date.isocalendar()`.
- 2026-03-08: Dry-run mode validates top-level keys (`title`, `description`, `problems`) and requires a non-empty `problems` list, then prints deterministic per-file metadata rows without making network calls.
- 2026-03-08: Task 5 runbook finalized in `docs/problem-bank-import-runbook.md` with staging-first order, UI import panel steps, script dry-run/real-run commands, verify endpoint usage, idempotency expectations, and secrets handling rules.
- 2026-03-08: E2E spec `curriculum-viewer/e2e/homework-problem-bank.spec.ts` now exercises both 10-problem and 20-problem imports via shared helper `importProblemBank`, asserting deterministic list counts (`목록: 10개`, `목록: 20개`) before continuing assignment flow.
- 2026-03-09: `scripts/import_problem_bank_from_files.py --dry-run` against all six March files remains a reliable preflight signal (week/day derivation and counts), independent of credential availability.
