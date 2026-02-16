---
workflow: code
graph_profile: end2end
---

# Curriculum Concept Connections v1

## Goal
- “개념 단위(함수/로그/이차/부등식/수열)”를 커리큘럼 그래프에 **명시적으로 연결(prereq)** 해서 학습 경로를 설계한다.
- 필요한 노드가 커리큘럼 데이터에 없으면 **중등/고등 구간에 최소 노드(gradeBand/domain/textbookUnit)** 를 추가한 뒤 연결한다.

## Scope
- 대상 데이터(SSoT): `public/data/curriculum_math_2022.json`
- 동기화 대상:
  - `curriculum-viewer/public/data/curriculum_math_2022.json`
  - `backend/app/data/curriculum_math_2022.json`
- 변경 유형:
  - `nodeType: gradeBand/domain/textbookUnit` 노드 추가
  - `edgeType: contains` 구조 엣지 추가(신규 노드가 트리에 매달리도록)
  - `edgeType: prereq` 선수 엣지 추가(학습 순서/선행 개념)

## Edge Semantics (중요)
- `contains`는 구조(소속/포함) 관계다. “어디에 속하나(분류)”에 가깝고, 보통 트리(상위→하위)로 사용한다.
  - 예: 교육과정 → 학년군 → 영역 → 단원
- `prereq`는 학습 선후(선수/후속) 관계다. “무엇이 먼저인가(학습 순서)”이며, 구조와 무관하게 가로/타 영역 연결이 가능하다.
  - 목표: prereq는 DAG(비순환) 유지

## Non-Goals
- 기존 `alignsTo`(단원↔성취기준) 편집/증설
- 기존 노드/엣지의 삭제(이번 작업에서는 “추가”만)
- 교과서/교육과정의 “정식 중등/고등 전체 노드” 데이터 구축(최소 시드만 추가)

## Connections (요구사항)

### A) 수열 연결

#### 노드(추가)
- `KR-MATH-2022-M-7-9` (gradeBand) “중등 1~3학년군”
- `KR-MATH-2022-M-7-9-RR` (domain) “변화와 관계”
- `P_TU_ARITH_SEQ` (textbookUnit) “등차수열”
- `P_TU_GEO_SEQ` (textbookUnit) “등비수열”

#### prereq 엣지(추가)
- `prereq:2수01-B->2수02-A`
  - source: `2수01-B` (두 자리 수 범위의 덧셈과 뺄셈)
  - target: `2수02-A` (규칙)
  - note: 덧셈/뺄셈 경험 → 규칙 찾기
- `prereq:2수02-A->P_TU_ARITH_SEQ`
  - source: `2수02-A` (규칙)
  - target: `P_TU_ARITH_SEQ` (등차수열)
  - note: 규칙 찾기 → 등차수열
- `prereq:2수01-C->P_TU_GEO_SEQ`
  - source: `2수01-C` (한 자리 수의 곱셈)
  - target: `P_TU_GEO_SEQ` (등비수열)
  - note: 곱셈 개념 → 등비수열

### B) 로그/이차/부등식/함수 연결

#### 노드(추가)
- `KR-MATH-2022-H-10-12` (gradeBand) “고등 1~3학년군”
- `KR-MATH-2022-H-10-12-RR` (domain) “변화와 관계”
- `P_TU_FUNCTION` (textbookUnit) “함수”
- `P_TU_INEQUALITY` (textbookUnit) “부등식”
- `P_TU_QUADRATIC_EQUATION` (textbookUnit) “이차방정식”
- `P_TU_QUADRATIC_FUNCTION` (textbookUnit) “이차함수”
- `P_TU_QUADRATIC_INEQUALITY` (textbookUnit) “이차부등식”
- `P_TU_LOG_CONCEPT` (textbookUnit) “로그”
- `P_TU_LOG_FUNCTION` (textbookUnit) “로그함수”

#### prereq 엣지(추가)
- `prereq:P_TU_LOG_CONCEPT->P_TU_LOG_FUNCTION` (로그 → 로그함수)
- `prereq:P_TU_FUNCTION->P_TU_LOG_FUNCTION` (함수 → 로그함수)
- `prereq:P_TU_QUADRATIC_EQUATION->P_TU_QUADRATIC_FUNCTION` (이차방정식 → 이차함수)
- `prereq:P_TU_FUNCTION->P_TU_QUADRATIC_FUNCTION` (함수 → 이차함수)
- `prereq:P_TU_INEQUALITY->P_TU_QUADRATIC_INEQUALITY` (부등식 → 이차부등식)
- `prereq:P_TU_QUADRATIC_EQUATION->P_TU_QUADRATIC_INEQUALITY` (이차방정식 → 이차부등식)
- `prereq:P_TU_QUADRATIC_FUNCTION->P_TU_QUADRATIC_INEQUALITY` (이차함수 → 이차부등식)

## Acceptance Criteria
- `public/data/curriculum_math_2022.json`에 위 노드/엣지들이 존재한다.
- 3개 파일이 완전히 동일하다(해시 일치).
- 모든 edge의 `source/target`이 실제 node id를 참조한다.
- `prereq` 그래프에 cycle이 없다.
- `/author/research-graph`에서 신규 노드가 보이고, prereq 엣지가 렌더된다.

## Verification
- 데이터 무결성(중복/참조):
  - nodes/edges id 유일
  - edge source/target 존재
- `prereq` cycle 없음(간단 DFS)
- 동기화 해시 확인:
  - `sha256sum public/data/curriculum_math_2022.json curriculum-viewer/public/data/curriculum_math_2022.json backend/app/data/curriculum_math_2022.json`
