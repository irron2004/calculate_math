# Draft: Railway DB wrong-problem query + re-assignment (2026-03-09 / 이지율)

## Requirements (confirmed)
- Query from Railway DB: problems that student "이지율" (id=3) got wrong
- Next (after review of wrong problems): create new homework using similar problems
- Also create practice set for bracket/distributive property style (e.g., 39*4 = (30+9)*4 = 30*4 + 9*4)
- Tag/label: "2026-03-09 이지율" (exact display text)
- Workflow: do the wrong-problem query first; assignment creation later
- UI: when viewing homework status, it should be easy to see per-student homework status

## Technical Decisions (pending)
- Data source for "wrong": homework submissions vs eval/placement vs manual review
- Access method to Railway DB: **DB subset export** (user selected)
- Output format for the wrong-problem report (CSV/JSON/table)
- Similar-problem generation method and difficulty constraints

## Research Findings
- DB schema (SQLite) has homework tables with JSON payloads:
  - `homework_submissions(student_id, answers_json, review_status, problem_reviews_json, submitted_at, ...)`
  - `homework_assignments(problems_json, title, due_at, ...)`
  - Join path for per-submission analysis: `homework_submissions` -> `homework_assignments` on `assignment_id`.
- `student_id` used in homework tables matches the **username** concept in API (not numeric int PK).
  - Backend checks `user.username == studentId` for student endpoints.
- Admin endpoints that can support extracting wrong problems without DB access:
  - `GET /api/homework/admin/assignments` (list)
  - `GET /api/homework/admin/assignments/{assignment_id}` (includes per-student `submissionId`, `reviewStatus`)
  - `GET /api/homework/admin/submissions/{submission_id}` (includes `problems`, `answers`, `problemReviews`)
  - `POST /api/homework/submissions/{submission_id}/review` stores `problemReviews[problemId]={needsRevision, comment}`.
- UI already has assignment -> per-student status table in `curriculum-viewer/src/pages/AuthorHomeworkStatusPage.tsx`.
- (pending) best-practice patterns for generating distributive-property problems + distractors

## Open Questions
- Which dataset defines "틀린 문제" (homework submissions? placement? eval?)
- Time range / which assignments to include
- Confirm student identifier: is (3) `student_id=3` in DB, or another id field?
- Where should the tag live: problem-bank label key/name vs homework assignment metadata?
- UI clarification: do you mean (A) assignment -> list students (already exists in `AuthorHomeworkStatusPage`), or (B) student -> list assignments/statuses?

## Notes From User
- "이지율(3)" where (3) is "아이디(학년)" (likely grade/class indicator, not necessarily `student_id` username).

## Scope Boundaries
- INCLUDE: query wrong problems, produce report, draft new practice set plan, add tagging approach
- EXCLUDE (for now): actually creating/importing the new homework until wrong-problem list is reviewed
