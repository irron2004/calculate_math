# Curriculum Graph DB Verification and Hardening

## TL;DR

> **Quick Summary**: Verify the Unit -> Skill -> Problem graph integration end-to-end, detect missing/wrong links, fix data/model mismatches, and re-validate with executable evidence.
>
> **Deliverables**:
> - Verified graph integrity report (missing links, wrong links, remediation log)
> - Backend parity evidence for sqlite vs neo4j endpoints
> - Frontend research-graph rendering/interaction verification evidence
> - Release readiness decision with pass/fail gates
>
> **Estimated Effort**: Medium
> **Parallel Execution**: YES - 3 waves + final verification wave
> **Critical Path**: Task 1 -> Task 6 -> Task 8 -> Task 13 -> Task 15 -> Task 16 -> F1-F4

---

## Context

### Original Request
"커리큘럼을 그래프 db로 연결했는데, 누락된게 없는지, 잘못 연결된건 없는지 확인하고 수정 보완해"

### Interview Summary
**Key Discussions**:
- User requested a verification plan after curriculum graph DB integration and migration work.
- Verification must explicitly catch both missing links and wrong links.
- Scope includes backend graph DB correctness and frontend research-graph behavior.

**Research Findings**:
- Graph conversion artifacts and Neo4j backend integration already exist in repository.
- Current conversion diagnostics showed no broken edges but many leaf/no-outgoing nodes that need classification.
- Key runtime surfaces are `/api/graph/backend`, `/api/graph/published`, `/api/problems?nodeId=...`.

### Metis Review
**Identified Gaps**:
- Metis consultation attempted but timed out repeatedly in this session.
- Gap review was completed via strict self-review fallback and encoded as explicit guardrails/acceptance criteria below.

---

## Work Objectives

### Core Objective
Establish high-confidence correctness for curriculum graph DB integration by proving structural integrity, semantic correctness of edges, cross-backend parity, and frontend usability under the Unit -> Skill -> Problem model.

### Concrete Deliverables
- Verification evidence bundle under `.sisyphus/evidence/`.
- Defect list with remediation actions and before/after proof.
- Updated graph artifacts/config only when defects are confirmed.
- Final release gate decision (approve/reject).

### Definition of Done
- [ ] All critical missing/wrong-link defects are either fixed or explicitly waived with rationale.
- [ ] sqlite and neo4j API parity checks pass for the agreed contract.
- [ ] Frontend research-graph renders and edits correctly for unit/skill/problem cases.
- [ ] Final verification wave returns APPROVE for all four reviewers.

### Must Have
- Deterministic, command-executable checks for every verification item.
- Explicit distinction between expected leaf nodes and true missing-link defects.
- Evidence paths for each QA scenario.

### Must NOT Have (Guardrails)
- No manual-only acceptance criteria.
- No breaking API contract changes during verification.
- No speculative feature scope (new recommendation engine, unrelated UX redesign).
- No destructive DB operations without backup/rollback path.
- Default execution target is staging/test first; production verification runs only after staging pass.

---

## Verification Strategy (MANDATORY)

> **ZERO HUMAN INTERVENTION** for acceptance checks. Every criterion is command/tool verifiable.

### Test Decision
- **Infrastructure exists**: YES
- **Automated tests**: YES (tests-after, with targeted test additions only if gaps are found)
- **Framework**: `pytest`, `vitest`, frontend build pipeline
- **Agent-Executed QA**: ALWAYS

### QA Policy
- **Backend/API**: Bash with `curl` + JSON assertions
- **Data Integrity**: Bash scripts and deterministic diff/check commands
- **Frontend UI**: Playwright scenarios for rendering/filter/editor behavior
- **Evidence**: `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`

---

## Execution Strategy

### Parallel Execution Waves

Wave 1 (Start immediately — baseline + structural audits):
- Task 1: Environment and backend mode baseline
- Task 2: Neo4j schema/constraints/index audit
- Task 3: Curriculum graph v2 structure validation
- Task 4: Link completeness and parent/contains consistency audit
- Task 5: Skill-problem linkage coverage audit
- Task 6: API smoke baseline in current backend mode

Wave 2 (After Wave 1 — parity + functional verification):
- Task 7: sqlite vs neo4j migration/idempotency parity
- Task 8: Endpoint contract parity diff across backends
- Task 9: Prerequisite traversal correctness validation
- Task 10: Research patch compatibility validation (unit/skill/problem)
- Task 11: Research-graph rendering validation (overview/editor)
- Task 12: Research editor create/export/import validation

Wave 3 (After Wave 2 — remediation + stabilization):
- Task 13: Apply data/model remediation for confirmed defects
- Task 14: Rebuild/reseed graph artifacts and rerun integrity checks
- Task 15: Full targeted regression suite and build verification
- Task 16: Verification report and release gate artifact

Wave FINAL (After all tasks — 4 parallel reviews):
- F1: Plan compliance audit
- F2: Code/data quality review
- F3: Real QA replay from scenarios
- F4: Scope fidelity check

Critical Path: 1 -> 6 -> 8 -> 13 -> 15 -> 16 -> F1-F4
Parallel Speedup: ~60% vs fully sequential execution
Max Concurrent: 6

### Dependency Matrix

- **1**: Blocked By — None | Blocks — 6, 7, 8
- **2**: Blocked By — None | Blocks — 7, 8, 13
- **3**: Blocked By — None | Blocks — 4, 5, 13, 14
- **4**: Blocked By — 3 | Blocks — 13, 14
- **5**: Blocked By — 3 | Blocks — 8, 13
- **6**: Blocked By — 1 | Blocks — 8, 11, 12
- **7**: Blocked By — 1,2 | Blocks — 8, 13
- **8**: Blocked By — 1,2,5,6,7 | Blocks — 13, 16
- **9**: Blocked By — 6 | Blocks — 13, 16
- **10**: Blocked By — 3,6 | Blocks — 12, 13
- **11**: Blocked By — 6 | Blocks — 16
- **12**: Blocked By — 6,10 | Blocks — 16
- **13**: Blocked By — 2,3,4,5,7,8,9,10 | Blocks — 14,15,16
- **14**: Blocked By — 3,4,13 | Blocks — 15,16
- **15**: Blocked By — 13,14 | Blocks — 16, F1-F4
- **16**: Blocked By — 8,9,11,12,13,14,15 | Blocks — F1-F4

### Agent Dispatch Summary

- **Wave 1**: T1 `quick`, T2 `unspecified-high`, T3 `quick`, T4 `deep`, T5 `deep`, T6 `quick`
- **Wave 2**: T7 `unspecified-high`, T8 `deep`, T9 `deep`, T10 `quick`, T11 `visual-engineering`, T12 `visual-engineering`
- **Wave 3**: T13 `deep`, T14 `quick`, T15 `unspecified-high`, T16 `writing`
- **FINAL**: F1 `oracle`, F2 `unspecified-high`, F3 `unspecified-high`, F4 `deep`

---

## TODOs

- [x] 1. Backend mode and runtime baseline capture

  **What to do**:
  - Capture current env matrix for `GRAPH_STORAGE_BACKEND`, `NEO4J_*`, backend URL, and frontend URL.
  - Record current branch commit SHA and deployment target.
  - Execute baseline endpoint checks to establish starting state.

  **Must NOT do**:
  - Do not mutate DB or switch backend mode in this task.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: deterministic environment snapshot and smoke checks.
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `playwright`: UI not required for this baseline task.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2-6)
  - **Blocks**: 6, 7, 8
  - **Blocked By**: None

  **References**:
  - `backend/app/api.py` - endpoint behaviors to validate.
  - `backend/NEO4J_GRAPH_BACKEND.md` - expected runtime env/cutover assumptions.

  **Acceptance Criteria**:
  - [ ] Baseline snapshot saved to `.sisyphus/evidence/task-1-backend-baseline.txt`.
  - [ ] `/api/graph/backend` and `/api/graph/published` response headers/status captured.

  **QA Scenarios**:
  ```
  Scenario: Baseline endpoints are reachable
    Tool: Bash (curl)
    Preconditions: Backend process running
    Steps:
      1. curl -sS -D .sisyphus/evidence/task-1-backend-headers.txt http://localhost:8000/api/graph/backend -o .sisyphus/evidence/task-1-backend.json
      2. curl -sS http://localhost:8000/api/graph/published -o .sisyphus/evidence/task-1-published.json
      3. Assert status line contains 200 in headers file
    Expected Result: Both files exist and backend endpoint is HTTP 200
    Failure Indicators: curl non-zero exit, missing files, status != 200
    Evidence: .sisyphus/evidence/task-1-backend.json

  Scenario: Service unavailable is detected cleanly
    Tool: Bash (curl)
    Preconditions: Point request to unused port 18000
    Steps:
      1. curl -sS --max-time 3 http://localhost:18000/api/graph/backend > .sisyphus/evidence/task-1-backend-error.txt 2>&1 || true
      2. Assert file contains connection failure text
    Expected Result: Failure captured, task marks environment as blocked
    Evidence: .sisyphus/evidence/task-1-backend-error.txt
  ```

  **Commit**: NO

- [x] 2. Neo4j schema constraints and index audit

  **What to do**:
  - Verify Unit/Skill/Problem uniqueness constraints and key indexes exist in target Neo4j DB.
  - Compare live constraints/indexes against `CURRICULUM_GRAPH_SCHEMA_V2.md` requirements.
  - Produce gap list with exact Cypher remediation statements.

  **Must NOT do**:
  - Do not apply schema changes in this audit task.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: schema correctness has high impact and multiple failure modes.
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `playwright`: not relevant to DB schema audit.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: 7, 8, 13
  - **Blocked By**: None

  **References**:
  - `backend/CURRICULUM_GRAPH_SCHEMA_V2.md` - canonical constraints/index requirements.
  - `backend/app/neo4j_graph.py` - current bootstrap/constraint implementation pattern.

  **Acceptance Criteria**:
  - [ ] Audit report saved to `.sisyphus/evidence/task-2-neo4j-schema-audit.md`.
  - [ ] Each required constraint/index marked present/missing.

  **QA Scenarios**:
  ```
  Scenario: List constraints and indexes from Neo4j
    Tool: Bash (neo4j-shell/cypher-shell)
    Preconditions: Neo4j reachable with credentials
    Steps:
      1. Run SHOW CONSTRAINTS and save output
      2. Run SHOW INDEXES and save output
      3. Compare against required list from schema doc
    Expected Result: Presence matrix with no ambiguity
    Failure Indicators: Auth failure, missing required entries, empty output
    Evidence: .sisyphus/evidence/task-2-neo4j-schema-audit.md

  Scenario: Missing-schema condition is explicitly surfaced
    Tool: Bash (diff/check script)
    Preconditions: Remove one required item from expected list mock
    Steps:
      1. Run comparison script against altered expected list
      2. Assert report flags mismatch as FAIL
    Expected Result: Missing item is highlighted in report
    Evidence: .sisyphus/evidence/task-2-neo4j-schema-audit.md
  ```

  **Commit**: NO

- [x] 3. Curriculum graph v2 structure and type mapping validation

  **What to do**:
  - Validate generated `curriculum_math_2022_graph_v2.json` shape, node-type mapping, and edge-type mapping.
  - Confirm all curriculum nodes are represented and no duplicate IDs exist.
  - Confirm problem nodes and `has_problem` edges are generated for mapped problems.

  **Must NOT do**:
  - Do not change source curriculum JSON in this task.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: deterministic artifact checks and scripted assertions.
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `oracle`: not required for straightforward structural assertions.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: 4, 5, 13, 14
  - **Blocked By**: None

  **References**:
  - `curriculum-viewer/scripts/convert-curriculum-2022-to-graph.mjs` - conversion logic and diagnostics fields.
  - `curriculum-viewer/public/data/curriculum_math_2022_graph_v2.json` - target artifact.
  - `curriculum-viewer/src/lib/curriculum2022/uspGraph.ts` - in-app mapping behavior.

  **Acceptance Criteria**:
  - [ ] Node/edge count, duplicate-id check, and mapping summary saved.
  - [ ] No malformed node types outside `unit|skill|problem`.

  **QA Scenarios**:
  ```
  Scenario: Conversion output passes structural assertions
    Tool: Bash (node script)
    Preconditions: conversion output exists
    Steps:
      1. Parse JSON and assert schemaVersion == curriculum-graph-v2
      2. Assert all nodeType values in {unit,skill,problem}
      3. Assert unique node ids and valid edge refs
    Expected Result: All assertions pass
    Failure Indicators: assertion error, invalid nodeType, unknown edge refs
    Evidence: .sisyphus/evidence/task-3-graph-structure.json

  Scenario: Invalid nodeType is detected
    Tool: Bash (temporary mutation + validator)
    Preconditions: create temp copy with one invalid nodeType
    Steps:
      1. Inject invalid nodeType into temp file
      2. Run validator script against temp file
      3. Assert validator reports fail
    Expected Result: Fail reason points to invalid nodeType
    Evidence: .sisyphus/evidence/task-3-graph-structure-error.txt
  ```

  **Commit**: NO

- [x] 4. Missing-link and parent-contains consistency audit

  **What to do**:
  - Verify that every node with `parentId` has a corresponding `contains` edge in graph v2.
  - Distinguish expected leaf nodes from true missing-link defects.
  - Build a defect table with node id, expected parent/edge, actual state, severity.

  **Must NOT do**:
  - Do not classify all leaves as defects; only missing required structural links are defects.

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: requires nuanced classification of structural vs semantic issues.
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `visual-engineering`: no UI implementation work in this task.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 1 (depends on Task 3 output)
  - **Blocks**: 13, 14
  - **Blocked By**: 3

  **References**:
  - `curriculum-viewer/public/data/curriculum_math_2022.json` - source `parentId` truth.
  - `curriculum-viewer/public/data/curriculum_math_2022_graph_v2.json` - converted edges to verify.

  **Acceptance Criteria**:
  - [ ] `.sisyphus/evidence/task-4-missing-link-audit.csv` created with complete classification.
  - [ ] Every reported defect has reproducible rule and severity.

  **QA Scenarios**:
  ```
  Scenario: ParentId to contains mapping completeness
    Tool: Bash (node script)
    Preconditions: source and converted JSON files available
    Steps:
      1. Build expected contains set from source parentId
      2. Compare to converted contains edges
      3. Export missing/extraneous rows
    Expected Result: Complete diff output generated
    Failure Indicators: script failure, empty report despite detected mismatches
    Evidence: .sisyphus/evidence/task-4-missing-link-audit.csv

  Scenario: False-positive guard for legitimate leaves
    Tool: Bash (node script)
    Preconditions: identify known terminal achievement nodes
    Steps:
      1. Run classification rule on leaf nodes
      2. Assert leaf nodes without required structural edges are NOT auto-failed
    Expected Result: leaves classified as expected-terminal where applicable
    Evidence: .sisyphus/evidence/task-4-leaf-classification.txt
  ```

  **Commit**: NO

- [x] 5. Skill-problem linkage coverage and orphan audit

  **What to do**:
  - Validate that each skill expected to have assessment has at least one linked problem.
  - Detect orphan problems not linked to existing skills.
  - Produce coverage metrics by gradeBand/domain.

  **Must NOT do**:
  - Do not require universal coverage for intentionally content-light skills unless policy says so.

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: combines structural validation with pedagogical coverage interpretation.
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `writing`: analysis/reporting only, no final doc publishing in this task.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 1 (depends on Task 3)
  - **Blocks**: 8, 13
  - **Blocked By**: 3

  **References**:
  - `curriculum-viewer/public/data/problems_2022_v1.json` - source problem mappings.
  - `curriculum-viewer/public/data/curriculum_math_2022_graph_v2.json` - generated has_problem/measures links.

  **Acceptance Criteria**:
  - [ ] Coverage report created at `.sisyphus/evidence/task-5-skill-problem-coverage.md`.
  - [ ] Orphan list created at `.sisyphus/evidence/task-5-orphans.csv`.

  **QA Scenarios**:
  ```
  Scenario: Coverage matrix generation
    Tool: Bash (node script)
    Preconditions: graph v2 and problems file available
    Steps:
      1. Count skills by gradeBand/domain
      2. Count skills with >=1 has_problem edge
      3. Emit coverage percentages
    Expected Result: Matrix generated with deterministic totals
    Failure Indicators: NaN percentages, missing sections, script errors
    Evidence: .sisyphus/evidence/task-5-skill-problem-coverage.md

  Scenario: Orphan detection catches unmapped problem nodeId
    Tool: Bash (node script)
    Preconditions: temp problem entry referencing unknown nodeId
    Steps:
      1. Add temp unmapped problem to temp file
      2. Run orphan detector
      3. Assert orphan row exists for temp id
    Expected Result: Unknown mapping appears in orphan report
    Evidence: .sisyphus/evidence/task-5-orphans.csv
  ```

  **Commit**: NO

- [x] 6. API smoke baseline for graph and problems endpoints

  **What to do**:
  - Exercise `/api/graph/backend`, `/api/graph/published`, `/api/problems?nodeId=...`.
  - Record response schema and key fields.
  - Create nodeId test set covering unit, skill, problem, unknown.

  **Must NOT do**:
  - Do not edit backend code in this task.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: endpoint smoke checks are command-driven and deterministic.
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `deep`: unnecessary for baseline endpoint assertions.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: 8, 9, 11, 12
  - **Blocked By**: 1

  **References**:
  - `backend/app/api.py` - endpoint contracts and expected status behavior.
  - `backend/app/models.py` - response shape for backend status.

  **Acceptance Criteria**:
  - [ ] Endpoint smoke evidence stored in `.sisyphus/evidence/task-6-api-smoke/`.
  - [ ] Unknown nodeId behavior is explicitly documented.

  **QA Scenarios**:
  ```
  Scenario: Valid nodeId returns expected payload
    Tool: Bash (curl)
    Preconditions: backend running with seeded data
    Steps:
      1. curl /api/graph/backend -> save JSON
      2. curl /api/graph/published -> save JSON
      3. curl /api/problems?nodeId=2수01-01 -> save JSON and assert non-empty list
    Expected Result: status 200 and expected keys present
    Failure Indicators: status != 200, missing keys, malformed JSON
    Evidence: .sisyphus/evidence/task-6-api-smoke/happy.json

  Scenario: Unknown nodeId handled gracefully
    Tool: Bash (curl)
    Preconditions: backend running
    Steps:
      1. curl /api/problems?nodeId=UNKNOWN_NODE
      2. Assert response is deterministic (empty list or documented error)
    Expected Result: no server error; behavior matches contract
    Evidence: .sisyphus/evidence/task-6-api-smoke/unknown-node.json
  ```

  **Commit**: NO

- [x] 7. sqlite-neo4j migration parity and idempotency verification

  **What to do**:
  - Run migration flow in a controlled environment twice.
  - Verify counts and key sample relationships remain stable after rerun.
  - Confirm no duplicate nodes/edges/problems introduced.

  **Must NOT do**:
  - Do not run directly on production without backup snapshot.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: DB migration parity/idempotency is high-risk verification.
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `visual-engineering`: no UI scope.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2
  - **Blocks**: 8, 13
  - **Blocked By**: 1, 2

  **References**:
  - `backend/scripts/migrate_graph_to_neo4j.py` - migration behavior.
  - `backend/app/db.py` and `backend/app/neo4j_graph.py` - storage representations to compare.

  **Acceptance Criteria**:
  - [ ] Idempotency evidence saved to `.sisyphus/evidence/task-7-idempotency.md`.
  - [ ] Re-run does not increase duplicate logical entities.

  **QA Scenarios**:
  ```
  Scenario: Migration parity first run
    Tool: Bash
    Preconditions: clean neo4j target and sqlite source available
    Steps:
      1. Run migrate_graph_to_neo4j.py
      2. Query counts of graph versions/nodes/edges/problems
      3. Save counts snapshot A
    Expected Result: migration completes successfully with non-zero counts
    Failure Indicators: script error, zero critical tables, missing graph version
    Evidence: .sisyphus/evidence/task-7-counts-run1.json

  Scenario: Idempotency second run
    Tool: Bash
    Preconditions: first run complete
    Steps:
      1. Run migration script again with same source
      2. Query counts snapshot B
      3. Assert A == B for logical entity counts
    Expected Result: no unexpected growth due to duplicates
    Evidence: .sisyphus/evidence/task-7-counts-run2.json
  ```

  **Commit**: NO

- [x] 8. Cross-backend endpoint contract parity diff

  **What to do**:
  - Compare key endpoint outputs between `GRAPH_STORAGE_BACKEND=sqlite` and `neo4j`.
  - Validate required fields, cardinality, and stable semantics.
  - Produce parity diff report with severity labels.

  **Must NOT do**:
  - Do not require byte-identical ordering when order is not contractually guaranteed.

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: semantic equivalence checks need careful diff rules.
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `quick`: insufficient for semantic parity analysis.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2
  - **Blocks**: 13, 16
  - **Blocked By**: 1, 2, 5, 6, 7

  **References**:
  - `backend/app/graph_storage.py` - backend switch logic.
  - `backend/app/api.py` - response contract points.
  - `backend/tests/test_graph_api.py` - baseline expectations.

  **Acceptance Criteria**:
  - [ ] Parity report saved to `.sisyphus/evidence/task-8-backend-parity.md`.
  - [ ] Any divergence is tagged as expected/defect with rationale.

  **QA Scenarios**:
  ```
  Scenario: Parity diff for published graph
    Tool: Bash (curl + jq/script)
    Preconditions: both backend modes accessible
    Steps:
      1. Capture /api/graph/published from sqlite mode
      2. Capture /api/graph/published from neo4j mode
      3. Compare required fields and normalized node/edge sets
    Expected Result: parity pass or actionable diff list
    Failure Indicators: missing required fields, major count drift, schema mismatch
    Evidence: .sisyphus/evidence/task-8-backend-parity.md

  Scenario: Problems endpoint semantic parity
    Tool: Bash (curl)
    Preconditions: nodeId sample set prepared
    Steps:
      1. Query /api/problems for each sample nodeId on both backends
      2. Compare problem ids and response semantics
    Expected Result: documented parity or explicit defect records
    Evidence: .sisyphus/evidence/task-8-problems-parity.json
  ```

  **Commit**: NO

- [x] 9. Prerequisite traversal correctness validation

  **What to do**:
  - Validate `REQUIRES`/`PREPARES_FOR` traversal results for representative skill nodes.
  - Verify depth-limited traversal outputs against expected prerequisite chains.
  - Flag cycles, broken references, and directionality mistakes.

  **Must NOT do**:
  - Do not run unbounded traversal queries in production-like environments.

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: graph traversal correctness is logic-heavy and error-prone.
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `writing`: not documentation-focused.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: 13, 16
  - **Blocked By**: 6

  **References**:
  - `backend/CURRICULUM_GRAPH_SCHEMA_V2.md` - expected relationship semantics.
  - `backend/app/neo4j_graph.py` - query/mapping behavior for graph retrieval.

  **Acceptance Criteria**:
  - [ ] Traversal validation report at `.sisyphus/evidence/task-9-traversal.md`.
  - [ ] Directionality and depth checks pass for selected fixtures.

  **QA Scenarios**:
  ```
  Scenario: Two-hop prerequisite closure correctness
    Tool: Bash (Cypher query)
    Preconditions: Neo4j populated
    Steps:
      1. Run depth-limited REQUIRES traversal for selected skill ids
      2. Compare output to expected fixture list
    Expected Result: expected prerequisite set matches
    Failure Indicators: missing expected prerequisites, reversed direction links
    Evidence: .sisyphus/evidence/task-9-traversal.md

  Scenario: Cycle/bad-edge detection
    Tool: Bash (validation query)
    Preconditions: graph loaded
    Steps:
      1. Run cycle check query on REQUIRES edges
      2. Assert no invalid cycles unless explicitly whitelisted
    Expected Result: no unexpected cycles
    Evidence: .sisyphus/evidence/task-9-cycle-check.txt
  ```

  **Commit**: NO

- [x] 10. Research patch compatibility validation for unit/skill/problem

  **What to do**:
  - Validate patch schema accepts only allowed node types (`unit|skill|problem|textbookUnit`).
  - Verify apply/export/editor-state roundtrip preserves node type and ids.
  - Ensure backward compatibility for existing patch files.

  **Must NOT do**:
  - Do not silently coerce invalid node types into valid ones.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: primarily test and schema verification on local modules.
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `oracle`: not needed for module-level compatibility checks.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: 12, 13
  - **Blocked By**: 3, 6

  **References**:
  - `curriculum-viewer/src/lib/research/schema.ts` - patch schema validation.
  - `curriculum-viewer/src/lib/research/applyResearchPatch.ts` - patch application path.
  - `curriculum-viewer/src/lib/research/patchExport.ts` - export shape.
  - `curriculum-viewer/src/lib/research/editorState.ts` - persisted editor state normalization.

  **Acceptance Criteria**:
  - [ ] Compatibility test evidence stored in `.sisyphus/evidence/task-10-research-compat.txt`.
  - [ ] Invalid node type scenario fails with explicit schema issue.

  **QA Scenarios**:
  ```
  Scenario: Roundtrip preserves node types
    Tool: Bash (vitest)
    Preconditions: test files available
    Steps:
      1. Run targeted tests for schema/apply/export/editorState
      2. Assert all tests pass
    Expected Result: roundtrip and schema tests are green
    Failure Indicators: failed snapshots, nodeType coercion mismatch
    Evidence: .sisyphus/evidence/task-10-research-compat.txt

  Scenario: Invalid node type rejected
    Tool: Bash (vitest targeted test)
    Preconditions: invalid nodeType fixture/test active
    Steps:
      1. Run schema test for invalid nodeType
      2. Assert issue code includes invalid_node_type
    Expected Result: validator rejects invalid value with deterministic code
    Evidence: .sisyphus/evidence/task-10-invalid-node-type.txt
  ```

  **Commit**: NO

- [x] 11. Research-graph rendering verification (overview/editor)

  **What to do**:
  - Verify research graph renders unit, skill, and problem nodes without blank/hidden states.
  - Validate count indicators and source/backend badges.
  - Confirm filtering does not accidentally remove newly typed nodes.

  **Must NOT do**:
  - Do not rely on visual-only judgment without explicit DOM/assertion checks.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI rendering behavior and selector-level assertions.
  - **Skills**: [`playwright`]
    - `playwright`: needed for browser-level evidence capture.
  - **Skills Evaluated but Omitted**:
    - `deep`: lower value than direct browser assertions for this task.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: 16
  - **Blocked By**: 6

  **References**:
  - `curriculum-viewer/src/pages/AuthorResearchGraphPage.tsx` - render/filter/count logic.
  - `curriculum-viewer/src/lib/researchGraph/nodeLabel.tsx` - node label rendering.

  **Acceptance Criteria**:
  - [ ] Playwright evidence in `.sisyphus/evidence/task-11-render/` with screenshots and assertion logs.
  - [ ] No blank canvas or missing-node render regression in overview/editor modes.

  **QA Scenarios**:
  ```
  Scenario: Overview/editor modes render graph and badges
    Tool: Playwright
    Preconditions: frontend and backend running locally
    Steps:
      1. Open /author/research-graph
      2. Assert selector `[aria-label="Research graph canvas"]` exists and is visible
      3. Assert page text matches `nodes:` and `graph backend:` summary lines
      4. Click the control that toggles to editor mode and assert canvas remains visible
    Expected Result: both modes render non-empty graph and status text
    Failure Indicators: empty canvas, missing status text, JS error overlay
    Evidence: .sisyphus/evidence/task-11-render/happy.png

  Scenario: Node-type visibility guard
    Tool: Playwright
    Preconditions: page loaded with unit/skill/problem data
    Steps:
      1. Toggle domain filter checkbox for one domain and set depth min/max controls
      2. Assert nodes with class `.research-node-label` remain present after filtering
      3. Reset filters and assert count text increases or stays equal, never drops to zero unexpectedly
    Expected Result: filters do not incorrectly hide entire typed subsets
    Evidence: .sisyphus/evidence/task-11-render/filter-check.json
  ```

  **Commit**: NO

- [x] 12. Research editor create-export-import flow validation

  **What to do**:
  - Validate proposed-node creation for `unit|skill|problem` from UI.
  - Verify exported patch JSON reflects chosen node type.
  - Verify persisted editor state restores node type accurately.

  **Must NOT do**:
  - Do not hardcode UI defaults that mask incorrect type selection.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: interaction flow and output verification in browser UI.
  - **Skills**: [`playwright`]
  - **Skills Evaluated but Omitted**:
    - `quick`: lacks browser interaction depth.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2 (depends on schema compatibility)
  - **Blocks**: 16
  - **Blocked By**: 6, 10

  **References**:
  - `curriculum-viewer/src/pages/AuthorResearchGraphPage.tsx` - add-proposed flow.
  - `curriculum-viewer/src/lib/curriculum2022/proposedNodes.ts` - id generation by type.
  - `curriculum-viewer/src/lib/research/editorState.ts` - persisted state behavior.

  **Acceptance Criteria**:
  - [ ] UI interaction evidence saved under `.sisyphus/evidence/task-12-editor-flow/`.
  - [ ] Export JSON contains selected nodeType values and valid ids.

  **QA Scenarios**:
  ```
  Scenario: Create and export proposed nodes by type
    Tool: Playwright
    Preconditions: editor mode enabled
    Steps:
      1. Click `Proposed 노드 추가` button
      2. Fill `label` input, select `node type=unit`, submit `생성`
      3. Repeat with `node type=problem`
      4. Click `Export JSON` and assert textarea contains `"nodeType": "unit"` and `"nodeType": "problem"`
    Expected Result: exported patch preserves selected types
    Failure Indicators: nodeType always defaults incorrectly, missing add_nodes entries
    Evidence: .sisyphus/evidence/task-12-editor-flow/export.json

  Scenario: Reload preserves node types from local state
    Tool: Playwright
    Preconditions: nodes created and state saved
    Steps:
      1. Reload page
      2. Click `Export JSON`
      3. Assert textarea still contains previously created `nodeType` values
    Expected Result: persisted state roundtrip is lossless for nodeType
    Evidence: .sisyphus/evidence/task-12-editor-flow/reload-check.png
  ```

  **Commit**: NO

- [x] 13. Remediate confirmed missing/wrong-link defects

  **What to do**:
  - Apply targeted fixes only for defects confirmed by Tasks 4,5,8,9,10.
  - Fix conversion/mapping logic or source graph data based on root cause.
  - Record each fix with defect id and verification reference.

  **Must NOT do**:
  - Do not introduce feature changes outside verification remediation scope.

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: root-cause remediation spans mapping, data, and contract logic.
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `visual-engineering`: remediation is primarily data/backend logic.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3
  - **Blocks**: 14, 15, 16
  - **Blocked By**: 2, 3, 4, 5, 7, 8, 9, 10

  **References**:
  - `curriculum-viewer/scripts/convert-curriculum-2022-to-graph.mjs` - conversion logic for link generation.
  - `backend/app/neo4j_graph.py` - neo4j graph persistence/query behavior.
  - `.sisyphus/evidence/task-4-missing-link-audit.csv` - defect source.

  **Acceptance Criteria**:
  - [ ] Remediation log saved to `.sisyphus/evidence/task-13-remediation-log.md`.
  - [ ] Each applied fix references a specific failed scenario.

  **QA Scenarios**:
  ```
  Scenario: Defect-driven fix validation
    Tool: Bash (targeted command/test rerun)
    Preconditions: at least one confirmed defect exists
    Steps:
      1. Apply fix for defect D-xxx
      2. Re-run only the failing check
      3. Assert check now passes and no new failures introduced
    Expected Result: defect status changed from FAIL to PASS
    Failure Indicators: unchanged failure or collateral regressions
    Evidence: .sisyphus/evidence/task-13-remediation-log.md

  Scenario: Scope guard
    Tool: Bash (git diff inspection)
    Preconditions: remediation changes staged
    Steps:
      1. Inspect changed files list
      2. Assert files map to remediation scope only
    Expected Result: no unrelated file modifications
    Evidence: .sisyphus/evidence/task-13-scope-guard.txt
  ```

  **Commit**: YES (groups with 14)
  - Message: `fix(graph): remediate verified link integrity defects`

- [x] 14. Rebuild graph artifacts and reseed/reload target graph state

  **What to do**:
  - Regenerate `curriculum_math_2022_graph_v2.json` after remediation.
  - Re-run migration/reload process as needed for target backend.
  - Re-run structural audits (Tasks 3 and 4 checks) to confirm stabilization.

  **Must NOT do**:
  - Do not skip regeneration when converter/data logic changed.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: deterministic regeneration and rerun commands.
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `deep`: logic work already completed in Task 13.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3
  - **Blocks**: 15, 16
  - **Blocked By**: 3, 4, 13

  **References**:
  - `curriculum-viewer/package.json` - conversion script entrypoint.
  - `backend/scripts/migrate_graph_to_neo4j.py` - reload path.

  **Acceptance Criteria**:
  - [ ] New artifact and reload evidence saved under `.sisyphus/evidence/task-14-rebuild/`.
  - [ ] Structural checks show no previously failing critical defects.

  **QA Scenarios**:
  ```
  Scenario: Regenerate artifact and verify deterministic output
    Tool: Bash
    Preconditions: remediation merged locally
    Steps:
      1. Run npm --prefix curriculum-viewer run convert:curriculum:graph
      2. Capture node/edge counts and diagnostics
      3. Save output summary
    Expected Result: conversion succeeds and diagnostics captured
    Failure Indicators: conversion failure, malformed output, missing file
    Evidence: .sisyphus/evidence/task-14-rebuild/conversion.txt

  Scenario: Reload graph DB and rerun integrity check
    Tool: Bash
    Preconditions: target backend credentials configured
    Steps:
      1. Run migration/reload command
      2. Re-run Task 3/4 validators
      3. Assert prior critical defects are absent
    Expected Result: post-fix state stable
    Evidence: .sisyphus/evidence/task-14-rebuild/post-reload-check.txt
  ```

  **Commit**: YES (groups with 13)
  - Message: `chore(graph): regenerate v2 artifact and revalidate post-fix`

- [x] 15. Targeted regression suite and build validation

  **What to do**:
  - Run backend tests, frontend targeted tests, and frontend build.
  - Include graph/research modules touched by remediation.
  - Record complete pass/fail output and duration.

  **Must NOT do**:
  - Do not mark task complete with partial test execution.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: broad regression gate before sign-off.
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `visual-engineering`: this is test/build execution, not UI design changes.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3
  - **Blocks**: 16, F1-F4
  - **Blocked By**: 13, 14

  **References**:
  - `backend/tests/test_graph_api.py` - backend API integrity checks.
  - `backend/tests/test_graph_storage_backend.py` - storage backend coverage.
  - `curriculum-viewer/src/lib/curriculum2022/*.test.ts` - converter/loading tests.
  - `curriculum-viewer/src/lib/research/*.test.ts` - patch/editor schema tests.

  **Acceptance Criteria**:
  - [ ] All designated tests/build pass and logs saved.
  - [ ] Regression evidence in `.sisyphus/evidence/task-15-regression/`.

  **QA Scenarios**:
  ```
  Scenario: Backend regression suite pass
    Tool: Bash
    Preconditions: backend venv ready
    Steps:
      1. Run backend/.venv/bin/pytest backend/tests/test_graph_api.py backend/tests/test_graph_storage_backend.py -q
      2. Save output log
    Expected Result: all tests pass
    Failure Indicators: any failed test or import/runtime error
    Evidence: .sisyphus/evidence/task-15-regression/backend-tests.txt

  Scenario: Frontend regression + build pass
    Tool: Bash
    Preconditions: frontend deps installed
    Steps:
      1. Run targeted vitest set
      2. Run npm --prefix curriculum-viewer run build
      3. Save logs
    Expected Result: tests and build pass
    Evidence: .sisyphus/evidence/task-15-regression/frontend-tests-build.txt
  ```

  **Commit**: YES
  - Message: `test(graph): add regression evidence for verification gates`

- [x] 16. Publish verification report and release gate decision

  **What to do**:
  - Consolidate outcomes from Tasks 1-15 into a single verification report.
  - Provide explicit release gate: APPROVE / REJECT with blocking reasons.
  - List remaining risks and follow-up actions if any.

  **Must NOT do**:
  - Do not mark APPROVE if any critical scenario is still failing.

  **Recommended Agent Profile**:
  - **Category**: `writing`
    - Reason: final synthesis and decision clarity.
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `deep`: analysis already done; this is decision documentation.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3
  - **Blocks**: F1-F4
  - **Blocked By**: 8, 9, 11, 12, 13, 14, 15

  **References**:
  - `.sisyphus/evidence/` - all task evidence.
  - `backend/CURRICULUM_GRAPH_SCHEMA_V2.md` - target correctness model.

  **Acceptance Criteria**:
  - [ ] Report file exists with verdict and blocker table.
  - [ ] Every blocker maps to specific failing evidence file.

  **QA Scenarios**:
  ```
  Scenario: Report completeness check
    Tool: Bash (structured checklist script)
    Preconditions: evidence directory populated
    Steps:
      1. Verify expected evidence files exist for Tasks 1-15
      2. Verify report includes pass/fail summary and verdict
    Expected Result: completeness checklist passes
    Failure Indicators: missing evidence references or missing verdict
    Evidence: .sisyphus/evidence/task-16-report-completeness.txt

  Scenario: Gate integrity check
    Tool: Bash (consistency script)
    Preconditions: report drafted
    Steps:
      1. Parse report for blockers marked critical
      2. Assert verdict != APPROVE when critical blockers exist
    Expected Result: verdict logic is internally consistent
    Evidence: .sisyphus/evidence/task-16-gate-integrity.txt
  ```

  **Commit**: YES
  - Message: `docs(graph): publish verification verdict and blocker matrix`

---

## Final Verification Wave (MANDATORY)

> Run all four reviews in parallel. All must return APPROVE before completion.
> Present consolidated results and wait for explicit user okay before closing verification.

- [x] F1. **Plan Compliance Audit** — `oracle`
  Read this plan end-to-end. Verify every Must Have is evidenced and every Must NOT Have is absent.
  Validate that each Task (1-16) has corresponding evidence files and acceptance checks.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [x] F2. **Code/Data Quality Review** — `unspecified-high`
  Run backend/frontend test+build gates and inspect graph artifacts for duplicate ids, broken refs, and anti-patterns.
  Output: `Backend [PASS/FAIL] | Frontend [PASS/FAIL] | Data Integrity [PASS/FAIL] | VERDICT`

- [x] F3. **Real QA Replay** — `unspecified-high`
  Execute every QA scenario listed in Tasks 1-16 and confirm evidence exists for each.
  Include integration checks across backend+frontend.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Evidence [N/N] | VERDICT`

- [x] F4. **Scope Fidelity Check** — `deep`
  Compare actual diffs/artifacts against scope boundaries in this plan.
  Flag any scope creep or missing planned verification actions.
  Output: `Scope Compliance [N/N] | Creep [CLEAN/N issues] | Missing [0/N] | VERDICT`

---

## Commit Strategy

- **C1**: `test(graph): add integrity and parity verification harness`
  - Files: verification scripts/tests only
  - Gate: tests pass
- **C2**: `fix(graph): remediate missing or incorrect curriculum links`
  - Files: graph data/model corrections only
  - Gate: parity and integrity checks pass
- **C3**: `docs(graph): publish verification report and release gate`
  - Files: report artifacts/docs only
  - Gate: final verification wave approved

---

## Success Criteria

### Verification Commands
```bash
backend/.venv/bin/pytest backend/tests/test_graph_api.py backend/tests/test_graph_storage_backend.py -q
npm --prefix curriculum-viewer run test -- src/lib/curriculum2022/graph.test.ts src/lib/curriculum2022/uspGraph.test.ts src/lib/research/schema.test.ts
npm --prefix curriculum-viewer run build
npm --prefix curriculum-viewer run convert:curriculum:graph
curl -sS http://localhost:8000/api/graph/backend
curl -sS http://localhost:8000/api/graph/published
curl -sS "http://localhost:8000/api/problems?nodeId=2수01-01"
```

### Final Checklist
- [ ] Missing-link defects triaged and resolved or waived
- [ ] Wrong-link defects triaged and resolved or waived
- [ ] Endpoint parity accepted for sqlite/neo4j
- [ ] Frontend research graph behavior validated for unit/skill/problem
- [ ] Final verification wave approved
