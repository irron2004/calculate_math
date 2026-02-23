# ULR (Ultra Research) Process Spec

This spec defines a round-based, document-first research workflow.

## 1. Purpose

### One-line goal
- When a user poses a problem, run multi-role agents in parallel and have a Chair converge the research by updating documents every round.

### Success criteria
- Document quality improves every round (not just chat logs).
- Hypotheses are classified into KEEP / HOLD / KILL.
- The final output contains a reproducible experiment plan (inputs, metrics, procedure, pass/fail criteria).

## 2. Core principles

- Document-first: every round must end with file updates.
- Fork-Join: diverge in parallel, then converge under a Chair decision.
- Evidence-tagging: every claim includes an evidence type.
- Decision-forcing: every round records keep/hold/kill decisions.

Evidence tags (standard):
- `[evidence: experiment]`
- `[evidence: literature]`
- `[evidence: codebase]`
- `[evidence: reasoning]`

## 3. Roles

- Explorer: generate a broad set of approaches/hypotheses and propose minimal verification experiments.
- Reality Checker: cut based on difficulty, asset availability, time, and risk.
- Evidence Auditor: summarize supporting/refuting evidence from experiments/literature/codebase.
- Chair (Orchestrator): coordinate rounds, update docs, and make convergence decisions.

## 4. Round-based operating flow

### Round 0: Brief lock
- Document the problem definition, success criteria, constraints, and available assets (code/data/logs).
- Create the research document skeleton.

### Round 1: Diverge (idea explosion)
- Explorer proposes 8-15 candidates.
- Each candidate includes a minimal falsifiable experiment.

### Round 2: Critique (feasibility + evidence cut)
- Reality Checker classifies candidates into KEEP / HOLD / KILL.
- Evidence Auditor summarizes support/refutation/missing evidence.

### Round 3: Converge (decision + experiment design)
- Chair converges to top 1-2 candidates.
- Finalize an executable experiment plan (metrics, baseline, procedure, pass/fail criteria).

### Round 4+: Optional implementation handoff
- Create prioritized TODOs for handing off from research mode to implementation mode (ULW).

## 5. Required artifacts (document system)

Recommended default paths:
- `.sisyphus/ulr/<topic>/brief.md`
- `.sisyphus/ulr/<topic>/research_log.md`
- `.sisyphus/ulr/<topic>/hypotheses.md`
- `.sisyphus/ulr/<topic>/experiment_plan.md`
- `.sisyphus/ulr/<topic>/decision_log.md`

File roles:
- `brief.md`: single source of truth for problem/goal/constraints/assets.
- `research_log.md`: round-by-round results and rationale.
- `hypotheses.md`: hypothesis state (Alive/Dead/Hold) and change history.
- `experiment_plan.md`: reproducible next experiment.
- `decision_log.md`: keep/kill/hold decisions with reasons.

## 6. Execution engine design (ULW-style)

### Triggers
- Keyword: `ulr` or `ultra-research`.
- Behavior: detect keyword and inject ULR mode instructions into the prompt.

### Orchestration model
- Use `task()` per round to collect role outputs in parallel.
- Chair synthesizes and updates documents.
- Persist state in a state file (e.g., `ulr.state.json`) tracking round/roles/artifacts.

### Recommended wave shape
- Wave 1: Explorer + (optional) Evidence Scout/Librarian + (optional) Asset Scout/Explore
- Wave 2: Reality Checker + Evidence Auditor
- Wave 3: Chair synthesis + doc updates

## 7. Round context packet format

Every role agent input uses a shared packet:
- Short problem definition
- Prior round summary (10-20 lines)
- This round objective
- Role-specific questions
- Enforced output format

Notes:
- Avoid long agent-to-agent conversations; Chair relays via packets.
- Keep context bounded; treat documents as the primary memory.

## 8. Guardrails

- Evidence tag required per claim.
- Hypothesis status update required at end of each round.
- No round may end without doc updates.
- Round 3 must output at least one executable experiment plan.

## 9. Implementation roadmap

### Phase 1: Docs MVP
- Create 5 doc templates.
- Finalize a manual Round 0-3 checklist.

### Phase 2: Command/prompt wiring
- Define `/ulr` command.
- Register Chair/Explorer/Reality/Evidence prompt templates.

### Phase 3: State machine automation
- Implement a round driver using `ulr.state.json`.
- Connect an auto-synthesis loop after background tasks complete.

### Phase 4: Quality + ops hardening
- Auto-block missing evidence/decisions.
- Add doc diff summaries and retry policy for failed rounds.

## 10. Immediate execution checklist

- [ ] Pick one topic and create `brief.md`
- [ ] Run Explorer round and generate 8+ candidates
- [ ] Run Reality/Evidence cut and converge top 1-2
- [ ] Finalize the next experiment in `experiment_plan.md`
- [ ] Generate ULW handoff TODOs
