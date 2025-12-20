# Incremental Skill Tree JSON Workflow

이 문서는 단순한 JSON 스킬트리를 **레벨별로 검증**하고 **Mermaid 다이어그램**으로 시각화하는 방법을 정리합니다. `docs/skill_tree_math_basic.json` 샘플과 `scripts/skill_tree_json_tools.py`를 함께 사용하세요.  
추가로, 이 스크립트는 `nodes` 필드 기반 데이터셋(예: `app/data/curriculum_skill.json`, `docs/skill_tree_k12_l0_l2.json`)이나 간단한 `mermaid` 스니펫도 읽을 수 있습니다.

## JSON 구조
- 필수 필드: `tree_id`, `skills` (배열)
- 스킬 필드: `id`, `name`, `level`, `prerequisites` (배열), `description`(선택)
- 레벨 필터링: `level <= N` 조건으로 원하는 깊이만 꺼낼 수 있습니다.

```json
{
  "tree_id": "math_basic",
  "title": "기초 수학 스킬트리",
  "skills": [
    { "id": "nat_num", "name": "자연수 이해", "level": 1, "prerequisites": [] },
    { "id": "int_num", "name": "정수 이해", "level": 2, "prerequisites": ["nat_num"] },
    { "id": "add_sub", "name": "정수 덧셈/뺄셈", "level": 3, "prerequisites": ["int_num"] }
  ]
}
```

## 검증 규칙
1) `id` 중복 금지  
2) `prerequisites`는 모두 실제 존재해야 함  
3) 선행 스킬의 `level`은 항상 더 낮아야 함  
4) 순환 금지 (위상 정렬 가능해야 함)

## 사용 예시
```bash
# 레벨 2까지만 검증 + Mermaid 출력
python scripts/skill_tree_json_tools.py docs/skill_tree_math_basic.json --max-level 2

# Markdown 코드펜스로 감싸서 파일로 저장
python scripts/skill_tree_json_tools.py docs/skill_tree_math_basic.json \
  --max-level 3 --wrap-markdown --write-mermaid docs/skill_tree_math_basic.mmd

# nodes 기반 풀 그래프에서 보스 제외하고 시각화
python scripts/skill_tree_json_tools.py app/data/curriculum_skill.json \
  --max-level 2 --skip-boss --allow-missing-prereqs \
  --wrap-markdown --write-mermaid docs/skill_tree_curriculum.mmd

# 선행 관계 기반으로 level 재계산 후 파일에 반영
python scripts/recompute_skill_levels.py --in app/data/curriculum_skill.json \
  --out app/data/curriculum_skill.levels.json --allow-missing --drop-tier
```

- `--skip-boss`: `kind='boss'` 또는 `boss` 플래그가 있는 노드를 제외합니다.
- `--allow-missing-prereqs`: 누락된 선행 스킬이 있어도 통과하며 경고만 출력합니다(레거시 데이터용).
- `recompute_skill_levels.py`: `level = max(prereq level) + 1` 규칙으로 자동 계산합니다. 필요한 경우 `--in-place`로 원본을 덮어쓸 수 있습니다.

출력 예시:

```mermaid
graph LR
  nat_num["자연수 이해 (L1)"]
  int_num["정수 이해 (L2)"]
  add_sub["정수 덧셈/뺄셈 (L3)"]
  mul_div["정수 곱셈/나눗셈 (L4)"]
  nat_num --> int_num
  int_num --> add_sub
  add_sub --> mul_div
```

## 워크플로우 팁
- 새 레벨을 추가할 때마다 `--max-level N`으로 짧게 검증 → Mermaid로 연결 상태 확인
- 에이전트/플래너가 특정 레벨까지만 작업하도록 할 때, 같은 플래그를 재사용하면 됩니다.
- 기본 샘플(`docs/skill_tree_math_basic.json`)을 복사해 자신만의 트리를 시작하세요.

## tmux 오케스트레이터로 “커리큘럼 촘촘히” 작업하기

이 repo에는 tmux 기반 멀티 에이전트 오케스트레이터(`agents_up.sh`, `orchestrate_tmux.py`)가 포함되어 있습니다.

### Task 파일 예시
`tasks/<id>/task.md`(권장) 또는 `tasks/<id>.md`에 아래처럼 최소 메타를 적습니다.

```md
---
workflow: curriculum
mode: boss
dataset_path: app/data/curriculum_skill.json
boss_id: TS_COMB_PROB
subgraph_depth: 2
---

# 목표
- TS_COMB_PROB(경우의 수·확률) 라인을 2~3 depth까지 촘촘히 세분화한다.
```

### 실행
```bash
# task.md의 front-matter에 workflow: curriculum 이 있으면 자동 감지됩니다.
./agents_up.sh <id>

# 이미 같은 tmux 세션이 떠있어서(다른 작업/이전 실행) 초기화가 필요하면:
TMUX_RESET=1 ./agents_up.sh <id>

# 필요시 강제로 워크플로우 지정(우선순위: env/CLI > task.md)
ORCH_WORKFLOW=curriculum ./agents_up.sh <id>
# 또는
source .venv/bin/activate
python orchestrate_tmux.py --workflow curriculum <id>
```

> 기본 tmux 세션명은 현재 프로젝트 폴더명(예: `calculate_math`)으로 자동 설정됩니다. 필요하면 `TMUX_SESSION=...`로 오버라이드하세요.
>
> `workflow: curriculum`일 때는 역할별로 **10개 pane + Orchestrator 1개 pane(총 11개)**가 생성됩니다.

### 산출물 위치
- `tasks/<id>/curriculum/`에 역할별 출력과 `subgraph.json`이 저장됩니다.
