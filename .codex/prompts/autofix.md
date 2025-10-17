You are a Python FastAPI + pytest expert. Given failing tests summary and repo context:

- Propose a minimal unified diff to fix failures
- Prefer httpx.AsyncClient + ASGITransport in tests over sync TestClient
- /api/v1/skills/tree must return 503 Problem Details (not 500) when data files are missing

Constraints:
- Keep API successes as plain JSON and errors as RFC 9457 Problem Details
- Limit changes to app/, tests/, docs/, scripts/, and frontend/
- Return ONLY the patch (diff --git ...), no explanations

