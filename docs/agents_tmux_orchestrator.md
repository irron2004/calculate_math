# Agents(tmux 오케스트레이터) 코드 구조 정리

이 문서는 `agents/` 아래의 tmux 기반 멀티-에이전트 오케스트레이션 코드 구조와 전체 실행 플로우를 “기능 단위”로 이해하기 쉽게 정리한 문서입니다.

## 1) 한 장 요약 (TL;DR)

실행 파이프라인은 크게 4층입니다.

1. **tmux 세션/패널 준비**: `./agents_up.sh <task_id>`(루트) → `agents/agents_up.sh`가 tmux pane을 만들고 각 pane에서 `codex`(AGENT_CMD)를 실행
2. **오케스트레이터 실행**: 같은 tmux window의 “Orchestrator pane”에서 `python agents/orchestrate_tmux(_v2).py <task_id>` 실행
3. **프롬프트 파일 생성/전송**: 오케스트레이터가 `.agents/inbox/*.md`에 프롬프트 파일을 쓰고, tmux로 해당 pane에 “이 파일을 읽고 답해라” 라인을 전송
4. **결과 수집/상태 갱신/다음 단계로 라우팅**: pane 출력에서 `###BEGIN:{req_id}### ... ###DONE:{req_id}###` 블록을 캡처해서 결과를 저장하고(run artifacts), state를 갱신한 뒤 다음 노드로 이동

## 2) 디렉토리/파일 지도 (기능별)

### (A) 실행/오케스트레이션 엔트리
- `agents_up.sh` (레포 루트): 루트에서 실행하는 wrapper. `agents/agents_up.sh`로 위임
- `agents/agents_up.sh`: tmux 세션/윈도우/패널을 만들고, role pane에서 `codex`를 실행하고, orchestrator pane에서 파이썬 오케스트레이터를 실행

### (B) 오케스트레이터 (Python)
- `agents/orchestrate_tmux.py` (**v1**)
  - `workflow: code` + `workflow: curriculum` 지원
  - code workflow는 “PM이 plan JSON을 한 번에 출력”하는 방식
  - graph_profile의 `stages` 기반 순차 실행 (pm → dev → qa → reviewer → ...)
- `agents/orchestrate_tmux_v2.py` (**v2 / B 방식**)
  - `workflow: code`만 지원
  - PM은 “plan patch ops”만 출력하고, 오케스트레이터가 plan을 갱신
  - depends_on 기반 `advance_ticket` + `pm_patch` 에스컬레이션
  - graph_profile의 `flow`/`transitions`로 “티켓 처리 단계 순서”를 커스텀 가능 (번호 suffix 포함)

### (C) 그래프/라우팅 (v2 중심)
- `agents/routing.py`: (주로 v2에서) 순수 라우팅 로직을 분리해두기 위한 모듈 (화이트리스트 기반)
- `agents/graph.py`: LangGraph 스타일의 그래프 빌더 (현재 오케스트레이터의 메인 실행 경로와는 분리되어 있음)

### (D) 스키마/패치/상태
- `agents/schemas.py`: Plan/Ticket/DevRole 등 핵심 스키마 (Plan은 v1(list) ↔ v2(dict) 마이그레이션 로더 포함)
- `agents/patch_schema.py`: PM patch(ops) 스키마 정의 (AddTicket/UpdateTicket/SplitTicket/RemoveTicket 등)
- `agents/apply_patch.py`: PatchEnvelope 적용 로직 + current_ticket_id reconcile 등
- `agents/state.py`: 오케스트레이터가 들고 도는 `AgentState` 정의 + 초기 상태 생성

### (E) 설정/템플릿
- `agents/config/graph_profiles.json`: graph_profile 정의 (stages/ticket_roles/flow/transitions/templates)
- `agents/.agents/templates/*.md`: 역할별 프롬프트 템플릿
- `.agents/inbox/`: 런타임에 오케스트레이터가 프롬프트 파일을 생성하는 “메일함” (git-ignore되는 것이 일반적)

## 3) 런타임 산출물/상태 파일 (tasks/<task_id>/)

오케스트레이터는 매 실행마다 다음을 생성/갱신합니다.

- `tasks/<task_id>/plan.json`: 계획(Plan). v2에서도 하위 호환을 위해 v1 포맷으로 저장
- `tasks/<task_id>/tickets/<TID>.md`: 티켓 지시문(역할/AC/검증 등). PM patch로 update되면 재생성/갱신될 수 있음
- `tasks/<task_id>/runs/<TID>/*.md`: 각 단계(Dev/QA/Reviewer/Research 등)의 원문 로그를 저장
- `tasks/<task_id>/run_state.json`: 재개(resume)를 위한 실행 상태 스냅샷 (마지막 stage, current_ticket, attempt 등)

## 4) graph_profile이 하는 일 (중요)

graph_profile은 두 군데에서 동시에 쓰입니다.

1) **tmux pane 구성** (`agents/agents_up.sh`)
- `stages`에 `qa`가 있으면 QA pane도 띄움, `reviewer`가 있으면 reviewer pane도 띄움
- `ticket_roles`를 보고 FE/BE/RESEARCH pane 개수와 순서를 결정
  - 같은 역할이 여러 번 나오면 pane도 여러 개 만들어집니다 (예: RESEARCH 3개 → Research1/2/3 pane)

2) **오케스트레이터 실행 흐름** (`agents/orchestrate_tmux_v2.py`)
- `flow`가 없으면: “기본 그래프”(pm_plan → router_dev → dev_* → qa → reviewer → advance_ticket…)로 동작
- `flow`가 있으면: “커스텀 flow 그래프”로 동작 (flow 순서대로 step 실행 + transitions로 루프/분기)

## 5) 템플릿과 마커(###BEGIN/###DONE)

오케스트레이터는 각 역할 pane에 직접 프롬프트 텍스트를 붙여 넣지 않고, 다음을 합니다.

1) `.agents/inbox/<role>_<req_id>.md`에 템플릿을 렌더링한 프롬프트 파일을 생성
2) tmux로 해당 pane에 “Request <req_id>: … -> <prompt_path>”를 전송
3) pane 출력에서 `###BEGIN:<req_id>###` ~ `###DONE:<req_id>###` 사이 텍스트를 캡처

템플릿에서 반드시 지켜야 하는 규칙:
- `{req_id}`와 `###BEGIN:{req_id}###`, `###DONE:{req_id}###` 마커는 필수
- v2의 work-step(dev/research/be/fe) 템플릿에서는 추가로 아래 키를 사용할 수 있음
  - `{stage}`: 현재 실행 중인 step id (예: `research2`)
  - `{prev_handoff}`: 직전 work-step 산출물(라운드테이블/연쇄 토의 전달용)

## 6) v2(code workflow) 실행 플로우

### (A) 기본 그래프(커스텀 flow 없음)

```
pm_plan
  → router_dev (ticket.owner_role 기반으로 dev_be/dev_fe/dev_research 선택)
  → dev_* (구현/리서치 실행)
  → qa (OK/FAIL)
  → reviewer (APPROVE/REQUEST_CHANGES)
  → advance_ticket (depends_on 충족 티켓으로 이동)
  → 반복 … / final_verification
```

핵심 포인트:
- QA/Reviewer가 반복 실패하면 `pm_patch`로 에스컬레이션(기본 2회 이후)
- `pm_patch`는 PM이 patch ops(JSON)를 출력하면 `apply_patch.py`로 plan/ticket을 갱신
- 모든 state는 `run_state.json`에 저장되어 `--resume`로 재개 가능

### (B) 커스텀 flow 그래프(`flow`/`transitions` 사용)

`flow`는 “한 티켓을 처리할 때 거칠 단계의 순서”를 명시합니다.
- 허용 base step: `research`, `be`, `fe`, `qa`, `reviewer`
- 번호 suffix 지원: `research1`, `research2`, `be2` 등 (동일 역할 pane 다중화)

`transitions`는 gate step(qa/reviewer)의 결과에 따라 다음 step을 바꿀 수 있게 합니다.
- step/target은 base(`research`) 또는 instance(`research1`)를 쓸 수 있음
- base를 쓰면 해당 base의 “flow 내 첫 번째 step”으로 매핑됩니다

예시:
```json
{
  "stages": ["pm", "dev", "qa", "reviewer"],
  "ticket_roles": ["RESEARCH", "RESEARCH", "RESEARCH", "BE"],
  "flow": ["research1", "research2", "research3", "be", "qa", "reviewer"],
  "transitions": {
    "reviewer": { "request_changes": "research1", "approve": "advance_ticket" }
  }
}
```

## 7) tmux pane env 규칙 (중복 역할 포함)

`agents/agents_up.sh`가 orchestrator pane에서 Python을 실행할 때, pane 타겟을 env로 넘겨줍니다.

- 기본(첫 번째 pane): `RESEARCH_PANE` (또는 `FE_PANE`, `BE_PANE`, ...)
- 중복 역할:
  - 첫 번째 pane도 `*_PANE_1`로 같이 export
  - 두 번째 이후는 `*_PANE_2`, `*_PANE_3` …

v2 커스텀 flow에서 `research2` 같은 step은 다음 우선순위로 타겟을 고릅니다.
1) `RESEARCH_PANE_2`가 있으면 사용
2) 없으면 `RESEARCH_PANE`로 fallback (warn 출력)

## 8) v1과 v2 차이 (왜 파일이 여러 개냐?)

- v1(`orchestrate_tmux.py`)
  - PM이 “전체 plan JSON”을 출력 → 오케스트레이터는 그대로 plan/ticket 생성 후 stages대로 실행
  - curriculum workflow(스킬트리)도 포함되어 파일이 더 커짐
  - `flow/transitions`는 로드만 하고 실제 라우팅에는 사용하지 않음(현재 기준)

- v2(`orchestrate_tmux_v2.py`)
  - PM은 “patch ops만” 출력 → 오케스트레이터가 plan을 수정
  - resume/attempt/pm_patch/depends_on 등 운영 기능이 집중되어 있음
  - `flow/transitions`로 “티켓 처리 순서”를 유연하게 구성 가능

## 9) 리팩터링을 위한 권장 분해(제안)

현재 구조를 “기능별”로 쪼개려면, 대략 아래 단위가 경계가 됩니다.

1) `tmux_io.py`: `tmux_send_line`, `tmux_capture`, `wait_for_markers`
2) `templates.py`: 템플릿 로딩/override/렌더 + 마커 규약
3) `profiles.py`: graph_profile 로드/정규화 + flow/transitions 검증
4) `runtime_store.py`: `plan.json`, `tickets/*.md`, `runs/`, `run_state.json` I/O
5) `workflow_code_v2.py`: pm_plan/pm_patch/dev/qa/reviewer/advance_ticket 노드 묶음
6) `workflow_curriculum_v1.py`: curriculum 전용 (v1에서 큰 덩어리)

이렇게 분리하면 “tmux 대화 전달”은 얇아지고, 나머지(재개/검증/패치/호환성)는 별 모듈로 분리되어 읽기 쉬워집니다.

