# OpenCode Ultra Research Process (ULR)

## TL;DR
> Add a research-specialized, repeatable "Ultra Research" process to the OpenCode plugin in this repo (`.plugins/oh-my-opencode-ulr/`).
>
> Primary deliverable: strengthen and formalize the existing `ulr`/`ultra research` mode so it behaves predictably (no accidental triggers, no prompt bloat), has clear precedence rules, and has TDD coverage.

**Estimated Effort**: Medium
**Parallel Execution**: YES (3 waves)
**Critical Path**: keyword-detector safety refactor -> ULR behavior + prompt -> tests + docs

---

## Context

### Original Request
- "Add a research-specialized process to opencode" and review the user's research notes in `docs\ulr-ultra-research-plan.md`.

### Reality Check (Repo)
- The referenced file `docs/ulr-ultra-research-plan.md` is not present in this workspace yet.
- The user provided the spec content in chat; this plan includes an English version in **Appendix A** so the executor can create the file deterministically.
- This repo contains an OpenCode plugin at `.plugins/oh-my-opencode-ulr/`.
- The plugin already has a keyword-driven Ultra Research mode:
  - ULR pattern/message: `.plugins/oh-my-opencode-ulr/src/hooks/keyword-detector/ultra-research/default.ts`
  - Mode injection: `.plugins/oh-my-opencode-ulr/src/hooks/keyword-detector/hook.ts`
  - Detector registry: `.plugins/oh-my-opencode-ulr/src/hooks/keyword-detector/constants.ts`
  - Tests: `.plugins/oh-my-opencode-ulr/src/hooks/keyword-detector/index.test.ts`

### Key Risks (Metis)
- `detectKeywordsWithType()` relies on positional `types[index]` mapping, which is fragile when adding/reordering detectors.
- Multi-mode collisions can create impossible constraints (e.g., two modes requiring different mandatory first responses).
- Repeated injection can bloat prompts and spam toasts.

---

## Work Objectives

### Core Objective
Implement a reliable "Ultra Research" process that orchestrates research in rounds and produces a concrete next experiment, without degrading performance or causing accidental activations.

### Definition of Done
- ULR activation and precedence rules are deterministic and covered by tests.
- ULR injection is deduped (no repeated prompt growth / toast spam).
- All changes pass plugin CI equivalents: `bun test` and `bun run typecheck` (within `.plugins/oh-my-opencode-ulr/`).

### Must NOT Have (Guardrails)
- No network calls, task spawning, or heavy computation inside `chat.message` hook.
- No reliance on positional detector typing (must be explicitly typed).
- No change that causes analyze/search to unexpectedly activate ULR (unless explicitly decided).

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: YES (`bun test` in `.plugins/oh-my-opencode-ulr/`)
- **Automated tests**: YES (TDD for touched modules)

### Primary Verification Commands
```bash
cd .plugins/oh-my-opencode-ulr && bun test
cd .plugins/oh-my-opencode-ulr && bun run typecheck
```

---

## Execution Strategy (Parallel Waves)

Wave 1 (Foundation + safety refactor)
- Task 1-5

Wave 2 (ULR process + UX)
- Task 6-9

Wave 3 (Docs + regression)
- Task 10-12

---

## TODOs

 - [ ] 1. Create `docs/ulr-ultra-research-plan.md` from Appendix A

  **What to do**:
  - Create `docs/ulr-ultra-research-plan.md` using the spec content from **Appendix A** (treat Appendix A as source-of-truth).
  - Ensure the doc includes: purpose, success criteria, principles, roles, Round 0-3 flow, required artifacts, evidence tags, and guardrails.
  - Keep this file stable: later code/prompt changes should reference it.

  **References**:
  - `.plugins/oh-my-opencode-ulr/src/hooks/keyword-detector/ultra-research/default.ts` - existing ULR message (baseline behavior)

  **Acceptance Criteria**:
  - [ ] `docs/ulr-ultra-research-plan.md` exists in workspace
  - [ ] The file includes Round 0-3 flow + required artifacts list

  **QA Scenarios**:
  ```
  Scenario: Spec doc is discoverable
    Tool: Bash
    Steps:
      1. Run a repo search for "ulr-ultra-research-plan" and "ultra research" keywords
      2. Verify `docs/ulr-ultra-research-plan.md` exists and contains round definitions
    Expected Result: File exists and includes at least Round 0-3 structure
    Evidence: .sisyphus/evidence/task-1-spec-present.txt
  ```

- [ ] 2. Remove positional detector typing (make detectors explicitly typed)

  **What to do**:
  - Refactor keyword detector registry so each detector includes its explicit `type` (e.g., `ultrawork`, `search`, `ultra-research`, `analyze`) rather than using `types[index]` mapping.
  - Update `detectKeywordsWithType()` accordingly.
  - Keep behavior identical for existing modes (except where changed by later tasks).

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 3-5)

  **References**:
  - `.plugins/oh-my-opencode-ulr/src/hooks/keyword-detector/detector.ts` - current positional mapping
  - `.plugins/oh-my-opencode-ulr/src/hooks/keyword-detector/constants.ts` - detector registry
  - `.plugins/oh-my-opencode-ulr/src/hooks/keyword-detector/index.test.ts` - asserts current ULR injection behavior

  **Acceptance Criteria**:
  - [ ] `cd .plugins/oh-my-opencode-ulr && bun test src/hooks/keyword-detector` -> PASS

  **QA Scenarios**:
  ```
  Scenario: Existing mode typing remains correct after refactor
    Tool: Bash
    Steps:
      1. Run `cd .plugins/oh-my-opencode-ulr && bun test src/hooks/keyword-detector/index.test.ts`
    Expected Result: Tests pass with no behavior regressions
    Evidence: .sisyphus/evidence/task-2-keyword-detector-tests.txt
  ```

- [ ] 3. Add per-session dedupe to prevent repeated injection + toast spam

  **What to do**:
  - Add lightweight session-scoped state to ensure the same mode message is injected at most once per session.
  - Ensure this does not affect background task sessions (still skipped) and does not break non-main session filtering.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 4, 5)

  **References**:
  - `.plugins/oh-my-opencode-ulr/src/hooks/keyword-detector/hook.ts` - injection + toast
  - `.plugins/oh-my-opencode-ulr/src/features/claude-code-session-state` - session tracking utilities

  **Acceptance Criteria**:
  - [ ] New tests prove the injection/toast happens once per session
  - [ ] `cd .plugins/oh-my-opencode-ulr && bun test src/hooks/keyword-detector` -> PASS

  **QA Scenarios**:
  ```
  Scenario: ULR injection is one-shot per session
    Tool: Bash
    Steps:
      1. Run the new unit test that sends two `ulr ...` messages in same session
      2. Assert output contains exactly one `[ultra-research-mode]` injection and one toast call
    Expected Result: One injection/toast, no prompt growth on second message
    Evidence: .sisyphus/evidence/task-3-ulr-dedupe.txt
  ```

- [ ] 4. Define and enforce mode precedence rules (ULR vs analyze/search/ultrawork)

  **What to do**:
  - Decide (default) precedence to avoid impossible constraints:
    - If ULR is present, do not inject `[analyze-mode]` or `[search-mode]` in the same message.
    - If both ULR + ultrawork are present, allow both but adjust ULR prompt to not mandate a different first response.
  - Implement precedence filtering inside keyword detection or the injection hook (keep it cheap).
  - Add tests for collision cases.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2-3)
  - **Blocked By**: Task 2

  **References**:
  - `.plugins/oh-my-opencode-ulr/src/hooks/keyword-detector/analyze/default.ts` - analyze trigger surface
  - `.plugins/oh-my-opencode-ulr/src/hooks/keyword-detector/search/default.ts` - search trigger surface
  - `.plugins/oh-my-opencode-ulr/src/hooks/keyword-detector/ultra-research/default.ts` - ULR prompt constraints

  **Acceptance Criteria**:
  - [ ] Tests cover: `ulr analyze ...`, `ulr search ...`, `ulr ultrawork ...` and assert intended injection outcomes

  **QA Scenarios**:
  ```
  Scenario: ULR suppresses analyze/search injections
    Tool: Bash
    Steps:
      1. Run collision tests for messages containing both `ulr` and `search` keywords
      2. Assert output contains `[ultra-research-mode]` and does NOT contain `[search-mode]`
    Expected Result: Only ULR injected
    Evidence: .sisyphus/evidence/task-4-precedence.txt
  ```

- [ ] 5. Add performance guardrails for keyword detection on large messages

  **What to do**:
  - Add a safe max-size slice for detection input (e.g., first N chars) to prevent worst-case regex work on pasted logs.
  - Add a test that ensures large inputs do not time out and still detect keywords near the start.

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocked By**: Task 2

  **References**:
  - `.plugins/oh-my-opencode-ulr/src/hooks/keyword-detector/detector.ts` - `removeCodeBlocks()` and detection

  **Acceptance Criteria**:
  - [ ] `bun test` includes a large-input case and passes

  **QA Scenarios**:
  ```
  Scenario: Large input does not degrade detection
    Tool: Bash
    Steps:
      1. Run the new large-input test
    Expected Result: Test completes quickly and passes
    Evidence: .sisyphus/evidence/task-5-large-input.txt
  ```

- [ ] 6. Rewrite `ULTRA_RESEARCH_MESSAGE` to match the new research process

  **What to do**:
  - Replace the current brief ULR prompt with the process defined in `docs/ulr-ultra-research-plan.md` (created in Task 1).
  - Enforce the process contract in-prompt:
    - Document-first: every round must update files under `.sisyphus/ulr/<topic>/...`
    - Fork-Join: parallel role agents -> Chair synthesis
    - Evidence-tagging: every claim must include `[evidence: experiment|literature|codebase|reasoning]`
    - Decision-forcing: hypotheses must move to KEEP/HOLD/KILL each round
  - Define roles + required outputs:
    - Explorer: 8-15 hypotheses + minimal falsifiable experiment per hypothesis
    - Reality Checker: feasibility filter + risks + constraints
    - Evidence Auditor: supporting/refuting evidence + missing evidence
    - Chair: updates docs + converges to 1-2 directions + produces a concrete `experiment_plan.md`
  - Add explicit artifact spec:
    - `.sisyphus/ulr/<topic>/brief.md`
    - `.sisyphus/ulr/<topic>/research_log.md`
    - `.sisyphus/ulr/<topic>/hypotheses.md`
    - `.sisyphus/ulr/<topic>/experiment_plan.md`
    - `.sisyphus/ulr/<topic>/decision_log.md`
    - (optional) `.sisyphus/ulr/<topic>/ulr.state.json`
  - Ensure it is consistent with other modes:
    - Remove/avoid any requirement that conflicts with ultrawork's mandatory first response.

  **Recommended Agent Profile**:
  - **Category**: `writing`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocked By**: Task 1, Task 4

  **References**:
  - `.plugins/oh-my-opencode-ulr/src/hooks/keyword-detector/ultra-research/default.ts` - where the prompt lives
  - `.plugins/oh-my-opencode-ulr/docs/orchestration-guide.md` - overall orchestration philosophy

  **Acceptance Criteria**:
  - [ ] Prompt includes: rounds 0-3, evidence tags, document-first artifact rules, and a concrete next experiment
  - [ ] Keyword-detector tests still pass after updating message

  **QA Scenarios**:
  ```
  Scenario: ULR message still injects and is stable
    Tool: Bash
    Steps:
      1. Run `bun test src/hooks/keyword-detector/index.test.ts`
      2. Verify injected text includes "ROUND FLOW" and "NON-NEGOTIABLE RULES" (or equivalent spec headings)
    Expected Result: Tests pass and injection includes the new structured process
    Evidence: .sisyphus/evidence/task-6-ulr-message.txt
  ```

- [ ] 7. Add/extend unit tests for ULR collisions and dedupe behavior

  **What to do**:
  - Add tests for precedence rules, dedupe, and code-block/system-reminder immunity where relevant.
  - Keep tests isolated (no global-state leakage across tests).

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocked By**: Tasks 2-4

  **References**:
  - `.plugins/oh-my-opencode-ulr/src/hooks/keyword-detector/index.test.ts` - existing test patterns
  - `.plugins/oh-my-opencode-ulr/src/hooks/keyword-detector/hook.ts` - session filtering logic

  **Acceptance Criteria**:
  - [ ] `cd .plugins/oh-my-opencode-ulr && bun test src/hooks/keyword-detector` -> PASS

  **QA Scenarios**:
  ```
  Scenario: Collision coverage
    Tool: Bash
    Steps:
      1. Run `bun test src/hooks/keyword-detector/index.test.ts`
    Expected Result: New collision tests pass
    Evidence: .sisyphus/evidence/task-7-collisions.txt
  ```

- [ ] 8. Add `/ulr` builtin command for explicit ULR activation

  **What to do**:
  - Add a new builtin command named `ulr` (slash command: `/ulr`) that injects the ULR instruction template without relying on keyword heuristics.
  - Command should accept an optional topic argument (used to name `.sisyphus/ulr/<topic>/`).
  - Keep it consistent with existing builtin command templates.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocked By**: Task 6

  **References**:
  - `.plugins/oh-my-opencode-ulr/src/features/builtin-commands/commands.ts` - builtin command registry
  - `.plugins/oh-my-opencode-ulr/src/features/builtin-commands/types.ts` - BuiltinCommandName union
  - `.plugins/oh-my-opencode-ulr/src/features/builtin-commands/templates/` - template pattern

  **Acceptance Criteria**:
  - [ ] `bun test` includes coverage for command registration/loading

  **QA Scenarios**:
  ```
  Scenario: Command appears in discovery output
    Tool: Bash
    Steps:
      1. Run the command discovery tests (where builtin commands are enumerated)
    Expected Result: New ULR command is listed with correct description
    Evidence: .sisyphus/evidence/task-8-command.txt
  ```

- [ ] 9. (Optional) Update toast copy/title to match finalized UX

  **What to do**:
  - Ensure toast title/message and variant behavior are consistent and deduped.
  - Make sure it does not override existing `variant`.

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocked By**: Task 3

  **References**:
  - `.plugins/oh-my-opencode-ulr/src/hooks/keyword-detector/hook.ts` - toast + variant logic

  **Acceptance Criteria**:
  - [ ] Toast is shown once and does not override pre-set variant

- [ ] 10. Add documentation page for Ultra Research process (plugin docs)

  **What to do**:
  - Add a dedicated doc describing: when to use ULR, how to trigger it, round outputs, and examples.
  - Link it from `.plugins/oh-my-opencode-ulr/docs/orchestration-guide.md` (or a central index page if used).

  **Recommended Agent Profile**:
  - **Category**: `writing`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocked By**: Task 6

  **References**:
  - `.plugins/oh-my-opencode-ulr/docs/orchestration-guide.md` - canonical user-facing workflow guide
  - `.plugins/oh-my-opencode-ulr/docs/guide/overview.md` - overview placement

  **Acceptance Criteria**:
  - [ ] New doc exists under `.plugins/oh-my-opencode-ulr/docs/` and is linked from an existing guide

  **QA Scenarios**:
  ```
  Scenario: Doc is linked
    Tool: Bash
    Steps:
      1. Search for "Ultra Research" links in plugin docs
      2. Verify link target exists
    Expected Result: Doc is discoverable from orchestration guide
    Evidence: .sisyphus/evidence/task-10-doc-link.txt
  ```

- [ ] 11. Run plugin-level regression: tests + typecheck

  **What to do**:
  - Run `bun test` and `bun run typecheck` for the plugin.

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (final)
  - **Blocked By**: Tasks 2-7 (and any optional tasks completed)

  **References**:
  - `.plugins/oh-my-opencode-ulr/package.json` - canonical scripts

  **Acceptance Criteria**:
  - [ ] `cd .plugins/oh-my-opencode-ulr && bun test` -> PASS
  - [ ] `cd .plugins/oh-my-opencode-ulr && bun run typecheck` -> PASS

  **QA Scenarios**:
  ```
  Scenario: Full plugin verification
    Tool: Bash
    Steps:
      1. Run `cd .plugins/oh-my-opencode-ulr && bun test`
      2. Run `cd .plugins/oh-my-opencode-ulr && bun run typecheck`
    Expected Result: Both commands succeed (exit code 0)
    Evidence: .sisyphus/evidence/task-11-plugin-verify.txt
  ```

- [ ] 12. (Optional) Mirror a short spec pointer in repo root docs

  **What to do**:
  - If you want repo-root documentation, add a short pointer doc in `docs/` that links to the canonical plugin docs page.

  **Recommended Agent Profile**:
  - **Category**: `writing`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocked By**: Task 10

---

## Commit Strategy
- Prefer small, reviewable commits inside `.plugins/oh-my-opencode-ulr/`:
  - `refactor(keyword-detector): make detector types explicit`
  - `feat(ulr): add dedupe + precedence rules`
  - `test(ulr): cover collisions and one-shot injection`
  - `docs(ulr): document ultra research process`

## Success Criteria
- ULR is predictable (typed detectors + precedence + dedupe)
- No perf regression in `chat.message` hook
- `bun test` and `bun run typecheck` pass for the plugin

---

## Appendix A: ULR Spec (English, from user-provided notes)

### 1) Purpose
- One-line goal: when a user poses a problem, run multi-role agents in parallel and have a Chair converge the research by updating documents each round.

### 2) Success criteria
- Document quality improves each round (not just chat logs).
- Hypotheses are categorized into KEEP / HOLD / KILL.
- Final output includes a reproducible experiment plan (inputs, metrics, procedure, pass/fail criteria).

### 3) Core principles
- Document-first: every round must end with file updates.
- Fork-Join: diverge in parallel, then Chair converges decisions.
- Evidence-tagging: every claim carries an evidence type.
- Decision-forcing: each round must record keep/hold/kill decisions.

Evidence tags:
- `[evidence: experiment]`
- `[evidence: literature]`
- `[evidence: codebase]`
- `[evidence: reasoning]`

### 4) Roles
- Explorer: generate a wide set of approaches/hypotheses and propose minimal verification experiments.
- Reality Checker: feasibility cut based on difficulty, asset availability, time, and risk.
- Evidence Auditor: compile supporting/refuting evidence from experiments/literature/codebase.
- Chair (Orchestrator): coordinate rounds, update docs, and produce convergence decisions.

### 5) Round-based flow
- Round 0 (Brief lock): define problem, success criteria, constraints, available assets; create research doc skeleton.
- Round 1 (Diverge): Explorer proposes 8-15 candidates; each includes a minimal falsifiable experiment.
- Round 2 (Critique): Reality Checker classifies KEEP/HOLD/KILL; Evidence Auditor summarizes support/refutation/missing evidence.
- Round 3 (Converge): Chair selects top 1-2 directions; finalizes an executable experiment plan (metrics, baseline, steps, pass/fail).
- Round 4+ (Optional handoff): generate TODOs/priorities to hand off into implementation mode (ULW).

### 6) Required artifacts (document system)
Recommended default paths:
- `.sisyphus/ulr/<topic>/brief.md`
- `.sisyphus/ulr/<topic>/research_log.md`
- `.sisyphus/ulr/<topic>/hypotheses.md`
- `.sisyphus/ulr/<topic>/experiment_plan.md`
- `.sisyphus/ulr/<topic>/decision_log.md`

File purposes:
- `brief.md`: single source of truth for problem/goal/constraints/assets.
- `research_log.md`: round-by-round results and rationale.
- `hypotheses.md`: hypothesis states (Alive/Dead/Hold) + change history.
- `experiment_plan.md`: reproducible next experiment.
- `decision_log.md`: keep/kill/hold decisions with reasons.

### 7) Execution engine design (ULW-style)
- Trigger keywords: `ulr` or `ultra-research`.
- Behavior: keyword detection injects ULR mode instructions (similar to ULW activation).
- Orchestration model:
  - Use `task()` per round to run role agents in parallel.
  - Chair synthesizes results and updates docs.
  - Persist round state and artifact paths in a state file (e.g., `ulr.state.json`).

Recommended waves:
- Wave 1: Explorer + (optional) Asset Scout / Librarian
- Wave 2: Reality Checker + Evidence Auditor
- Wave 3: Chair synthesis + doc updates

### 8) Round context packet format
Every role agent input should include:
- Short problem definition
- Prior round summary (10-20 lines)
- This round objective
- Role-specific questions
- Enforced output format

Guidance:
- Avoid long direct agent-to-agent chats; Chair relays via context packets.

### 9) Guardrails
- Evidence tag required per claim.
- Hypothesis status change required at end of each round.
- No round may end without doc updates.
- Round 3 must output at least one executable experiment plan.

### 10) Implementation roadmap
- Phase 1: docs MVP (5 templates + Round 0-3 checklist)
- Phase 2: command/prompt wiring (`/ulr` + role prompts)
- Phase 3: state machine automation (`ulr.state.json` + auto synthesis loop)
- Phase 4: quality/ops hardening (block missing evidence/decisions, diff summary, retry policy)
