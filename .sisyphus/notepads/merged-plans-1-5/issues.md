# Issues

- A prior delegation prompt included strict refusal scaffolding and resulted in no useful work; keep prompts focused on concrete atomic changes without meta refusal blocks.

---

## Implementation Markers Search Results (2026-03-05)

### HIGH SEVERITY

**Backend - Incomplete Auth Integration**
- `/mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/backend/app/api.py` line 1108
  - Finding: `# TODO: Get from auth context`
  - Context: `create_homework_assignment()` call with hardcoded `created_by="admin"`
  - Risk: When merging with auth workstream, homework assignments will all be created by "admin" user instead of actual authenticated user
  - Action: Wire up auth context before merge

### MEDIUM SEVERITY

**Plugin - Future Migration TODO**
- `/mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/.plugins/oh-my-opencode-ulr/src/features/hook-message-injector/injector.ts` lines 53-56
  - Finding: `// TODO: These SDK-based functions are exported for future use when hooks migrate to async.`
  - Context: Documented technical debt for async hook migration
  - Risk: Known limitation, not blocking but requires future refactor
  - Action: Track for post-merge cleanup

### LOW SEVERITY (Test Files - Acceptable)

**curriculum-viewer - Test Type Assertions**
All `as any[]` usages are in test files only (acceptable for test mocking):
- `/mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/curriculum-viewer/src/pages/HealthPage.test.tsx` line 83
- `/mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/curriculum-viewer/src/lib/curriculum/graphLayout.test.ts` lines 12, 45
- `/mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/curriculum-viewer/src/lib/curriculum/progression.test.ts` lines 35, 46, 62, 72
- `/mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/curriculum-viewer/src/lib/curriculum/graphView.test.ts` lines 12, 22

### CLEAN - No Issues Found

Priority files scanned with zero markers:
- `curriculum-viewer/src/pages/AuthorHomeworkStatusPage.tsx` - CLEAN
- `curriculum-viewer/src/pages/AuthorResearchGraphPage.tsx` - CLEAN
- `curriculum-viewer/src/pages/AuthorHomeworkPage.tsx` - CLEAN
- `curriculum-viewer/src/lib/homework/types.ts` - CLEAN
- No console.log statements in curriculum-viewer/src

### Summary

| Severity | Count | Blocker for Merge? |
|----------|-------|-------------------|
| HIGH     | 1     | YES - api.py line 1108 |
| MEDIUM   | 1     | No - documented debt |
| LOW      | 4     | No - test files |
| CLEAN    | 4     | N/A |


## Blockers and Risks (2026-03-05)

### CRITICAL: Missing Workstream A Plan
- Workstream A (homework-log-rendering-fix) source plan file NOT FOUND
- Mentioned in merged-plans-1-5.md as `.sisyphus/plans/homework-log-rendering-fix.md` but file does not exist
- **Impact**: Cannot execute Workstream A without this plan file
- **Action needed**: Either create the plan file or confirm it was removed/renamed

### Workstream C: Page Integration Pending
- Helper files (viewMode, edgeLod, nodeLabel, toggle) ALREADY EXIST
- BUT main page `AuthorResearchGraphPage.tsx` NOT YET UPDATED with overview mode
- **Impact**: Tasks 1-5 largely complete; Task 6 (integration) is blocking final verification
- **Risk**: E2E tests exist but may fail until page integration complete

### Workstream B: Date Helper Already Exists
- `dueAt.ts` and `dueAt.test.ts` already exist in the codebase
- **Impact**: Wave 1 may be largely complete; verify before executing
- **Risk**: Need to confirm existing implementation matches plan requirements

### Overlap Coordination Risk
- Multiple workstreams touch AuthorHomeworkStatusPage.tsx and AuthorHomeworkPage.tsx
- **Risk**: Without careful sequencing, could cause merge conflicts
- **Mitigation**: Follow recommended order (D before A before B)

### Workstream D: Backend-Heavy
- Largest workstream with 12 tasks across 3 waves
- **Risk**: Longest execution time; many dependencies between tasks
- **Mitigation**: Follow wave structure strictly

### Workstream E: Plugin Independence
- This workstream is fully independent of others
- **Benefit**: Can execute in parallel without coordination concerns

### Orchestration Tooling Reliability (2026-03-05)
- Repeated `task()` execution attempts timed out with non-actionable output and no targeted file delivery.
- Practical mitigation for Task 1 was direct tool-based execution with strict scope control and evidence capture.

### Railway Header Error Repro Status (2026-03-05)
- The `exclude-patterns` non-printable ASCII header error did not reproduce on `railway up` using Railway CLI `4.30.1`.

### Railway Deploy Blocker Reproduced Again (2026-03-06)
- During Workstream A Task 13 deployment attempts, `railway up` repeatedly failed at build-context load with:
  - `header key "exclude-patterns" contains value with non-printable ASCII characters`
- Additional upload variants (`--path-as-root`, `--no-gitignore`) either reproduced the same issue or hit 413 payload-too-large.
- Result: Local verification complete, but production asset hash/markers did not roll forward in this session.

### Railway Deploy Blocker Resolved (2026-03-06)
- Root cause was deploy-context mismatch in monorepo uploads and oversized/dirty upload context.
- Resolution: deploy from a clean temporary monorepo root containing only `curriculum-viewer/` as a subdirectory, keeping service rootDirectory as `curriculum-viewer`.
- Verified successful deployment ID: `e4bf5de5-e098-4a9e-9593-029627bd5724`.
