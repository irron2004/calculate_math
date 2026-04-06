# Tree Curriculum → Skill-Graph v1 변환/호환 정책 (SSoT)

이 문서는 `curriculum_math_v1.json` 같은 **트리형 데이터(parent/children)** 를 `skill-graph-v1`(nodes+edges)로 변환할 때의 규칙을 정책으로 고정한다.

중요(결정):
- v1에서는 이 변환을 **제품 기능으로 제공하지 않는다**(자동 변환/자동 fallback 없음).
- 본 문서는 향후 v2 또는 개발자용 스크립트/수동 변환에 대비한 규칙 SSoT다.

관련 문서:
- 스키마(형식): `curriculum-viewer/docs/skill-graph-schema.v1.md`
- 의미론/검증(정책): `curriculum-viewer/docs/skill-graph-rules.md`

---

## 1) contains edge 생성 규칙 (AC)

### 1.1 방향(결정)

- `contains`는 **부모 → 자식** 방향으로 생성한다.

### 1.2 생성 소스(결정)

트리형 데이터는 `parent_id` 또는 `children_ids` 중 하나 이상을 가진다고 가정한다.
변환 시에는 **`parent_id`를 1차 진실(SSoT)** 로 사용한다.

규칙:
1. 각 노드 `N`에 대해 `parent_id`가 존재하면,
   - edge 생성: `{ edgeType: "contains", source: N.parent_id, target: N.id }`
2. `parent_id`가 없으면 root로 간주하며 contains edge를 생성하지 않는다.

`children_ids`는 참고용으로만 사용한다(선택):
- `children_ids`가 존재하지만 `child.parent_id !== parent.id`인 경우, 변환 단계에서는 데이터를 “수정”하지 않고 warning(권장)으로만 기록한다.

---

## 2) nodeCategory 기본값/매핑 (AC)

### 2.1 매핑 규칙(결정)

트리형 데이터의 `type`(예: `subject|grade|domain|standard`)을 `nodeCategory`로 매핑한다.

- `standard` → `core`
- `subject|grade|domain` → `formal`

### 2.2 매핑 불가 시 처리(결정)

- `type`이 없거나, 위 목록에 없는 값이면 `nodeCategory: "formal"`로 둔다.
- 단, Author가 이후 분류를 확정해야 하므로 변환 리포트(또는 Import 경고)로 “unknown type mapped to formal”을 표시하는 것을 권장한다.

---

## 3) order/start 기본값 및 파생 규칙 (AC)

### 3.1 `order` (결정)

기본값:
- 입력 노드에 `order:number`가 이미 있으면 그대로 사용한다.
- 없으면 아래 파생 규칙으로 **결정적(deterministic)** `order`를 부여한다.

파생 규칙(결정):
- 각 노드의 `order`는 아래 3개 요소로 구성된 정렬 키를 기반으로 “전체 순번(1..N)”을 부여한다.
  1) `grade`(number)가 있으면 오름차순, 없으면 999
  2) `type` 우선순위: `subject(0) < grade(1) < domain(2) < standard(3)`, 알 수 없으면 9
  3) `id` 사전순
- 위 정렬을 적용해 나열한 순서대로 `order = (index+1) * 10`을 부여한다. (10단위: 추후 중간 삽입 여지)

### 3.2 `start` (결정)

기본값:
- 변환 시 `start`는 기본적으로 **설정하지 않는다**(미지정 = `false`로 간주).

옵션 파생 규칙(권장, “바로 실행 가능한 시드”가 필요할 때만):
- `core` 노드 중에서 `grade`가 최소인 노드들을 `start:true`로 설정한다.
  - tie-breaker: `id` 사전순 상위 K개(기본 K=1 또는 2)만 start로 지정(권장)

비고:
- 변환 단계에서 `requires`를 생성하지 않기 때문에, `start:true` 노드에 incoming requires가 생길 수 없고(0개), `start_incoming_requires` 규칙을 위반하지 않는다.

---

## 4) 변환 결과가 스키마/검증 정책에 걸리는 방식 (AC)

### 4.1 스키마(FE-1: Format) 관점

변환 출력은 `skill-graph-v1`의 형식을 만족해야 한다.

- `schemaVersion`: `"skill-graph-v1"`
- `graphId/title`: 입력 데이터의 `meta`가 있으면 활용하고, 없으면 변환 도구(또는 UI)에서 고정값을 채운다.
- node 필수 필드:
  - `id`: 입력의 `node.id`를 그대로 사용(공백이 없고 `^[A-Za-z0-9._-]+$`를 만족해야 함)
  - `label`: 입력의 `node.title`을 사용(빈 문자열 금지)
  - `nodeCategory`: 2절 매핑 결과
- edge 필수 필드:
  - `edgeType/source/target`을 반드시 채운다(1절)

### 4.2 검증 정책(RESEARCH-1A2A: Semantics/Validation) 관점

변환 단계는 “구조 보존” 목적이므로 `contains`만 생성하고, `requires/prepares_for/related`는 생성하지 않는다.

- 차단(error) 가능:
  - `schema_invalid`(필수 필드 누락, 타입 오류)
  - `duplicate_node_id`(입력 트리 데이터 자체가 중복 ID를 가진 경우)
  - `missing_node_ref`(parent_id가 존재하지 않는 노드를 참조하는 경우)
  - `contains_cycle`(입력 트리의 parent 체인이 사이클인 경우)
- 영향 없음(변환만으로는 발생 불가):
  - `requires_cycle` (requires edge를 생성하지 않으므로)
  - `challenge_cannot_gate` (requires가 없으므로)

---

## 5) 샘플 입력(트리 3~5노드) → 변환 출력 예시 (AC)

### 5.1 입력(트리 4노드)

```json
{
  "meta": { "schema_version": "curriculum_math_v1", "curriculum_id": "KR-MATH-2022" },
  "nodes": [
    { "id": "MATH-2022", "type": "subject", "title": "수학", "children_ids": ["MATH-2022-G-1"] },
    { "id": "MATH-2022-G-1", "type": "grade", "title": "1학년", "parent_id": "MATH-2022", "children_ids": ["MATH-2022-G-1-D-NA"] },
    { "id": "MATH-2022-G-1-D-NA", "type": "domain", "title": "수와 연산", "grade": 1, "parent_id": "MATH-2022-G-1", "children_ids": ["MATH-2022-G-1-NA-001"] },
    { "id": "MATH-2022-G-1-NA-001", "type": "standard", "title": "0~100 수 읽기·쓰기", "grade": 1, "domain_code": "NA", "parent_id": "MATH-2022-G-1-D-NA", "children_ids": [] }
  ]
}
```

### 5.2 출력(skill-graph-v1)

```json
{
  "schemaVersion": "skill-graph-v1",
  "graphId": "KR-MATH-2022",
  "title": "KR-MATH-2022 (converted)",
  "nodes": [
    { "id": "MATH-2022", "label": "수학", "nodeCategory": "formal", "order": 10 },
    { "id": "MATH-2022-G-1", "label": "1학년", "nodeCategory": "formal", "order": 20 },
    { "id": "MATH-2022-G-1-D-NA", "label": "수와 연산", "nodeCategory": "formal", "order": 30 },
    { "id": "MATH-2022-G-1-NA-001", "label": "0~100 수 읽기·쓰기", "nodeCategory": "core", "order": 40 }
  ],
  "edges": [
    { "edgeType": "contains", "source": "MATH-2022", "target": "MATH-2022-G-1" },
    { "edgeType": "contains", "source": "MATH-2022-G-1", "target": "MATH-2022-G-1-D-NA" },
    { "edgeType": "contains", "source": "MATH-2022-G-1-D-NA", "target": "MATH-2022-G-1-NA-001" }
  ]
}
```
