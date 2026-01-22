# FE-1 Audit Report — curriculum-viewer 기능 인벤토리 (v1 기준 + 현재 구현 반영)

- 작성일: 2026-01-16
- 범위: `curriculum-viewer/` (뷰어 + 구조 검증기), `.legacy/`는 참고만

## 1) 라우트/페이지/주요 컴포넌트 매핑

라우트 정의: `curriculum-viewer/src/App.tsx`

| Route | Guard | Page | 주요 컴포넌트/의존 |
|---|---:|---|---|
| `/login` | - | `curriculum-viewer/src/pages/LoginPage.tsx` | `AuthProvider` |
| `/signup` | - | `curriculum-viewer/src/pages/SignupPage.tsx` | `AuthProvider` |
| `/dashboard` | Y | `curriculum-viewer/src/pages/ExplorerPage.tsx` | 트리 탐색, `NodeDetail`, `useFocusNodeId` |
| `/map` | Y | `curriculum-viewer/src/pages/GraphPage.tsx` | React Flow + dagre, 제목 검색 하이라이트, `NodeDetail`(상세 패널) |
| `/report` | Y | `curriculum-viewer/src/pages/HealthPage.tsx` | `validateCurriculum`, 필터/검색, 행 클릭 시 `/dashboard?focus=<nodeId>` |
| `/learn/:nodeId` | Y | `curriculum-viewer/src/pages/V2UnavailablePage.tsx` | v1에서는 안내/차단(v2 범위) |
| `/eval/:sessionId` | Y | `curriculum-viewer/src/pages/V2UnavailablePage.tsx` | v1에서는 안내/차단(v2 범위) |

네비게이션(UI): `curriculum-viewer/src/components/AppLayout.tsx`
- 상단 메뉴는 v1(트리/지도/리포트)만 노출 (`/learn`, `/eval`은 v1에서 안내/차단)

## 2) 주요 페이지 “동등 증빙”(테스트 기반)

> 본 문서의 “스크린샷”은 CI/로컬에서 재현 가능한 테스트(렌더/내비게이션 검증)로 대체한다.

- 트리(Explorer): `curriculum-viewer/src/pages/ExplorerPage.dataLoad.test.tsx`
  - 로딩 실패 시 사용자에게 에러 메시지 노출 및 크래시 없음 확인.
- 그래프(Map): `curriculum-viewer/src/pages/GraphPage.test.tsx`
  - 범례 렌더, 노드 클릭 시 상세 패널, “도전하기” CTA(LOCKED 비활성 포함) 확인.
- 리포트(Validator UI): `curriculum-viewer/src/pages/HealthPage.test.tsx`
  - 이슈 테이블 렌더, 행 클릭 시 `/dashboard?focus=<nodeId>` 점프 확인.

## 3) curriculum_math_v1.json 로딩 경로/실패 동작

로더(SSoT): `curriculum-viewer/src/lib/curriculum/CurriculumProvider.tsx`
- 로딩 경로: `fetch('/data/curriculum_math_v1.json')`
- 실패 동작:
  - HTTP 비정상(`!response.ok`) → `Failed to load curriculum data (HTTP <status>)`
  - 예외(네트워크/파싱 등) → 에러 문자열을 `error`로 저장
  - 각 페이지는 `loading/error`를 표시하고, 크래시하지 않아야 함
- 동등 증빙:
  - `curriculum-viewer/src/pages/ExplorerPage.dataLoad.test.tsx` (에러 메시지 + `.error` 클래스 확인)

## 4) 구조 검증기(validator) — CLI 실행 결과 증빙

스크립트: `curriculum-viewer/scripts/validate-data.mjs`

### 4.1 정상 데이터(성공)

- Command: `cd curriculum-viewer && npm run validate:data`
- Output:

```
OK: curriculum data is valid
```

### 4.2 의도적으로 깨진 데이터(실패)

- Fixture: `tasks/20260115_mvp_execution_backlog_v1/docs/fixtures/invalid_curriculum_missing_child.json`
- Command: `cd curriculum-viewer && npm run validate:data -- --file ../tasks/20260115_mvp_execution_backlog_v1/docs/fixtures/invalid_curriculum_missing_child.json`
- Result: Exit code 1 (error 존재)
- Output:

```
Data contract validation found 1 issue(s) (1 error(s), 0 warning(s))
- [error] missing_child nodeId=S relatedId=G — Missing child node: S (subject) -> G
```

## 5) 백로그 항목 분류(Done/Partial/To-do/Verify) + 근거

기준(SSoT): `tasks/20260115_mvp_execution_backlog_v1/docs/audit-checklist-v1.md`

| ID | 상태 | 근거(파일/테스트/동작) |
|---|---|---|
| MVP-A00 | DONE | 본 문서(`tasks/20260115_mvp_execution_backlog_v1/docs/FE-1_audit.md`) + 체크리스트(`tasks/20260115_mvp_execution_backlog_v1/docs/audit-checklist-v1.md`) |
| MVP-A01 | TO-DO | 영향도 분석 문서/산출물 없음 |
| MVP-A02 | PARTIAL | 메뉴는 v1만 노출(`curriculum-viewer/src/components/AppLayout.tsx`), 하지만 “Author vs Student” 권한/라우트 분리(역할 기반) 미구현 |
| MVP-010 | PARTIAL | 로컬 스토리지 기반 간이 인증(`curriculum-viewer/src/lib/auth/AuthProvider.tsx`), 서버 세션/사용자 분리 고도화 없음 |
| MVP-090 | DONE | 노드별 진행/상태 산출(`curriculum-viewer/src/lib/studentLearning/progress.ts`), 타입/저장소(`curriculum-viewer/src/lib/studentLearning/types.ts`, `curriculum-viewer/src/lib/studentLearning/storage.ts`) |
| MVP-073 | DONE | `CLEAR_THRESHOLD = 0.8` 및 cleared 판정(`curriculum-viewer/src/lib/studentLearning/types.ts`, `curriculum-viewer/src/lib/studentLearning/attemptSession.ts`) |
| MVP-040 | DONE | 트리/그래프/상세 패널(`curriculum-viewer/src/pages/ExplorerPage.tsx`, `curriculum-viewer/src/pages/GraphPage.tsx`) |
| MVP-0303 | DONE | 지도 상태 시각화 + 범례(`curriculum-viewer/src/pages/GraphPage.tsx`, `curriculum-viewer/src/components/LearningStatusLegend.tsx`) |
| MVP-0304 | DONE | LOCKED 사유(선행 노드) 표시 + 테스트(`curriculum-viewer/src/components/LearningNodeDetailPanel.tsx`, `curriculum-viewer/src/components/LearningNodeDetailPanel.test.tsx`) |
| MVP-0305 | DONE | 도전하기 버튼 규칙(LOCKED 비활성) + 테스트(`curriculum-viewer/src/components/LearningNodeDetailPanel.tsx`, `curriculum-viewer/src/components/LearningNodeDetailPanel.test.tsx`) |
| MVP-0404 | DONE | 문제 풀이 화면 + 제출 전 정오/정답 미노출 + 테스트(`curriculum-viewer/src/pages/LearnPage.tsx`, `curriculum-viewer/src/pages/LearnPage.test.tsx`) |
| MVP-0406 | PARTIAL | “제출 → 결과 저장”은 로컬 저장소 기반(서버 API 없음): `curriculum-viewer/src/pages/LearnPage.tsx`, `curriculum-viewer/src/lib/studentLearning/storage.ts` |
| MVP-0403 | DONE | DRAFT 임시저장 + 이어풀기(디바운스 포함) + 테스트(`curriculum-viewer/src/pages/LearnPage.tsx`, `curriculum-viewer/src/pages/LearnPage.test.tsx`) |
| MVP-0405 | TO-DO | 미입력 안내/제출 확인 모달 UX 없음 |
| MVP-0502 | DONE | 평가 요약 + 문항별 결과(내답/정답/정오) + 테스트(`curriculum-viewer/src/pages/EvalPage.tsx`, `curriculum-viewer/src/pages/EvalPage.test.tsx`) |
| MVP-0503 | TO-DO | 태그별 정답률 산출/표시 없음 |
| MVP-0504 | PARTIAL | “클리어 후 잠금해제 반영”은 상태 산출 로직 존재(`computeNodeProgressV1`)하나, 전체 UX(즉시 반영/리포트 연계)까지는 추가 검증 필요 |
| MVP-0505 | DONE | 다음 노드 CTA(평가 페이지) + 테스트(`curriculum-viewer/src/pages/EvalPage.tsx`, `curriculum-viewer/src/pages/EvalPage.test.tsx`) |
| MVP-0506 | TO-DO | 오답 해설(explanation) 노출 UX 없음 |
| MVP-0601 | TO-DO | 학습 현황 대시보드(통계/추천) 없음(현재 `/dashboard`는 트리 탐색) |
| MVP-0602 | TO-DO | (학습자 대시보드 기준) 네비 연결은 아직 의미상 미충족 |
| MVP-0701 | PARTIAL | 현재 `/report`는 개발자용 데이터 검증 리포트(학습 통계/약점 리포트 아님) |
| MVP-0702 | TO-DO | 개발자용 검증 리포트를 Author 모드로 분리하는 구조/라우트 없음 |

## 6) 재현/실행 방법(수동 확인)

- 실행: `cd curriculum-viewer && npm run dev`
- 로그인(간이): `/login`에서 임의 username 입력 후 이동
- 주요 확인:
  - `/dashboard`: 트리 탐색/검색/포커스(쿼리 `?focus=`) 동작
  - `/map`: 그래프 렌더/범례/노드 상세/LOCKED 사유/도전하기 버튼 규칙
  - `/report`: 코드/검색 필터, 이슈 행 클릭 시 `/dashboard?focus=<nodeId>` 이동
