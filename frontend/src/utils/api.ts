diff --git a/frontend/src/utils/api.ts b/frontend/src/utils/api.ts
index a4bc687..222ad2d 100644
--- a/frontend/src/utils/api.ts
+++ b/frontend/src/utils/api.ts
@@ -16,6 +16,7 @@ import type {
 } from '../types';
 import { STARTER_SKILL_TREE, SKILL_TREE_SEED_VERSION } from '../constants/skillTreeSeed';
 import { buildSimpleSkillTree } from './simpleSkillTree';
+import { trackApiError, trackSkillTreeFallback } from './analytics';
 
 export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';
 
@@ -38,33 +39,30 @@ async function apiCall<T>(endpoint: string, options?: RequestInit): Promise<T> {
   });
 
   if (!response.ok) {
-    let bodyPreview: string | undefined;
-    try {
-      const text = await response.clone().text();
-      bodyPreview = text.trim().slice(0, 200);
-    } catch (error) {
-      bodyPreview = undefined;
-    }
+    const requestId = response.headers.get('x-request-id');
     console.error('[API] 호출 실패', {
       url,
       status: response.status,
       statusText: response.statusText,
-      bodyPreview,
+      requestId,
+    });
+    trackApiError({
+      endpoint,
+      method: options?.method ?? 'GET',
+      status: response.status,
+      requestId,
     });
-    throw new Error(
-      `API 호출 실패: ${response.status} ${response.statusText} @ ${url}${
-        bodyPreview ? ` → ${bodyPreview}` : ''
-      }`,
-    );
+    throw new Error(`API 호출 실패: ${response.status} ${response.statusText} @ ${url}`);
   }
 
   return response.json();
 }
 
-// 기본값을 live로 올려서 백엔드 트리를 우선 사용하고, seed는 명시적으로만 활성화한다.
-const skillTreeMode = (import.meta.env.VITE_SKILL_TREE_MODE ?? 'live').toLowerCase();
+const rawSkillTreeMode = (import.meta.env.VITE_SKILL_TREE_MODE ?? 'auto-seed').toLowerCase();
+const supportedModes = new Set(['live', 'seed', 'auto-seed']);
+const skillTreeMode = supportedModes.has(rawSkillTreeMode) ? rawSkillTreeMode : 'auto-seed';
 const useSeedSkillTree = skillTreeMode === 'seed';
-const allowSeedFallback = useSeedSkillTree || skillTreeMode === 'auto-seed';
+const allowSeedFallback = skillTreeMode === 'seed' || skillTreeMode === 'auto-seed';
 
 const seedSkillTree = buildSimpleSkillTree(STARTER_SKILL_TREE, {
   version: SKILL_TREE_SEED_VERSION,
@@ -95,6 +93,26 @@ const seedSkillTreePayload: SkillTreeResponse = {
   },
 };
 
+type SeedFallbackReason = 'seed_mode' | 'api_error' | 'graph_unavailable' | 'nodes_unavailable';
+
+const createSeedPayload = (reason: SeedFallbackReason, detail?: string): SkillTreeResponse => ({
+  ...seedSkillTreePayload,
+  diagnostics: {
+    fallback: 'seed',
+    reason,
+    mode: skillTreeMode,
+    detail,
+  },
+});
+
+const reportSeedFallback = (reason: SeedFallbackReason, detail?: string) => {
+  trackSkillTreeFallback({
+    reason,
+    mode: skillTreeMode,
+    detail,
+  });
+};
+
 // 세션 생성 (20문제 세트)
 export async function createSession(
   token?: string,
@@ -245,14 +263,26 @@ export async function fetchLatestLRC(userId: string): Promise<LRCEvaluation | nu
 export async function fetchSkillTree(): Promise<SkillTreeResponse> {
   if (useSeedSkillTree) {
     console.info('[API] 스킬 트리를 시드 데이터로 로드합니다.');
-    return seedSkillTreePayload;
+    reportSeedFallback('seed_mode');
+    return createSeedPayload('seed_mode');
   }
   try {
-    return await apiCall<SkillTreeResponse>('/v1/skills/tree');
+    const payload = await apiCall<SkillTreeResponse>('/v1/skills/tree');
+    const hasNodes = Array.isArray(payload.nodes) && payload.nodes.length > 0;
+    const hasGraphNodes =
+      Array.isArray(payload.graph?.nodes) && (payload.graph?.nodes?.length ?? 0) > 0;
+    if ((!hasNodes || !hasGraphNodes) && allowSeedFallback) {
+      const reason: SeedFallbackReason = hasNodes ? 'graph_unavailable' : 'nodes_unavailable';
+      reportSeedFallback(reason);
+      return createSeedPayload(reason);
+    }
+    return payload;
   } catch (error) {
     if (allowSeedFallback) {
       console.warn('[API] 스킬 트리 API 호출 실패 → 시드 데이터로 대체합니다.', error);
-      return seedSkillTreePayload;
+      const detail = error instanceof Error ? error.message : undefined;
+      reportSeedFallback('api_error', detail);
+      return createSeedPayload('api_error', detail);
     }
     throw error;
   }
