---
name: math-backend-implementation
description: 수학 모험 백엔드(FastAPI + SQLite/Neo4j)를 구현한다. 그래프·문제·숙제·상태 API, 스키마 변경, 마이그레이션, 테스트 작성이 필요할 때 반드시 이 스킬을 쓴다. "백엔드 API", "FastAPI", "라우트 추가", "스키마 변경", "마이그레이션", "pytest" 표현이 나오면 트리거한다.
---

# Math Backend Implementation

연구 산출물을 FastAPI + DB 위에서 동작시키는 절차.

## 언제 쓰는가

- 신규 API 엔드포인트 구현
- 그래프·문제·숙제 데이터 모델 변경
- DB 마이그레이션 스크립트 작성
- 기존 API 버그 수정/리팩토링
- 백엔드 테스트 작성

## 사전 확인: 기존 API 재사용

**CLAUDE.md 규칙:** 학생 숙제 상태·제출 여부·답안 조회는 이미 있는 admin API를 쓴다:
- `GET /api/homework/admin/students/{student_id}/daily-summary`
- `GET /api/homework/admin/students/{student_id}/assignments/{assignment_id}/submission-status`
- `GET /api/homework/admin/submissions/{submission_id}/answer-check`

**새 ad-hoc 조회 API를 만들기 전에** 위 surface가 부족한지 먼저 증명한다.

## 워크플로우

### 1. 인터페이스 계약 먼저

`_workspace/api_contract_{feature}.md`를 작성해 FE와 shape을 합의한다:

```markdown
## GET /api/graph/nodes/{nodeId}/related

**Request**: path param nodeId (string)
**Response 200**:
\`\`\`json
{
  "nodeId": "na_add_2digit_carry",
  "requires": [{"id": "...", "label": "..."}],
  "preparesFor": [{"id": "...", "label": "..."}]
}
\`\`\`
**Response 404**: 존재하지 않는 노드
```

계약 없이 바로 코딩하면 FE와의 shape 불일치로 돌아간다.

### 2. 테스트부터

`backend/tests/test_{feature}.py`를 먼저 작성:

```python
def test_related_nodes_returns_expected_shape(client, seed_graph):
    r = client.get("/api/graph/nodes/na_add_2digit_carry/related")
    assert r.status_code == 200
    body = r.json()
    assert body["nodeId"] == "na_add_2digit_carry"
    assert isinstance(body["requires"], list)
```

TestClient + `tmp_path` fixture 패턴. 레이트리밋은 `DISABLE_RATE_LIMITS=1`로 자동 비활성화.

### 3. 구현

- 라우트: `backend/app/api.py` — 기존 네이밍 일관성 유지
- DB: `backend/app/db.py` (SQLite) 또는 `backend/app/neo4j_graph.py`
- 그래프 추상화: `backend/app/graph_storage.py` — 백엔드 무관 계층은 여기

### 4. 스키마 변경 시 마이그레이션

SQLite 스키마 변경:
- `db.py`의 초기화 쿼리 수정
- `scripts/migrate_{name}.py` 스크립트 추가 (기존 DB 변환)
- 정본 문서 업데이트: `backend/CURRICULUM_GRAPH_SCHEMA_V2.md`

**절대 하지 않는 것:**
- `DROP TABLE`로 데이터 날리기 (개발 환경이라도 명시 요청 없이는 금지)
- 마이그레이션 없이 스키마만 변경

### 5. 인증·레이트리밋 유지

신규 라우트도 기존 패턴 유지:
- JWT 필요 시 `Depends(get_current_user)` 사용
- 레이트리밋은 `@limiter.limit(...)` 유지
- 관리자 전용이면 admin 스코프 체크

### 6. 검증

```bash
pytest backend/tests/test_{feature}.py -v
pytest  # 회귀 확인
```

회귀 테스트가 빨간색이면 구현을 되돌리지 말고 **원인을 찾는다**.

### 7. 운영 반영

- Docker: `docker-compose up`으로 로컬 검증
- 마이그레이션 실행 순서를 README나 runbook에 추가

## 의존 스킬

- `math-frontend-implementation` — API 계약(shape) 합의 및 검토
- `diagnostic-taxonomy-design` — taxonomy 변경 시 DB 스키마/enum 영향

## 데이터 취급 원칙

- **PII 보호** — 학생 개인정보(이름, 연락처)는 암호화 저장, 로그에는 ID만
- **접근 제어** — admin API는 관리자 스코프 체크, 민감 데이터는 추가 인증
- **감사 로그** — 학생 데이터 조회/변경 이력은 별도 테이블에 기록
- **최소 보존** — 테스트/개발 환경에서 실제 학생 데이터 사용 금지

## 성능 원칙

- **응답시간 로깅** — 모든 API 호출에 처리 시간 기록, p95/p99 모니터링
- **대용량 쿼리** — 그래프 전체 조회, 학생 전체 리포트 등은 페이지네이션 필수
- **N+1 방지** — SQLAlchemy 관계 조회 시 joinedload/eager loading 사용
- **캐싱 고려** — 빈번한 read API(그래프 메타데이터)는 캐싱 검토

## 원칙

- **기존 admin API 재사용** — ad-hoc 조회 API 남발 금지
- **계약 먼저, 구현 나중** — FE와 shape 합의 없는 코딩 금지
- **테스트 먼저** — TestClient + tmp SQLite fixture
- **마이그레이션 동반** — 스키마 변경은 데이터 변환과 함께
- **기존 패턴 유지** — 인증·레이트리밋·에러 응답 포맷

## 참고
- `/mnt/c/Users/hskim/Desktop/ruahverce/calculate_math/CLAUDE.md` (homework admin lookup 규칙)
- `backend/CURRICULUM_GRAPH_SCHEMA_V2.md`
- `backend/app/` 전체 구조
