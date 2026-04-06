# Skill-Graph v1 — Rules (Semantics) + Validation Matrix

이 문서는 `skill-graph-v1`의 **의미론(정책)** 과 **검증 규칙(error/warning 매트릭스)** 를 SSoT로 고정한다.

SSoT(관련 문서):
- 형식(Format): `curriculum-viewer/docs/skill-graph-schema.v1.md`
- 결정 로그(모호점 최소화): `tasks/20260115_mvp_author_mode_v1/docs/skill-graph-schema-decision-log.v1.md`
- Fixture pack(문서/토론용): `curriculum-viewer/docs/skill-graph-fixtures.v1.json`

---

## 1) edgeType 의미/사용 제한 (AC)

> 잠금 해제(unlock)는 `requires`만 사용한다.

### 1.1 `requires` (잠금/해제)

- 의미: `A -(requires)-> B` 는 “B를 진행 가능하게 만들기 위한 필수 선행이 A”임을 의미한다.
- 사용 제한(결정):
  - **unlock에 사용되는 유일한 edgeType** 이다.
  - `requires`는 **사이클이 있으면 치명 오류(error)** 로 차단한다.
  - `source === target` (self-loop)는 금지(error).

### 1.2 `prepares_for` (추천/확장)

- 의미: 학습 흐름/추천(“다음에 하면 좋은 것”) 연결이다.
- 사용 제한(결정):
  - 잠금/해제(필수 선행)에는 사용하지 않는다.
  - 사이클은 허용 가능하나(구조상 가능), 추천 품질을 떨어뜨릴 수 있어 warning으로 취급할 수 있다.

### 1.3 `related` (연관)

- 의미: 연관 개념을 나타내는 탐색/검색 보조 연결이다.
- 사용 제한(결정):
  - unlock에 사용하지 않는다.
  - 추천의 1차 근거로 사용하지 않는다(보조 정보).

### 1.4 `contains` (그룹/구조)

- 의미: 시각적 계층(접기/펼치기) 등 구조적 그룹핑을 위한 연결이다.
- 사용 제한(결정):
  - unlock에 사용하지 않는다.
  - 추천의 1차 근거로 사용하지 않는다.

---

## 2) nodeCategory 정책 (Challenge 포함) (AC)

### 2.1 `core`

- 의미: 코스의 “핵심 학습 단위”.
- 정책(결정): 코스 완료/진도 집계의 기본 단위로 취급한다.

### 2.2 `formal`

- 의미: 형식화/정의/개념 정리 등 “참고/정리 단위”.
- 정책(결정): unlock에 포함될 수 있으나, v1에서는 core 중심으로 운영하는 것을 권장한다.

### 2.3 `challenge` (좌절/정체 방지) (AC)

- 의미: 확장/흥미를 위한 도전 과제.
- 정책(결정):
  - **필수 통과 조건이 아니다**(진도/코스 완료에서 제외).
  - challenge가 core/formal을 “잠그는 게이트”가 되지 않도록 제한한다.
    - `requires`에서 `source`가 challenge인 경우, `target`도 challenge여야 한다. (위반 시 error)

---

## 3) Validation 규칙 매트릭스(v1) — 조건 → error/warn → 메시지 코드 (AC)

Import/저장/Publish에서 사용할 규칙을 아래처럼 고정한다. (최소 12개)

| 메시지 코드 | severity | 조건(요약) | 사용자 메시지(요약) | ruleId(내부) |
|---|---|---|---|---|
| `SG_SCHEMA_INVALID` | error | 스키마(형식) 자체가 깨짐 | 그래프 형식이 올바르지 않습니다. | `schema_invalid` |
| `SG_DUPLICATE_NODE_ID` | error | node.id 중복 | 중복된 노드 ID가 있습니다. | `duplicate_node_id` |
| `SG_INVALID_NODE_ID` | error | ID 규칙 위반(공백/허용 문자) | 노드 ID 형식이 올바르지 않습니다(공백/허용 문자 확인). | `invalid_node_id` |
| `SG_INVALID_ENUM` | error | `edgeType/nodeCategory` 허용값 위반 | 허용되지 않는 값이 있습니다(edgeType/nodeCategory). | `invalid_enum` |
| `SG_MISSING_NODE_REF` | error | edge가 존재하지 않는 node를 참조 | 엣지가 존재하지 않는 노드를 참조합니다. | `missing_node_ref` |
| `SG_SELF_LOOP` | error | self-edge 금지(`source===target`) | 자기 자신으로 연결된 엣지는 허용되지 않습니다. | `self_loop` |
| `SG_START_INCOMING_REQUIRES` | error | `start:true`에 incoming requires 존재 | start 노드는 선행 requires를 가질 수 없습니다. | `start_incoming_requires` |
| `SG_REQUIRES_CYCLE` | error | requires 사이클 존재 | requires 관계에 순환(cycle)이 있어 배포할 수 없습니다. | `requires_cycle` |
| `SG_CHALLENGE_CANNOT_GATE` | error | challenge → (core/formal) requires 금지 | 도전(challenge) 노드는 핵심/형식 노드를 잠글 수 없습니다. | `challenge_cannot_gate` |
| `SG_CONTAINS_CYCLE` | error | contains 사이클 존재 | contains 구조에 순환(cycle)이 있습니다. | `contains_cycle` |
| `SG_CONTAINS_MULTI_PARENT` | warning | contains target이 복수 parent를 가짐 | 하나의 노드가 여러 contains 부모를 가집니다. | `contains_multi_parent` |
| `SG_PREPARES_CYCLE` | warning | prepares_for 사이클 | 추천 흐름(prepares_for)에 순환이 있습니다. | `prepares_cycle` |
| `SG_DUPLICATE_EDGE` | warning | 동일 `(edgeType, source, target)` 중복 | 동일한 엣지가 중복되어 있습니다. | `duplicate_edge` |
| `SG_NO_START_NODES` | warning | start 노드가 0개 | 시작(start) 노드가 없습니다. 시작 노드를 지정하세요. | `no_start_nodes` |

---

## 4) requires cycle 탐지 — 기대 동작(치명 오류) (AC)

대상:
- `edgeType === "requires"` 엣지로 구성된 방향 그래프

기대 동작(결정):
- requires 그래프에 사이클이 1개라도 있으면 **Import/Publish를 차단(error)** 한다.
- 오류 메시지는 최소한 아래 정보를 포함해야 한다.
  - “requires cycle detected”
  - 사이클에 포함된 node id 목록(가능하면 순서 포함)
  - 대표 edge 1개 이상(가능하면)

권장(구현 힌트):
- DFS(색칠: unvisited/visiting/visited)로 사이클을 탐지하고, back-edge 발견 시 경로를 재구성한다.

---

## 5) Import 처리 원칙 — 스키마 통과 vs 정책 위반 (AC)

Import 파이프라인(결정):
1. **형식 검증**(`curriculum-viewer/src/lib/skillGraph/schema.ts`)
   - 실패 시: Import 차단 + “형식 오류” 메시지 + 이슈 목록 표시
2. **정책 검증**(본 문서 3절 매트릭스)
   - error 존재: Import 차단(데이터는 저장/덮어쓰기 금지)
   - warning만 존재: Import 허용 + 경고 요약/목록 표시(사용자 확인 후 진행 가능)

---

## 6) curriculum_math_v1.json → skill-graph-v1 변환/매핑 정책 (AC)

목표:
- 기존 트리형 커리큘럼 데이터를 “Author Mode 그래프 편집”의 초기 시드로 사용할 때, 최소한의 변환 규칙을 제공한다.

입력:
- `curriculum-viewer/public/data/curriculum_math_v1.json`

출력(결정):
- `schemaVersion`: `"skill-graph-v1"`
- `graphId/title`: 입력의 `meta.curriculum_id`/`meta.note` 등이 있으면 활용하고, 없으면 고정값(예: `"CURRICULUM_MATH_V1"`, `"Curriculum Math v1"`)을 사용한다.
- nodes/edges는 아래 규칙으로 생성한다.

### 6.1 nodes 생성(결정)

- 각 `curriculum_math_v1.nodes[*]`를 `SkillNode`로 1:1 변환한다.
  - `id`: 원본 `node.id`
  - `label`: 원본 `node.title`
  - `nodeCategory` 기본값(결정):
    - `type==="standard"` → `"core"`
    - 그 외(`subject|grade|domain`) → `"formal"`
- `start` 기본값(결정):
  - 원칙적으로 변환 단계에서는 `start`를 강제하지 않는다(기본 `false`).
  - 단, “바로 실행 가능한 시드”가 필요하면 옵션으로 아래 중 하나를 선택한다.
    1) 전체에서 `grade` 최소값을 가진 `standard(core)` 들을 `start:true`로 설정
    2) Author가 직접 start를 지정(권장)

### 6.2 contains edges 생성(결정)

- 트리 구조를 유지하기 위해, 원본의 `parent_id` 관계로 `contains` edge를 생성한다.
  - `edgeType: "contains"`
  - `source: parent_id`
  - `target: node.id`
- 이 변환은 “그룹/탐색” 목적이며, unlock/추천에는 사용하지 않는다.

### 6.3 requires/prepares_for 생성(결정)

- v1 변환에서는 requires/prepares_for를 **자동 생성하지 않는다**.
- 이유: requires는 “진도 정책을 결정”해버리므로, 자동 생성은 의도치 않은 잠금/게이팅을 만들 위험이 크다.
- v2에서 필요해지면:
  - domain_code/grade 기반 progression을 `prepares_for`로만 생성(권장)하거나,
  - Author가 직접 requires를 설정하도록 한다.

---

## 7) 최소 결정 로그(구현/테스트 기준) (AC)

아래 항목은 v1에서 논쟁 가능 지점을 “결론 + 이유”로 최소 고정한다(상세 근거는 결정 로그 문서 참조).

1. `contains`는 그룹/구조 용도이며 필수 아님(잠금/추천에 사용 금지) — 구현 복잡도/이행 비용 최소화.
2. `related`는 방향 의미 없는 연관 링크이며, 저장 시 사전순 정규화를 권장 — 중복/양방향 혼선 감소.
3. `start` 기본값은 `false`이며, `start:true`에 incoming requires는 error — “시작 가능 vs 선행 필요” 모순 제거.
4. `order`는 optional이며, 기본값을 강제하지 않음 — 콘텐츠 확정 전 임의 순서가 “정답”처럼 보이는 문제 방지.
5. `nodeCategory`는 필수(기본값 없음) — 정책(필수 여부/게이팅)과 직결되므로 누락을 허용하지 않음.
6. ID 규칙은 초기부터 엄격(공백 금지 + 제한된 문자) — URL/키/edge 생성 안정성 확보.

상세 결정 로그:
- `tasks/20260115_mvp_author_mode_v1/docs/skill-graph-schema-decision-log.v1.md`
