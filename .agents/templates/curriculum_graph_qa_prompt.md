# Graph QA Request {req_id}

너는 “그래프 QA/데이터 엔지니어”다.
목표는 스킬 그래프(DAG)의 데이터 품질을 점검하고(사이클/고아/점프/중복/보스 도달가능성), **수정 패치(JSON)**까지 제안하는 것이다.

[Task 파일]
{task_path}

[현재 데이터셋]
- {dataset_path}

[타깃 보스]
- boss_id: {boss_id}
- boss_label: {boss_label}

[현재 서브그래프(JSON)]
{subgraph_json}

[공통 규격(아키텍트 스펙)]
{architect_spec}

[SME 산출물]
{sme_output}

[Ontology Librarian 산출물]
{ontology_output}

[Atomic Decomposer 산출물]
{decomposer_output}

[Prereq Modeler 산출물]
{prereq_output}

[UX Writer 산출물]
{ux_output}

[Standards Mapper 산출물]
{standards_output}

[Misconception Curator 산출물]
{misconception_output}

[검증 체크리스트]
- cycles: 순환 경로(있으면 경로를 제시)
- orphan nodes: 어떤 노드에도 연결되지 않은 노드
- unreachable bosses: 루트에서 보스로 도달 불가
- duplicate ids / alias conflicts
- long-edge jump 상위 20개(너무 멀리 뛰는 requires)
- 불명확한 label/description(UX 관점)

[가능하면 실행할 커맨드(선택)]
- `python scripts/skill_tree_json_tools.py app/data/curriculum_skill.json --max-level 3 --skip-boss --allow-missing-prereqs --wrap-markdown --write-mermaid docs/skill_tree_curriculum_preview.mmd`
- `python scripts/recompute_skill_levels.py --in app/data/curriculum_skill.json --out app/data/curriculum_skill.levels.json --allow-missing --drop-tier`

[출력]
- 아래 마커 블록 안에는 **반드시 JSON 오브젝트 1개만** 출력한다(코드펜스/설명 금지).
- 스키마(예시):

  {{
    "qa_report_md": "| check | status | details |\\n|---|---|---|\\n| cycles | OK | ... |",
    "issues": {{
      "cycles": [{{"path":["A","B","C","A"]}}],
      "orphan_nodes": ["..."],
      "unreachable_bosses": ["..."],
      "duplicate_ids": [{{"id":"...","count": 2}}],
      "long_edges": [{{"from":"...","to":"...","reason":"..."}}]
    }},
    "patch": {{
      "add_nodes": [{{"...":"..."}}],
      "add_edges": [{{"...":"..."}}],
      "remove_edges": [{{"...":"..."}}],
      "merge_ids": [{{"alias_id":"OLD","kept_id":"NEW","reason":"..."}}],
      "label_updates": [{{"id":"...","label":"...","description":"..."}}]
    }},
    "recommended_commands": ["..."],
    "notes": ["..."]
  }}

###BEGIN:{req_id}###
(여기에 JSON만)
###DONE:{req_id}###
