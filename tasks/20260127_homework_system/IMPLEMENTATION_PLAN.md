# 학생 관리 및 숙제 시스템 - 상세 구현 계획

**작성일**: 2026-01-27
**상태**: 구현 계획 확정

---

## 1. MVP 범위 정의

1. Admin(teacher)이 학생에게 숙제를 "할당"한다
2. 학생은 로그인 후 "My Page"에서 할당된 숙제 목록을 본다
3. 숙제를 클릭하면 문제(주관식)가 보인다
4. 학생이 답안(텍스트 + 사진 업로드)을 제출한다
5. 제출 즉시 admin 메일로 "답안 + 사진 첨부"가 전송된다
6. 답안과 첨부파일은 백엔드에 저장된다 (메일 실패해도 저장은 남음)

---

## 2. 확정된 기술 결정 사항

| 항목 | 결정 | 비고 |
|------|------|------|
| **이메일 발송** | 백엔드 API (Gmail SMTP) | FastAPI + BackgroundTasks |
| **파일 저장** | 디스크 저장 | `backend/data/uploads/{submission_id}/` |
| **첨부 정책** | 최대 3장, 장당 5MB | jpg, jpeg, png, webp 허용 |
| **마감일** | 필요 | due_at 필드 추가 |
| **인증 방식** | 로컬스토리지 유지 | studentId를 API에 전달 |
| **Admin 이메일** | 환경변수로 설정 | ADMIN_EMAIL |

---

## 3. 백엔드 설계 (FastAPI / SQLite)

### 3.1 DB 테이블 추가

**1. homework_assignments (숙제)**
```sql
CREATE TABLE homework_assignments (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  prompt TEXT NOT NULL,           -- 문제 본문
  due_at TEXT,                    -- 마감일 (ISO8601, 선택)
  created_by TEXT NOT NULL,       -- admin id
  created_at TEXT NOT NULL
);
```

**2. homework_assignment_targets (숙제 대상 학생)**
```sql
CREATE TABLE homework_assignment_targets (
  assignment_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  assigned_at TEXT NOT NULL,
  PRIMARY KEY (assignment_id, student_id)
);
```

**3. homework_submissions (제출)**
```sql
CREATE TABLE homework_submissions (
  id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  answer_text TEXT NOT NULL,
  submitted_at TEXT NOT NULL
);
```

**4. homework_submission_files (첨부파일)**
```sql
CREATE TABLE homework_submission_files (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL,
  stored_path TEXT NOT NULL,      -- 디스크 경로
  original_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
```

### 3.2 API 엔드포인트

**1. POST /api/homework/assignments** (Admin 숙제 생성)
```python
Request:
{
  "title": "1단원 복습",
  "prompt": "교과서 10-15페이지 문제를 풀고 사진으로 제출하세요",
  "dueAt": "2026-02-01T23:59:59",  # 선택
  "targetStudentIds": ["student1", "student2"]
}

Response:
{ "id": "uuid", "success": true }
```

**2. GET /api/homework/assignments?studentId=...** (학생 숙제 목록)
```python
Response:
{
  "assignments": [
    {
      "id": "uuid",
      "title": "1단원 복습",
      "prompt": "...",
      "dueAt": "2026-02-01T23:59:59",
      "createdAt": "2026-01-27T10:00:00",
      "submitted": false
    }
  ]
}
```

**3. GET /api/homework/assignments/{id}?studentId=...** (숙제 상세)
```python
Response:
{
  "id": "uuid",
  "title": "1단원 복습",
  "prompt": "교과서 10-15페이지...",
  "dueAt": "2026-02-01T23:59:59",
  "submission": null  # 또는 기존 제출 정보
}
```

**4. POST /api/homework/assignments/{id}/submit** (학생 제출)
```python
Request: multipart/form-data
- studentId: string
- answerText: string
- images[]: File[] (최대 3개, 각 5MB)

Response:
{ "submissionId": "uuid", "success": true }
```

### 3.3 이메일 전송

```python
# backend/app/email_service.py
- smtplib + email.message.EmailMessage 사용
- FastAPI BackgroundTasks로 비동기 전송
- 메일 실패해도 제출은 성공 처리 + 서버 로그 기록
- 첨부파일 포함 (저장된 이미지 파일)
```

### 3.4 환경변수

```env
# backend/.env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=your-email@gmail.com
ADMIN_EMAIL=admin-receive@example.com
```

---

## 4. 프론트엔드 설계 (React/Vite)

### 4.1 새 페이지

| 파일 | 경로 | 설명 |
|------|------|------|
| `pages/AuthorHomeworkPage.tsx` | `/author/homework` | Admin 숙제 출제 |
| `pages/MyPage.tsx` | `/mypage` | 학생 숙제 목록 |
| `pages/HomeworkSubmitPage.tsx` | `/mypage/homework/:id` | 숙제 제출 |

### 4.2 새 컴포넌트

| 파일 | 설명 |
|------|------|
| `components/StudentSelect.tsx` | 학생 다중 선택 |
| `components/AssignmentCard.tsx` | 숙제 카드 (상태 표시) |
| `components/ImageUploader.tsx` | 사진 업로드 (미리보기 + 삭제) |

### 4.3 새 라이브러리

| 파일 | 설명 |
|------|------|
| `lib/homework/api.ts` | 백엔드 API 호출 함수 |
| `lib/homework/types.ts` | 타입 정의 |

### 4.4 라우트 추가

```typescript
// routes.ts
export const ROUTES = {
  // 기존...
  authorHomework: '/author/homework',
  mypage: '/mypage',
  homeworkSubmit: '/mypage/homework/:id'
}

// App.tsx
<Route path="/author/homework" element={<RequireAuthor><AuthorHomeworkPage /></RequireAuthor>} />
<Route path="/mypage" element={<RequireAuth><MyPage /></RequireAuth>} />
<Route path="/mypage/homework/:id" element={<RequireAuth><HomeworkSubmitPage /></RequireAuth>} />
```

---

## 5. 파일별 상세 구현 계획

### 5.1 백엔드 파일

**1. `backend/app/models.py` (수정)**
```python
# 추가할 Pydantic 모델
class HomeworkAssignmentCreate(BaseModel):
    title: str
    prompt: str
    dueAt: Optional[str] = None
    targetStudentIds: List[str]

class HomeworkSubmission(BaseModel):
    studentId: str
    answerText: str
```

**2. `backend/app/db.py` (수정)**
```python
# 추가할 함수
def init_homework_tables(): ...
def create_assignment(data): ...
def list_assignments_for_student(student_id): ...
def get_assignment(assignment_id): ...
def create_submission(assignment_id, student_id, answer_text): ...
def save_submission_file(submission_id, file_data): ...
def check_submission_exists(assignment_id, student_id): ...
```

**3. `backend/app/email_service.py` (신규)**
```python
def send_homework_notification(
    admin_email: str,
    student_name: str,
    assignment_title: str,
    answer_text: str,
    file_paths: List[str]
): ...
```

**4. `backend/app/api.py` (수정)**
```python
# 추가할 엔드포인트
@router.post("/homework/assignments")
@router.get("/homework/assignments")
@router.get("/homework/assignments/{id}")
@router.post("/homework/assignments/{id}/submit")
```

### 5.2 프론트엔드 파일

**1. `lib/homework/types.ts` (신규)**
```typescript
export type HomeworkAssignment = {
  id: string
  title: string
  prompt: string
  dueAt?: string
  createdAt: string
  submitted: boolean
}

export type HomeworkSubmission = {
  answerText: string
  images: File[]
}
```

**2. `lib/homework/api.ts` (신규)**
```typescript
export async function createAssignment(data): Promise<...>
export async function listAssignments(studentId): Promise<...>
export async function getAssignment(id, studentId): Promise<...>
export async function submitHomework(id, data): Promise<...>
```

**3. `pages/AuthorHomeworkPage.tsx` (신규)**
```typescript
// 기능: 학생 선택 + 제목/문제 입력 + 마감일 + 출제 버튼
// 학생 목록: AuthProvider의 user DB에서 조회
```

**4. `pages/MyPage.tsx` (신규)**
```typescript
// 기능: 내 숙제 목록 (AssignmentCard 반복)
// 상태 표시: 미제출(노란색), 제출완료(초록색), 마감임박(빨간색)
```

**5. `pages/HomeworkSubmitPage.tsx` (신규)**
```typescript
// 기능: 문제 표시 + 답안 입력 + 사진 업로드 + 제출
// 제출 시: FormData로 multipart 전송
```

**6. `components/ImageUploader.tsx` (신규)**
```typescript
// 기능: 파일 선택 + 미리보기 + 삭제 + 용량/개수 검증
// Props: maxFiles=3, maxSizeBytes=5MB, onChange
```

---

## 6. 구현 순서

### Phase 1: 백엔드 기반 (1일)
1. `db.py` - 테이블 생성 함수 추가
2. `db.py` - CRUD 함수 구현
3. `models.py` - Pydantic 모델 추가
4. `api.py` - 4개 엔드포인트 구현 (이메일 제외)
5. 테스트: curl로 API 동작 확인

### Phase 2: 백엔드 이메일 (0.5일)
6. `email_service.py` - Gmail SMTP 구현
7. `api.py` - 제출 시 BackgroundTasks로 이메일 연동
8. 테스트: 실제 이메일 수신 확인

### Phase 3: 프론트엔드 기반 (0.5일)
9. `lib/homework/types.ts` - 타입 정의
10. `lib/homework/api.ts` - API 호출 함수
11. `routes.ts` + `App.tsx` - 라우트 추가

### Phase 4: Admin 페이지 (1일)
12. `pages/AuthorHomeworkPage.tsx` - 숙제 출제
13. `components/StudentSelect.tsx` - 학생 선택
14. `AuthorLayout.tsx` - 네비게이션 링크 추가
15. 테스트: 숙제 출제 동작 확인

### Phase 5: 학생 페이지 (1일)
16. `pages/MyPage.tsx` - 숙제 목록
17. `components/AssignmentCard.tsx` - 숙제 카드
18. `pages/HomeworkSubmitPage.tsx` - 숙제 제출
19. `components/ImageUploader.tsx` - 사진 업로드
20. `AppLayout.tsx` - 마이페이지 링크 추가

### Phase 6: 통합 테스트 (0.5일)
21. E2E 테스트: 출제 → 목록 확인 → 제출 → 이메일 확인
22. 버그 수정

**총 예상: 4-5일**

---

## 7. 검증 방법

### 7.1 백엔드 테스트
```bash
# 숙제 생성
curl -X POST http://localhost:8000/api/homework/assignments \
  -H "Content-Type: application/json" \
  -d '{"title":"테스트","prompt":"문제입니다","targetStudentIds":["student1"]}'

# 숙제 목록
curl "http://localhost:8000/api/homework/assignments?studentId=student1"

# 숙제 제출
curl -X POST http://localhost:8000/api/homework/assignments/{id}/submit \
  -F "studentId=student1" \
  -F "answerText=답안입니다" \
  -F "images=@photo.jpg"
```

### 7.2 E2E 테스트
1. admin/admin 로그인 → 관리자 모드 → /author/homework
2. 학생 선택 + 문제 입력 → 출제
3. 학생 계정 로그인 → /mypage → 숙제 확인
4. 숙제 클릭 → 답안 입력 + 사진 첨부 → 제출
5. Admin 이메일 수신 확인 (답안 + 사진 첨부)

---

## 8. 필요한 의존성

### 백엔드
```
python-multipart  # 파일 업로드
```

### 프론트엔드
```
없음 (기존 의존성으로 충분)
```

---

## 9. 환경 설정 체크리스트

- [ ] Gmail 앱 비밀번호 생성: https://myaccount.google.com/apppasswords
- [ ] backend/.env 파일 생성
- [ ] CORS 설정 확인 (backend/app/main.py)
- [ ] 업로드 폴더 생성: backend/data/uploads/
