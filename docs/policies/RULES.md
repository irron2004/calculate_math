# RULES.md — Non-Negotiable Policies

This document lists constraints that apply to every change proposed in this repository. Treat these rules as hard requirements that override any ad-hoc instruction unless explicitly superseded by a maintainer.

## Security & Data Handling
- Do not commit or print secrets, API tokens, JWT signing keys, or database files. `.env*`, `.secrets/`, and CI-provisioned credentials are read-only.
- Sanitize and validate all external input through Pydantic models before using it in business logic, SQL statements, or filesystem operations.
- Preserve existing logging redaction and avoid introducing verbose traces that may leak user information.
- When patching SQL or shell invocations, keep parameter binding (`?` placeholders) and avoid string interpolation.

## Git & Branch Hygiene
- Write commits using [Conventional Commits](https://www.conventionalcommits.org/) with lowercase type prefixes (`feat`, `fix`, `docs`, `refactor`, `test`, `chore`).
- Keep every pull request focused on a single concern (one feature or one fix). Split unrelated updates into separate branches.
- Prefer short-lived branches rebased on `main`. Resolve merge conflicts locally before raising a PR.

## Coding Standards
- Backend code targets Python 3.11+. Follow the FastAPI patterns already in `app/`: Pydantic v2 models, dependency injections, and asynchronous request handlers that propagate `X-Request-ID`.
- Frontend code targets Node 18+/npm. Keep TypeScript strict, route updates in `frontend/src/App.tsx`, and add vitest tests next to new components.
- Run linters/formatters (`ruff`, `black`, `isort`, `mypy`, `eslint`) locally when feasible; CI will enforce them.
- Avoid large-scale refactors or formatting-only changes without explicit maintainer approval.

## Approvals & Shell Safety
- The Codex CLI runs under `approval_policy=on-request`. Request escalation before executing destructive commands (`rm`, `mv`, mass rewrites), network access, or processes writing outside the workspace.
- Document every command you intend to run in the **Plan → Commands → Diff → Verify** loop and wait for approval when required.
- Never bypass sandbox restrictions via custom scripts or subshells. If a workflow is blocked, surface the limitation instead of forcing execution.

## Documentation & Tests
- Update docstrings and Markdown guides (`README.md`, `docs/`, or the memory files) when changing API contracts or workflows.
- For every behavior change, add or adjust tests in `tests/` (backend) or `frontend/src/**/*.{test,spec}.tsx?` (frontend). You do not need to execute pytest/vitest locally, but list the expected outcomes in the PR template.
- Keep generated artifacts (coverage reports, compiled assets) out of version control.

