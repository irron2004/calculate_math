# curriculum_skilltree_research_v1 (TS_COMB_PROB) — Final Artifacts

## Files

- `missing_prereq_patch.json`: R1 (coverage) patch extracted + JSON-fixed
- `prereq_patch.json`: R2 (progression/requires) patch extracted + JSON-fixed
- `transfer_edges.json`: R3 (transfer) patch extracted + JSON-fixed
- `merged_graph_patch.json`: merged patch (R2 requires precedence, R3 enables/analog_of precedence, R1 coverage nodes preserved)
- `QA_REPORT.md`: lightweight validation (JSON validity, edge types, no level suggestions, requires-cycle check within patch)

## Sources

- R1: `tasks/curriculum_skilltree_research_v1/runs/T1/research_fcd0127204.md`
- R2: `tasks/curriculum_skilltree_research_v1/runs/T1/research_6658dd0561.md`
- R3: `tasks/curriculum_skilltree_research_v1/runs/T1/research_59a334ac71.md`

## How to resume the orchestrator

From repo root:

```bash
ORCH_VERSION=v2 ORCH_RESUME=1 ./agents_up.sh curriculum_skilltree_research_v1
```

If you want to re-run only the reviewer step:

```bash
ORCH_VERSION=v2 ORCH_RESUME=1 ORCH_RESUME_STAGE=reviewer ./agents_up.sh curriculum_skilltree_research_v1
```

If tmux state is messy and you want a clean restart:

```bash
TMUX_RESET=1 ORCH_VERSION=v2 ./agents_up.sh curriculum_skilltree_research_v1
```
