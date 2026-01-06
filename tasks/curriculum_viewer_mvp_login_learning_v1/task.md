---
workflow: code
graph_profile: curriculum_viewer_v1
---

# Curriculum Viewer — MVP+ (Login + Tree + Learning)

## Goal
현재 `curriculum-viewer`의 진행 상태(그래프 일부 구현, 트리/리포트 Placeholder)를 기반으로, **한 번에 MVP 데모가 가능한 수준**까지 기능을 완성한다.

추가 요구:
- 로그인 기능
- 로그인 후 Tree “활성화”(비로그인 시 Tree는 잠김/비활성)
- Tree에서 노드 클릭 시 **설명 + 문제풀이 화면**으로 진입
- **학년군(grade_band) 노드는 사용하지 않는다**(UI/데이터에서 제거 또는 무시). 학년 정보는 노드 상세(메타)에서만 표시한다.

---

## Current Status (확인 결과)
- 라우팅/레이아웃은 이미 존재: `/tree`, `/graph`, `/health` + 우측 상세 패널 (`curriculum-viewer/src/App.tsx`)
- `/tree`와 `/health`는 아직 Placeholder (`curriculum-viewer/src/pages/ExplorerPage.tsx`, `curriculum-viewer/src/pages/HealthPage.tsx`)
- `/graph`는 React Flow + dagre로 그래프 렌더링/노드 클릭 상세는 동작하지만,
  - 학년군 필터 UI가 남아있고(전체 렌더 아님)
  - `progression` 엣지는 아직 화면에 연결되지 않음 (`curriculum-viewer/src/pages/GraphPage.tsx`)
- `progression` 엣지 생성 로직/테스트는 이미 구현되어 있음 (`curriculum-viewer/src/lib/curriculum/progression.ts`)
- `npm run validate:data`, `npm test`, `npm run build`는 현재 통과

---

## Remaining Work Checklist (이 티켓에서 완료해야 할 일)

### 1) Login + Tree 활성화
- [ ] `/login` 페이지/라우트 추가
- [ ] localStorage 기반 로그인 세션 유지 + 로그아웃
- [ ] 비로그인 상태에서 `/tree` 잠금(redirect 또는 disabled UI + CTA)
- [ ] 헤더에 로그인 상태 표시/로그아웃 버튼

### 2) 공용 데이터 로더/포커스
- [ ] `curriculum_math_v1.json` 로딩/인덱싱을 공용 훅/모듈로 분리(페이지 간 공유)
- [ ] `?focus=<nodeId>` 지원(`/tree`, `/graph`) + 선택 노드 상태 공유

### 3) Tree Explorer 구현
- [ ] 계층 트리 렌더(학년군 노드 제거): `subject → grade → domain → standard`
- [ ] 검색(ID/title/text) + 결과 포커스/하이라이트
- [ ] 노드 클릭 시 우측 상세 갱신(메타 + breadcrumb + 부모/자식 링크)
- [ ] `standard` 클릭 시 `/learn/<nodeId>`로 이동

### 4) Learning (설명 + 문제풀이)
- [ ] `/learn/:nodeId` 라우트 + UI(설명/문제/제출/결과)
- [ ] 문제 데이터 파일 추가: `curriculum-viewer/public/data/problems_v1.json`
- [ ] 최소 1개 문제 타입 구현(`numeric` 정규화 비교) + 단위 테스트
- [ ] 학습 결과 localStorage 저장(최소 last result)

### 4.5) (선택) Gemini CLI로 문제 생성
- [ ] Gemini CLI를 호출하는 스크립트 추가(목표 텍스트 → `problems_v1.json` 갱신)
- [ ] 최소 사용 예시/문서 추가(어떤 `--cmd` 형태로 호출하는지)
- [ ] 생성된 문제는 `numeric` 타입만 사용(현 채점기 제약)

### 5) Graph 개선(Progression + 전체 렌더)
- [ ] 학년군 필터 제거 + 항상 전체 렌더
- [ ] `contains` + `progression` 엣지 동시 표시(스타일 구분 + legend)
- [ ] `grade` 노드는 그래프에 표시하지 않음 + subject→domain 스킵 엣지로 연결 유지
- [ ] `?focus=<nodeId>`로 진입 시 자동 선택 + 가능하면 센터링

### 6) Health(Validation Report)
- [ ] UI용 validation 엔진(TS) 구현(중복/부모누락/양방향불일치/계층/orphan/cycle)
- [ ] `/health` 테이블 + 필터 + 클릭 시 `/tree` 또는 `/graph`로 점프(`?focus=`) + 하이라이트

---

## Scope (이번 티켓에 포함)

### A) 공통 레이아웃/상태
- 공통 데이터 로더 + 인덱스 생성(페이지 간 공유)
  - `fetch('/data/curriculum_math_v1.json')`
  - `nodeById`, `parentById`, `childrenById`
  - breadcrumb/path 유틸
- “포커스/선택 노드”를 URL로 전달 가능
  - 예: `/graph?focus=<nodeId>`, `/tree?focus=<nodeId>`, `/learn/<nodeId>`

### B) Login (MVP용 간단 세션)
- `/login` 페이지 추가
- 최소 요구: “로그인/로그아웃”, 로그인 상태 유지(localStorage)
- 인증 방식(가벼운 MVP): **프론트엔드 로컬 세션**
  - 사용자명 + 비밀번호 입력(예: demo/demo) 또는 “임의 사용자명 허용” 중 택1
  - 보안 목적 아님(데모 목적). 추후 BE 인증으로 교체 가능하도록 구조화(Provider/Context)
- 로그인 전에는 Tree가 **비활성**
  - `/tree` 접근 시 로그인 페이지로 redirect 또는 Tree 영역 disabled + 로그인 CTA
  - 상단 헤더에 로그인 상태/로그아웃 버튼 표시

### C) Tree Explorer 구현
- 계층 트리 렌더:
  - `subject → grade → domain → standard`
- 검색 기능(상단):
  - ID 검색(정확/부분)
  - title/text 키워드 검색(부분 일치)
- 노드 클릭:
  - leaf(`standard`)면 `/learn/<nodeId>`로 이동
  - leaf가 아니면 expand/collapse + 우측 상세 패널 업데이트
- 우측 상세 패널(최소):
  - id/type/title/text(있으면)/meta(grade, domain, domain_code, official_code)
  - breadcrumb(루트 → 현재)
  - 부모/자식 링크(클릭 시 해당 노드로 포커스 이동)

### D) Learning (설명 + 문제풀이)
- 라우트: `/learn/:nodeId`
- 화면 구성(최소):
  - 상단: 노드 제목/학년/영역
  - 본문: 성취기준 텍스트/설명(text)
  - 문제 리스트 + 답안 입력 + 제출
  - 채점 결과 표시(정답/오답, 정답 보기)
- 문제 데이터(MVP):
  - 정적 파일로 시작: `curriculum-viewer/public/data/problems_v1.json`
  - `nodeId -> problems[]` 매핑
  - 문제 타입 최소 1개는 구현: `numeric`(숫자 입력, 공백/콤마 제거 후 비교)
  - 해당 노드에 문제가 없으면 “문제 준비중” 상태 표시
- 학습 상태(MVP):
  - localStorage에 노드별 마지막 제출 결과 저장(정답률/완료 배지 등은 선택)

### E) Graph View 개선(Progression 포함)
- 학년군 필터 제거(항상 전체 렌더)
- `contains` edge + `progression` edge 동시 표시
  - `progression` 생성 로직은 `src/lib/curriculum/progression.ts` 사용(이미 존재)
  - 스타일로 구분: dashed + 다른 색 + (선택) 라벨/legend
- (선택) `grade` 노드 숨김 + subject→domain 스킵 엣지
- 노드 클릭 시 우측 상세 패널 유지 + 선택 노드 하이라이트 유지
- `?focus=<nodeId>`로 들어오면 해당 노드 자동 선택 + 화면 중앙으로 이동(가능하면)

### F) Health(Validation Report) 구현
- Validation 엔진(TS) 추가: `validateCurriculum(nodes) -> issues[]`
  - 최소 검증(현재 `scripts/validate-data.mjs`와 별개로 UI용):
    - 중복 ID
    - parent 누락
    - parent↔children 불일치
    - 타입 계층 위반
    - orphan(루트에서 도달 불가)
    - cycle 탐지
- `/health`에서 테이블로 출력 + 필터(에러 코드/타입/검색)
- row 클릭 시:
  - `/tree?focus=<nodeId>` 또는 `/graph?focus=<nodeId>`로 이동(둘 중 하나를 기본으로)
  - 해당 노드 하이라이트/센터링

---

## Out of scope (이번 티켓 제외)
- 서버 기반 사용자 관리/권한(진짜 보안)
- (대규모) 문제 은행 구축/품질 관리(대량 생성, 난이도 캘리브레이션, 검수 워크플로우)
- 문제 풀이 결과의 DB 저장/통계(backend attempts 테이블 활용 등)
- 그래프 편집(Author Mode)

---

## Engineering Notes
- 변경 범위는 `curriculum-viewer/` 중심으로 하고, `.legacy/`는 건드리지 않는다.
- 단위 테스트는 vitest 기반으로 최소 추가:
  - progression edge UI 연결/스타일(선택)
  - validation 엔진(핵심 규칙 2~3개)
  - learning 채점 로직(숫자 정규화)
- 기존 커맨드가 모두 PASS:
  - `cd curriculum-viewer && npm run validate:data`
  - `cd curriculum-viewer && npm test`
  - `cd curriculum-viewer && npm run build`

---

## Acceptance Criteria (완료 조건)
- 로그인:
  - `/login`에서 로그인/로그아웃이 동작하고 새로고침 후에도 유지됨
  - 비로그인 상태에서 Tree는 잠김(redirect 또는 disabled UI)
- Tree:
  - 트리 탐색/검색이 동작하고 노드 선택 시 우측 상세가 갱신됨
  - `standard` 노드 클릭 시 `/learn/<nodeId>`로 이동
- Learning:
  - `/learn/:nodeId`에서 설명(text) + 문제풀이 + 채점 결과가 보임
  - 해당 노드에 문제가 없으면 “문제 준비중” 표시
- Graph:
  - 학년군 필터 UI가 사라지고 전체가 렌더됨
  - `MATH-2022-G-2-D-NA → MATH-2022-G-3-D-NA` progression edge가 dashed 스타일로 보임
- Health:
  - 검증 결과 테이블이 보이고, 항목 클릭 시 Tree/Graph로 점프 + 하이라이트 됨
- 품질:
  - `npm run validate:data`, `npm test`, `npm run build` 모두 0 exit code
