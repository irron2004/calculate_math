# 20260122_remaining_implementation_v1

기존 task들에서 미구현된 기능들을 통합 정리한 백로그입니다.

## 개요

- **생성일**: 2026-01-22
- **목적**: 분산된 미구현 항목들을 한 곳에서 관리
- **우선순위**: P0 (필수) → P1 (중요) → P2 (선택)

---

## P0: 필수 구현 (MVP 완성)

### 1. Author Mode 완성
**출처**: `20260115_mvp_author_mode_v1`

| 항목 | 설명 | 관련 파일 |
|------|------|----------|
| 엣지 연결 UI | React Flow onConnect로 requires/prepares_for 엣지 추가 | `AuthorEditorPage.tsx` |
| 엣지 삭제 UI | 엣지 클릭 → 삭제 확인 → 제거 | `AuthorEditorPage.tsx` |
| 노드 드래그 + 레이아웃 저장 | 위치 변경 후 저장 | `graphRepository.ts` |
| 엣지 타입 선택 모달 | requires vs prepares_for 선택 UI | 신규 컴포넌트 |
| 실시간 검증 업데이트 | 편집 시 validation 자동 실행 | `AuthorValidatePage.tsx` |

### 2. 상태 시각화 완성
**출처**: `20260115_mvp_student_learning_v1`, `curriculum_viewer_ui_enhancement_v1`

| 항목 | 설명 | 관련 파일 |
|------|------|----------|
| 노드 색상 구분 | locked/available/in_progress/completed 색상 | `LearningNodeLabel.tsx` |
| 상태 아이콘 | 잠금/체크/진행중 아이콘 표시 | `LearningNodeLabel.tsx` |
| 범례 UI | 색상/아이콘 의미 설명 패널 | `LearningStatusLegend.tsx` |
| 진행률 바 | 노드별 완료 비율 표시 | 신규 컴포넌트 |

### 3. Grade 노드 제거
**출처**: `curriculum_viewer_graph_remove_grade_nodes_v1`

| 항목 | 설명 | 관련 파일 |
|------|------|----------|
| Grade 노드 필터링 | type === 'grade' 노드 숨김 | `graphLayout.ts` |
| 스킵 엣지 생성 | grade 자식 → grade 부모 연결 우회 | `graphLayout.ts` |
| 레이아웃 안정화 | 제거 후 레이아웃 재계산 | `graphLayout.ts` |

### 4. 학습 세션 관리
**출처**: `20260115_mvp_student_learning_v1`, `curriculum_viewer_student_mode_mvp_v1`

| 항목 | 설명 | 관련 파일 |
|------|------|----------|
| 임시저장 (DRAFT) | 풀다가 나가도 답안 유지 | `LearnPage.tsx` |
| 자동 복원 | 재방문 시 이전 답안 로드 | `LearnPage.tsx` |
| 이어풀기 UI | "이전 답안이 있습니다" 모달 | 신규 컴포넌트 |

---

## P1: 중요 기능

### 5. 진단/통계 시스템
**출처**: `20260115_mvp_execution_backlog_v1`, `curriculum_viewer_ui_enhancement_v1`

| 항목 | 설명 | 관련 파일 |
|------|------|----------|
| 태그별 정답률 | 문제 태그별 통계 집계 | `StudentReportPage.tsx` |
| 취약 영역 분석 | 낮은 정답률 태그 하이라이트 | `StudentReportPage.tsx` |
| 대시보드 차트 | 진행률/정답률 시각화 (Recharts) | `DashboardPage.tsx` |
| nodeId별 상태 계산 | 완전한 진행 데이터 모델 | `progress/` 모듈 |

### 6. Progression Edge 시각화
**출처**: `curriculum_viewer_graph_progression_v1`

| 항목 | 설명 | 관련 파일 |
|------|------|----------|
| 엣지 스타일 구분 | requires(실선) vs prepares_for(점선) vs progression(파선) | `CurriculumGraphView.tsx` |
| 범례 추가 | 엣지 타입별 설명 | 신규 컴포넌트 |
| 학년군 필터 완전 제거 | 전체 학년 동시 표시 | `GraphPage.tsx` |

### 7. UX 개선
**출처**: `curriculum_viewer_learning_bulk_submit_v1`, `curriculum_viewer_student_mode_mvp_v1`

| 항목 | 설명 | 관련 파일 |
|------|------|----------|
| 미입력 안내 모달 | "3번 문제를 입력하지 않았습니다" | `LearnPage.tsx` |
| 제출 확인 모달 | "정말 제출하시겠습니까?" | `LearnPage.tsx` |
| 다시 풀기 버튼 | 결과 화면에서 재도전 | `EvalPage.tsx` |
| 로딩/에러 상태 | 스피너, 에러 메시지 UI | 전역 |

---

## P2: 선택 기능

### 8. LaTeX 렌더링
**출처**: `curriculum_viewer_student_mode_mvp_v1`

| 항목 | 설명 | 관련 파일 |
|------|------|----------|
| KaTeX 통합 | 수식 렌더링 | `LearnPage.tsx` |
| 문제/해설 렌더링 | content 필드 파싱 | 신규 컴포넌트 |

### 9. 문제별 해설
**출처**: `curriculum_viewer_ui_enhancement_v1`

| 항목 | 설명 | 관련 파일 |
|------|------|----------|
| 해설 표시 | 채점 후 explanation 표시 | `EvalResultList.tsx` |
| 풀이 과정 보기 | 단계별 해설 UI | 신규 컴포넌트 |

### 10. 고급 검증
**출처**: `curriculum_graph_mvp_v1`

| 항목 | 설명 | 관련 파일 |
|------|------|----------|
| 사이클 감지 | DAG 위반 검출 | `validate.ts` |
| 고아 노드 검출 | 연결 없는 노드 경고 | `validate.ts` |
| 중복 엣지 검출 | 같은 연결 중복 경고 | `validate.ts` |

### 11. Author Preview 고급
**출처**: `curriculum_viewer_author_preview_interactive_v1`

| 항목 | 설명 | 관련 파일 |
|------|------|----------|
| 가능한 노드 패널 | 연결 가능한 노드 목록 표시 | `AuthorEditorPage.tsx` |
| 드래그/줌 UX | 부드러운 네비게이션 | `SkillGraphPreview.tsx` |
| 레이아웃 저장 | 사용자 지정 위치 유지 | `graphRepository.ts` |

---

## 완전 미구현 작업 (별도 검토 필요)

다음 작업들은 코드베이스와 무관하거나 대규모 작업으로 별도 검토가 필요합니다:

| 작업 | 상태 | 비고 |
|------|------|------|
| curriculum_skilltree_research_v1 | 미구현 | 에이전트 워크플로우 연구 작업 |
| math-knowledge-graph-mvp | 미구현 | 대규모 지식 그래프 구축 |

---

## 구현 순서 제안

```
Phase 1 (P0 필수)
├── 1. Grade 노드 제거 (의존성 없음, 먼저 완료)
├── 2. 상태 시각화 완성 (Grade 제거 후)
├── 3. 학습 세션 관리 (임시저장)
└── 4. Author Mode 완성

Phase 2 (P1 중요)
├── 5. 진단/통계 시스템
├── 6. Progression Edge 시각화
└── 7. UX 개선

Phase 3 (P2 선택)
├── 8. LaTeX 렌더링
├── 9. 문제별 해설
├── 10. 고급 검증
└── 11. Author Preview 고급
```

---

## 관련 파일 목록

### 수정 필요 파일
- `src/pages/AuthorEditorPage.tsx`
- `src/pages/LearnPage.tsx`
- `src/pages/EvalPage.tsx`
- `src/pages/DashboardPage.tsx`
- `src/pages/StudentReportPage.tsx`
- `src/pages/GraphPage.tsx`
- `src/components/LearningNodeLabel.tsx`
- `src/components/CurriculumGraphView.tsx`
- `src/lib/curriculum/graphLayout.ts`
- `src/lib/curriculum/validate.ts`
- `src/lib/repository/graphRepository.ts`

### 신규 생성 필요 파일
- `src/components/EdgeTypeSelectModal.tsx`
- `src/components/SubmitConfirmModal.tsx`
- `src/components/DraftRestoreModal.tsx`
- `src/components/EdgeLegend.tsx`
- `src/components/MathRenderer.tsx` (KaTeX)
- `src/lib/learn/sessionStorage.ts`

---

## 체크리스트

### P0 완료 조건
- [ ] Grade 노드가 그래프에서 보이지 않음
- [ ] 노드 상태별 색상/아이콘 구분 가능
- [ ] 풀다가 나가도 답안 유지됨
- [ ] Author가 엣지를 추가/삭제할 수 있음

### P1 완료 조건
- [ ] 대시보드에서 태그별 정답률 확인 가능
- [ ] 엣지 타입별 스타일 구분 가능
- [ ] 미입력 문항 안내 모달 표시됨

### P2 완료 조건
- [ ] 수식이 올바르게 렌더링됨
- [ ] 채점 후 해설 표시됨
- [ ] 사이클/고아 노드 검증됨
