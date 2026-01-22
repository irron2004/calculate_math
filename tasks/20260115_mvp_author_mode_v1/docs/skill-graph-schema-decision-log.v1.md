# Skill-Graph v1 — 스키마 결정 로그(모호점 최소화)

이 문서는 `skill_graph_v1` 스키마/포맷에서 남는 모호점을 “결론 + 이유 + v2 이관 여부”로 최소 기록한다.
구현(validator/import/export)은 FE-0에서 먼저 고정하며, 본 문서는 합의/회귀 방지를 위한 근거 기록이다.

참고 SSoT:
- 형식(Format): `curriculum-viewer/docs/skill-graph-schema.v1.md`
- 정책/의미론: `curriculum-viewer/docs/skill-graph-rules.md`

---

## 결정 항목 (5개+)

### 1) `contains`의 의미/필수 여부

- v1 결론: `contains`는 “그룹/구조(접기/펼치기)” 용도로만 두며, **필수는 아니다**.
- 이유: v1에서 가장 먼저 필요한 것은 requires(진도)와 prepares_for(추천)이며, 계층 구조는 UI/콘텐츠에 따라 변동이 커서 강제하면 이행 비용이 크다.
- v2: UI에서 그룹 편집/컴파운드 노드가 필요해질 때 확장(예: 다중 루트/폴더 노드/컴파운드).

### 2) `related`의 방향성/정규화

- v1 결론: `related`는 방향 의미가 없는 “연관 링크”로 취급하며, 저장 시 `(sourceId,targetId)`를 사전순으로 정규화하는 것을 **권장**(필수는 아님).
- 이유: 동일 관계를 양방향으로 중복 저장하는 실수를 줄이고, 탐색/검색 보조로만 쓰는 목적에 맞춘다.
- v2: “양방향/가중치/근거” 같은 모델이 필요하면 `related_v2` 또는 메타 확장으로 분리.

### 3) `start` 기본값 및 모순 처리

- v1 결론: `start` 기본값은 `false`로 간주하며, `start:true` 노드에 incoming `requires`가 있으면 **오류로 차단**한다.
- 이유: “시작 가능”과 “선행 필요”가 동시에 성립하면 UI/진도 로직이 모호해져 구현이 흔들린다.
- v2: 복수 start/진입점 추천 알고리즘을 추가하더라도, start와 requires의 모순은 금지 유지가 안전하다.

### 4) `order` 기본값/의미

- v1 결론: `order`는 **선택 필드**이며, 없으면 “정렬 힌트 없음”으로 처리한다(기본값 0 같은 강제값을 두지 않음).
- 이유: 콘텐츠가 확정되지 않은 상태에서 기본값을 강제하면 임의의 순서가 “정답”처럼 보일 수 있어 오해를 만든다.
- v2: 레이아웃/추천이 고도화되면 `order` 외에 `difficulty`, `estimatedMinutes` 등 별도 신호를 추가.

### 5) `nodeCategory` 기본값

- v1 결론: `nodeCategory`는 **필수**이며 기본값을 두지 않는다(누락 시 import/검증 실패).
- 이유: core/challenge/formal은 정책(필수 여부/게이팅)과 직결되므로, 기본값을 두면 의도치 않은 분류가 발생한다.
- v2: 필요 시 `unknown` 카테고리를 추가하되, `schemaVersion`을 올려 명시적으로 확장한다.

### 6) Top-level `graphId/title` vs `meta.graphId/title` 호환

- v1 결론: 형식 문서에서는 `graphId/title`를 top-level로 표준화하되, 기존/타 문서와의 호환을 위해 `meta.graphId/meta.title`도 허용한다.
- 이유: 데이터 소스/작성 도구가 여러 형태로 발전할 수 있으므로, v1에서 불필요한 마이그레이션 부담을 줄인다.
- v2: exporter는 단일 형태로 정규화(예: top-level만 출력)하도록 고정할지 검토.

### 7) ID 규칙(허용 문자/길이) 엄격도

- v1 결론: `node.id`는 공백 금지 + 제한된 문자 셋 정규식(형식 문서 참고)으로 제한하고, 중복은 error로 차단한다.
- 이유: ID는 URL/키/localStorage/edge id 생성에 모두 쓰이므로, 초기부터 안전한 문자 범위를 강제하는 편이 운영 비용이 낮다.
- v2: 국제화/레거시 코드 수용이 필요하면 “import 시만 느슨하게 받고 내부에서 slug로 변환” 같은 전략을 검토.

---

## 기존 트리형 데이터와의 호환/변환 결론 (AC)

- v1 결론: `curriculum_math_v1.json`(subject/grade/domain/standard 트리)에서 `skill_graph_v1`로의 **자동 변환은 v1 범위에서 제공하지 않는다**.
- 이유: 트리 노드 타입/필드와 skill-graph의 `nodeCategory/start/edgeType`는 의미적으로 1:1 매핑이 아니며(특히 `nodeCategory`), 변환 결과가 “정책을 암묵적으로 결정”해버릴 위험이 크다.
- v2: 필요해지면 별도 “변환 스크립트/Import 모드”로 제공한다(예: 트리 `parent_id/children_ids`를 `contains`로만 변환하고, requires/prepares_for는 Author가 편집).

