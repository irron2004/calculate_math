diff --git a/frontend/src/types/index.ts b/frontend/src/types/index.ts
index baed638..c2c3976 100644
--- a/frontend/src/types/index.ts
+++ b/frontend/src/types/index.ts
@@ -293,6 +293,12 @@ export type SkillTreeResponse = {
     message: string;
     kind: string;
   };
+  diagnostics?: {
+    fallback?: 'seed';
+    reason?: string;
+    mode?: string;
+    detail?: string;
+  };
 };
 
 export type SkillProgressResponse = {
