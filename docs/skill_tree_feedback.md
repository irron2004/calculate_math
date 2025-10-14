# Skill Tree Senior Feedback

## Context
- Senior review highlighted why the `/skills` page currently renders `"표시할 스킬 트리 데이터가 없습니다."` despite successful page load.
- Feedback focuses on the data flow from the FastAPI backend (`GET /api/v1/skills/tree`) through the frontend loader (`fetchSkillTree` → `loadSkillTree`) to the `SkillTreeGraph` renderer.

## Key Findings

### Data Loading & API Routing
- `fetchSkillTree()` hits `${API_BASE_URL}/v1/skills/tree`; in Vite production builds `API_BASE_URL` inherits the `VITE_API_BASE_URL` prefix (defaulting to `/math-api/api`).
- If Railway (or another proxy) serves the backend under a different path, the request returns a 404/403 and surfaces as an error banner (`"API 호출 실패: …"`). The current blank tree suggests the network call succeeds but the payload lacks graph content.
- Production `.env` must set `VITE_API_BASE_URL` to either the bare backend domain or the correct proxy path (e.g., `/api`). Reverse proxies must forward `/math-api/api` to the FastAPI service when that prefix is retained.

### Graph Payload Integrity
- `SkillTreePage.loadSkillTree` stores `payload.graph` in `uiGraph`. When `uiGraph.nodes` is empty, `graphNodesView` short-circuits and the UI surfaces the empty-data message.
- Backend endpoint proxies `skills.ui.json` directly into `payload["graph"]`. Missing or stale deployments of this file result in `graph: None` or an empty node list.
- `skills.ui.json` must stay in sync with `graph.bipartite.json` (node IDs like `C01-S1`). Any mismatch prevents node lookups when building `graphNodesView`.
- FastAPI now validates the UI graph at load time; missing nodes or dangling edges raise a `SkillSpecError`, returning a red error banner instead of an empty-state fallback.

### Rendering & UX Notes
- Locked nodes are still rendered; invisibility is due to absent nodes rather than CSS opacity.
- The graph container relies on manual coordinates; without data it falls back to the empty-state banner.
- Longer-term, automated layouts (React Flow, dagre) would remove the static JSON dependency and improve maintainability.

## Production Verification Steps
1. **Confirm `VITE_API_BASE_URL` configuration**
   - Railway: open the service’s *Variables* tab and confirm `VITE_API_BASE_URL` matches the FastAPI route (e.g. blank string for same-origin `/api`, `/math-api/api` when proxied).
   - Nginx/reverse proxy: ensure the upstream rule forwards the chosen prefix to the FastAPI service. If the frontend uses an outdated prefix, rebuild with an updated `.env.production`.
2. **Inspect the live network payload**
   - In the deployed UI, open `/skills`, then DevTools → *Network* → filter `v1/skills/tree`.
   - Verify status `200` and that the JSON response has `graph.nodes.length > 0`, `graph.edges.length` is non-zero, and `error` is `null`.
   - If `graph.nodes` is empty, capture the payload for comparison with local assets.
   - CLI 대안: `python scripts/fetch_skill_tree_payload.py --base-url https://<domain>/api`로 서버 응답 요약치를 확인할 수 있습니다.
3. **Pre-deploy asset validation**
   - Run `python scripts/check_skill_tree_assets.py` locally (or in CI) to ensure `skills.ui.json` contains nodes/edges and that IDs align with `graph.bipartite.json`.
4. **Optional backend logging**
   - If the UI remains empty, temporarily enable FastAPI request logging (e.g. `uvicorn app.main:app --log-level debug`) to confirm the file loads correctly, then disable once diagnosed.

## TODO Checklist
- [ ] Verify production/network environments: confirm `VITE_API_BASE_URL` aligns with deployed backend routing and adjust Railway or proxy rules if necessary.
- [ ] Inspect live `fetchSkillTree` responses (Network tab or logging) to confirm whether the payload arrives and whether `graph.nodes` is empty.
- [ ] Ensure `skills.ui.json` ships with releases; regenerate it from the latest bipartite graph when course IDs or group names change. Use `python scripts/check_skill_tree_assets.py` to confirm the bundled file has nodes/edges and aligns with `graph.bipartite.json`.
- [x] Cross-check `skills.ui.json` node IDs against `payload.nodes` and the unlocked map to prevent mismatched lookups.
- [x] Add lightweight telemetry or UI fallback when `graphNodesView` is empty to aid diagnosis in production.
- [ ] Evaluate replacing the static UI graph specification with an auto-layout pipeline (React Flow/dagre) once immediate data issues are resolved.
