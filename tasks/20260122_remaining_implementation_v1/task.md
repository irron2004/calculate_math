---
workflow: code
graph_profile: frontend
---

# 미구현 기능 통합 구현

## Goal
기존 task들에서 미구현된 기능들을 완성하여 MVP를 완료한다.

---

## Current Status
- 기본 인증(로그인/회원가입) 구현됨
- React Flow 기반 그래프 렌더링 구현됨
- 문제 풀이(LearnPage) 기본 구현됨
- 채점 엔진(numeric_equal) 구현됨
- **상태 시각화 미완성** (색상/아이콘 구분 없음)
- **Grade 노드 제거 안됨**
- **임시저장/이어풀기 없음**
- **Author Mode 엣지 편집 UI 없음**

---

## Requirements

### EPIC 0 — Grade 노드 제거 (P0)

#### REM-001 Grade 노드 필터링
- **담당**: FE
- **작업**:
  - `type === 'grade'` 노드를 그래프에서 숨김
  - 필터링 함수 `filterGradeNodes()` 구현
- **DoD**: 그래프 로드 시 grade 노드가 보이지 않음

#### REM-002 스킵 엣지 생성
- **담당**: FE
- **작업**:
  - Grade 노드를 거치는 연결을 직접 연결로 변환
  - `A → Grade → B` 를 `A → B (skip edge)` 로 변환
- **DoD**: Grade 제거 후에도 연결 관계 유지됨

#### REM-003 레이아웃 재계산
- **담당**: FE
- **작업**: Grade 제거 후 dagre 레이아웃 재실행
- **DoD**: 노드 배치가 자연스럽게 정렬됨

---

### EPIC 1 — 상태 시각화 (P0)

#### REM-004 노드 상태 계산 로직
- **담당**: FE
- **작업**:
  - 상태 4종 정의: `LOCKED/AVAILABLE/IN_PROGRESS/COMPLETED`
  - `calculateNodeStatus()` 함수 구현
  - 선수 노드 완료 여부 기반 계산
- **DoD**: 각 노드의 상태가 정확히 계산됨

#### REM-005 노드 색상/아이콘 구분
- **담당**: FE
- **작업**:
  - LOCKED: 회색 + 잠금 아이콘
  - AVAILABLE: 파랑 + 시작 아이콘
  - IN_PROGRESS: 노랑 + 진행중 아이콘
  - COMPLETED: 초록 + 체크 아이콘
- **DoD**: 상태별 시각적 구분 가능

#### REM-006 상태 범례 UI
- **담당**: FE
- **작업**: `LearningStatusLegend` 컴포넌트 구현
- **DoD**: 그래프 페이지에서 색상/아이콘 의미 확인 가능

---

### EPIC 2 — 학습 세션 관리 (P0)

#### REM-007 임시저장 (DRAFT) 구현
- **담당**: FE
- **작업**:
  - `sessionStorage.ts` 모듈 구현
  - `saveDraft()`, `loadDraft()`, `clearDraft()` 함수
  - 답안 입력 시 1초 디바운스로 자동 저장
- **DoD**: 페이지 이탈 시 답안 유지됨

#### REM-008 이어풀기 복원 UI
- **담당**: FE
- **작업**:
  - `DraftRestoreModal` 컴포넌트 구현
  - 재방문 시 "이전 답안이 있습니다" 표시
  - "이어서 풀기" / "처음부터 풀기" 선택
- **DoD**: 이전 답안 복원 또는 초기화 가능

#### REM-009 제출 완료 시 초기화
- **담당**: FE
- **작업**: 제출 성공 시 draft 삭제
- **DoD**: 제출 후 재방문 시 빈 상태

---

### EPIC 3 — Author Mode 완성 (P0)

#### REM-010 엣지 연결 UI
- **담당**: FE
- **작업**:
  - React Flow `onConnect` 콜백 구현
  - 노드 A → B 드래그로 연결선 생성
- **DoD**: 마우스로 노드 간 연결 가능

#### REM-011 엣지 타입 선택 모달
- **담당**: FE
- **작업**:
  - `EdgeTypeSelectModal` 컴포넌트 구현
  - requires / prepares_for 선택
- **DoD**: 연결 시 타입 선택 후 생성

#### REM-012 엣지 삭제 UI
- **담당**: FE
- **작업**:
  - 엣지 클릭 → 삭제 확인 → 제거
  - `onEdgeClick` 핸들러 구현
- **DoD**: 기존 엣지 삭제 가능

#### REM-013 노드 드래그 + 위치 저장
- **담당**: FE
- **작업**:
  - `onNodeDragStop` 핸들러 구현
  - 위치 정보 저장
- **DoD**: 노드 위치 변경 후 새로고침해도 유지

#### REM-014 실시간 검증 업데이트
- **담당**: FE
- **작업**: 엣지 편집 시 자동 validation 실행
- **DoD**: 사이클 생성 시 즉시 경고

---

### EPIC 4 — 진단/통계 시스템 (P1)

#### REM-015 태그별 정답률 집계
- **담당**: FE
- **작업**:
  - `calculateTagStats()` 함수 구현
  - 문제 태그별 total/correct/rate 계산
- **DoD**: 태그별 정답률 데이터 생성

#### REM-016 취약 영역 분석
- **담당**: FE
- **작업**: 정답률 60% 미만 + 시도 3회 이상 태그 추출
- **DoD**: 취약 태그 목록 생성

#### REM-017 대시보드 차트
- **담당**: FE
- **작업**:
  - Recharts BarChart 통합
  - 태그별 정답률 막대 그래프
- **DoD**: 대시보드에서 차트 표시

---

### EPIC 5 — 엣지 시각화 (P1)

#### REM-018 엣지 타입별 스타일
- **담당**: FE
- **작업**:
  - requires: 실선, 파랑
  - prepares_for: 점선, 초록
  - progression: 파선, 회색
  - skip: 얇은 점선, 회색
- **DoD**: 엣지 타입별 시각적 구분

#### REM-019 엣지 범례 UI
- **담당**: FE
- **작업**: `EdgeLegend` 컴포넌트 구현
- **DoD**: 엣지 타입별 의미 확인 가능

---

### EPIC 6 — UX 개선 (P1)

#### REM-020 미입력 안내 모달
- **담당**: FE
- **작업**:
  - `UnansweredModal` 컴포넌트 구현
  - 미입력 문항 번호 표시
  - "돌아가기" / "그냥 제출" 선택
- **DoD**: 미입력 상태에서 제출 시 안내

#### REM-021 제출 확인 모달
- **담당**: FE
- **작업**: `SubmitConfirmModal` 컴포넌트 구현
- **DoD**: 제출 전 확인 요청

#### REM-022 다시 풀기 버튼
- **담당**: FE
- **작업**: 평가 페이지에서 재도전 버튼
- **DoD**: 버튼 클릭 시 학습 페이지로 이동

#### REM-023 로딩/에러 상태 UI
- **담당**: FE
- **작업**: 스피너, 에러 메시지 컴포넌트
- **DoD**: 로딩 중 / 에러 발생 시 적절한 UI 표시

---

### EPIC 7 — 선택 기능 (P2)

#### REM-024 LaTeX 렌더링 (KaTeX)
- **담당**: FE
- **작업**:
  - KaTeX 라이브러리 설치
  - `MathRenderer` 컴포넌트 구현
  - `$...$` 패턴 파싱
- **DoD**: 수식이 올바르게 렌더링됨

#### REM-025 문제별 해설 표시
- **담당**: FE
- **작업**: 채점 후 explanation 필드 표시
- **DoD**: 오답 문항에서 해설 확인 가능

#### REM-026 고급 검증 규칙
- **담당**: FE
- **작업**:
  - 사이클 감지 (DFS)
  - 고아 노드 검출
  - 중복 엣지 검출
- **DoD**: 검증 리포트에 문제 항목 표시

#### REM-027 Author Preview 고급
- **담당**: FE
- **작업**:
  - 연결 가능한 노드 패널
  - 사용자 지정 레이아웃 저장
- **DoD**: 편집 UX 개선

---

## 구현 순서

```
Phase 1 (P0 필수) - 1주차
├── EPIC 0: Grade 노드 제거 (REM-001~003)
├── EPIC 1: 상태 시각화 (REM-004~006)
├── EPIC 2: 학습 세션 관리 (REM-007~009)
└── EPIC 3: Author Mode 완성 (REM-010~014)

Phase 2 (P1 중요) - 2주차
├── EPIC 4: 진단/통계 (REM-015~017)
├── EPIC 5: 엣지 시각화 (REM-018~019)
└── EPIC 6: UX 개선 (REM-020~023)

Phase 3 (P2 선택) - 3주차
└── EPIC 7: 선택 기능 (REM-024~027)
```

---

## Out of Scope
- 백엔드 API 개발 (프론트엔드 중심, LocalStorage 활용)
- 완전 미구현 작업 (curriculum_skilltree_research_v1, math-knowledge-graph-mvp)
- AI 기반 진단/추천 시스템

---

## 관련 파일

### 수정 필요
- `src/pages/AuthorEditorPage.tsx`
- `src/pages/LearnPage.tsx`
- `src/pages/EvalPage.tsx`
- `src/pages/DashboardPage.tsx`
- `src/pages/GraphPage.tsx`
- `src/components/LearningNodeLabel.tsx`
- `src/components/CurriculumGraphView.tsx`
- `src/lib/curriculum/graphLayout.ts`
- `src/lib/curriculum/validate.ts`

### 신규 생성
- `src/components/EdgeTypeSelectModal.tsx`
- `src/components/SubmitConfirmModal.tsx`
- `src/components/UnansweredModal.tsx`
- `src/components/DraftRestoreModal.tsx`
- `src/components/LearningStatusLegend.tsx`
- `src/components/EdgeLegend.tsx`
- `src/components/MathRenderer.tsx`
- `src/components/Spinner.tsx`
- `src/lib/learn/sessionStorage.ts`
- `src/lib/progress/nodeStatus.ts`
- `src/lib/progress/diagnostics.ts`
- `src/lib/curriculum/edgeStyles.ts`

---

## Verification

### P0 완료 조건
- [ ] Grade 노드가 그래프에서 보이지 않음
- [ ] 스킵 엣지로 연결 관계 유지됨
- [ ] 노드 상태별 색상/아이콘 구분 가능
- [ ] 상태 범례 표시됨
- [ ] 풀다가 나가도 답안 유지됨
- [ ] 재방문 시 이어풀기 모달 표시됨
- [ ] Author가 엣지를 추가/삭제할 수 있음
- [ ] 엣지 타입 선택 가능

### P1 완료 조건
- [ ] 대시보드에서 태그별 정답률 차트 표시
- [ ] 취약 영역 하이라이트
- [ ] 엣지 타입별 스타일 구분 가능
- [ ] 미입력 안내 모달 표시됨
- [ ] 제출 확인 모달 표시됨

### P2 완료 조건
- [ ] 수식이 올바르게 렌더링됨
- [ ] 채점 후 해설 표시됨
- [ ] 사이클/고아 노드 검증됨

### 품질
- [ ] `npm test` 통과
- [ ] `npm run build` 통과
