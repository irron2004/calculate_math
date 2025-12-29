---
workflow: code
graph_profile: curriculum_viewer_v1
---

# ✅ Next Task: Curriculum Graph MVP v1 (React Flow + dagre)

## 목표
- `curriculum_math_v1.json`(성취기준 표준 노드) 로드
- 트리/그래프 시각화
- 자동 검증(오류 리포트)
- 리포트 클릭 → 트리/그래프로 점프(센터링)

## 작업 범위/제약
- 신규 개발은 `curriculum-viewer/`에서 진행
- `.legacy/`는 수정하지 않음

---

## Task 0 — 프로젝트 부트스트랩

**설명**: React+TS 웹 프로젝트 생성 및 기본 라우팅/레이아웃 세팅

**작업**
- React + TypeScript 프로젝트 생성
- 페이지 3개 라우팅 구성
  - `/tree` (Tree View)
  - `/graph` (Graph View)
  - `/health` (Validation Report)
- 공통 레이아웃(상단 탭 + 우측 상세 패널 영역) 뼈대 구성

**DoD**
- 3개 페이지 이동 가능
- 공통 레이아웃 유지
- 빌드/런 정상

---

## Task 1 — 데이터 스키마 & 로더

**설명**: JSON 구조를 타입으로 고정하고 인덱싱(lookup)이 가능한 형태로 로드

**작업**
- `CurriculumNode` TS type 정의
- `loadCurriculum()` 구현
  - JSON fetch (`/public/data/curriculum_math_v1.json`)
- 인덱스 생성
  - `nodeById: Map<string, CurriculumNode>`
  - `childrenById`, `parentById` (또는 node 내부 활용)
- 노드 경로(path) 계산 유틸(선택 노드의 breadcrumb용)

**DoD**
- 로딩 실패 시 에러 메시지 표시
- `nodeById.get(id)` O(1)로 조회 가능
- 샘플 JSON 로딩 후 노드 개수 화면에 표시(디버그)

---

## Task 2 — Validation Engine (검증 엔진)

**설명**: “꼬임”을 자동으로 잡는 v1의 핵심 기능

**검증 규칙(필수)**
- `E_DUP_ID`
- `E_MISSING_PARENT`
- `E_PARENT_NOT_LIST_CHILD`
- `E_CHILD_NOT_LINKED_BACK`
- `E_TYPE_HIERARCHY` (subject→grade_band→domain→standard)
- `E_ORPHAN` (루트에서 도달 불가)
- `E_CYCLE`
- `E_INVALID_DOMAIN` (NA/GE/ME/DA)
- `E_INVALID_GRADE_BAND` (1-2/3-4/5-6)

**작업**
- `validateCurriculum(nodes: CurriculumNode[]): ValidationResult[]`
- DFS/BFS 기반 orphan 탐지
- DFS 기반 cycle 탐지(visited/stack)
- type hierarchy 검사 유틸

**DoD**
- 샘플 JSON 기준 오류 0개(정상 데이터일 때)
- parent/children 일부러 깨면 해당 에러가 잡힘(간단 테스트)

---

## Task 3 — Tree View (탐색용)

**설명**: 데이터 탐색/검증 속도를 올리는 기본 UI

**작업**
- 트리 렌더 (subject → grade_band → domain → standard)
- 검색 입력
  - ID 검색
  - 텍스트 검색(text contains)
- 노드 클릭 시 우측 패널에 상세 표시
  - id, type, grade_band, domain, text
  - breadcrumb (루트→현재)
- “오류 하이라이트” 지원(Validation 결과 반영)

**DoD**
- 검색으로 노드 빠르게 찾을 수 있음
- 클릭 시 상세가 정확히 출력
- 오류 노드는 트리에서 시각적으로 구분(색/배지)

---

## Task 4 — Graph Build (React Flow 변환)

**설명**: CurriculumNode를 React Flow nodes/edges로 변환

**작업**
- `buildGraph(nodes)` 구현
  - React Flow node: `{id, type, position, data}`
  - edge: `{id, source, target}`
- 노드 타입별 커스텀 스타일 적용
  - subject, grade_band, domain, standard
- 클릭/선택 이벤트로 “상세 패널” 연동

**DoD**
- 그래프에 최소 30노드 정상 렌더
- 노드 클릭 시 상세 패널 업데이트

---

## Task 5 — Auto Layout (dagre 적용)

**설명**: 그래프가 엉키지 않게 자동 배치

**작업**
- `layoutWithDagre(nodes, edges, direction="TB")`
- 레벨별 간격/노드 크기 설정
- 레이아웃은 **초기 로딩/필터 변경 시 1회만** 실행

**DoD**
- 페이지 로드 시 자동 정렬
- 드래그로 노드 위치 변경 가능(선택)
- 렌더링 반복 시 레이아웃이 계속 재실행되지 않음

---

## Task 6 — Validation Report View (Health)

**설명**: 오류를 한 번에 확인하고 “점프”하는 화면

**작업**
- 검증 결과를 테이블로 출력
  - code / node_id / message / severity
- 필터
  - error만 보기
  - code별 필터
- 클릭 시
  - `/tree` 또는 `/graph`로 이동하면서 해당 node_id로 포커스

**DoD**
- 오류 테이블에서 클릭하면 해당 노드가 강조 표시됨
- 필터가 동작함

---

## Task 7 — Graph Jump & Highlight (핵심 UX)

**설명**: 리포트 → 그래프에서 해당 노드로 센터링 + 하이라이트

**작업**
- query param으로 포커스 전달
  - 예: `/graph?focus=KR.2022.E.MATH.3-4.NA.001`
- GraphView에서 focus id가 있으면
  - 해당 노드 선택 상태 처리
  - viewport center 이동 (fitView 또는 setCenter)
  - 하이라이트 스타일 적용
- 오류 노드에 배지/테두리 강조(Validation 연동)

**DoD**
- Health 화면에서 클릭 → Graph에서 해당 노드가 화면 중앙에 옴
- 클릭한 노드가 확실히 눈에 띔(강조 스타일)

---

## Task 8 — “초3” 필터 준비(다음 MVP 연결점)

**설명**: v2에서 초3 범위 확장을 쉽게 만들기 위한 최소 확장 포인트

**작업(최소)**
- grade_band 필터 UI
  - 1-2 / 3-4 / 5-6 토글
- domain 필터 UI
  - NA/GE/ME/DA

**DoD**
- 필터 변경 시 트리/그래프가 해당 범위만 보여줌
- 필터 변경 시 레이아웃 재적용(1회)

---

# 산출물(Deliverables)
- `CurriculumNode` 타입 + 로더
- `validateCurriculum()` 엔진 + 에러 코드
- Tree / Graph / Health 3개 화면
- dagre 레이아웃 적용
- Health → Graph/Tree 점프 + 하이라이트

---

# 내가 제안하는 작업 순서(가장 빠른 루트)
1. Task 0 → 1
2. Task 2 (검증 엔진)
3. Task 4 → 5 (그래프 먼저 띄우기)
4. Task 7 (점프/하이라이트)
5. Task 3 (트리)
6. Task 6 (리포트)
7. Task 8 (필터)
