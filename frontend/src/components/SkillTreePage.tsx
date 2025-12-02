diff --git a/frontend/src/components/SkillTreePage.tsx b/frontend/src/components/SkillTreePage.tsx
index 6b450b0..a270484 100644
--- a/frontend/src/components/SkillTreePage.tsx
+++ b/frontend/src/components/SkillTreePage.tsx
@@ -227,6 +227,8 @@ const SkillTreePage: React.FC = () => {
   const [experiment, setExperiment] = useState<ExperimentAssignment | null>(null);
   const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
   const [isSimpleSkillTree, setIsSimpleSkillTree] = useState(false);
+  const [seedDiagnostics, setSeedDiagnostics] =
+    useState<SkillTreeResponse['diagnostics'] | null>(null);
   const isMountedRef = useRef(true);
   const [isRefreshing, setIsRefreshing] = useState(false);
   const [zoom, setZoom] = useState(1);
@@ -312,6 +314,9 @@ useUnlockFx(recentlyUnlocked);
         setProgress(createEmptyProgress());
         setExperiment(null);
         setIsSimpleSkillTree(true);
+        setSeedDiagnostics(
+          payload.diagnostics?.fallback === 'seed' ? payload.diagnostics : null,
+        );
         setError(null);
         if (!silent) {
           setSelectedNodeId(null);
@@ -321,6 +326,7 @@ useUnlockFx(recentlyUnlocked);
       }
 
       setIsSimpleSkillTree(false);
+      setSeedDiagnostics(null);
       setVersion(payload.version ?? null);
       setPalette(payload.palette ?? {});
       const nodeList = Array.isArray(payload.nodes) ? payload.nodes : [];
@@ -423,6 +429,7 @@ useUnlockFx(recentlyUnlocked);
     registerCourseConcept,
     trackExperimentExposure,
     fetchSkillTree,
+    setSeedDiagnostics,
   ],
 );
 
@@ -747,7 +754,24 @@ useEffect(() => {
 
       {isSimpleSkillTree ? (
         <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-100">
-          시작용 스킬 트리를 표시합니다. 선행 관계를 빠르게 확인할 수 있고, 학습 시작은 추후 단계별 업데이트와 함께 활성화됩니다.
+          <p>
+            {(() => {
+              const reason = seedDiagnostics?.reason ?? 'seed_mode';
+              if (reason === 'api_error') {
+                return '라이브 스킬 트리를 불러오지 못해 시드 데이터를 표시합니다.';
+              }
+              if (reason === 'graph_unavailable') {
+                return '서버에서 UI 레이아웃이 비어 있어 시드 스킬 트리를 임시로 사용합니다.';
+              }
+              if (reason === 'nodes_unavailable') {
+                return '스킬 노드가 비어 있어 시드 스킬 트리를 임시로 사용합니다.';
+              }
+              return '시작용 스킬 트리를 표시합니다.';
+            })()}
+          </p>
+          <p className="mt-1 text-[11px] text-amber-200/80">
+            라이브 데이터가 준비되면 새로고침하여 최신 경로·진행도를 확인하세요. fallback 발생은 텔레메트리에 기록되어 운영팀이 즉시 추적합니다.
+          </p>
         </div>
       ) : null}
 
