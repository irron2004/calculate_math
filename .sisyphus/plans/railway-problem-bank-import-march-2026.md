# Railway Problem Bank Import (2026-03-09..03-14)

## TL;DR
> **Quick Summary**: 2026-03-09..03-14의 10문항/일 객관식 숙제를 Railway 운영 백엔드의 문제은행(Problem Bank)에 저장하고, 다음부터는 같은 과정을 스크립트/런북으로 빠르게 반복 가능하게 만든다.
>
> **Deliverables**:
> - 문제은행 import API가 20문항 고정이 아니라 “가변 문항 수(>=1, 상한 있음)”를 허용
> - 3/9~3/14 JSON 6개를 저장(리포지토리 fixture) + API로 일괄 import하는 스크립트
> - 재실행(idempotent) 보장 + 확인(weekKey/dayKey 필터 조회) 절차를 런북으로 문서화
>
> **Estimated Effort**: Medium
> **Parallel Execution**: YES (2 waves + final verification)
> **Critical Path**: T2 (backend import policy) -> T3 (tests) -> T5 (import script/runbook) -> Final QA

---

## Context

### Original Request
- Railway로 배포 중인 서비스에 3/9~3/14 문제(매일 10문항, 전부 객관식)를 “추가”
- 다음부터 빠르게 할 수 있도록 추가 프로세스를 정리

### Key Decisions (confirmed)
- 저장 위치: **문제은행(Problem Bank)에 저장** (assignment로 즉시 발행이 아니라 bank에 적재)
- 문항 수 정책: **고정 길이 검증 제거(가변 문항 수 허용)**

### Existing System References (observed)
- Backend import validation: `backend/app/homework_problem_bank.py` `validate_weekly_homework_payload(expected_problem_count=...)`
- Import storage/idempotency: `backend/app/db.py` `import_homework_problem_batch()` (payload hash로 batch idempotent)
- API endpoint: `backend/app/api.py` `POST /api/homework/admin/problem-bank/import`
- Admin UI import panel: `curriculum-viewer/src/pages/AuthorHomeworkPage.tsx` (`handleBankImport`)
- E2E example (currently 20문항 payload): `curriculum-viewer/e2e/homework-problem-bank.spec.ts`
- Local precedent (10문항 import): `scripts/import_grade2_log_homework_2026w10.py` (expected_problem_count=10)

---

## Work Objectives

### Core Objective
- 10문항/일 JSON을 문제은행으로 안정적으로 import(운영/재실행 안전)할 수 있게 한다.

### Must Have
- `POST /api/homework/admin/problem-bank/import` 가 10문항 payload를 **HTTP 200**으로 처리
- import는 **idempotent**: 같은 payload 재실행 시 duplicate 생성 없이 skipped 처리
- per-problem 검증은 유지: objective는 `options>=2`, `answer`가 있으면 `options` 중 하나여야 함
- import 실패 semantics: **문제 1개라도 invalid면 전체 요청을 400으로 거부(atomic)** (partial import 금지)
- 실수 방지: **0문항 거부**, **상한(max problems) 적용**
- 빠른 반복: JSON 6개 + 일괄 import 스크립트 + 확인(runbook)

### Must NOT Have (guardrails)
- 학생 API/화면에 정답(`answer`) 노출(기존 정책 유지)
- 관리자 권한 요구를 약화(인증/인가 우회 금지)
- “문항 수” 외의 validation을 느슨하게 만드는 변경(스키마 품질 저하 금지)

---

## Verification Strategy

### Test Decision (default)
- **Infrastructure exists**: YES (backend pytest, frontend vitest, Playwright)
- **Automated tests**: Tests-after (구현 후 테스트 추가/수정)

### QA Policy
- 모든 TODO는 에이전트가 실행 가능한 QA 시나리오를 포함한다.
- Evidence는 `.sisyphus/evidence/` 아래에 저장한다.

---

## Execution Strategy

### Parallel Execution Waves

Wave 1 (can start immediately)
├── T1. Import payload fixtures (3/9..3/14 JSON 6개)
├── T2. Backend: import count policy (variable count + max + non-empty)
├── T4. Import automation script (API-driven, dry-run)
└── T5. Runbook 문서화 (UI + script + verify)

Wave 2 (after Wave 1)
├── T3. Backend tests (10문항 import + count policy + idempotency)
└── T6. Optional: Playwright smoke update (10문항도 커버)

---

## TODOs

- [x] 1. 3/9~3/14 문제 JSON 6개를 repo fixture로 추가

  **What to do**:
  - 파일 생성: `homework_2026-03-09.json` .. `homework_2026-03-14.json`
  - 각 파일 payload shape는 문제은행 import payload와 호환:
    - top-level: `title`, `description`, `problems[]`
    - each problem: `type="objective"`, `question`, `options[]`, `answer` (options 중 하나)
  - “정답” 값은 현재 제공된 JSON처럼 **options의 텍스트**로 유지(backend validator와 정합)

  **Recommended Agent Profile**:
  - Category: `quick`
  - Skills: (none)

  **Parallelization**:
  - Can Run In Parallel: YES (T2/T4/T5와 병렬)
  - Blocks: T4 (script가 fixture를 읽을 수 있게)

  **References**:
  - `backend/app/homework_problem_bank.py` - payload schema/validation 룰
  - `curriculum-viewer/e2e/homework-problem-bank.spec.ts` - payload 예시(20문항)

  **Acceptance Criteria / QA**:
  ```text
  Scenario: fixtures are valid JSON
    Tool: Bash (python)
    Steps:
      1. python -c "import json; json.load(open('homework_2026-03-09.json','r',encoding='utf-8'))"
      2. 동일하게 03-10..03-14 파일도 파싱
    Expected Result: JSON parse error 없음
    Evidence: .sisyphus/evidence/task-1-json-parse.txt
  ```

- [x] 2. Backend: Problem Bank import에서 고정 20문항 검증 제거 + 상한/0문항 가드레일 추가

  **What to do**:
  - `POST /api/homework/admin/problem-bank/import` 경로가 `expected_problem_count=None`로 import 호출하도록 변경
  - `validate_weekly_homework_payload()` 는:
    - `problems`가 list가 아니면 400
    - `len(problems) == 0`이면 400
    - `len(problems) > MAX`이면 400 (MAX는 200 같은 상수로 명시; 운영 보호)
    - 나머지 per-problem 검증(현재 로직) 유지

  **Recommended Agent Profile**:
  - Category: `unspecified-high`
  - Skills: (none)

  **Parallelization**:
  - Can Run In Parallel: YES (T1/T4/T5와 병렬)
  - Blocks: T3

  **References**:
  - `backend/app/api.py` - `import_problem_bank()` endpoint
  - `backend/app/db.py` - `import_homework_problem_batch(expected_problem_count=...)`
  - `backend/app/homework_problem_bank.py` - `validate_weekly_homework_payload()`

  **Acceptance Criteria / QA**:
  ```text
  Scenario: 10-problem payload is accepted
    Tool: Bash (pytest)
    Steps:
      1. Add/extend pytest to call import_homework_problem_batch(expected_problem_count=None) with 10 problems
    Expected Result: ValueError not raised
    Evidence: .sisyphus/evidence/task-2-variable-count.txt

  Scenario: empty problems is rejected
    Tool: Bash (pytest)
    Expected Result: ValueError("problems list is required" or similar)
    Evidence: .sisyphus/evidence/task-2-empty-rejected.txt
  ```

- [x] 3. Backend tests: API import이 10문항을 받아들이고, 재실행 시 idempotent임을 보장

  **What to do**:
  - 기존 테스트 유지 + 아래 추가:
    - `POST /api/homework/admin/problem-bank/import` 에 10문항 payload -> 200 + createdProblemCount=10
    - 동일 payload 재실행 -> 200 + createdProblemCount=0 + skippedProblemCount=10
    - 0문항 -> 400 INVALID_IMPORT
    - (상한 초과) -> 400 INVALID_IMPORT

  **Recommended Agent Profile**:
  - Category: `deep`
  - Skills: (none)

  **Parallelization**:
  - Can Run In Parallel: NO (T2 이후)
  - Blocked By: T2

  **References**:
  - `backend/tests/test_homework_problem_bank_api.py` - API import idempotency 패턴(20문항)
  - `backend/tests/test_homework_problem_bank_import.py` - db import 함수 직접 호출 패턴

  **Acceptance Criteria / QA**:
  ```text
  Scenario: backend tests pass
    Tool: Bash (pytest)
    Steps:
      1. cd backend
      2. pytest -q
    Expected Result: PASS
    Evidence: .sisyphus/evidence/task-3-pytest.txt
  ```

- [x] 4. Import automation script 추가 (API-driven, dry-run 지원)

  **What to do**:
  - 새 스크립트 추가 (예: `scripts/import_problem_bank_from_files.py`)
  - 입력: JSON 파일들 + base URL + admin 계정
  - 동작:
    - 로그인(`/api/auth/login`) -> token
    - 날짜로부터 `weekKey`(ISO week)와 `dayKey` 계산
    - 각 파일 payload로 `/api/homework/admin/problem-bank/import` 호출
    - 결과(batchId, created/skipped)를 표 형태로 출력
    - `--dry-run`: 호출 대신 파싱/주요 메타만 출력

  **Recommended Agent Profile**:
  - Category: `quick`
  - Skills: (none)

  **Parallelization**:
  - Can Run In Parallel: YES (T2와 병렬 가능; 단 실제 호출은 T2 배포 후)
  - Blocked By: T1 (fixtures), T2 (backend policy deployed)

  **References**:
  - `scripts/publish_homework.py` - admin login + requests 사용 패턴
  - `curriculum-viewer/src/lib/homework/api.ts` - import endpoint path
  - `backend/app/models.py` - request fields (`weekKey`, `dayKey`, `payload`)

  **Acceptance Criteria / QA**:
  ```text
  Scenario: dry-run parses all files
    Tool: Bash
    Steps:
      1. python scripts/import_problem_bank_from_files.py --dry-run homework_2026-03-09.json ... homework_2026-03-14.json
    Expected Result: 각 파일에 대해 weekKey/dayKey 추론 + 문제 수(10) 출력
    Evidence: .sisyphus/evidence/task-4-dry-run.txt
  ```

- [x] 5. Runbook: 다음부터 빠르게 하는 “추가 프로세스” 문서화

  **What to do**:
  - 문서 위치: `.sisyphus/plans/railway-problem-bank-import-march-2026.md` 내 Runbook 섹션 추가 또는 별도 `.sisyphus/drafts/`가 아닌 repo 문서(프로젝트 정책에 맞춰)
  - 포함 내용(운영 안전):
    - (권장) staging 먼저, 없으면 local -> prod 순서
    - UI로 import 하는 법 (AuthorHomeworkPage의 문제은행 Import 패널)
    - 스크립트로 import 하는 법 (env var, dry-run, 실제 실행)
    - verify 방법: `/api/homework/admin/problem-bank/problems?weekKey=...&dayKey=...` 로 카운트 확인
    - idempotency 설명(같은 payload 재실행 안전)
    - secrets policy (토큰/비번 기록 금지)

  **Recommended Agent Profile**:
  - Category: `writing`
  - Skills: (none)

  **Parallelization**:
  - Can Run In Parallel: YES

  **Acceptance Criteria / QA**:
  ```text
  Scenario: runbook is executable end-to-end
    Tool: Bash
    Steps:
      1. Follow runbook commands in order on a test environment
    Expected Result: import + verify steps are complete and unambiguous
    Evidence: .sisyphus/evidence/task-5-runbook-checklist.txt
  ```

- [x] 6. (Optional) Playwright E2E에 10문항 import 케이스도 추가

  **What to do**:
  - 기존 `curriculum-viewer/e2e/homework-problem-bank.spec.ts`는 20문항 payload를 사용
  - 추가로 10문항 payload를 import하는 케이스(또는 helper 파라미터화)

  **Recommended Agent Profile**:
  - Category: `unspecified-high`
  - Skills: [`playwright`]

  **Parallelization**:
  - Can Run In Parallel: NO (T2 이후)

  **Acceptance Criteria / QA**:
  ```text
  Scenario: e2e import works for 10 and 20
    Tool: Bash (playwright)
    Steps:
      1. cd curriculum-viewer
      2. npm run test:e2e -- homework-problem-bank
    Expected Result: PASS
    Evidence: .sisyphus/evidence/task-6-playwright.txt
  ```

---

## Final Verification Wave (parallel)

- [x] F1. API contract + security sanity (`deep`)
  - 학생 경로에 `answer` 노출이 없는지 spot-check
  - admin import는 auth 없이 접근 불가(403)

- [x] F2. CI-style test run (`unspecified-high`)
  - backend pytest + frontend vitest (가능하면 e2e)

- [x] F3. Production-safe dry-run (`quick`)
  - prod URL 대상으로 `--dry-run` 실행(네트워크 호출 없음)

- [ ] F4. Production import + verify checklist (`unspecified-high`)
  - 실제 import 실행 후 weekKey/dayKey 필터 조회로 10문항 * 6일 확인

---

## Commit Strategy
- Commit 1: backend import policy change + tests
- Commit 2: fixtures + importer script + runbook

## Success Criteria
- 3/9~3/14 데이터가 문제은행에 존재(weekKey/dayKey로 조회 가능)
- 동일 payload 재실행해도 중복 생성 없이 skipped 처리
- 다음부터는 스크립트/런북만으로 동일 과정을 5~10분 내 수행 가능
