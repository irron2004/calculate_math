# Homework Daily Answer Check V1 — BE Owner Output

## 1. 목적

매일 정해진 시간에 학생 숙제 제출 여부와 답안 상태를 자동 체크하기 위한 1차 백엔드 owner 산출물이다.

이번 1차 범위의 결론은 다음과 같다.

- 신규 조회 API를 새로 설계하지 않는다.
- 기존 admin 조회 API 3개를 daily answer-check 선행 API로 채택한다.
- 1차 핵심은 조회 endpoint 추가보다 자동체크 run 추적성, 상태값 분리, snapshot 저장 구조 보강이다.

---

## 2. 채택 API 범위

### 2.1 학생 기준 오늘까지 숙제 목록 조회

**Endpoint**
- `GET /api/homework/admin/students/{student_id}/daily-summary`

**용도**
- 특정 학생 기준 오늘(asOf)까지 도래한 숙제 목록 조회
- 제출 여부, 지연 제출 여부, overdue 여부 확인
- daily batch의 대상 숙제 선정 기준 API

**Request query**
- `asOf`: 기준 시각 (예: `2026-04-11T23:59:59`)
- `includeSubmitted`: 제출된 숙제 포함 여부
- `includeFutureScheduled`: 미래 scheduled 숙제 포함 여부

**Current response schema**
```json
{
  "studentId": "test",
  "asOf": "2026-04-11T23:59:59",
  "timezone": "UTC",
  "assignments": [
    {
      "assignmentId": "a1",
      "title": "로그 숙제",
      "description": "1일차",
      "dueAt": "2026-04-11T23:59:59",
      "scheduledAt": "2026-04-11T06:00:00",
      "assignedAt": "2026-04-11T06:00:00",
      "submitted": false,
      "submissionId": null,
      "submittedAt": null,
      "submissionStatus": "not_submitted",
      "reviewStatus": null,
      "isOverdue": false,
      "problemCount": 8
    }
  ]
}
```

**Current submissionStatus values**
- `not_submitted`
- `submitted`
- `late_submitted`

---

### 2.2 특정 숙제 제출 상태 재확인

**Endpoint**
- `GET /api/homework/admin/students/{student_id}/assignments/{assignment_id}/submission-status`

**용도**
- 학생/숙제 단건 제출 상태 재확인
- daily-summary 결과 후 보조 검증 API

**Current response schema**
```json
{
  "studentId": "test",
  "assignments": [
    {
      "id": "a1",
      "title": "로그 숙제",
      "description": "1일차",
      "problemCount": 8,
      "dueAt": "2026-04-11T23:59:59",
      "scheduledAt": null,
      "isScheduled": false,
      "stickerRewardCount": 2,
      "createdBy": "admin",
      "createdAt": "2026-04-10T20:00:00",
      "assignedAt": "2026-04-10T20:00:00",
      "submitted": true,
      "submissionId": "s1",
      "submittedAt": "2026-04-11T22:10:00",
      "reviewStatus": "pending",
      "reviewedAt": null,
      "reviewedBy": null
    }
  ]
}
```

**404 error shape**
```json
{
  "error": {
    "code": "ASSIGNMENT_NOT_FOUND",
    "message": "Assignment not found for this student"
  }
}
```

---

### 2.3 제출 상세 답안 체크

**Endpoint**
- `GET /api/homework/admin/submissions/{submission_id}/answer-check`

**용도**
- 제출본의 문제/정답/학생답/정오 여부 확인
- 객관식 자동 정오판별 read model
- 주관식 review 상태와 함께 운영 검토용 상세 API

**Current response schema**
```json
{
  "submissionId": "s1",
  "assignmentId": "a1",
  "assignmentTitle": "로그 숙제",
  "studentId": "test",
  "dueAt": "2026-04-11T23:59:59",
  "submittedAt": "2026-04-11T22:10:00",
  "submissionStatus": "submitted",
  "reviewStatus": "pending",
  "problems": [
    {
      "problemId": "p1",
      "problemIndex": 1,
      "type": "objective",
      "question": "log2 8 = ?",
      "options": ["2", "3", "4"],
      "correctAnswer": "3",
      "studentAnswer": "2",
      "isCorrect": false,
      "review": {
        "needsRevision": false,
        "comment": ""
      }
    },
    {
      "problemId": "p2",
      "problemIndex": 2,
      "type": "subjective",
      "question": "풀이를 적으세요.",
      "options": null,
      "correctAnswer": null,
      "studentAnswer": "식을 세워 계산했습니다.",
      "isCorrect": null,
      "review": {
        "needsRevision": true,
        "comment": "식 전개를 더 적어주세요"
      }
    }
  ]
}
```

**404 error shape**
```json
{
  "error": {
    "code": "SUBMISSION_NOT_FOUND",
    "message": "Submission not found"
  }
}
```

---

## 3. 현재 응답 스키마 끝까지 정리

현재 코드 기준 Pydantic 응답 모델은 아래와 같다.

### 3.1 `AdminDailyHomeworkSummaryItem`
- `assignmentId: str`
- `title: str`
- `description: Optional[str]`
- `dueAt: Optional[str]`
- `scheduledAt: Optional[str]`
- `assignedAt: str`
- `submitted: bool`
- `submissionId: Optional[str]`
- `submittedAt: Optional[str]`
- `submissionStatus: str`
- `reviewStatus: Optional[str]`
- `isOverdue: bool`
- `problemCount: int`

### 3.2 `AdminDailyHomeworkSummaryResponse`
- `studentId: str`
- `asOf: str`
- `timezone: str = "UTC"`
- `assignments: List[AdminDailyHomeworkSummaryItem]`

### 3.3 `AdminStudentAssignmentStatusItem`
- `id: str`
- `title: str`
- `description: Optional[str]`
- `problemCount: int`
- `dueAt: Optional[str]`
- `scheduledAt: Optional[str]`
- `isScheduled: bool`
- `stickerRewardCount: int`
- `createdBy: str`
- `createdAt: str`
- `assignedAt: str`
- `submitted: bool`
- `submissionId: Optional[str]`
- `submittedAt: Optional[str]`
- `reviewStatus: Optional[str]`
- `reviewedAt: Optional[str]`
- `reviewedBy: Optional[str]`

### 3.4 `AdminStudentAssignmentStatusListResponse`
- `studentId: str`
- `assignments: List[AdminStudentAssignmentStatusItem]`

### 3.5 `AdminWrongProblemReview`
- `needsRevision: bool = false`
- `comment: str = ""`

### 3.6 `AdminDailyHomeworkProblemAnswerItem`
- `problemId: str`
- `problemIndex: int`
- `type: str`
- `question: str`
- `options: Optional[List[str]]`
- `correctAnswer: Optional[str]`
- `studentAnswer: Optional[str]`
- `isCorrect: Optional[bool]`
- `review: AdminWrongProblemReview`

### 3.7 `AdminDailyHomeworkSubmissionDetailResponse`
- `submissionId: str`
- `assignmentId: str`
- `assignmentTitle: str`
- `studentId: str`
- `dueAt: Optional[str]`
- `submittedAt: str`
- `submissionStatus: str`
- `reviewStatus: str`
- `problems: List[AdminDailyHomeworkProblemAnswerItem]`

---

## 4. 현재 데이터 모델 영향도

현재 운영 조회에 쓰이는 핵심 테이블은 아래다.

### 4.1 `homework_assignments`
- 숙제 본체
- 핵심 필드:
  - `id`
  - `title`
  - `description`
  - `problems_json`
  - `due_at`
  - `scheduled_at`
  - `sticker_reward_count`
  - `created_by`
  - `created_at`

### 4.2 `homework_assignment_targets`
- 숙제-학생 할당 테이블
- 핵심 필드:
  - `assignment_id`
  - `student_id`
  - `assigned_at`

### 4.3 `homework_submissions`
- 제출 데이터
- 핵심 필드:
  - `id`
  - `assignment_id`
  - `student_id`
  - `answers_json`
  - `submitted_at`
  - `review_status`
  - `reviewed_at`
  - `reviewed_by`
  - `problem_reviews_json`

### 4.4 `homework_submission_files`
- 제출 첨부파일 메타 저장

---

## 5. 부족한 컬럼/테이블 영향도

자동 answer-check 운영까지 이어가려면 현재 조회 모델만으로는 실행 이력과 재실행/실패 추적성이 부족하다.

핵심 보강 방향은 다음과 같다.

- `submission_status`와 `auto_check_status`를 분리
- batch run 단위 추적 저장
- 문항별 snapshot 저장
- 실패/재실행 가능성 확보

### 5.1 상태값 분리 원칙

#### 현재 상태값
- 제출 상태(`submissionStatus`):
  - `not_submitted`
  - `submitted`
  - `late_submitted`
- 리뷰 상태(`reviewStatus`):
  - `pending`
  - `approved`
  - `returned`

#### 추가 필요 상태값
- 자동체크 상태(`auto_check_status`):
  - `scheduled`
  - `started`
  - `completed`
  - `partially_completed`
  - `failed`
  - `skipped`

**결론**
- `submission_status`는 제출 사실/시점의 상태
- `auto_check_status`는 배치 실행 결과 상태
- 둘은 의미가 다르므로 분리 저장이 맞다.

---

### 5.2 권장 신규 테이블 A — `homework_auto_check_runs`

배치 실행 단위 메타 저장 테이블.

**권장 컬럼**
- `id TEXT PRIMARY KEY`
- `run_type TEXT NOT NULL` — 예: `daily_answer_check`
- `as_of TEXT NOT NULL`
- `status TEXT NOT NULL` — `scheduled|started|completed|partially_completed|failed|skipped`
- `triggered_by TEXT NOT NULL` — `scheduler|admin|manual_retry`
- `started_at TEXT`
- `finished_at TEXT`
- `check_run_id TEXT UNIQUE` 또는 `id`를 run 식별자로 사용
- `target_student_count INTEGER NOT NULL DEFAULT 0`
- `target_assignment_count INTEGER NOT NULL DEFAULT 0`
- `checked_submission_count INTEGER NOT NULL DEFAULT 0`
- `failure_count INTEGER NOT NULL DEFAULT 0`
- `failure_reason TEXT`
- `meta_json TEXT`
- `created_at TEXT NOT NULL`

**영향도**
- 기존 서비스 루프 영향 낮음
- read API와 직접 충돌 없음
- rollback 용이
- 스케줄러/재실행/부분실패 추적에 필수

---

### 5.3 권장 신규 테이블 B — `homework_auto_check_targets`

학생-숙제-제출 단위 체크 결과 저장 테이블.

**권장 컬럼**
- `id TEXT PRIMARY KEY`
- `run_id TEXT NOT NULL`
- `student_id TEXT NOT NULL`
- `assignment_id TEXT NOT NULL`
- `submission_id TEXT`
- `submission_status TEXT NOT NULL`
- `auto_check_status TEXT NOT NULL`
- `due_at TEXT`
- `submitted_at TEXT`
- `last_checked_at TEXT`
- `failure_reason TEXT`
- `objective_problem_count INTEGER NOT NULL DEFAULT 0`
- `objective_correct_count INTEGER NOT NULL DEFAULT 0`
- `subjective_problem_count INTEGER NOT NULL DEFAULT 0`
- `missing_answer_count INTEGER NOT NULL DEFAULT 0`
- `needs_manual_review INTEGER NOT NULL DEFAULT 0`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`

**권장 unique/index**
- `(run_id, student_id, assignment_id)` unique
- index on `(student_id, due_at)`
- index on `(auto_check_status, updated_at)`

**영향도**
- 제출 원본(`homework_submissions`) 비파괴 유지 가능
- 특정 run 기준 재현 가능
- daily-summary 조회 결과와 후속 상세 snapshot 연결 가능

---

### 5.4 권장 신규 테이블 C — `homework_auto_check_problem_snapshots`

문항별 스냅샷 저장 테이블.

**권장 컬럼**
- `id TEXT PRIMARY KEY`
- `run_id TEXT NOT NULL`
- `target_id TEXT NOT NULL`
- `student_id TEXT NOT NULL`
- `assignment_id TEXT NOT NULL`
- `submission_id TEXT`
- `problem_id TEXT NOT NULL`
- `question_id TEXT`
- `problem_index INTEGER`
- `problem_type TEXT NOT NULL`
- `question_snapshot TEXT NOT NULL`
- `correct_answer_snapshot TEXT`
- `student_answer_snapshot TEXT`
- `is_correct INTEGER`
- `review_needs_revision INTEGER NOT NULL DEFAULT 0`
- `review_comment_snapshot TEXT`
- `service_tag_id TEXT`
- `unit_name_raw TEXT`
- `unit_name_normalized TEXT`
- `track_code TEXT`
- `created_at TEXT NOT NULL`

**영향도**
- 문제 원본/정답 변경 시에도 당시 체크 결과 재현 가능
- Service→Research handoff 최소 필드(`service_tag_id`, `unit_name_raw`, `unit_name_normalized`, `track_code`) 보존 가능
- 운영 감사/오류 분석/재실행 비교에 유리

---

### 5.5 컬럼 추가안 vs 별도 테이블안

#### `homework_submissions`에 직접 컬럼 추가하는 안
예:
- `check_run_id`
- `last_checked_at`
- `auto_check_status`
- `failure_reason`

#### 판단
1차는 **직접 컬럼 추가보다 별도 run/target/snapshot 테이블 분리**를 권장한다.

**이유**
- 제출 원본과 배치 실행 이력을 분리 가능
- 재실행 시 이력 유실 방지
- 부분 실패/여러 번 체크/버전 비교 가능
- rollback이 쉽다

**예외적으로 허용 가능한 최소 컬럼 추가**
운영 편의를 위해 아래 정도는 추가 검토 가능:
- `homework_submissions.last_checked_at`
- `homework_submissions.last_check_run_id`

다만 이 경우에도 정본 실행 이력은 별도 테이블이 필요하다.

---

## 6. 1차 구현 권장 범위

### 6.1 이번 1차에서 바로 구현 권장
1. 기존 admin 조회 API 3개를 공식 선행 API로 문서화
2. `homework_auto_check_runs` 테이블 추가
3. `homework_auto_check_targets` 테이블 추가
4. `homework_auto_check_problem_snapshots` 테이블 추가
5. auto-check 상태 enum/상태값 문서화

### 6.2 이번 1차에서 보류 가능
1. 학생 단위 bulk answer-check 신규 API
2. `partial_submitted` 같은 새 제출 상태값 추가
3. 자동 체크 write API 공개 endpoint화

---

## 7. QA / 운영 검증 포인트

### 정상 제출
- `submissionStatus=submitted`
- 객관식 문항은 `correctAnswer`, `studentAnswer`, `isCorrect` 일치
- 주관식은 `isCorrect=null`
- auto-check 후 `auto_check_status=completed`

### 미제출
- `submissionId=null`
- `submissionStatus=not_submitted`
- due 시점 경과 후 `isOverdue=true`
- auto-check target row 생성 가능해야 함

### 부분 제출
- 전체 문항 수 대비 `missing_answer_count` 계산 가능해야 함
- 미응답 객관식은 `student_answer_snapshot=null`, `is_correct=0`
- 미응답 주관식은 `student_answer_snapshot=null`, `is_correct=null`

### 지연 제출
- `submittedAt > dueAt` 이면 `submissionStatus=late_submitted`
- target row에도 같은 상태 snapshot 유지

### returned 후 재제출
- 최신 제출 기준 상태 조회 보장
- 이전 제출 snapshot과 새 제출 snapshot이 혼동되지 않아야 함

---

## 8. 실제 코드 변경 파일 경로 (1차 owner 산출물)

이번 owner 산출물에서 실제 변경한 파일은 아래다.

- `/mnt/c/Users/hskim/Desktop/ruahverce/calculate_math/03_문서/docs/homework_daily_answer_check_v1_be_owner_output.md`

이번 변경은 **기존 코드/테스트를 실제 읽고, 현재 구현 상태를 기준으로 1차 운영/스키마 보강안 문서화한 산출물**이다.

---

## 9. 확인한 기존 코드 파일 경로

근거 확인 파일:
- `/mnt/c/Users/hskim/Desktop/ruahverce/calculate_math/01_백엔드/backend/app/api.py`
- `/mnt/c/Users/hskim/Desktop/ruahverce/calculate_math/01_백엔드/backend/app/db.py`
- `/mnt/c/Users/hskim/Desktop/ruahverce/calculate_math/01_백엔드/backend/app/models.py`
- `/mnt/c/Users/hskim/Desktop/ruahverce/calculate_math/01_백엔드/backend/app/homework_grading.py`
- `/mnt/c/Users/hskim/Desktop/ruahverce/calculate_math/01_백엔드/backend/tests/test_homework_api.py`
- `/mnt/c/Users/hskim/Desktop/ruahverce/calculate_math/01_백엔드/backend/tests/test_homework_daily_check_api.py`

---

## 10. 실행 / 검증 명령

### 변경 파일 확인
```bash
cd /mnt/c/Users/hskim/Desktop/ruahverce/calculate_math
git diff -- 03_문서/docs/homework_daily_answer_check_v1_be_owner_output.md
```

### 관련 테스트 실행 명령
```bash
cd /mnt/c/Users/hskim/Desktop/ruahverce/calculate_math/01_백엔드/backend
pytest -q tests/test_homework_api.py tests/test_homework_daily_check_api.py
```

### 참고
현재 OpenClaw 셸에서는 `pytest` 명령이 없어 직접 실행 검증은 실패했다.
실행 결과:
- `pytest: command not found`

따라서 테스트 실행 명령은 위와 같이 남기고, 실제 환경에서 재검증이 필요하다.

---

## 11. owner 메모

- 1차 범위의 본질은 조회 API 신규 개발이 아니라 운영 추적성 보강이다.
- 제출 상태와 자동체크 상태는 계약상 분리해야 한다.
- snapshot은 정답/학생답/서비스 태그를 함께 저장해야 이후 Research/QA/Ops handoff와 재현성이 보장된다.
- 원본 숙제/제출 데이터는 비파괴적으로 유지하고, 자동체크 결과는 별도 이력 테이블로 누적하는 방식이 가장 안전하다.
