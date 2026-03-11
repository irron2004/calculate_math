# Learnings

- For merged execution, execute source-plan subtasks atomically and verify after each subtask to avoid wide unintended edits.
- Workstream E Task 1 doc already exists at `docs/ulr-ultra-research-plan.md`; validated by content search for Round 0-3 headings and ULR markers.

## Codebase Footprint Discovery (2026-03-05)

### Workstream A: Math-friendly Rendering (homework-log-rendering-fix)
- **STATUS**: Source plan file NOT FOUND in .sisyphus/plans/
- **Known target pages** (from merged plan):
  - `curriculum-viewer/src/pages/PlacementTestPage.tsx` (fraction rendering)
  - `curriculum-viewer/src/pages/AuthorHomeworkStatusPage.tsx` (formatting)
  - `curriculum-viewer/src/pages/AuthorHomeworkPage.tsx` (author previews)
- **Tests needed**: Vitest for renderer, Playwright smoke
- **Key dependency**: Workstream D types must land first

### Workstream B: Due Date +7d Extension (homework-due-date-extend-1w)
- **Source plan**: EXISTS at `.sisyphus/plans/homework-due-date-extend-1w.md`
- **Implementation files**:
  - `/mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/curriculum-viewer/src/pages/AuthorHomeworkStatusPage.tsx` - UI button
  - `/mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/curriculum-viewer/src/lib/homework/dueAt.ts` - date helper (ALREADY EXISTS)
  - `/mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/curriculum-viewer/src/lib/homework/dueAt.test.ts` - unit tests (ALREADY EXISTS)
  - `/mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/curriculum-viewer/src/lib/homework/api.ts` - PATCH call
- **Backend files**:
  - `/mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/backend/app/api.py` - update_admin_assignment()
  - `/mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/backend/tests/test_homework_api.py` - regression tests
- **E2E tests**: None specific yet, uses existing homework flow
- **Wave structure**: 2 waves (Wave 1: backend test + date helper, Wave 2: UI wiring)

### Workstream C: Research Graph Readability (research-graph-readability)
- **Source plan**: EXISTS at `.sisyphus/plans/research-graph-readability.md`
- **Implementation files** (PARTIALLY COMPLETE):
  - `/mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/curriculum-viewer/src/lib/researchGraph/viewMode.ts` - ALREADY EXISTS
  - `/mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/curriculum-viewer/src/lib/researchGraph/viewMode.test.ts` - ALREADY EXISTS
  - `/mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/curriculum-viewer/src/lib/researchGraph/edgeLod.ts` - ALREADY EXISTS
  - `/mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/curriculum-viewer/src/lib/researchGraph/edgeLod.test.ts` - ALREADY EXISTS
  - `/mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/curriculum-viewer/src/lib/researchGraph/nodeLabel.tsx` - ALREADY EXISTS
  - `/mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/curriculum-viewer/src/lib/researchGraph/nodeLabel.test.tsx` - ALREADY EXISTS
  - `/mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/curriculum-viewer/src/components/ResearchGraphModeToggle.tsx` - needs verification
  - `/mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/curriculum-viewer/src/components/ResearchGraphModeToggle.test.tsx` - ALREADY EXISTS
- **Main page integration**: `/mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/curriculum-viewer/src/pages/AuthorResearchGraphPage.tsx` - NOT YET UPDATED
- **E2E tests**:
  - `/mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/curriculum-viewer/e2e/research-graph-overview.spec.ts` - EXISTS
  - `/mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/curriculum-viewer/e2e/research-graph-node-guides.spec.ts` - EXISTS

### Workstream D: Problem Bank + Per-Student Assignment (homework-problem-bank-assignment)
- **Source plan**: EXISTS at `.sisyphus/plans/homework-problem-bank-assignment.md`
- **Backend files**:
  - `/mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/backend/app/models.py` - DTOs
  - `/mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/backend/app/db.py` - problem bank functions
  - `/mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/backend/app/api.py` - admin endpoints
  - `/mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/backend/tests/test_homework_problem_bank_api.py` - EXISTS
  - `/mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/backend/tests/test_homework_problem_bank_labels.py` - EXISTS
  - `/mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/backend/tests/test_homework_problem_bank_import.py` - EXISTS
  - `/mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/backend/tests/test_homework_weekly_validator.py` - EXISTS
  - `/mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/backend/tests/test_homework_problem_bank_db.py` - EXISTS
- **Frontend files**:
  - `/mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/curriculum-viewer/src/lib/homework/types.ts` - type split needed
  - `/mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/curriculum-viewer/src/pages/AuthorHomeworkPage.tsx` - problem bank UI
  - `/mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/curriculum-viewer/src/pages/AuthorHomeworkStatusPage.tsx` - student assignment
- **E2E tests**:
  - `/mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/curriculum-viewer/e2e/homework-problem-bank.spec.ts` - EXISTS

### Workstream E: OpenCode Ultra Research Process (opencode-ultra-research-process)
- **Source plan**: EXISTS at `.sisyphus/plans/opencode-ultra-research-process.md`
- **Documentation**: `docs/ulr-ultra-research-plan.md` - ALREADY EXISTS (per prior notepad)
- **Plugin files**:
  - `/mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/.plugins/oh-my-opencode-ulr/src/hooks/keyword-detector/hook.ts` - injection
  - `/mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/.plugins/oh-my-opencode-ulr/src/hooks/keyword-detector/detector.ts` - detection
  - `/mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/.plugins/oh-my-opencode-ulr/src/hooks/keyword-detector/constants.ts` - registry
  - `/mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/.plugins/oh-my-opencode-ulr/src/hooks/keyword-detector/ultra-research/default.ts` - ULR message
  - `/mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/.plugins/oh-my-opencode-ulr/src/hooks/keyword-detector/index.test.ts` - EXISTS
- **Test command**: `cd .plugins/oh-my-opencode-ulr && bun test`

### OVERLAP FILES (Critical Sequencing)

| File | Workstreams | Sequencing Guardrail |
|------|-------------|---------------------|
| `curriculum-viewer/src/pages/AuthorHomeworkStatusPage.tsx` | A (formatting), B (due date button) | Land B UI first, then A formatting |
| `curriculum-viewer/src/pages/AuthorResearchGraphPage.tsx` | C (overview mode), A (prompt formatting) | Implement C structural changes first |
| `curriculum-viewer/src/pages/AuthorHomeworkPage.tsx` | D (problem bank), A (previews) | D types must land before A |
| `curriculum-viewer/src/lib/homework/types.ts` | D (type split), A (author previews) | D types first |

### Recommended Execution Order (from merged plan)

1. **Workstream E** (plugin) - INDEPENDENT, can run parallel with all
2. **Workstream D** - Foundation/backend contracts early (types + DTO separation)
3. **Workstream C** - Structural page changes (AuthorResearchGraphPage)
4. **Workstream A** - Renderer + CSS early; apply page formatting AFTER D/C land
5. **Workstream B** - Coordinated with A for AuthorHomeworkStatusPage overlap
6. **Cross-Workstream Integration Pass** - Final verification

### Test Commands Summary

```bash
# Frontend
cd curriculum-viewer && npm run test
cd curriculum-viewer && npm run build
cd curriculum-viewer && npm run test:e2e

# Backend
pytest backend/tests -q

# Plugin
cd .plugins/oh-my-opencode-ulr && bun test
cd .plugins/oh-my-opencode-ulr && bun run typecheck
```

---

## Math-Text Rendering Research (2026-03-05)

### Existing Implementation
- **File**: `curriculum-viewer/src/lib/math/renderMathText.tsx`
- **Current support**: `log_()` subscript pattern only (regex: `/log_\(([^)]+)\)|log_([^\s]+)/gi`)
- **Test file**: `renderMathText.test.tsx` - covers log_3, log_(x+1), plain text

### Authoritative References

#### 1. KaTeX (Official)
- **Docs**: https://katex.org/docs/options
- **Security**: https://katech.org/docs/security
- **Key options**:
  - `displayMode`: true for block math, false for inline
  - `throwOnError`: false (render errors gracefully as text)
  - `errorColor`: "#cc0000" for error display
  - `trust`: false by default (blocks `\includegraphics`, `\href`)
  - `maxSize`: prevents large visual affronts
  - `maxExpand`: 1000 default (prevents infinite macro loops)

#### 2. KaTeX React Integration (Production Patterns)
- **@shiueo/react-katex**: https://github.com/shiueo/react-katex
  - TypeScript-native, supports error handling callbacks
  - Example: `<KaTeXComponent block={true} math="\frac{-b \pm \sqrt{b^2 - 4ac}}{2a}" />`
- **react-katex** (talyssonoc): https://www.npmjs.com/package/react-katex
  - 126K weekly downloads, 181 dependents
  - Provides `<InlineMath>` and `<BlockMath>` components

#### 3. Real-World Implementation Examples (GitHub)
- **CopilotKit** (Line 305): Uses regex replacement `\$\$([\s\S]*?)\$\$` for block math
- **Zettlr**: `katex.render(equation, element, { throwOnError: false, displayMode })`
- **slidevjs**: Auto-detects inline `$` vs block `$$` delimiters

### XSS Guardrails

#### React-Safe Patterns
1. **React escapes by default**: JSX `{content}` automatically escapes HTML
2. **Avoid dangerouslySetInnerHTML**: Unless absolutely necessary
3. **DOMPurify + html-react-parser**: For trusted HTML content
   - Source: https://blog.openreplay.com/securing-react-with-dompurify

#### KaTeX Security Notes
- KaTeX output "should be safe" from script injection (official)
- Still recommended: sanitize with generous whitelist (SVG, MathML)
- Error messages may contain unescaped LaTeX - use `throwOnError: false`

### Pattern Recommendations for Workstream A

#### For `log_...` (existing)
- **Current**: Regex-based React fragment with `<sub>`
- **Status**: WORKS - no changes needed

#### For `^...` (superscript)
- **Option A**: Extend regex pattern like log_, render `<sup>`
- **Option B**: Use KaTeX for full LaTeX expressions
- **Recommendation**: Option A for simple cases, KaTeX for complex expressions

#### For stacked fractions
- **LaTeX syntax**: `\frac{numerator}{denominator}`
- **Examples**:
  - Simple: `\frac{a}{b}` → a/b stacked
  - Continued: `\cfrac{1}{1+\cfrac{1}{2}}`
- **Recommendation**: KaTeX integration for proper vertical stacking

#### Edge-Case Handling
1. **Nested markers**: `log_(x^2)` - handle inner ^ first or use KaTeX
2. **Malformed input**: Empty subscripts/superscripts → render as plain text
3. **Escaping**: KaTeX uses backslash `\`, need proper escaping in JS strings

### Performance/Testability Notes
- KaTeX is synchronous and fast (7.1M weekly downloads)
- SSR-compatible: use `katex.renderToString` for server-side
- Memoize with `React.memo()` for repeated renders
- Test patterns: Vitest snapshot testing for HTML output

### No New Dependencies (per constraint)
- Current regex approach works for simple patterns
- Consider KaTeX only if LaTeX expressions become common
- DOMPurify NOT needed if using React fragment approach (no innerHTML)

## Workstream A Task 1 Audit (2026-03-05)

- Source plan path confirmed: `.sisyphus/plans/.legacy/homework-log-rendering-fix.md`.
- Audit evidence captured at `.sisyphus/evidence/task-1-render-surface-audit.txt`.
- `renderMathText` is currently applied in PlacementTest, HomeworkSubmit (problem/options), AuthorHomeworkStatus (problem/options/answer), and AuthorHomeworkPage (question preview only).
- Key raw render paths remain in MyPage, LearnPage, EvalResultList, AuthorResearchGraphPage, and description/subjective-answer paths in HomeworkSubmit + AuthorHomeworkStatus.
- Railway CLI `4.30.1` currently deploys `curriculum-viewer` successfully with `railway up`; exclude-pattern header issue was not reproducible in this run.
- Ignore files (`.railwayignore`, `.dockerignore`, `.gitignore`) are LF + ASCII with no BOM/control characters.

---

## ULR Plugin Workstream Authoritative References (2026-03-05)

### Official OpenCode Plugin Documentation

| Source | URL | Relevance |
|--------|-----|-----------|
| OpenCode Plugins Guide | https://opencode.ai/docs/plugins/ | Primary source for hook events, plugin structure, custom tools |
| OpenCode SDK Types | `@opencode-ai/plugin` package | TypeScript types for `Plugin`, `PluginInput`, hook handlers |
| OpenCode Config Docs | https://opencode.ai/docs/config/ | Config precedence, JSONC format |

**Key Plugin Hook Events** (from official docs):
- `chat.message` - Intercept user messages, inject mode prompts
- `tool.execute.before` / `tool.execute.after` - Pre/post tool execution
- `session.*` events - Session lifecycle
- `experimental.session.compacting` - Context compaction customization

### Plugin Architecture Files (Source of Truth)

| File | Purpose | Task Relevance |
|------|---------|----------------|
| `.plugins/oh-my-opencode-ulr/src/hooks/keyword-detector/hook.ts` | Mode injection logic, session dedupe | Tasks 2-5, 7 |
| `.plugins/oh-my-opencode-ulr/src/hooks/keyword-detector/detector.ts` | Keyword detection with regex | Task 2 (explicit typing), Task 5 (perf) |
| `.plugins/oh-my-opencode-ulr/src/hooks/keyword-detector/constants.ts` | Detector registry | Task 2 (explicit types) |
| `.plugins/oh-my-opencode-ulr/src/hooks/keyword-detector/ultra-research/default.ts` | Current ULR message | Task 6 (rewrite) |
| `.plugins/oh-my-opencode-ulr/src/hooks/keyword-detector/index.test.ts` | Test patterns | Tasks 3-5, 7 |
| `.plugins/oh-my-opencode-ulr/src/features/builtin-commands/commands.ts` | Command registry | Task 8 (/ulr command) |
| `.plugins/oh-my-opencode-ulr/src/features/builtin-commands/templates/ulr.ts` | Existing ULR template | Task 6, 8 |
| `.plugins/oh-my-opencode-ulr/src/features/claude-code-session-state/` | Session tracking utilities | Task 3 (dedupe) |

### Current ULR Implementation Status

**Already Implemented** (per code inspection):
- ✅ Keyword detection: `ultra`, `ultra-research`, `ulr` triggers
- ✅ Session dedupe: `injectedModesBySession` Map prevents repeated injection
- ✅ Precedence rules: ULR suppresses search/analyze modes (line 108-110 in hook.ts)
- ✅ Toast notifications: "Ultra Research Mode Activated"
- ✅ `/ulr` command: Registered in commands.ts (lines 99-109)
- ✅ ULR template: Built-in at templates/ulr.ts
- ✅ Tests: Comprehensive test suite covering dedupe, precedence, large inputs

**Gaps to Address** (per source plan):
- ❌ Task 2: Positional detector typing (`types[index]`) - needs explicit `type` in each detector
- ❌ Task 5: Large input guardrails - existing test shows 200K char handling, but need explicit slice
- ❌ Task 6: ULR message rewrite to match spec (Round 0-3 flow, evidence tags)
- ❌ Task 8: `/ulr` command may need optional topic argument

### Test Patterns (from index.test.ts)

```typescript
// Session dedupe test pattern (line 107-137)
test("should not inject ultra research twice in same session (dedupe)", async () => {
  const first = { parts: [{ type: "text", text: "ulr investigate model drift" }] }
  await hook["chat.message"]({ sessionID }, first)
  expect(firstText!.text).toContain("[ultra-research-mode]")
  
  const second = { parts: [{ type: "text", text: "ulr investigate again" }] }
  await hook["chat.message"]({ sessionID }, second)
  expect(secondText!.text).toBe("ulr investigate again") // no injection
})

// Precedence test pattern (line 139-156)
test("should suppress search/analyze injections when ultra research is present", async () => {
  const output = { parts: [{ type: "text", text: "ulr search for the bug" }] }
  await hook["chat.message"]({ sessionID }, output)
  expect(textPart!.text).toContain("[ultra-research-mode]")
  expect(textPart!.text).not.toContain("[search-mode]")
})
```

### Verification Commands

```bash
# Run plugin tests
cd .plugins/oh-my-opencode-ulr && bun test

# Run keyword-detector tests only
cd .plugins/oh-my-opencode-ulr && bun test src/hooks/keyword-detector/index.test.ts

# Typecheck
cd .plugins/oh-my-opencode-ulr && bun run typecheck
```

### Key Constraints (from Source Plan)

1. **No network calls in chat.message hook** - Must stay lightweight
2. **No positional detector typing** - Must use explicit `type` property
3. **No accidental ULR activation** - Must preserve analyze/search unless explicitly decided
4. **Session dedupe must not affect background tasks** - Skip injection for `subagentSessions`
5. **Variant override protection** - Don't override pre-existing `message.variant`

### Ambiguities / Version-Sensitive Notes

- **OpenCode plugin API**: The `@opencode-ai/plugin` package types evolve. Current hook signature uses `chat.message(input, output)` where `output.parts` is mutable array.
- **Test framework**: Uses Bun's built-in test runner (`bun:test`), not Jest/Vitest
- **Slash command handling**: Hook explicitly skips messages starting with `/` (line 68-71 in hook.ts)
- **System reminder filtering**: Keywords in `<system-reminder>` tags are filtered out (uses `removeSystemReminders()`)

## Workstream A Task 10 (2026-03-06)

- Added preview-only rendering in `AuthorHomeworkPage.tsx` for assignment description, manual question, objective options, and answer while keeping all edit controls raw.
- Added `AuthorHomeworkPage.test.tsx` with assertions that raw values persist in controls and rendered output includes `sub`, `sup`, and `.math-frac` markup.
- Evidence captured at `.sisyphus/evidence/task-10-author-homeworkpage-test.txt`.

## Workstream A Task 11 (2026-03-06)

- `AuthorResearchGraphPage.tsx` now renders example prompts with `renderMathText(item.prompt)` in the inspected panel.
- Updated `AuthorResearchGraphPage.test.tsx` fixture prompt to `log_2 x + 1/2` and asserted `sub` plus `.math-frac` are present.
- Evidence captured at `.sisyphus/evidence/task-11-research-graph-test.txt`.

## Workstream A Tasks 12-13 (2026-03-06)

- Post-audit completed: no remaining true-positive raw math render surfaces in targeted student/admin problem-content displays.
- Local verification passed end-to-end (`npm run test`, `npm run build`, `npm run test:e2e`).
- Production bundle check currently serves assets without `math-frac` markers; deployment path has an `exclude-patterns` non-printable ASCII build-context failure in Railway.

## Workstream A Task 13 Deployment Finalization (2026-03-06)

- Reliable Railway deploy path for this monorepo: run `railway up` from a clean temporary root that contains `curriculum-viewer/` as a subfolder, matching service `rootDirectory=curriculum-viewer`.
- `railway up "curriculum-viewer" --path-as-root` can conflict with the service rootDirectory and trigger `Could not find root directory: curriculum-viewer`.
- Successful production verification evidence: bundle markers include `math-frac` and Playwright screenshot saved at `.sisyphus/evidence/task-13-prod-placement.png`.
