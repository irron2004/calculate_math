diff --git a/frontend/src/utils/analytics.ts b/frontend/src/utils/analytics.ts
index d66acbf..359529d 100644
--- a/frontend/src/utils/analytics.ts
+++ b/frontend/src/utils/analytics.ts
@@ -182,4 +182,32 @@ export const trackSkillTreeContrastToggled = (highContrast: boolean) => {
 export const trackSkillTreeFocusMode = (nodeId: string | null) => {
   emitEvent('skill_tree_focus_mode', { node_id: nodeId });
 };
+
+export const trackSkillTreeFallback = (payload: {
+  reason: string;
+  mode: string;
+  detail?: string;
+}) => {
+  emitEvent('skill_tree_fallback', {
+    reason: payload.reason,
+    mode: payload.mode,
+    detail: payload.detail,
+  });
+};
+
+export const trackApiError = (payload: {
+  endpoint: string;
+  method: string;
+  status: number;
+  requestId?: string | null;
+  mode?: string;
+}) => {
+  emitEvent('api_error', {
+    endpoint: payload.endpoint,
+    method: payload.method,
+    status: payload.status,
+    request_id: payload.requestId,
+    mode: payload.mode,
+  });
+};
 
