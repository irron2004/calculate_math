---
workflow: code
graph_profile: curriculum_viewer_v1
---

# Ticket: Learning Bulk Submit v1 (일괄 제출/채점)

## Goal
`/learn/:nodeId` 학습 화면에서 **문제별 제출 버튼**을 없애고, **모든 문제를 풀고 나서 한 번에 제출(채점)** 하도록 UX를 변경한다.

---

## Current Behavior
- `curriculum-viewer/src/pages/LearnPage.tsx`에서 각 문제 카드마다 `제출` 버튼이 있어 문제별로 채점/저장이 됨.
- 문제은행은 `curriculum-viewer/public/data/problems_v1.json`에서 `problemsByNodeId[nodeId]`로 로딩됨.
- 채점은 `curriculum-viewer/src/lib/learn/grading.ts`의 `gradeNumericAnswer()` 사용.
- 결과는 localStorage에 `curriculum-viewer:learn:lastResult:${nodeId}` 키로 저장/복원됨.

---

## Requirements

### 1) 제출 UX 변경 (필수)
- [ ] 문제 카드별 `제출` 버튼 제거
- [ ] 페이지 하단에 단일 버튼 추가: `채점하기`(또는 `전체 제출`)
- [ ] 모든 문제에 답안을 입력하기 전까지 `채점하기` 버튼은 **disabled**
  - “입력 완료” 판정은 채점 로직과 일관되게(예: `normalizeNumericInput()` 기준으로 빈 값이면 미입력)

### 2) 일괄 채점
- [ ] `채점하기` 클릭 시 현재 노드의 **모든 문제를 일괄 채점**
- [ ] 채점 이후 각 문제 카드에 결과 표시(정답/오답 + 정답 값)
- [ ] 상단에 총점 표시: `점수: X / N`

### 3) 저장/복원
- [ ] 채점 결과와 답안을 localStorage에 **한 번에 저장**
- [ ] 동일 노드 재진입/새로고침 시 결과/답안이 복원됨

### 4) 다시 풀기(권장)
- [ ] `다시 풀기` 버튼(또는 `초기화`) 추가
  - 클릭 시 해당 노드의 저장된 결과/답안을 삭제하고 초기 상태로 복귀

---

## Out of Scope
- 문제 타입 확장(서술형/객관식 등)
- 서버 연동/DB 저장
- 커리큘럼 데이터 구조 변경

---

## Implementation Notes
- 수정 파일(주):
  - `curriculum-viewer/src/pages/LearnPage.tsx`
  - (필요 시) `curriculum-viewer/src/lib/learn/grading.ts`
- 기존 localStorage 스키마(`submissions`)는 유지하되, 저장 시점을 “개별 제출” → “일괄 제출”로 변경한다.
- 채점 전에는 개별 문제 결과(`정답/오답`)가 나오지 않도록 한다.

---

## Verification
- [ ] standard 노드로 진입 → 문제 목록 표시
- [ ] 모든 문제 답 입력 전: `채점하기` disabled
- [ ] 모든 답 입력 후: `채점하기` enabled → 클릭 시 일괄 채점/결과 표시
- [ ] 새로고침 후에도 결과/답안 유지
- [ ] `다시 풀기`로 초기화 가능
- [ ] `npm test`, `npm run build` 통과 (가능하면 관련 테스트 추가)

