---
workflow: code
graph_profile: curriculum_viewer_v1
---

# Curriculum Viewer — `curriculum_math_v1.json` 시각화(v1)

## 목표
생성된 데이터 파일(`curriculum-viewer/public/data/curriculum_math_v1.json`)을 기반으로,
`curriculum-viewer` 앱에서 **노드/엣지 연결(그래프)** 을 바로 확인할 수 있게 만든다.

- 그래프: React Flow + dagre 자동 레이아웃
- 노드 클릭 → 우측 상세 패널에 노드 정보 표시
- 학년군/엣지 타입 필터로 구조 확인 가능

## 배경/입력 데이터
- 데이터 파일: `curriculum-viewer/public/data/curriculum_math_v1.json`
- 조사 정리 문서: `docs/2022_curriculum.md`
- JSON 스키마(핵심)
  - `nodes[]`: `id`, `nodeType`, `label`, `parentId?`, `gradeBand?`, `domainCode?`, `text?`, ...
  - `edges[]`: `id`, `edgeType`(`contains|alignsTo|prereq`), `source`, `target`, `note?`

## 범위(포함)
1. 데이터 로더/타입 정의
2. Graph View 화면 구현(React Flow + dagre)
3. 라우팅/네비/상세 패널 연결
4. 최소한의 UX(필터/카운트/에러 처리)
5. 빌드/테스트 통과

## 비범위(제외)
- 백엔드/API
- 데이터 편집/저장
- 문제/정답률/학습 세션
- 검증 리포트(Health) 고도화(표/점프는 다음 티켓)

---

## Task 1 — 타입/로더

**작업**
- `CurriculumGraph`, `CurriculumNode`, `CurriculumEdge` TS 타입 정의
- `fetch('/data/curriculum_math_v1.json')` 기반 로더 구현
- 로딩 상태/에러 상태 UI 처리
- `nodeById: Map<string, CurriculumNode>` 인덱스 생성

**DoD**
- 데이터 로드 성공/실패가 화면에서 구분됨
- 노드 개수/엣지 개수 표시 가능

---

## Task 2 — Graph View (React Flow 변환)

**작업**
- `reactflow`, `dagre` 의존성 추가
- `nodes/edges` → React Flow `Node[]/Edge[]` 변환
  - 노드 타입별 스타일/색상 매핑
  - 엣지 타입별 스타일(contains/alignsTo/prereq)
- dagre 레이아웃 함수 구현 및 적용(초기 로딩/필터 변경 시 1회)

**DoD**
- `/graph`에서 노드/엣지가 연결된 상태로 표시됨
- 레이아웃이 자동으로 정리되어 “뭉개지지” 않음

---

## Task 3 — 필터(학년군/엣지 타입)

**작업**
- 학년군 필터(기본: `3-4`, 옵션: `1-2`, `5-6`, `all`)
- 엣지 타입 토글
  - `contains` 기본 ON
  - `alignsTo`, `prereq` 기본 OFF
- 필터 변경 시 그래프 재구성 + 레이아웃 재적용(1회)

**DoD**
- 필터 변경으로 그래프의 노드/엣지 수가 즉시 반영됨

---

## Task 4 — 노드 클릭 → 상세 패널

**작업**
- 노드 클릭 시 우측 패널에 상세 표시
  - `id`, `nodeType`, `label`, `gradeBand`, `domainCode`, `officialCode`, `skillLevel`, `text`, `note`
- 선택된 노드 강조(테두리/섀도우 등)

**DoD**
- 클릭한 노드가 명확히 강조되고, 상세 내용이 항상 최신으로 갱신됨

---

## Task 5 — 라우팅/기본 페이지 정리

**작업**
- 라우팅: `/tree`, `/graph`, `/health` 유지
- `/` 진입 시 `/tree`로 redirect
- 상단 네비 링크(트리/그래프/리포트) 표시
- GraphView에서 필요한 CSS 추가

**DoD**
- 네비/라우팅 정상 동작
- 그래프 화면이 1페이지 내에서 정상 사용 가능(스크롤/뷰포트)

---

## Task 6 — 검증(빌드/테스트)

**작업**
- `npm run test` 통과
- `npm run build` 통과

**DoD**
- 로컬 실행 기준 3개 명령이 문제 없이 동작
  - `npm install`
  - `npm run dev`
  - `npm run build`

---

## 수동 확인 체크리스트
- `/graph` 진입 시 그래프가 보인다
- 기본 필터(초등 3~4 + contains)에서 트리형 연결이 보인다
- `alignsTo` 토글 ON 시 단원→성취기준 매핑 엣지가 추가로 보인다
- 노드 클릭 시 오른쪽 상세 패널에 해당 노드 정보가 나온다

