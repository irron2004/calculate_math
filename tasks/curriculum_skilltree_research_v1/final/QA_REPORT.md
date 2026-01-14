# QA Report: curriculum_skilltree_research_v1 (TS_COMB_PROB)

## Inputs used
- R1: `tasks/curriculum_skilltree_research_v1/runs/T1/research_fcd0127204.md`
- R2: `tasks/curriculum_skilltree_research_v1/runs/T1/research_6658dd0561.md`
- R3: `tasks/curriculum_skilltree_research_v1/runs/T1/research_59a334ac71.md`

## Artifacts
- `tasks/curriculum_skilltree_research_v1/final/missing_prereq_patch.json`
- `tasks/curriculum_skilltree_research_v1/final/prereq_patch.json`
- `tasks/curriculum_skilltree_research_v1/final/transfer_edges.json`
- `tasks/curriculum_skilltree_research_v1/final/merged_graph_patch.json`

## Summary
- add_nodes: 39
- add_edges: 62 (requires=34, enables=22, analog_of=6)
- remove_edges: 16
- merge_aliases: 3

## Checks
- Top-level schema: PASS
- Node required fields: PASS
- Edge type validity: PASS (requires/enables/analog_of)
- add_edges vs remove_edges collision: PASS
- No level/min_level suggestion: PASS
- Requires-cycle check (within patch edges only): PASS (no cycle detected)
  - Note: base graph edges are not included; this is a partial check.

## External References
- Nodes referenced by edges but not in add_nodes (assumed to exist in base graph):
  - COMB_BASIC
  - INCLUSION_EXCLUSION_2SET
  - PERM_BASIC
  - PROB_BASIC
