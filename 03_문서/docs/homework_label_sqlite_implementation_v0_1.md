# 숙제 label 구조 필드형 SQLite 구현 권장안 v0.1

## 0. 목적

`homework_label_structured_schema_v0_1.md`를 실제 backend SQLite에 반영하기 위한
**구현 권장안 1안**을 정리한다.

이 문서는 아래 5가지를 바로 결정할 수 있게 하는 것이 목적이다.

1. 권장 구조 1안
2. `unit_id` / `unit_slug` 처리 방식
3. `mapping_status` 이력 처리 방식
4. migration 순서
5. rollback 포인트

---

## 1. 현재 backend 기준 전제

현재 backend의 label 관련 핵심 테이블은 아래 두 개다.

- `homework_labels`
  - `id`
  - `key`
  - `label`
  - `kind`
  - `created_by`
  - `created_at`
  - `archived_at`
- `homework_problem_labels`
  - `problem_id`
  - `label_id`
  - `created_at`

즉, 현재 구조는 **label registry + problem-label 연결**에는 충분하지만,
아래 요구를 직접 담기에는 부족하다.

- 구조 필드 기반 조회
- `unit_id` 기준 canonical 식별
- `mapping_status` 현재값 + 상태 전이 이력
- 운영 리드타임 / Research 병목 분석
- split / merged / deprecated 추적

---

## 2. 권장 구조 1안

### 2.1 결론

**`homework_labels`는 registry로 유지하고, 구조화/매핑 정보는 별도 테이블로 분리한다.**

권장 테이블 구성은 아래와 같다.

- 유지
  - `homework_labels`
  - `homework_problem_labels`
- 신규
  - `homework_label_structures`
  - `homework_label_mapping_events`

필요 시 향후 추가 가능:
- `curriculum_units` 또는 `research_units` 같은 canonical unit master

### 2.2 이유

이 구조를 권장하는 이유는 아래와 같다.

1. **서비스 안정성**
   - 기존 `label_id` 연결을 깨지 않는다.
   - 기존 API/스크립트의 `key`, `label` 조회를 즉시 바꾸지 않아도 된다.

2. **비파괴 매핑**
   - 서비스 원본 registry를 유지하면서 구조 필드를 점진적으로 붙일 수 있다.
   - Research canonical이 바뀌어도 원본 레코드를 직접 덮어쓰지 않아도 된다.

3. **분석 확장성**
   - 현재값 테이블과 이벤트 이력 테이블을 분리하면
     운영 리드타임, 상태 전이, split / merged 분석이 가능하다.

4. **rollback 용이성**
   - 읽기 경로만 구버전으로 돌려도 서비스 복구가 가능하다.
   - 신규 테이블을 남겨둔 채 기능만 비활성화하는 완화 rollback이 가능하다.

---

## 3. 테이블 권장안

## 3.1 `homework_labels` 유지 원칙

`homework_labels`는 아래 역할로 유지한다.

- 서비스 원본 label registry
- 기존 `homework_problem_labels.label_id` 참조 대상
- 기존 `key`, `label`, `kind` 조회 호환 대상

즉, 이 테이블은 **없애지 않고**, 구조화 테이블이 1:1 또는 0:1로 붙는 형태를 권장한다.

---

## 3.2 `homework_label_structures`

### 역할
- 구조 필드형 metadata 저장
- 현재 canonical 매핑 상태 저장
- 운영/분석/Research 공통 조회 기준 제공

### 권장 DDL

```sql
CREATE TABLE IF NOT EXISTS homework_label_structures (
    label_id TEXT PRIMARY KEY,
    label_slug TEXT NOT NULL,
    school_level TEXT,
    grade INTEGER,
    unit_id TEXT,
    unit_slug TEXT,
    concept_slug TEXT,
    difficulty TEXT,
    set_no INTEGER,
    assignment_name TEXT,
    label_display_name TEXT,
    raw_label_text TEXT,
    source_key TEXT,
    source_label TEXT,
    mapping_status TEXT NOT NULL DEFAULT 'unmapped',
    mapping_status_changed_at TEXT,
    mapped_at TEXT,
    effective_from TEXT,
    effective_to TEXT,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    archived_at TEXT,
    FOREIGN KEY (label_id) REFERENCES homework_labels(id) ON DELETE CASCADE,
    CHECK (school_level IN ('elem', 'mid', 'high') OR school_level IS NULL),
    CHECK (difficulty IN ('low', 'mid', 'high') OR difficulty IS NULL),
    CHECK (
        mapping_status IN (
            'unmapped',
            'proposed',
            'mapped',
            'split',
            'merged',
            'deprecated'
        )
    )
);
```

### 컬럼 해석

- `label_id`
  - `homework_labels.id`와 1:1 대응
- `label_slug`
  - 구조 필드 기반으로 생성되는 대표 canonical slug
- `school_level`, `grade`, `unit_id`, `unit_slug`, `concept_slug`, `difficulty`, `set_no`
  - 운영/분석 기준 필드
- `mapping_status`
  - 현재 상태
- `mapping_status_changed_at`
  - 현재 상태로 마지막 전이 시각
- `mapped_at`
  - `mapped` 상태에 도달한 시각
- `raw_label_text`
  - 자유입력/legacy 값 보존
- `source_key`, `source_label`
  - migration / 외부 유입 역추적용
- `effective_from`, `effective_to`
  - 향후 canonical 유효기간 관리 여지

---

## 3.3 `homework_label_mapping_events`

### 역할
- `mapping_status` 전이 이력 기록
- split / merged / reverted / deprecated 근거 보존
- 운영 리드타임 / 전이 분석 지원

### 권장 DDL

```sql
CREATE TABLE IF NOT EXISTS homework_label_mapping_events (
    id TEXT PRIMARY KEY,
    label_id TEXT NOT NULL,
    from_status TEXT,
    to_status TEXT NOT NULL,
    event_type TEXT NOT NULL,
    unit_id_before TEXT,
    unit_id_after TEXT,
    unit_slug_before TEXT,
    unit_slug_after TEXT,
    actor_type TEXT,
    actor_id TEXT,
    note TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (label_id) REFERENCES homework_labels(id) ON DELETE CASCADE,
    CHECK (to_status IN ('unmapped', 'proposed', 'mapped', 'split', 'merged', 'deprecated')),
    CHECK (from_status IN ('unmapped', 'proposed', 'mapped', 'split', 'merged', 'deprecated') OR from_status IS NULL),
    CHECK (event_type IN ('created', 'status_changed', 'mapped', 'split', 'merged', 'deprecated', 'reverted', 'backfilled'))
);
```

### event_type 권장 해석

- `created`
  - 구조 레코드 최초 생성
- `backfilled`
  - migration으로 과거 데이터 적재
- `status_changed`
  - 일반 상태 전이
- `mapped`
  - canonical 매핑 완료
- `split`
  - 하나의 서비스 label이 여러 canonical 방향으로 해석된 경우
- `merged`
  - 다수 legacy label이 하나의 canonical 단위로 수렴한 경우
- `deprecated`
  - 더 이상 canonical 주 경로로 사용하지 않는 경우
- `reverted`
  - rollback 또는 운영 판단에 따른 상태 복구

---

## 4. 인덱스 권장안

구현 우선순위 기준으로 아래 인덱스를 권장한다.

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_homework_label_structures_label_slug
    ON homework_label_structures(label_slug, concept_slug, difficulty, set_no);

CREATE INDEX IF NOT EXISTS idx_homework_label_structures_unit_id
    ON homework_label_structures(unit_id);

CREATE INDEX IF NOT EXISTS idx_homework_label_structures_unit_slug
    ON homework_label_structures(unit_slug);

CREATE INDEX IF NOT EXISTS idx_homework_label_structures_mapping_status
    ON homework_label_structures(mapping_status);

CREATE INDEX IF NOT EXISTS idx_homework_label_structures_status_changed_at
    ON homework_label_structures(mapping_status_changed_at);

CREATE INDEX IF NOT EXISTS idx_homework_label_structures_mapped_at
    ON homework_label_structures(mapped_at);

CREATE INDEX IF NOT EXISTS idx_homework_label_structures_school_grade_unit
    ON homework_label_structures(school_level, grade, unit_id);

CREATE INDEX IF NOT EXISTS idx_homework_label_mapping_events_label_created
    ON homework_label_mapping_events(label_id, created_at);

CREATE INDEX IF NOT EXISTS idx_homework_label_mapping_events_to_status_created
    ON homework_label_mapping_events(to_status, created_at);

CREATE INDEX IF NOT EXISTS idx_homework_label_mapping_events_event_type_created
    ON homework_label_mapping_events(event_type, created_at);
```

### 인덱스 메모

- SQLite에서는 NULL이 포함된 복합 unique 동작을 주의해야 한다.
- 따라서 실제 중복 방지 제약은 초기에 과도하게 강제하기보다,
  **조회 인덱스 + 운영 검증 로직**으로 먼저 시작하는 것이 안전하다.
- `label_slug, concept_slug, difficulty, set_no` unique는
  null 처리 정책이 정해진 뒤 강화하는 것을 권장한다.

---

## 5. `unit_id` / `unit_slug` 처리 방식

## 5.1 결론

- **시스템 식별 기준은 `unit_id` 우선**
- `unit_slug`는 **가독성/조회/호환용 보조 필드**로 병행

## 5.2 이유

### `unit_id`를 기준으로 둬야 하는 이유
- canonical unit rename에 덜 취약하다.
- split / merged / deprecated 이력 관리가 쉽다.
- 장기적으로 graph node 또는 unit master와 연결하기 쉽다.

### `unit_slug`를 함께 둬야 하는 이유
- 운영자가 읽기 쉽다.
- ad-hoc SQL, 리포트, 디버깅이 편하다.
- 초기 canonical master 미완성 상태에서도 임시 운용이 가능하다.

## 5.3 실제 적용 원칙

1. 구조 테이블에 `unit_id`, `unit_slug` 둘 다 저장한다.
2. backend 내부 join/식별/관계 기준은 `unit_id`를 우선한다.
3. canonical master가 아직 약하면 초기 backfill에서는 `unit_slug`만 채워도 된다.
4. 다만 nullable로 시작하더라도 중장기 목표는 `unit_id` 채움이다.

한 줄로 정리하면:

> **초기 호환은 `unit_slug`, 장기 안정성은 `unit_id`다. 구현 기준은 `unit_id` 우선으로 잡는다.**

---

## 6. `mapping_status` 이력 처리 방식

## 6.1 결론

**현재값 컬럼 + 이벤트 이력 테이블 병행**을 권장한다.

즉,
- `homework_label_structures.mapping_status`
- `homework_label_structures.mapping_status_changed_at`
- `homework_label_structures.mapped_at`
- `homework_label_mapping_events`

를 함께 둔다.

## 6.2 왜 컬럼만으로는 부족한가

컬럼만 두면 아래는 가능하다.
- 현재 unmapped 수
- 현재 mapped 수
- 현재 split 상태 수

하지만 아래는 제한된다.
- `unmapped → proposed → mapped` 전이 리드타임
- 특정 기간 split/merged 빈도
- canonical 개편 전후 비교
- rollback 근거 확인

따라서 **운영은 현재값 컬럼**, **분석/추적은 이벤트 테이블**로 나누는 것이 가장 실용적이다.

---

## 7. migration 순서

## 7.1 Step 0. 원칙

- 기존 `homework_labels`, `homework_problem_labels`는 유지한다.
- 초기에 기존 쓰기 경로를 깨지 않는다.
- 신규 구조는 null 허용 + backfill 후 점진 승격으로 간다.

## 7.2 Step 1. 신규 테이블 생성

생성 대상:
- `homework_label_structures`
- `homework_label_mapping_events`

이 단계에서는 서비스 읽기/쓰기 동작을 바꾸지 않는다.

## 7.3 Step 2. 구조화 대상 label 분류

기존 `homework_labels.key`를 아래처럼 분류한다.

- `hwset-*` → 우선 구조화 대상
- `concept-*` → 구조 보조 축 또는 별도 vocabulary 관리 후보
- `source-*` → source metadata
- `day-*` → 운영 메타 축
- 기타 legacy → `raw_label_text` 기반 임시 적재

## 7.4 Step 3. backfill

`hwset-*` 중심으로 `homework_label_structures`를 채운다.

초기 권장값:
- `mapping_status`
  - 확정 canonical이 있으면 `mapped`
  - 미확정이면 `unmapped` 또는 `proposed`
- `created_at`
  - 가능하면 기존 `homework_labels.created_at` 사용
- `updated_at`
  - backfill 시점
- `source_key`
  - 기존 `homework_labels.key`
- `source_label`
  - 기존 `homework_labels.label`
- `raw_label_text`
  - 필요 시 legacy 원문

그리고 각 row마다 최소 1건의 이벤트를 넣는다.

예:
- `event_type='backfilled'`
- `to_status='mapped'`
- `created_at=<backfill_time>`

## 7.5 Step 4. 읽기 경로 병행

읽기 우선순위:
1. 구조 테이블이 있는 label은 구조 필드 우선 사용
2. 구조 테이블이 없으면 기존 `homework_labels.key`, `label` 사용

즉, API 응답에는 기존 필드를 유지하면서 아래를 추가하는 방식이 안전하다.

- `labelSlug`
- `schoolLevel`
- `grade`
- `unitId`
- `unitSlug`
- `conceptSlug`
- `difficulty`
- `mappingStatus`

## 7.6 Step 5. 신규 생성 경로 전환

운영 UI/API에서 선택형 입력을 받아:
- `homework_labels` registry row 생성
- 동시에 `homework_label_structures` row 생성
- 최초 `mapping_events` row 생성

이 순서로 전환한다.

## 7.7 Step 6. 제약 강화

충분히 안정화되면 아래를 검토한다.

- 일부 컬럼 NOT NULL 승격
- `unit_id` 채움률 기준 검증 강화
- 중복 후보 체크 강화
- admin 전용 리포트 쿼리 구조 필드 우선화

---

## 8. rollback 포인트

## 8.1 1차 rollback: 읽기 경로 복귀

가장 안전한 rollback은 **읽기 경로를 기존 registry 기준으로 되돌리는 것**이다.

- API 응답에서 구조 필드 사용 중단
- 기존 `key`, `label`, `kind` 중심 동작으로 복귀
- 신규 테이블은 남겨두되 미사용 처리

이 방식은 데이터 삭제가 없어 안전하다.

## 8.2 2차 rollback: 신규 쓰기 중단

문제가 생기면:
- 신규 구조 테이블 write를 중단
- `homework_labels` / `homework_problem_labels`만 사용
- 추후 원인 파악 후 backfill 재수행 가능

## 8.3 3차 rollback: 백필 무시

잘못된 backfill이 있었더라도,
원본 registry를 직접 훼손하지 않았다면 아래 대응이 가능하다.

- 잘못 생성된 `homework_label_structures` row 정리
- 잘못 생성된 `mapping_events` row 정리
- 원본 `homework_labels`는 그대로 유지

즉, 이 구조의 핵심 rollback 포인트는 아래다.

> **원본 registry를 손대지 않고, 구조화 데이터만 옆에 붙여서 실패 범위를 국소화한다.**

---

## 9. SQLite 구현 시 주의점

## 9.1 ALTER TABLE 제약

SQLite는 테이블 재작성 비용이 높은 편이므로,
기존 `homework_labels`를 크게 뜯는 방식보다 신규 테이블 추가가 안전하다.

## 9.2 enum 부재

SQLite에는 enum이 없으므로:
- `CHECK` 제약
- backend validation
- admin 입력 제한

을 함께 써야 한다.

## 9.3 timestamp 저장

현재 backend 스타일과 맞춰 `TEXT` ISO timestamp를 유지하는 것이 무난하다.

## 9.4 null 처리

초기 migration에서는 null 허용이 중요하다.
특히 아래는 초기 null 허용을 권장한다.

- `unit_id`
- `concept_slug`
- `difficulty`
- `set_no`
- `mapped_at`

---

## 10. backend 적용 우선순위

### 10.1 1차 반영 범위
- 신규 테이블 생성
- backfill 스크립트 추가
- label list API에 구조 필드 optional 노출

### 10.2 2차 반영 범위
- label 생성 API / admin UI를 선택형 입력으로 변경
- 구조 필드 기반 검색 추가
- `mapping_status` 필터 추가

### 10.3 3차 반영 범위
- 상태 전이 관리 UI
- split / merged 운영 도구
- 리포트 쿼리 구조 필드 우선화

---

## 11. 최종 권장 결론

### 권장 구조
- `homework_labels`는 registry로 유지
- `homework_label_structures`로 구조 필드 분리
- `homework_label_mapping_events`로 상태 전이 이력 분리

### `unit_id` / `unit_slug`
- `unit_id`를 시스템 식별 기준으로 사용
- `unit_slug`는 조회/호환/디버깅용으로 병행

### `mapping_status`
- 현재값 컬럼 + 이벤트 이력 테이블 병행

### migration 순서
1. 신규 테이블 생성
2. 구조화 대상 분류
3. backfill
4. 읽기 병행
5. 신규 쓰기 전환
6. 제약 강화

### rollback 포인트
- 읽기 경로를 기존 registry로 복귀
- 신규 쓰기 중단
- 구조화 데이터만 정리하고 원본 registry는 보존

한 줄 결론:

> **SQLite 기준 가장 안전한 구현안은 `homework_labels` 원본 registry를 유지한 채, 구조 필드와 상태 이력을 별도 테이블로 비파괴적으로 붙이는 방식이다.**
