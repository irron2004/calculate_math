# Graph Layout Rules v1 — React Flow + dagre (SSoT)

이 문서는 `curriculum-viewer`의 그래프 뷰(React Flow) 자동 레이아웃 기준을 **단일 결론(SSoT)** 으로 고정한다.
기본 레이아웃은 `dagre`를 사용하며, `ELK` 도입이 필요한 조건/비용을 함께 정의한다.

- 구현 참조(SSoT):
  - dagre 적용: `curriculum-viewer/src/pages/GraphPage.tsx`
  - contains edge 생성(grade 스킵/중복 방지): `curriculum-viewer/src/lib/curriculum/graphView.ts`
  - progression edge 생성(도메인 코드/학년 기반): `curriculum-viewer/src/lib/curriculum/progression.ts`
- 샘플 데이터(검증/기대 결과 기준): `curriculum-viewer/public/data/curriculum_math_v1.json`

---

## 1) 레이아웃 방향 + 주요 간격 기본값 (AC)

### 1.1 방향(Direction)

- 기본 방향: `TB` (Top → Bottom)
- 옵션 방향: `LR` (Left → Right)

결정 기준(권장):
- `TB`: 트리형(contains) 구조를 위→아래로 읽기 쉽고, 표준(leaf) 노드가 많아도 “아래로 늘어나는” 형태가 자연스럽다.
- `LR`: 도메인/표준이 수평으로 과도하게 넓어져 가독성이 떨어질 때, 또는 화면이 가로로 넓은 환경(대형 모니터)에서 유리하다.

### 1.2 dagre 기본 파라미터(Default params)

`GraphPage.layoutWithDagre()`의 기본값을 SSoT로 고정한다.

- `rankdir`: `TB` (기본)
- `nodesep`: `30`
- `ranksep`: `60`
- `marginx`: `20`
- `marginy`: `20`

파라미터 의미(요약):
- `nodesep`: 같은 rank(같은 “줄”) 내 노드 간 간격
- `ranksep`: 인접 rank 사이 간격
- `marginx/marginy`: 전체 그래프 외곽 여백

---

## 2) children_ids 기반 contains edge 생성 규칙 (AC)

### 2.1 edge 의미

- `contains` edge: 데이터의 `children_ids`를 기반으로 “부모 → 자식” 포함 관계를 시각화한다.

### 2.2 생성 규칙(결정)

`buildContainsEdgeRefsSkippingGradeNodes(nodes, nodeById)` 기준:

1. `sourceId === targetId`인 self-edge는 생성하지 않는다.
2. 중복 방지: `${sourceId}->${targetId}` 키를 `Set`으로 관리해 한 번만 생성한다.
3. **grade 노드는 그래프에서 숨긴다** (`getGraphVisibleNodes()`가 `type==="grade"`를 제외).
4. 하지만 contains 구조를 잃지 않기 위해, parent가 grade를 자식으로 가질 때는 **grade를 “중간 노드”로 취급해 스킵 연결**한다:
   - `parent -> grade -> grandChild` 구조에서 `parent -> grandChild` edge를 생성한다.
   - 단, `grandChild`가 또 grade면 스킵한다(grade는 항상 숨김).

요약: “실제 데이터 트리에서 grade를 숨기되, 시각적 연결은 유지하기 위해 parent→(grade를 건너뛴)실제 표시 노드로 edge를 재구성”한다.

---

## 3) 레이아웃 입력 그래프 범위(중요)

GraphPage는 레이아웃 계산 입력으로 **contains edge만** 사용한다.

- 레이아웃 입력: `layoutWithDagre(graphNodes, containsEdges, ...)`
- 레이아웃 입력에서 제외: `progression` edge (점선, 도메인 간 인접 학년 연결)

의도:
- “계층(contains)”만으로 안정적인 배치를 만든 뒤,
- “학습 흐름(progression)”은 가독성 보조 오버레이로 표시한다.

---

## 4) 가독성 저하 케이스 + 완화책 (AC)

### 4.1 교차(crossing) 과다

상황:
- progression edge는 레이아웃에 반영되지 않으므로, 데이터 특성에 따라 점선 edge 교차가 늘어날 수 있다.

완화책(우선순위):
1. progression을 “보조 정보”로 유지(현재 정책 유지): contains 기반 구조가 읽히는 것이 1순위.
2. 간격 튜닝: `ranksep`을 키워 교차가 눈에 덜 띄게(세로 여유 확보).
3. 표시 제어: progression edge 토글(숨김/표시), 도메인별 필터로 교차 밀도 감소.

### 4.2 밀집/과도한 세로 길이

상황:
- 한 domain 아래에 표준(standard)이 많이 달리면 세로로 길어지고, 노드 간 간격이 좁아 보일 수 있다.

완화책:
1. 축약 표시: domain 노드만 우선 노출 + standard는 펼치기(접기) UX.
2. 간격 튜닝: `nodesep`/`ranksep` 확대.
3. 탐색 UX: `fitView` + `MiniMap`(현재 사용)을 유지하고, 선택 노드로 `setCenter` 이동(현재 사용).

### 4.3 긴 edge / 스킵 연결로 인한 시각적 거리 증가

상황:
- grade를 숨기면서 `subject -> domain` 스킵 연결이 생겨 edge가 길어질 수 있다(특히 subject가 여러 grade를 자식으로 갖는 경우).

완화책:
1. 필요 시 grade 표시 모드(grade를 숨기지 않는 모드) 제공(추후 옵션).
2. `LR` 방향으로 전환해 “긴 세로 줄기” 대신 “가로 흐름”을 선택.

---

## 5) dagre로 충분한 기준 + ELK 전환 기준/비용 (AC)

### 5.1 dagre로 충분한 경우(권장 기준)

아래를 만족하면 dagre를 기본으로 유지한다.

- 핵심 구조가 “계층(contains)”이며, contains 기준 배치가 읽히는 경우
- 노드/엣지 규모가 중간 수준이고(예: 수십~수백), 자동 배치 시간이 UX에 문제 없을 때
- edge routing(직교, 포트, 라벨 충돌 회피 등) 고급 요구가 낮을 때

### 5.2 ELK 전환 트리거(권장 기준)

아래 중 하나라도 지속적으로 문제가 되면 ELK 도입을 검토한다.

1. contains edge 자체에서 교차/겹침이 많아 “계층 구조가 읽히지 않음”
2. 컴파운드/그룹(예: grade band로 군집 유지), 제약 조건(정렬/고정)이 필요
3. edge routing 품질 요구(직교 라우팅, 포트/라벨/충돌 회피 등)가 명확
4. 대규모(예: 200+ 노드 이상)에서 성능/가독성 트레이드오프가 dagre 튜닝으로 해결되지 않음

### 5.3 ELK 전환 비용(요약)

- 의존성/번들 증가(ELK/elkjs)
- 레이아웃 옵션 학습/튜닝 비용(결과 “안정성/결정성” 확보 필요)
- 성능 대응 필요(대규모에서 Web Worker 분리 검토)
- 회귀 방지: 샘플 그래프/스크린샷/정성 기준을 테스트/문서로 추가 고정 필요

---

## 6) 샘플 데이터 기준 기대 레이아웃 결과 (AC)

기준 샘플: `curriculum-viewer/public/data/curriculum_math_v1.json` (현행 28 nodes)

전제:
- 그래프 표시에서 `grade` 노드는 숨김 처리된다.
- contains edge는 `children_ids` 기반이며, grade는 중간 노드로 스킵되어 연결된다.
- 레이아웃은 contains edge만으로 계산된다.

### 6.1 TB 기대 배치(서술)

TB 기본 레이아웃에서 기대 결과는 아래와 같다.

1. 최상단(rank 0): `subject` 1개 (`MATH-2022`)
2. 중간(rank 1): 각 `domain` 노드들이 배치된다(grade를 숨기므로 subject 아래로 domain들이 직접 연결되어 보임).
3. 하단(rank 2~): 각 domain 아래에 해당 `standard` 노드들이 매달린다(leaf).
4. progression(점선)은 domain 간 인접 학년 연결로 추가되며, 배치에는 영향 없이 오버레이로 표시된다.

가시적으로 “subject(1) → domain(n) → standard(m)”의 3단 계층이 주요 구조로 읽혀야 한다.

