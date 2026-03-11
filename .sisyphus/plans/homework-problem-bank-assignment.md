# Homework Problem Bank + Per-Student Assignment

## TL;DR

> **Quick Summary**: 기존 숙제 기능을 확장해 문제은행(DB 저장) + 라벨 관리 + 학생별 출제를 한 흐름으로 통합한다.
>
> **Deliverables**:
> - 문제은행/라벨 스키마 및 마이그레이션
> - 관리자 문제 입력(주간 JSON import) + 라벨링 + 필터
> - 학생별 출제(기존 target 패턴 재사용) + 학생 API 정답 비노출
>
> **Estimated Effort**: Large
> **Parallel Execution**: YES - 4 waves + final verification
> **Critical Path**: 1 -> 6 -> 8 -> 10 -> 12 -> F1/F2/F3/F4

---

## Context

### Original Request
월~금 20문항 세트를 DB에 저장하고 라벨을 달아, 출제 화면에서 학생별로 숙제를 출제.

### Interview Summary
**Key Discussions**:
- 정답(`answer`)은 관리자/교사 전용으로만 조회.
- 라벨은 preset 중심 + 관리자 제한적 커스텀 허용.
- 테스트 전략은 TDD.

**Research Findings**:
- 기존 숙제 기능 및 학생 타겟 조인 테이블(`homework_assignment_targets`)이 이미 존재.
- 기존 문제는 `homework_assignments.problems_json` 임베드 구조.
- 패턴 파일: `backend/app/db.py`, `backend/app/api.py`, `backend/app/models.py`, `curriculum-viewer/src/pages/AuthorHomeworkPage.tsx`.

### Metis Review
**Identified Gaps** (addressed in this plan):
- Snapshot vs reference 정책을 명시: 출제 시 문제 스냅샷 저장.
- 정답 누출 방지 가드레일(API DTO 분리 + 테스트 강제).
- 재-import/중복/순서/권한/라벨 삭제 엣지케이스 명시.

---

## Work Objectives

### Core Objective
문제은행과 라벨을 도입하고, 기존 숙제 출제 흐름과 호환되게 학생별 출제를 강화한다.

### Concrete Deliverables
- `homework_problems`, `homework_labels`, `homework_problem_labels` 및 import 추적 스키마 추가
- 관리자 문제은행 API(등록/조회/필터/라벨연결/주간 JSON import)
- 출제 UI에서 문제 선택 + 학생 선택 + 스냅샷 출제
- 학생 API 응답에서 `answer` 완전 비노출 보장

### Definition of Done
- [x] 관리자 import -> 문제은행 저장 -> 라벨링 -> 학생별 출제 -> 학생 조회까지 E2E 통과
- [x] 학생 권한 API 응답 어디에도 `answer` 필드 없음
- [x] TDD 테스트(백엔드+프론트) 모두 PASS

### Must Have
- 기존 `homework_assignment_targets` 재사용
- 출제 시점 스냅샷 저장(나중 수정이 기존 출제물에 영향 없음)
- preset 라벨 + 관리자 custom 라벨 제한

### Must NOT Have (Guardrails)
- 학생 경로에서 `answer` 반환 금지
- 기존 숙제 목록/제출 기능 파손 금지
- 자동 채점/분석 대시보드 범위 확장 금지

---

## Verification Strategy (MANDATORY)

> **ZERO HUMAN INTERVENTION** - 모든 검증은 에이전트 실행으로 수행.

### Test Decision
- **Infrastructure exists**: YES
- **Automated tests**: TDD
- **Framework**: Backend pytest 계열 + Frontend vitest
- **If TDD**: 각 구현 task는 RED -> GREEN -> REFACTOR 순서로 진행

### QA Policy
- Frontend/UI: Playwright로 화면 흐름 검증 + 스크린샷 저장
- API/Backend: Bash `curl` + 응답 필드/권한 검증
- Module/Logic: 테스트 러너로 단위/통합 검증
- Evidence path: `.sisyphus/evidence/task-{N}-{scenario}.{ext}`

---

## Execution Strategy

### Parallel Execution Waves

Wave 1 (Foundation): T1, T2, T3, T4, T5
Wave 2 (Core backend): T6, T7, T8, T9
Wave 3 (Frontend integration + hardening): T10, T11, T12
Wave FINAL (Independent review): F1, F2, F3, F4

### Dependency Matrix
- T1: blocked by none -> blocks T6,T7,T10
- T2: blocked by none -> blocks T6,T10
- T3: blocked by none -> blocks T7,T11
- T4: blocked by none -> blocks T8,T9
- T5: blocked by none -> blocks T8,T12
- T6: blocked by T1,T2 -> blocks T8,T10,T11
- T7: blocked by T1,T3 -> blocks T9,T10,T11
- T8: blocked by T4,T5,T6 -> blocks T10,T12
- T9: blocked by T4,T7 -> blocks T11,T12
- T10: blocked by T1,T2,T6,T7,T8 -> blocks T12
- T11: blocked by T3,T6,T7,T9 -> blocks T12
- T12: blocked by T5,T8,T9,T10,T11 -> blocks F1,F2,F3,F4

### Agent Dispatch Summary
- Wave 1: quick x5
- Wave 2: unspecified-high x2, deep x2
- Wave 3: visual-engineering x2, unspecified-high x1
- Final: oracle x1, unspecified-high x2, deep x1

---

## TODOs

- [x] 1. 문제은행 스키마 및 마이그레이션 함수 추가

  **What to do**:
  - `backend/app/db.py`에 `homework_problems`, `homework_labels`, `homework_problem_labels`, `homework_import_batches` 생성 `_ensure_*` 추가
  - 기존 숙제 테이블/데이터와 호환 유지

  **QA Scenarios**:
  ```text
  Scenario: migration happy path
    Tool: Bash (pytest)
    Expected Result: 신규 4개 테이블 생성
    Evidence: .sisyphus/evidence/task-1-migration.txt

  Scenario: migration idempotency
    Tool: Bash (pytest)
    Expected Result: 2회 실행에도 오류/중복 없음
    Evidence: .sisyphus/evidence/task-1-idempotency.txt
  ```

- [x] 2. 관리자/학생 DTO 분리로 answer 비노출 강제

  **What to do**:
  - `backend/app/models.py`에 AdminProblemDTO(answer 포함)와 StudentProblemDTO(answer 제외) 분리
  - 학생 응답 모델에서 answer 필드 타입 차단

  **QA Scenarios**:
  ```text
  Scenario: admin dto includes answer
    Tool: Bash (pytest)
    Expected Result: 관리자 직렬화 결과에 answer 존재
    Evidence: .sisyphus/evidence/task-2-admin-dto.txt

  Scenario: student dto excludes answer
    Tool: Bash (pytest)
    Expected Result: 학생 직렬화 결과에 answer 키 미존재
    Evidence: .sisyphus/evidence/task-2-student-dto.txt
  ```

- [x] 3. 프런트 문제/라벨 타입 계층 분리

  **What to do**:
  - `curriculum-viewer/src/lib/homework/types.ts`에서 admin/student problem 타입 분리
  - preset + custom label 타입 정의

  **QA Scenarios**:
  ```text
  Scenario: frontend typecheck pass
    Tool: Bash (npm/vitest)
    Expected Result: 타입체크 통과
    Evidence: .sisyphus/evidence/task-3-typecheck.txt

  Scenario: student type cannot access answer
    Tool: Bash
    Expected Result: 학생 타입의 answer 접근 컴파일 실패
    Evidence: .sisyphus/evidence/task-3-negative.txt
  ```

- [x] 4. 주간 JSON import 검증기(TDD) 작성

  **What to do**:
  - 요일별 20문항, 객관식 options, answer 형식 규칙 검증
  - invalid 입력을 일관된 에러 코드로 반환

  **QA Scenarios**:
  ```text
  Scenario: valid weekly json
    Tool: Bash (pytest)
    Expected Result: 검증 통과
    Evidence: .sisyphus/evidence/task-4-valid.txt

  Scenario: invalid objective options
    Tool: Bash (pytest)
    Expected Result: 400 에러 + 명시 메시지
    Evidence: .sisyphus/evidence/task-4-invalid.txt
  ```

- [x] 5. import batch 중복 방지/순서 보존 규칙 구현

  **What to do**:
  - 주차+요일+원본해시 기준 idempotent import
  - 문제 순서(order) 안정적으로 저장

  **QA Scenarios**:
  ```text
  Scenario: re-import same payload
    Tool: Bash (pytest)
    Expected Result: 문제 중복 생성 없음
    Evidence: .sisyphus/evidence/task-5-idempotent.txt

  Scenario: order preservation
    Tool: Bash (pytest)
    Expected Result: 조회 순서가 입력 순서와 동일
    Evidence: .sisyphus/evidence/task-5-order.txt
  ```

- [x] 6. 문제은행 DB 접근 함수/리포지토리 계층 추가

  **What to do**:
  - 문제 생성/조회/라벨 연결/필터 함수를 `backend/app/db.py`에 추가
  - preset/custom 라벨 제약(관리자만 custom 생성) 반영

  **QA Scenarios**:
  ```text
  Scenario: create and query by label
    Tool: Bash (pytest)
    Expected Result: 라벨 필터 결과가 정확히 일치
    Evidence: .sisyphus/evidence/task-6-label-query.txt

  Scenario: student cannot create custom label
    Tool: Bash (pytest)
    Expected Result: 권한 거부 처리
    Evidence: .sisyphus/evidence/task-6-auth.txt
  ```

- [x] 7. 관리자 문제은행 API(등록/조회/라벨 필터) 추가

  **What to do**:
  - `backend/app/api.py`에 admin 전용 endpoints 추가
  - 페이징/라벨 필터/요일 필터 지원

  **QA Scenarios**:
  ```text
  Scenario: admin list with label filter
    Tool: Bash (curl)
    Expected Result: 필터 라벨 포함 문제만 반환
    Evidence: .sisyphus/evidence/task-7-admin-filter.json

  Scenario: student hitting admin endpoint
    Tool: Bash (curl)
    Expected Result: 403/권한 오류
    Evidence: .sisyphus/evidence/task-7-auth-fail.json
  ```

- [x] 8. 관리자 import API + batch 처리 연결

  **What to do**:
  - 주간 JSON 업로드 API에서 검증기(T4) + idempotent import(T5) + 저장(T6) 실행
  - import 결과(신규/갱신/스킵 카운트) 응답 제공

  **QA Scenarios**:
  ```text
  Scenario: import weekly set once
    Tool: Bash (curl)
    Expected Result: created count > 0, errors 0
    Evidence: .sisyphus/evidence/task-8-import-once.json

  Scenario: import same set again
    Tool: Bash (curl)
    Expected Result: duplicate insert 없음, skipped count 증가
    Evidence: .sisyphus/evidence/task-8-import-twice.json
  ```

- [x] 9. 학생 조회 API answer 비노출 회귀보호 테스트 추가

  **What to do**:
  - 기존 학생 assignment/list/detail 경로에서 answer 비노출 단정 테스트 추가
  - 중첩 구조(JSON)까지 검색하는 누출 테스트 작성

  **QA Scenarios**:
  ```text
  Scenario: student fetch assignment detail
    Tool: Bash (curl)
    Expected Result: response 어디에도 answer 키 없음
    Evidence: .sisyphus/evidence/task-9-student-safe.json

  Scenario: admin fetch assignment detail
    Tool: Bash (curl)
    Expected Result: admin 경로에서 answer 확인 가능
    Evidence: .sisyphus/evidence/task-9-admin-visible.json
  ```

- [x] 10. 출제 API를 문제은행 선택 기반 스냅샷 생성으로 확장

  **What to do**:
  - assignment 생성 시 `problemIds` 입력을 받아 문제은행에서 스냅샷(`problems_json`) 생성
  - 기존 직접 문제입력 방식과 하위호환 유지

  **QA Scenarios**:
  ```text
  Scenario: create assignment from problem ids
    Tool: Bash (curl)
    Expected Result: assignment 생성 + target 학생 연결 성공
    Evidence: .sisyphus/evidence/task-10-create-snapshot.json

  Scenario: edit problem bank after publish
    Tool: Bash (curl)
    Expected Result: 기존 assignment 내용은 변경되지 않음
    Evidence: .sisyphus/evidence/task-10-snapshot-immutable.json
  ```

- [x] 11. 관리자 출제 화면에 문제은행/라벨 필터/학생선택 통합

  **What to do**:
  - `AuthorHomeworkPage`에 문제은행 탭/검색/라벨 필터/선택 목록 추가
  - 학생 선택 UI는 기존 패턴 유지, 다중 선택 UX 개선

  **QA Scenarios**:
  ```text
  Scenario: author selects labeled problems and students
    Tool: Playwright
    Steps: 로그인 -> 출제화면 -> 라벨 필터 -> 문제 선택 -> 학생 2명 선택 -> 출제
    Expected Result: 성공 토스트 + 상태 화면 이동
    Evidence: .sisyphus/evidence/task-11-author-flow.png

  Scenario: submit without student selection
    Tool: Playwright
    Expected Result: 검증 메시지 노출, 제출 차단
    Evidence: .sisyphus/evidence/task-11-no-student.png
  ```

- [x] 12. E2E 통합(TDD 마무리) + 권한/보안/회귀 하드닝

  **What to do**:
  - 백엔드+프런트 통합 테스트로 import->라벨->출제->학생조회 경로 고정
  - 권한 오류, 라벨 삭제/변경, 재-import, 정답 누출 회귀 시나리오 추가

  **QA Scenarios**:
  ```text
  Scenario: end-to-end weekly workflow
    Tool: Playwright + Bash(curl)
    Expected Result: 관리자 전체 플로우 성공, 학생에게는 answer 미노출
    Evidence: .sisyphus/evidence/task-12-e2e.zip

  Scenario: unauthorized and edge-case replay
    Tool: Bash (pytest/curl)
    Expected Result: 비권한 접근 차단, 재-import 중복 없음, 회귀 테스트 PASS
    Evidence: .sisyphus/evidence/task-12-security.txt
  ```

---

## Final Verification Wave (MANDATORY)

- [x] F1. Plan Compliance Audit (`oracle`)
- [x] F2. Code Quality Review (`unspecified-high`)
- [x] F3. Real QA Replay (`unspecified-high` + `playwright`)
- [x] F4. Scope Fidelity Check (`deep`)

---

## Commit Strategy

- Wave 1: `feat(homework-db): add problem bank and label schema`
- Wave 2: `feat(homework-api): add problem bank APIs and secure DTOs`
- Wave 3: `feat(homework-ui): authoring and per-student assignment integration`
- Wave 3: `test(homework): add e2e hardening and import idempotency checks`

---

## Success Criteria

### Verification Commands
```bash
# backend tests
pytest backend/tests/test_homework_api.py

# frontend tests
cd curriculum-viewer && npm test -- --run
```

### Final Checklist
- [x] 문제은행 import/조회/라벨링/출제 흐름 완료
- [x] 학생 응답 정답 비노출 100%
- [x] TDD 테스트 및 회귀 테스트 PASS
