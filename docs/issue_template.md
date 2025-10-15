# Bug Report Template (Reproducible)

Use this template to file issues that CI and Codex can reproduce consistently.

## Summary
- Short description of the bug and affected area (router/service/component)

## Impact
- Severity (blocker/major/minor) and user-visible effects

## Environment
- Commit SHA / branch:
- OS (WSL2 Ubuntu), Python version, Node version:
- Config overrides (`.env` keys if relevant; no secrets):

## Steps to Reproduce
```bash
# Backend health
curl -i http://localhost:8000/health

# Problem list and deterministic generation
curl -s "http://localhost:8000/api/problems" | jq '.items | length'
curl -s "http://localhost:8000/api/problems/generate?category=add&seed=1" | jq

# Login + session
curl -i -X POST http://localhost:8000/api/v1/login \
  -H 'Content-Type: application/json' \
  -d '{"nickname":"student01","password":"secret"}'
# Use returned Set-Cookie for sessions

# Skills endpoints
curl -s http://localhost:8000/api/v1/skills/tree | jq '.nodes | length'
```

## Expected vs Actual
- Expected:
- Actual:

## Logs / Traceback (with line numbers)
```
[Include relevant stack traces or log snippets. If using Docker, include `docker logs pe-fastapi --tail 200` excerpts.]
```

## Tests to Run (CI reference)
- Backend: `pytest -q`
- Focused tests (if applicable):
  - `tests/test_api.py::test_session_generation`
  - `tests/test_skills_router.py::test_skill_tree_loads`

## Proposed Fix Scope
- Suspected files/modules (minimal change):
  - `app/routers/<name>.py`, `app/services/...`, etc.

## Additional Context / Attachments
- Screenshots, minimal payloads, anonymized inputs

