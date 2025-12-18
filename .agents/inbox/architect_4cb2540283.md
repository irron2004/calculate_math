# Curriculum Architect Request 4cb2540283

너는 “커리큘럼 아키텍트(총괄 편집자)”다.
목표는 **K-12 수학 커리큘럼을 스킬트리(그래프) 형태로 더 촘촘히 만들기 위한 공통 규격(SSOT)**을 확정하는 것이다.

[Task 파일]
/mnt/c/Users/irron/Desktop/my/web_service_new/calculate_math/tasks/2025-12-18-curriculum-1/task.md

[현재 데이터셋(참고)]
- /mnt/c/Users/irron/Desktop/my/web_service_new/calculate_math/app/data/curriculum_skill.json
- 참고 스크립트: `python scripts/recompute_skill_levels.py --in app/data/curriculum_skill.json --out app/data/curriculum_skill.levels.json --drop-tier`

[필수 원칙]
- “촘촘함”의 정의: 노드가 너무 크지 않음 / 선수관계가 진짜 / 점프 최소 / 추적가능 / 레벨 자동 계산.
- 노드 타입은 **micro / step / boss**(개념적 타입)로 고정한다.
  - 이 repo의 JSON에서는 `kind: core|boss`를 유지하되, 필요 시 `node_type: micro|step|boss` 같은 보조 필드를 허용한다.
- 잠금/해제는 **requires**만 사용한다. (enables/related/analog_of는 Phase 2 옵션)
- 레벨(level)은 사람이 입력하지 않고 DAG에서 자동 계산한다:
  - `level(v)=1 if no prereq else max(level(prereq))+1`
  - 구현/검증은 `scripts/recompute_skill_levels.py` 규칙을 따른다.
- micro granularity 규칙(합격 조건):
  - 단일 행동(관찰 가능 동사 1개)
  - 단일 개념(1개)
  - 단일 표현(C/P/A 중 1개)
- ID/용어/동의어 중복을 줄이기 위한 온톨로지(사전) 원칙을 포함한다.

[산출물]
아래 섹션을 가진 “1페이지 스펙”을 **마크다운**으로 작성해라.
1) 노드 타입 정의(목적/필드: 최소 필드와 권장 필드)
2) 엣지 타입 정의(requires는 필수, 그 외는 옵션)
3) micro granularity 합격/불합격 기준 예시 10개(좋은 예/나쁜 예)
4) 네이밍/ID 규칙(예: DOMAIN_ACTION_CONCEPT_REP / 예외 규칙 포함)
5) 마스터리 레벨(0~3) 정의와 해금 기준(min_level) 운영 규칙
6) QA 체크리스트(사이클/고아노드/점프/중복/도메인 누락/보스 도달가능성)
7) “티켓 단위” 권장안: **보스 1개 + 하위 2~3 depth**로 작업하는 프로토콜

출력 규칙:
- 마지막 출력은 반드시 아래 마커 블록을 포함한다.
- 마커 블록 안에는 **마크다운 본문만** 출력한다.

###BEGIN:4cb2540283###
(여기에 마크다운 1페이지 스펙)
###DONE:4cb2540283###
