# Phase 5 — CSAT 노드 분리 제안

**상태:** 사용자 결정 대기 (실행 보류)
**대상:** 100개 CSAT 노드 (`CSAT2025-*`, `CSAT2023-*`)
**영향 범위:** 파일 구조, API, FE 시각화

## 현상

현재 `curriculum_math_2022.json`에 수능 2023·2025 문항 구조가 포함:
- 상위 카테고리 노드 8개 (공통·확률통계·미적분·기하 × 2년도)
- 개별 문항 노드 92개 (각 시험 22~30번)

모두 `textbookUnit`으로 등록, `schoolLevel`/`domainCode`/`description` 공란. 이것이 `curriculum_math_2022.json`의 필드 누락률을 크게 끌어올린 주요 원인.

## 분리가 필요한 이유

1. **관심사 분리** — 커리큘럼 그래프(학습 구조) ≠ 문제 은행(평가 도구). 섞이면 양쪽 모두 가독성 저하.
2. **시각화 오염** — `/map` 라우트(ReactFlow)에 366개 노드 중 100개가 문항이면 학습 지도가 난잡.
3. **필드 규칙 충돌** — 커리큘럼 노드는 `schoolLevel`·`domainCode` 필수, CSAT 문항은 의미 없음. 한 스키마로 억지 통합 중.
4. **버전 관리** — 수능은 매년 추가. 커리큘럼 파일에 매년 파일이 커짐.

## 분리 시 유지해야 할 기능

- 특정 수능 문항이 어느 커리큘럼 단원과 관련 있는가? (`alignsTo` 역할)
- 문항 난이도·오답률 데이터가 단원 상태 분석에 참여할 수 있는가?

## 제안 구조

### 옵션 A (권장): 별도 파일 + 참조 테이블

```
public/data/
├── curriculum_math_2022.json        ← 커리큘럼만 (266 노드, CSAT 제거)
├── problem_bank_csat_2025.json      ← 2025 수능만
├── problem_bank_csat_2023.json      ← 2023 수능만
└── problem_to_node_mappings.json    ← 문항↔커리큘럼 노드 매핑 테이블
```

**`problem_bank_csat_2025.json`:**
```json
{
  "meta": {"examCode": "CSAT-2025", "year": 2025, "sections": ["COMMON", "PS", "CA", "GE"]},
  "problems": [
    {
      "id": "CSAT2025-C-01",
      "section": "COMMON",
      "number": 1,
      "label": "2025 수능 공통 1번",
      "relatedCurriculumNodes": ["P_TU_EXP_LAWS_REVIEW"]
    }
  ]
}
```

**`problem_to_node_mappings.json`:** 과거 `alignsTo` 엣지와 동일 역할, 별도 관리.

### 옵션 B (최소 변경): 플래그 분리

기존 파일 유지하되 CSAT 노드에 `category: "assessment"` 필드 추가, 커리큘럼 노드에는 `category: "curriculum"`. FE는 category 필터로 표시 여부 제어.

**장점:** 파일 분리 비용 없음
**단점:** 파일 크기·시각화 문제 해결 안 됨, 임시방편

## 필요 작업 (옵션 A 기준)

1. **스키마 설계:** problem bank JSON 포맷 정의
2. **파일 분리 스크립트:** `scripts/split_csat_from_curriculum.py`
   - 입력: `curriculum_math_2022.json`
   - 출력: 3개 파일 + 매핑 테이블
3. **백엔드 API:**
   - `GET /api/graph/published` — CSAT 제외 그래프 반환
   - `GET /api/problem-bank/csat/{year}` — 수능 문제은행 조회 (신규)
   - `GET /api/mappings/problem-to-node/{problemId}` — 매핑 조회 (신규)
4. **프론트엔드:** `/map`은 자동으로 CSAT 제외. 수능 문제 탐색은 별도 라우트(`/problem-bank/csat/:year`)
5. **마이그레이션:** DB에 이미 CSAT 노드가 저장되어 있다면 삭제 + 문제은행 테이블 신규 구축

## 리스크

- **기존 문제 태깅 깨짐:** 이미 CSAT 노드 id로 태깅된 문제가 있으면 재매핑 필요
- **관리자 편집 도구 수정:** `/author/*` 라우트가 통합 그래프를 전제로 구현돼 있을 가능성
- **Neo4j 백엔드 전환 계획:** CSAT 노드를 Neo4j에 같이 넣을지 별도 컬렉션으로 갈지 결정 필요 (`backend/CURRICULUM_GRAPH_SCHEMA_V2.md`)

## 사용자 결정 필요

다음 중 하나를 지정해 주세요:

1. **지금 옵션 A로 분리** → BE/FE 팀 작업 필요, Phase 6 이후 별도 태스크로 진행
2. **옵션 B로 임시 처리** → 즉시 가능, 근본 해결 아님
3. **당분간 유지** → CSAT는 그대로 두고, 필드 누락 경고만 validator에서 스킵

**권장:** 1번(옵션 A). 단, 다른 Phase들(1~4, 6)이 먼저 머지된 뒤 별도 브랜치에서 진행. 혼재 시 merge conflict 가능성 높음.
