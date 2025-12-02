diff --git a/frontend/src/utils/__tests__/api.test.ts b/frontend/src/utils/__tests__/api.test.ts
index 8c9a849..bff64bf 100644
--- a/frontend/src/utils/__tests__/api.test.ts
+++ b/frontend/src/utils/__tests__/api.test.ts
@@ -2,17 +2,20 @@ import { afterEach, describe, expect, it, vi } from 'vitest';
 
 describe('fetchSkillTree (seed mode)', () => {
   const originalFetch = global.fetch;
+  const originalMode = process.env.VITE_SKILL_TREE_MODE;
 
   afterEach(() => {
     vi.restoreAllMocks();
     global.fetch = originalFetch;
     vi.resetModules();
+    process.env.VITE_SKILL_TREE_MODE = originalMode;
   });
 
-  it('returns the starter skill tree without hitting the network by default', async () => {
+  it('returns the starter skill tree without hitting the network when mode=seed', async () => {
     const fetchMock = vi.fn();
     global.fetch = fetchMock as typeof fetch;
     vi.spyOn(console, 'info').mockImplementation(() => undefined);
+    process.env.VITE_SKILL_TREE_MODE = 'seed';
 
     const { SKILL_TREE_SEED_VERSION } = await import('../../constants/skillTreeSeed');
     const { fetchSkillTree } = await import('../api');
@@ -23,5 +26,27 @@ describe('fetchSkillTree (seed mode)', () => {
     expect(Array.isArray((payload as any).skills)).toBe(true);
     expect((payload as any).skills).not.toHaveLength(0);
     expect(payload.graph?.nodes?.length ?? 0).toBeGreaterThan(0);
+    expect(payload.diagnostics?.reason).toBe('seed_mode');
+  });
+
+  it('falls back to seed data when live request fails in auto-seed mode', async () => {
+    const response = new Response('boom', {
+      status: 503,
+      statusText: 'Service Unavailable',
+      headers: { 'x-request-id': 'req-1' },
+    });
+    const fetchMock = vi.fn().mockResolvedValue(response);
+    global.fetch = fetchMock as typeof fetch;
+    vi.spyOn(console, 'info').mockImplementation(() => undefined);
+    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
+    vi.spyOn(console, 'error').mockImplementation(() => undefined);
+    process.env.VITE_SKILL_TREE_MODE = 'auto-seed';
+
+    const { fetchSkillTree } = await import('../api');
+    const payload = await fetchSkillTree();
+
+    expect(fetchMock).toHaveBeenCalledTimes(1);
+    expect(payload.diagnostics?.fallback).toBe('seed');
+    expect(payload.diagnostics?.reason).toBe('api_error');
   });
 });
