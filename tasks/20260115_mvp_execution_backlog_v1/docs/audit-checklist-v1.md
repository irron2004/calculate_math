# Audit Checklist & v1 기준(뷰어+검증기) — SSoT

이 문서는 `curriculum-viewer`의 **현재 구현 상태를 빠르게 분류(Audit)** 하기 위한 체크리스트와,
v1에서 반드시 제공해야 하는 범위(뷰어+구조 검증기) / v2로 미룰 범위를 **단일 결론(SSoT)** 으로 고정한다.

---

## 0) 상태 정의 (AC)

- **DONE**: v1 요구사항을 충족하며, 수동 확인 또는 테스트로 재현 가능하고 “추가 수정 없이” 사용 가능한 상태.
- **PARTIAL**: 기능은 존재하지만 v1 요구사항과 정책/UX/출력 규격이 달라 “수정이 필요한” 상태.
- **TO-DO**: v1에 필요하지만 기능/흔적이 없거나, 현재 UX에서 접근/사용이 불가능한 상태.
- **VERIFY**: 흔적은 있으나 v1 충족 여부가 불명확하여, 체크리스트에 따라 “직접 실행/증빙”이 필요한 상태.

---

## 1) v1 범위(뷰어+구조 검증기) vs v2 범위

### v1(반드시 제공)
- **정적 커리큘럼 로딩**: `public/data/curriculum_math_v1.json` 로딩/오류 처리
- **탐색 뷰어**: 트리(Explorer) + 그래프(React Flow + dagre) + 노드 상세 패널
- **구조 검증기**:
  - CLI: `npm run validate:data` (exit code로 성공/실패 판정)
  - UI: 리포트 페이지에서 이슈 목록 확인/필터링/점프
- **품질 게이트**: `npm test`, `npm run build`가 통과

### v2(미룸)
- 학습/채점(AttemptSession, 제출, 평가 페이지), 진행 상태(CLEARED/LOCKED 등), 추천/대시보드(학습자용), 인증/권한(학생 계정) 고도화

---

## 2) Audit 체크리스트 (AC)

### 2.1 라우트/페이지(현재 코드 기준)

라우트 정의: `curriculum-viewer/src/App.tsx`

| Route | 페이지(파일) | v1 포함 | Audit 체크 |
|---|---|:---:|---|
| `/login` | `src/pages/LoginPage.tsx` | (선택) | 화면 렌더/에러 없음 |
| `/signup` | `src/pages/SignupPage.tsx` | (선택) | 화면 렌더/에러 없음 |
| `/dashboard` | `src/pages/ExplorerPage.tsx` | Y (트리 탐색) | 트리 렌더 + 검색/포커스 동작 |
| `/map` | `src/pages/GraphPage.tsx` | Y | dagre 자동 레이아웃 + fitView |
| `/report` | `src/pages/HealthPage.tsx` | Y | 이슈 목록/필터/점프 동작 |
| `/learn/:nodeId` | `src/pages/V2UnavailablePage.tsx` | N (v2) | v1에서는 안내/차단 대상 |
| `/eval/:sessionId` | `src/pages/V2UnavailablePage.tsx` | N (v2) | v1에서는 안내/차단 대상 |

네비게이션(UI): `curriculum-viewer/src/components/AppLayout.tsx`
- 상단 메뉴: 트리(`/dashboard`), 지도(`/map`), 리포트(`/report`)
- v1 목표: 메뉴는 **트리/그래프/검증(리포트)** 만 노출하는 것이 원칙

증빙(채울 항목, FE-1):
- [ ] 각 v1 페이지 스크린샷(또는 동등 증빙) 첨부
- [ ] 각 라우트 진입 시 콘솔 에러/크래시 없음 확인

### 2.2 데이터(로딩 경로/실패 동작)

로더(SSoT): `curriculum-viewer/src/lib/curriculum/CurriculumProvider.tsx`
- 로딩 경로: `fetch('/data/curriculum_math_v1.json')`
- 실패 동작:
  - HTTP 오류 시 `Failed to load curriculum data (HTTP <status>)` 메시지를 `error`로 노출
  - 각 페이지는 `loading/error`를 표시하고, 크래시하지 않아야 함

데이터 파일:
- 샘플: `curriculum-viewer/public/data/curriculum_math_v1.json`
- 문제은행(참고): `curriculum-viewer/public/data/problems_v1.json` (v2 학습/채점에서 사용)

증빙(채울 항목, FE-1):
- [ ] 로딩 성공 시 UI에 노드 수/트리/그래프가 표시됨
- [ ] 로딩 실패(예: 파일명 변경/404 가정) 시 에러 메시지 표시되고 앱이 유지됨

### 2.3 구조 검증기(validator) — CLI & UI

CLI(SSoT):
- 커맨드: `cd curriculum-viewer && npm run validate:data`
- 스크립트: `curriculum-viewer/scripts/validate-data.mjs`
- 기대: 데이터 계약 위반 시 실패(Exit code 1), 정상 데이터면 성공(Exit code 0)

UI(SSoT):
- 페이지: `curriculum-viewer/src/pages/HealthPage.tsx`
- 규칙 엔진: `curriculum-viewer/src/lib/curriculum/validate.ts`
- 기대:
  - 이슈 목록을 `severity/code/message/nodeId/relatedId` 기준으로 탐색 가능
  - 이슈(row) 클릭 시 해당 노드로 focus 전달(현재: `/dashboard?focus=<nodeId>`)

증빙(채울 항목, FE-1):
- [ ] `npm run validate:data` 실행 결과(성공/실패 중 1개 이상) 캡처
- [ ] `/report`에서 이슈 필터/검색/점프 동작 캡처

### 2.4 빌드/테스트(품질 게이트)

- 실행: `cd curriculum-viewer && npm run dev`
- 테스트: `cd curriculum-viewer && npm test`
- 빌드: `cd curriculum-viewer && npm run build`

증빙(채울 항목, FE-1):
- [ ] `npm test` 통과 로그
- [ ] `npm run build` 통과 로그

---

## 3) 백로그 v1 포함/제외(v2) 분류표 (AC)

기준: “뷰어+구조 검증기”는 v1, “학습/채점/진행/대시보드(학습자)”는 v2.
아래 항목은 `tasks/20260115_mvp_execution_backlog_v1/task.md`를 기준으로 분류한다.

| ID | 항목 | v1/v2 |
|---|---|---|
| MVP-A00 | Audit 기능 인벤토리 체크리스트 작성 | v1 |
| MVP-A01 | 즉시 채점→일괄 제출 채점 영향도 분석 | v2 |
| MVP-A02 | 학생 모드 vs Author 모드 화면/권한/라우트 정리 | v1 |
| MVP-010 | 로그인/세션 유지(학생) | v2 |
| MVP-090 | 노드별 진행 데이터 모델 | v2 |
| MVP-073 | 클리어 판정(>=80%) + 저장 | v2 |
| MVP-040 | 지도/트리/그래프 렌더 + 상세 패널 | v1(뷰어 부분) / v2(학습자 UX 확장) |
| MVP-0303 | 지도 상태 시각화(CLEARED/LOCKED 등) | v2 |
| MVP-0304 | LOCKED 사유 안내 | v2 |
| MVP-0305 | 도전하기 버튼 활성 규칙 | v2 |
| MVP-0404 | 문제 풀이 화면 | v2 |
| MVP-0406 | 제출 API + 결과 저장 | v2 |
| MVP-0403 | 답안 임시저장(DRAFT)+이어풀기 | v2 |
| MVP-0405 | 미입력 안내/제출 모달 | v2 |
| MVP-0502 | 평가 페이지 강화 | v2 |
| MVP-0503 | 태그별 정답률 | v2 |
| MVP-0504 | 클리어 후 잠금해제 반영 | v2 |
| MVP-0505 | 다음 노드 CTA | v2 |
| MVP-0506 | 오답 해설 표시 | v2 |
| MVP-0601 | 대시보드(학습 현황) | v2 |
| MVP-0602 | 네비에 대시보드 메뉴 추가 | v2 |
| MVP-0701 | 리포트(학습 통계/약점) | v2 |
| MVP-0702 | 개발자용 검증 리포트를 Author로 이동 | v1(검증기 유지) / v2(학습 리포트 분리) |

---

## 4) v1 완료 조건(Verification) 5개+ (AC)

아래는 “검증 가능한 문장”으로 작성된 v1 완료 조건이다.

1. `curriculum-viewer/public/data/curriculum_math_v1.json` 기준으로 `npm run validate:data`가 Exit code 0이다.
2. 의도적으로 깨진 데이터(예: 중복 id)로 `npm run validate:data`가 Exit code 1이다.
3. `/report`에서 이슈 목록이 렌더되고, 검색/코드 필터가 동작한다.
4. `/report`에서 nodeId가 있는 이슈 행을 클릭하면 `/dashboard?focus=<nodeId>`로 이동하며, 상세 패널이 해당 노드로 업데이트된다.
5. `/map`에서 dagre 자동 레이아웃이 적용된 그래프가 렌더되며, `fitView`가 적용되어 초기 화면에 그래프가 들어온다.
6. `/map`에서 노드 클릭 시 상세 패널이 업데이트되고, focus가 있으면 해당 노드로 센터링된다.
7. `npm test`가 통과한다.
8. `npm run build`가 통과한다.
