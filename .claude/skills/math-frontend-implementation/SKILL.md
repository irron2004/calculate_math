---
name: math-frontend-implementation
description: 수학 모험 프론트엔드(Vite + React 18 + ReactFlow)를 구현한다. 학생 UI, 그래프 시각화, 숙제 제출 화면, 조교 대시보드, 추천 이유 노출 UI, Playwright E2E가 필요할 때 반드시 이 스킬을 쓴다. "프론트", "React", "ReactFlow", "UI 구현", "E2E", "화면 추가" 표현이 나오면 트리거한다.
---

# Math Frontend Implementation

Vite + React 18 + ReactFlow 위에서 학습 UI를 구현하는 절차.

## 언제 쓰는가

- 신규 화면/라우트 구현
- ReactFlow 그래프 시각화 수정
- 추천 이유·진단 결과 UI 추가
- 조교/관리자 대시보드 구현
- 컴포넌트 단위/E2E 테스트 작성

## 워크플로우

### 1. 3-context 패턴 준수

기존 래핑 순서를 지킨다:
```tsx
<AuthProvider>
  <CurriculumProvider>
    <RepositoryProvider>
      <App />
    </RepositoryProvider>
  </CurriculumProvider>
</AuthProvider>
```

새 전역 상태는 **적절한 컨텍스트에 합류**. 네 번째 프로바이더를 쉽게 추가하지 않는다.

### 2. 라우트 규칙

```
/map                - ReactFlow 그래프 (학생 뷰)
/learn/:nodeId      - 학습 콘텐츠 + 스크래치패드
/eval/:sessionId    - 문제 풀이 평가
/homework/:id       - 숙제 제출
/author/*           - 편집 (admin 전용)
```

새 라우트 추가 시 기존 컨벤션 유지, 인증 가드는 기존 패턴 재사용.

### 3. API 호출: 계약 문서 기반

BE가 만든 `_workspace/api_contract_*.md`를 읽고 shape을 정확히 맞춘다. 추측 금지. shape이 맞지 않으면 **BE에 돌려보내지 말고** `SendMessage`로 차이점 공유 → 합의 → 수정.

### 4. ReactFlow 노드·상태 컬러

기존 규칙 유지:
- 노드 타입: `subject`, `grade`, `domain`, `standard`
- 상태 컬러: `CLEARED` 녹색, `AVAILABLE` 파랑, `IN_PROGRESS` 주황, `LOCKED` 회색
- 레이아웃: Dagre

색/모양 변경은 디자인 일관성을 깬다. 단일 화면에서 임의로 바꾸지 않는다.

### 5. 추천 이유 UI 규칙

추천 카드/리스트는 "왜 이 노드를 추천하는가" 문구를 **반드시 노출**한다. 근거가 없는 추천 UI는 미완성.

```tsx
<RecommendationCard
  node={node}
  reason={recommendation.reason} // 필수
/>
```

BE가 reason을 주지 않으면 계약 단계에서 추가 요청.

### 6. 테스트

**단위 테스트:** Vitest + `@testing-library/react` + jsdom
```tsx
it("shows reason when recommendation has one", () => {
  render(<RecommendationCard reason="2차함수 약점 확인" ... />)
  expect(screen.getByText(/약점 확인/)).toBeInTheDocument()
})
```

ReactFlow 사용 컴포넌트는 `src/setupTests.ts`의 ResizeObserver 폴리필이 로드되는지 확인.

**E2E:** Playwright, 핵심 플로우만 (숙제 배정 → 제출 → 결과)
```bash
npm run test:e2e
```

### 7. 빌드·타입 체크

```bash
npm run build  # tsc + vite build
```

타입 에러를 `any`로 덮지 않는다. 근본 원인 수정.

### 8. 경계면 확인 노트

구현 후 `_workspace/fe_api_usage_{feature}.md`에 실제 사용한 필드 명시. QA 시 BE 응답과 교차 확인하기 위한 기록.

## 의존 스킬

- `math-backend-implementation` — API 계약(shape) 합의
- `student-state-analysis` — 추천 이유 UI 데이터 구조 확인

## 원칙

- **3-context 중첩 유지**
- **API shape 추측 금지** — 계약 문서 준수
- **추천 이유 노출 필수**
- **ReactFlow 색/타입 일관성**
- **타입 에러를 `any`로 덮지 않기**

## 참고
- `curriculum-viewer/src/` 전체 구조
- `03_문서/docs/curriculum_viewer_v1_contract.md`
- `03_문서/docs/curriculum_viewer_v1_validation_rules.md`
