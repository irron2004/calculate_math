---
workflow: code
graph_profile: curriculum_2022_3r
---

# 2022 Curriculum prereq graph research

기준 데이터: public/data/curriculum_math_2022.json

목표
- textbookUnit 간 선행 지식(prereq) 연결을 최대한 완전하게 구축
- 필요한 선행 개념이 데이터에 없으면 proposed 노드로 제안

제약
- 기본은 기존 노드 간 prereq edge 추가
- 신규 노드는 add_nodes로만 제안하고 proposed=true, reason 포함
- 신규 노드의 nodeType은 기존과 동일하게 `textbookUnit` 사용
- 신규 노드 ID 규칙: `P_TU_<slug>` (ascii 소문자/숫자/underscore)
  - 예: `P_TU_arithmetic_addition`
  - 충돌 시 `_2`, `_3`처럼 숫자 suffix 추가
- contains/alignsTo는 변경하지 않음
