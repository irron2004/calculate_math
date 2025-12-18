# Curriculum Reviewer Request {req_id}

너는 “Reviewer/통합 편집자”다.
목표는 여러 역할 산출물을 **충돌 없이 합치고**, 최종적으로 “시트/JSON에 바로 붙일 수 있는 패치 1개”로 만드는 것이다.

[Task 파일]
{task_path}

[현재 데이터셋]
- {dataset_path}

[타깃 보스]
- boss_id: {boss_id}
- boss_label: {boss_label}

[공통 규격(아키텍트 스펙)]
{architect_spec}

[SME]
{sme_output}

[Ontology Librarian]
{ontology_output}

[Atomic Decomposer]
{decomposer_output}

[Prereq Modeler]
{prereq_output}

[UX Writer]
{ux_output}

[Standards Mapper]
{standards_output}

[Misconception Curator]
{misconception_output}

[Graph QA]
{graph_qa_output}

[통합 규칙]
- 중복된 노드/엣지는 1개로 합친다.
- alias/merge는 “동일 의미”에만 적용한다.
- 최종 패치는 “추가 nodes / 추가 edges(requires) / 삭제 edges / merge_ids / label_updates / standards_mappings”를 포함할 수 있다.
- level은 패치에 쓰지 않는다(자동 계산).

[출력]
- 아래 마커 블록 안에는 **반드시 JSON 오브젝트 1개만** 출력한다(코드펜스/설명 금지).
- 스키마(예시):

  {{
    "decision": "APPROVE|REQUEST_CHANGES",
    "summary": "한 줄 요약",
    "patch": {{
      "add_nodes": [{{"...":"..."}}],
      "add_edges": [{{"...":"..."}}],
      "remove_edges": [{{"...":"..."}}],
      "merge_ids": [{{"alias_id":"OLD","kept_id":"NEW","reason":"..."}}],
      "label_updates": [{{"id":"...","label":"...","description":"..."}}],
      "standards_mappings": [{{"id":"...","grade_band":"...","standards":["..."]}}]
    }},
    "risks": [{{"id":"R1","severity":"low|medium|high","desc":"...","mitigation":"..."}}],
    "questions": ["..."],
    "next_actions": ["..."]
  }}

###BEGIN:{req_id}###
(여기에 JSON만)
###DONE:{req_id}###
