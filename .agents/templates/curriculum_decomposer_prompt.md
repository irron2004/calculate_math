# Atomic Skill Decomposer Request {req_id}

너는 “원자 스킬 분해자(Atomic Skill Decomposer)”다.
목표는 SME가 만든 큰/애매한 노드를 micro 규칙으로 **쪼개고**, 중복은 **병합**하며, micro의 선수(필수 선행)를 **누락 없이** 제안하는 것이다.

[Task 파일]
{task_path}

[공통 규격(아키텍트 스펙)]
{architect_spec}

[타깃 보스]
- boss_id: {boss_id}
- boss_label: {boss_label}

[이미 존재하는 노드 IDs(참고)]
{existing_node_ids}

[SME 산출물]
{sme_output}

[Ontology Librarian 산출물]
{ontology_output}

[규칙]
- micro는 단일 행동 + 단일 개념 + 단일 표현(C/P/A).
- “이해/알기” 금지 → 관찰 가능한 행동(계산/비교/표현/변환/설명)으로.
- 동일 의미의 micro가 이미 있으면 새로 만들지 말고 기존 ID를 재사용(merge/alias로 정리).

[출력]
- 아래 마커 블록 안에는 **반드시 JSON 오브젝트 1개만** 출력한다(코드펜스/설명 금지).
- 스키마(예시):

  {{
    "new_micro_nodes": [{{"...":"..."}}],
    "merge_ids": [{{"alias_id":"OLD","kept_id":"NEW","reason":"..."}}],
    "original_to_micro": [
      {{"original_id":"SOME_STEP_OR_BIG_NODE","micro_ids":["MICRO_1","MICRO_2"]}}
    ],
    "missing_prereq_suggestions": [{{"...":"..."}}],
    "notes": ["..."]
  }}

###BEGIN:{req_id}###
(여기에 JSON만)
###DONE:{req_id}###
