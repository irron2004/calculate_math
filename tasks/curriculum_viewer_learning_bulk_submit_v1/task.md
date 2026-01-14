---
workflow: code
graph_profile: curriculum_viewer_v1
---

# Curriculum Viewer — Learning Bulk Submit v1

## Goal
`/learn/:nodeId` 학습 화면에서 **문제별 제출 버튼을 제거**하고, **모든 문제를 풀고 난 뒤 한 번에 제출(채점)** 하도록 UX를 개선한다.

---

## Current Behavior
- `curriculum-viewer/src/pages/LearnPage.tsx`에서 각 문제 카드마다 `제출` 버튼이 있어 개별 채점/저장이 가능함.
- 문제은행은 `curriculum-viewer/public/data/problems_v1.json`에서 `problemsByNodeId[nodeId]`로 로딩됨.
- 채점은 `curriculum-viewer/src/lib/learn/grading.ts`의 `gradeNumericAnswer()` 사용.
- 결과는 localStorage에 `curriculum-viewer:learn:lastResult:${nodeId}` 키로 저장/복원됨.

---

## Requirements

### 1) 제출 UX 변경 (핵심)
- [ ] 문제 카드별 `제출` 버튼 제거
- [ ] 페이지 하단에 **단일 버튼** 추가: `채점하기` (또는 `전체 제출`)
- [ ] 모든 문제에 답안을 입력하기 전까지 `채점하기` 버튼은 **disabled**
  - 입력 판단은 공백/콤마 제거 등 기존 로직과 일관되게 처리(예: `normalizeNumericInput()` 기준으로 빈 값이면 미입력)

### 2) 일괄 채점 동작
- [ ] `채점하기` 클릭 시 현재 노드의 **모든 문제를 일괄 채점**
- [ ] 채점 이후 각 문제 카드에 결과 표시(정답/오답, 정답 값 표시)
- [ ] 상단에 총점/진행 표시: 예) `점수: X / N`

### 3) 저장/복원
- [ ] 채점 결과와 제출 답안을 localStorage에 **한 번에 저장**
- [ ] 동일 노드 재진입/새로고침 시 결과/답안을 복원

### 4) 다시 풀기(권장)
- [ ] `다시 풀기` 버튼(또는 `초기화`) 추가
  - 클릭 시 해당 노드의 저장된 결과/답안을 삭제하고 UI를 초기 상태로 되돌림

---

## Out of Scope
- 문제 타입 확장(서술형/객관식 등)
- 서버 연동/DB 저장
- 커리큘럼 데이터 구조 변경

---

## Implementation Notes
- 수정 중심 파일:
  - `curriculum-viewer/src/pages/LearnPage.tsx`
  - (필요 시) `curriculum-viewer/src/lib/learn/grading.ts`
- 기존 `StoredResult` 스키마(`submissions`)는 유지하되, 저장 시점을 “개별 제출” → “일괄 제출”로 변경.

---

## Verification
- [ ] 임의의 standard 노드로 진입 후 문제들이 보임
- [ ] 모든 문제 답을 입력하기 전까지 `채점하기`가 비활성
- [ ] 모든 답 입력 후 `채점하기`로 일괄 채점되고 각 문제 결과가 표시됨
- [ ] 새로고침 후에도 결과/답안이 유지됨
- [ ] `다시 풀기`로 초기화 가능
- [ ] `npm test`, `npm run build` 통과 (가능하면 관련 테스트 추가)

