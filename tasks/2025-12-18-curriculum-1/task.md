---
workflow: curriculum
mode: boss
dataset_path: app/data/curriculum_skill.json
boss_id: TS_COMB_PROB
subgraph_depth: 2
---

# Curriculum Skill Tree Densification — Ticket 1

## 목표(Goal)
- `TS_COMB_PROB`(보스: 경우의 수·확률) 라인을 **하위 2~3 depth까지 “촘촘한 스킬트리”로 세분화**한다.
- 결과물은 **스킬 트리 데이터(노드/선수관계)만** 다룬다. (문항/평가/앱 구현은 제외)

## 작업 단위(Definition of Done)
- (필수) micro/step/boss 공통 규격을 1페이지로 확정(Architect).
- (필수) `TS_COMB_PROB` 달성을 위한 step 노드와 micro 노드를 충분히 추가 제안한다.
- (필수) 잠금/해제에 사용되는 requires(선수) 관계를 “점프 없이” 정교화한다.
- (필수) 중복/동의어/ID 충돌을 alias/merge로 정리한다.
- (필수) 그래프 QA(사이클/고아/점프/중복/보스 도달가능성)와 수정 패치를 제시한다.
- (최종) Reviewer는 **시트/JSON에 바로 붙여넣을 수 있는 단일 Patch JSON**으로 통합한다.

## 범위(Scope)
- 다룰 데이터: `app/data/curriculum_skill.json` 기준(노드/엣지) + 이 티켓에서 제안하는 추가/수정.
- 엣지 타입: `requires`만 필수(잠금/해제). (enables/related/analog_of는 이번 티켓에서는 사용하지 않음)
- 레벨(level)은 사람이 입력하지 않고 자동 계산한다. (패치에 tier/level을 강제로 넣지 않는다)

## 비범위(Non-goals)
- FastAPI/React 코드 수정, API 추가, DB 설계/마이그레이션
- 문제 생성/템플릿/채점/LRC/보스전 UX 설계
- 실제 교육과정 성취기준 코드 매핑(표가 없으면 Standards Mapper는 SKIP 가능)

## 참고
- 기존 보스 노드(현재 데이터): `TS_COMB_PROB`
- 권장 확인 스크립트(선택):
  - `python scripts/skill_tree_json_tools.py app/data/curriculum_skill.json --max-level 3 --skip-boss --allow-missing-prereqs --wrap-markdown --write-mermaid docs/skill_tree_curriculum_preview.mmd`
  - `python scripts/recompute_skill_levels.py --in app/data/curriculum_skill.json --out app/data/curriculum_skill.levels.json --allow-missing --drop-tier`

