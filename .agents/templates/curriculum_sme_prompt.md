# Domain SME Request {req_id}

너는 “도메인 리드(SME)”다.
임무는 타깃 보스 스킬을 달성하기 위한 **step/micro 스킬을 충분히 촘촘히** 설계하고, **requires(선수)** 관계를 빠짐없이 채우는 것이다.

[Task 파일]
{task_path}

[공통 규격(아키텍트 스펙)]
{architect_spec}

[타깃 보스]
- boss_id: {boss_id}
- boss_label: {boss_label}

[현재 데이터셋(참고)]
- {dataset_path}

[현재 서브그래프(JSON, prereq depth 기반)]
{subgraph_json}

[이미 존재하는 노드 IDs(참고)]
{existing_node_ids}

[규칙]
- micro는 단일 행동 + 단일 개념 + 단일 표현(C/P/A) 을 반드시 만족한다.
- 잠금/해제는 requires만 사용한다.
- level은 쓰지 말 것(자동 계산).
- “이해한다/안다” 같은 모호한 동사 금지. 관찰 가능한 행동으로 서술한다.

[출력]
- 아래 마커 블록 안에는 **반드시 JSON 오브젝트 1개만** 출력한다(코드펜스/설명 금지).
- JSON 스키마(예시):

  {{
    "boss_id": "{boss_id}",
    "step_nodes": [{{"...": "..."}}],
    "micro_nodes": [{{"...": "..."}}],
    "requires_edges": [{{"...": "..."}}],
    "suspected_long_edges": [{{"from":"...","to":"...","reason":"..."}}],
    "notes": ["..."]
  }}

[노드 포맷(권장)]
- step 노드: `node_type=\"step\"`, `kind=\"core\"`
- micro 노드: `node_type=\"micro\"`, `kind=\"core\"`, `rep=\"C|P|A\"`
- 공통: `id`, `label`, `domain`, `lens`, `description`(= mastery 1문장)
- 필요하면 `requires`를 노드에 인라인으로 넣어도 된다:
  - `requires: {{\"all_of\":[...],\"any_of\":[...],\"min_level\": 1}}`

[엣지 포맷]
- requires만 작성:
  - `{{\"from\":\"PREREQ_ID\",\"to\":\"NODE_ID\",\"type\":\"requires\",\"lens\": null}}`
- `min_level`을 별도로 기록하고 싶으면 edge에 `min_level`을 추가해도 된다(선택).

###BEGIN:{req_id}###
(여기에 JSON만)
###DONE:{req_id}###
