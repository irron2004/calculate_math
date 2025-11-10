# CHECKLISTS.md — Review Gate

Use these checklists before requesting review or merging. Tick every item that applies to your change; if something is not applicable, note why in the PR description.

## Pull Request
- [ ] Linked issue or clear problem statement is included.
- [ ] Change scope fits in a single feature/fix (no unrelated refactors).
- [ ] Summary follows the AGENTS.md PR template with updated tests/doc references.
- [ ] Screenshots or API samples added when behavior or UI changes.

## Backend Updates
- [ ] New/modified endpoints include FastAPI router, Pydantic schemas, and service tests.
- [ ] `tests/` contains pytest coverage for success, failure, and edge cases.
- [ ] Lifespan dependencies (`app.state.*`) remain consistent and thread-safe.
- [ ] Database migrations or data files documented in `docs/` if applicable.

## Frontend Updates
- [ ] Components use accessible roles/text and handle keyboard navigation.
- [ ] Vitest or Testing Library tests cover rendering and user interactions.
- [ ] API calls route through `frontend/src/utils/api.ts` with error states handled.
- [ ] Build artifacts (`dist/`) are excluded from the commit.

## Security & Quality
- [ ] No secrets, tokens, or personal data committed.
- [ ] Lint/type tools (`ruff`, `mypy`, `eslint`, `tsc`) expected to pass in CI.
- [ ] Performance impact considered (skill graph, session generation, large datasets).
- [ ] Documentation (`README.md`, `docs/`, memory files) updated to match behavior.

