# Repository Guidelines

## Project Structure & Module Organization
- `app/` hosts the FastAPI backend; place routers under `app/routers/`, shared settings in `app/config.py`, and telemetry helpers in `app/instrumentation.py`.
- `tests/` mirrors backend modules with pytest suites named `test_<feature>.py`; shared fixtures live in `tests/conftest.py`.
- `frontend/` contains the Vite React client with components in `frontend/src/components/` and pages in `frontend/src/pages/`.
- Documentation and automation live under `docs/`, `scripts/`, and `tools/`; update them whenever you change behavior or interfaces.

## Build, Test, and Development Commands
- `make dev` sets up the Python virtualenv with runtime and developer extras.
- `make run` starts the FastAPI server on `http://localhost:8000`; pair it with `npm run dev` for the frontend preview on `http://localhost:5173`.
- `make smoke` triggers health checks against the running backend.
- `make test` (alias for `pytest -q`) executes the backend suite; use `CI=1 npm test -- --run` for frontend Vitest runs.

## Coding Style & Naming Conventions
- Format Python with Black (4-space indentation), lint with Ruff, and keep imports sorted via isort; type-check with `mypy --strict` as part of review.
- Prefer snake_case modules, PascalCase Pydantic models, and async-first router handlers.
- In the frontend, rely on ESLint + Prettier defaults; components use PascalCase filenames, custom hooks follow `useCamelCase`.

## Testing Guidelines
- Backend tests use pytest with httpx `AsyncClient`; cover happy paths, validation errors, and regressions.
- Name files `tests/test_<feature>.py` and ensure fixtures that span modules land in `tests/conftest.py`.
- Frontend tests belong beside the component or under `frontend/src/**/__tests__/`; keep snapshots deterministic.

## Commit & Pull Request Guidelines
- Follow Conventional Commit prefixes such as `feat(api): add pricing endpoint` or `fix(frontend): handle empty cart`.
- Each PR should summarize the change, link issues, list manual/automated checks, and attach screenshots or logs for observable behavior shifts.
- Keep changes focused; split unrelated fixes into separate branches to simplify review.

## Security & Configuration Tips
- Never commit secrets; rely on `.env` files and document required keys in `README.md`.
- Validate external inputs, propagate the `X-Request-ID` header, and keep OpenTelemetry settings current in `app/instrumentation.py`.
- Prefer editing within the repository workspace to avoid WSL permission issues.
