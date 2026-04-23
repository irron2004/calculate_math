---
name: homework-operations
description: 숙제 배정·미제출 추적·제출 확인·반려 관리를 운영한다. admin API로 학생별 일일 현황 조회, 미제출 리마인드, 검토 대기 정리, 운영 이슈 로그가 필요할 때 반드시 이 스킬을 쓴다. "미제출", "숙제 현황", "제출 확인", "리마인드", "반려", "오늘 숙제", "daily summary" 표현이 나오면 트리거한다.
---

# Homework Operations

숙제 루프(배정 → 제출 → 검토 → 재제출)를 운영 관점에서 돌리는 절차.

## 언제 쓰는가

- 일일 미제출 현황 확인
- 특정 학생의 숙제 제출 여부 조회
- 제출된 답안의 자동 채점 결과 확인
- 반려/재제출 대상 정리
- 리마인드 발송 대상 산출

## 원칙 (가장 중요)

**admin API만 쓴다.** CLAUDE.md의 규칙이다. 새 API를 요청하기 전에 이 세 가지로 해결되는지 먼저 증명한다:

| API | 언제 쓰는가 |
|---|---|
| `GET /api/homework/admin/students/{student_id}/daily-summary?asOf=YYYY-MM-DD` | 특정 날짜 기준 학생의 숙제 현황 (제출/미제출/지연/연체) |
| `GET /api/homework/admin/students/{student_id}/assignments/{assignment_id}/submission-status` | 특정 숙제의 제출 상태 재확인 |
| `GET /api/homework/admin/submissions/{submission_id}/answer-check` | 제출된 문제·학생 답·정답·자동채점 결과 |

## 워크플로우

### 1. 기준 시각(asOf) 결정

기본: 오늘 23:59 (하루 마감 기준). 특정 시점 현황을 볼 때는 해당 시각.

### 2. 학생 목록 확보

운영 대상 학생 ID 목록 준비. 반/그룹 단위 조회가 필요하면 BE에 우선 admin API로 가능한지 확인.

### 3. 일일 현황 집계

각 학생에 대해 `daily-summary` 호출:
```
GET /api/homework/admin/students/{id}/daily-summary?asOf=2026-04-23
```

응답에서 분류:
- **제출 완료**: 기록만
- **지연 제출**: 리마인드 불필요, 운영 로그
- **미제출(기한 전)**: 오늘 마감이면 리마인드 후보
- **미제출(기한 초과)**: 에스컬레이션 후보

### 4. 리마인드 대상 선정

**기준:**
- 마감 24시간 이내 미제출
- 최근 3일 내 리마인드 이력 없음 (중복 발송 금지)
- 학생 연락 가능 상태

**문구 원칙:**
- 비난조 금지
- 구체적 숙제명 + 마감 시각 포함
- 1회만 가볍게, 반복 미제출은 운영 에스컬레이션으로

### 5. 답안 확인이 필요할 때

특정 제출의 자동채점 결과를 볼 때:
```
GET /api/homework/admin/submissions/{submission_id}/answer-check
```

반려 판단:
- 자동채점 통과 + 해설 필요 없음 → 완료
- 자동채점 실패 + 명백한 개념 오류 → 재제출 요청
- 자동채점 모호 (주관식/서술형) → 사람 검토 대기

### 6. 운영 이슈 로그

다음 패턴이 반복되면 `math-backend-engineer`에게 에스컬레이션:
- `daily-summary` 응답과 실제 상태 불일치
- `answer-check`가 반복적으로 빈 결과
- 제출이 기록되지 않는 특정 학생/숙제

로그 형식 (`_workspace/operations_issues_{date}.md`):
```markdown
## 이슈: 학생 X의 2026-04-22 숙제가 daily-summary에 미반영
- **재현**: GET /api/homework/admin/students/X/daily-summary?asOf=2026-04-22
- **기대**: "submitted" 상태
- **실제**: "not_submitted"
- **추가 정보**: 학생은 20:15에 제출했다고 보고
- **우선순위**: 중 (개별 사안, 반복 시 상)
```

### 7. 산출물

- `_workspace/homework_daily_status_{YYYY-MM-DD}.md` — 전체 현황 요약
- `_workspace/reminder_dispatch_{YYYY-MM-DD}.md` — 발송 대상 + 문구 초안
- `_workspace/operations_issues_{YYYY-MM-DD}.md` — 이슈 로그 (있을 때)

### 8. 주간 피드백

매주 `student-state-researcher`에게:
- 반복 미제출 학생 패턴
- 특정 숙제 세트의 반려율 편중
- 재제출 전환율

## 의존 스킬

- `math-backend-implementation` — admin API 활용 및 버그 에스컬레이션
- `student-state-analysis` — 주간 피드백 데이터 제공

## 데이터 취급 원칙

- **PII 마스킹** — 리마인드/보고 시 학생 실명 대신 ID 사용, 개인 식별 정보 최소화
- **접근 제한** — admin API는 인증된 운영자만, 조회 결과는 필요한 최소 정보만
- **로그 보존** — 미제출/리마인드 이력은 1년 후 집계 통계로 변환
- **동의 확인** — 리마인드 발송 전 연락처 활용 동의 여부 확인

## 원칙

- **admin API 우선** — ad-hoc API 요청 전 기존 surface 확인
- **추측 금지** — 응답 본 뒤 보고
- **전환률이 목표** — 목록만 출력하고 끝내지 않는다
- **부드러운 커뮤니케이션** — 비난조 회피
- **반복 버그는 BE로 에스컬레이션** — 운영에서 해결하려 들지 않기

## 참고
- `/mnt/c/Users/hskim/Desktop/ruahverce/calculate_math/CLAUDE.md` (Homework admin lookup conventions)
- `03_문서/docs/homework_daily_answer_check_v1_be_owner_output.md`
- `03_문서/docs/problem_ops_and_progress_management.md`
