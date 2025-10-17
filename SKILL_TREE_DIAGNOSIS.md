# 스킬 트리 진단 체크리스트

## 현재 상황
스킬 트리가 **이미 완전히 구현**되어 있지만, "표시할 스킬 트리 데이터가 없습니다" 메시지가 표시되는 상황.

## 진단 단계

### 1. 백엔드 API 확인

```bash
# 로컬에서 백엔드 실행
make run

# 다른 터미널에서 API 호출
curl http://localhost:8000/api/v1/skills/tree | jq
```

**확인 사항:**
- [ ] `graph` 필드가 존재하는가?
- [ ] `graph.nodes` 배열에 36개 노드가 있는가?
- [ ] `graph.edges` 배열에 40개 엣지가 있는가?
- [ ] `error` 필드가 null인가?

**예상 응답 구조:**
```json
{
  "version": "2025-10-12.bipartite.v1.ui.v1",
  "palette": {...},
  "groups": [...],
  "nodes": [...],  // 36개 course step 노드
  "edges": [...],
  "skills": [...],  // 60개 atomic skill
  "progress": {...},
  "graph": {        // ← 이 필드가 중요!
    "version": "2025-10-12.bipartite.v1.ui.v1",
    "trees": [...],  // 3개
    "nodes": [...],  // 36개
    "edges": [...]   // 40개
  },
  "unlocked": {...},
  "experiment": {...}
}
```

### 2. skills.ui.json 파일 확인

```bash
ls -la app/data/skills.ui.json
cat app/data/skills.ui.json | jq '.nodes | length'  # 36이어야 함
cat app/data/skills.ui.json | jq '.edges | length'  # 40이어야 함
```

**확인 사항:**
- [ ] 파일이 존재하는가?
- [ ] JSON이 유효한가?
- [ ] `nodes` 배열에 36개 항목이 있는가?
- [ ] 모든 노드에 `id`, `tree`, `tier`, `grid` 필드가 있는가?

### 3. 프론트엔드 네트워크 요청 확인

```bash
# 프론트엔드 실행
cd frontend
npm run dev
```

브라우저 DevTools → Network:
1. `/skills` 페이지 접속
2. `v1/skills/tree` 요청 확인

**확인 사항:**
- [ ] 요청 URL이 올바른가? (예: `http://localhost:5173/math-api/api/v1/skills/tree`)
- [ ] 응답 상태가 200인가?
- [ ] 응답 body에 `graph` 필드가 있는가?
- [ ] `graph.nodes.length > 0`인가?

### 4. 환경 변수 확인

```bash
# 프론트엔드 환경 변수
cat frontend/.env.local  # 있다면
echo $VITE_API_BASE_URL

# 백엔드 환경 변수
cat .env  # 있다면
```

**확인 사항:**
- [ ] `VITE_API_BASE_URL`이 올바른가?
  - 로컬 개발: `/math-api/api` (기본값)
  - Production: 배포 환경에 맞게 설정

### 5. 프론트엔드 콘솔 로그 확인

브라우저 DevTools → Console:

**찾아볼 메시지:**
```
[SkillTree] 그래프 노드가 비어 있습니다. {
  apiBaseUrl: "...",
  graphNodeCount: 0,  // ← 0이면 문제
  graphEdgeCount: 0,
  payloadNodeCount: ...
}
```

---

## 문제 시나리오별 해결 방법

### 시나리오 A: API가 404/500 오류 반환

**증상:**
- Network 탭에서 `/v1/skills/tree` 요청이 404/500
- 또는 CORS 오류

**해결:**
```bash
# 1. 백엔드가 실행 중인지 확인
ps aux | grep uvicorn

# 2. 백엔드 재시작
make run

# 3. Vite proxy 설정 확인
cat frontend/vite.config.ts
```

### 시나리오 B: API 응답에 `graph` 필드 없음

**증상:**
- API 응답은 200이지만 `graph: null`
- 또는 `error` 필드에 메시지

**해결:**
```bash
# skills.ui.json 재생성 (만약 스크립트가 있다면)
python scripts/generate_ui_graph.py

# 또는 graph.bipartite.json에서 수동 추출
# (현재는 이미 skills.ui.json이 존재함)
```

### 시나리오 C: 프론트엔드가 잘못된 URL 호출

**증상:**
- Network 탭에서 잘못된 URL (예: `/api/v1/skills/tree` 대신 `/v1/skills/tree`)

**해결:**
```bash
# frontend/.env.local 생성 또는 수정
echo 'VITE_API_BASE_URL=/math-api/api' > frontend/.env.local

# 프론트엔드 재시작
npm run dev
```

### 시나리오 D: `graphNodesView` 변환 로직 오류

**증상:**
- API 응답에 `graph.nodes`가 있지만 `graphNodesView.length === 0`

**가능한 원인:**
1. `uiGraph.nodes`와 `projectionLookup`의 ID 불일치
2. `uiNode.id`가 `nodes` 배열의 어떤 노드와도 매칭되지 않음

**디버깅:**
```typescript
// SkillTreePage.tsx:237 근처에 임시 로그 추가
console.log('uiGraph:', uiGraph);
console.log('uiGraph.nodes:', uiGraph?.nodes);
console.log('projectionLookup keys:', Array.from(projectionLookup.keys()));
console.log('graphNodesView:', graphNodesView);
```

---

## 빠른 검증 스크립트

```bash
#!/bin/bash
# quick_check.sh

echo "=== 1. 백엔드 파일 확인 ==="
ls -lh app/data/skills.ui.json
echo ""

echo "=== 2. JSON 구조 확인 ==="
jq '.nodes | length' app/data/skills.ui.json
jq '.edges | length' app/data/skills.ui.json
echo ""

echo "=== 3. 백엔드 실행 중? ==="
curl -s http://localhost:8000/health | jq '.status'
echo ""

echo "=== 4. API 테스트 ==="
curl -s http://localhost:8000/api/v1/skills/tree | jq '{
  version,
  graph_exists: (.graph != null),
  graph_nodes_count: (.graph.nodes | length),
  graph_edges_count: (.graph.edges | length),
  error
}'
echo ""

echo "=== 5. 프론트엔드 환경 변수 ==="
cat frontend/.env.local 2>/dev/null || echo "No .env.local"
```

```bash
chmod +x quick_check.sh
./quick_check.sh
```

---

## 가장 가능성 높은 원인

**우선순위 1:** API 경로 불일치
- `VITE_API_BASE_URL` 설정 확인
- Vite proxy 설정 확인

**우선순위 2:** 백엔드가 실행되지 않음
- `make run` 실행 확인
- 포트 8000 사용 중인지 확인

**우선순위 3:** skills.ui.json 파일 누락 (배포 환경)
- Docker/프로덕션 빌드에서 파일이 포함되는지 확인

---

## 다음 단계

1. ✅ 위 진단 체크리스트 실행
2. ✅ 문제 시나리오 식별
3. ✅ 해당 해결 방법 적용
4. ✅ 로그/스크린샷 수집 (필요 시)
5. ✅ 추가 지원 요청 (진단 결과와 함께)

---

## 정리

**스킬 트리는 이미 완전히 구현되어 있습니다.** 문제는 구현이 아니라 **배포/설정** 이슈입니다.

- ✅ 데이터 구조: 완료
- ✅ 백엔드 API: 완료
- ✅ 프론트엔드 UI: 완료
- ❓ 연결/배포: 확인 필요
