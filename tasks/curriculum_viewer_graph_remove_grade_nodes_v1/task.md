---
workflow: code
graph_profile: curriculum_viewer_v1
---

# Graph View 개선 — 학년(grade) 노드 제거

## 배경
현재 `curriculum-viewer`의 Graph 화면에서 `grade` 노드가 “중간 레벨”로 렌더링되어 화면을 복잡하게 만든다.
교육과정의 목표는 학년으로 나누는 것이 아니므로, Graph에서는 학년을 **노드로 표현하지 않고** 노드 상세(메타)로만 보여주고 싶다.

---

## 목표
- Graph 화면에서 `grade` 타입 노드를 렌더링하지 않는다.
- 대신 시각적으로 자연스러운 구조가 되도록 “스킵 엣지”를 생성한다.
  - 예: `subject → domain` (기존에는 `subject → grade → domain`)
- 노드 상세 패널에는 여전히 `grade`(숫자)가 표시된다(도메인/성취기준 노드의 메타로 존재).

---

## 해야 할 일

### 1) GraphPage: grade 노드 숨김 + 스킵 엣지
- 렌더링 대상 노드에서 `type === 'grade'`를 제외한다.
- `contains` 엣지를 만들 때,
  - `subject → grade` 엣지는 생성하지 않는다.
  - `subject`의 자식이 `grade`라면, 그 `grade`의 자식(`domain`)으로 **subject→domain** 엣지를 생성한다.
  - `grade → domain` 엣지는 생성하지 않는다(grade 노드를 숨기므로).
  - `domain → standard`는 기존대로 유지한다.
- `progression` 엣지(buildProgressionEdges) 스타일/legend는 유지한다.
- MiniMap 색상 매핑에서 grade 타입 분기 제거(또는 숨김 처리).

### 2) 레이아웃 안정화
- dagre 레이아웃이 “contains” 구조를 기준으로 안정적으로 배치되도록,
  - 레이아웃용 엣지는 contains(스킵 포함)만 사용하고
  - progression은 스타일만 추가(레이아웃에 영향 최소화)하는 구조를 유지/정리한다.

### 3) QA/검증
- 아래가 모두 PASS:
  - `cd curriculum-viewer && npm run validate:data`
  - `cd curriculum-viewer && npm test`
  - `cd curriculum-viewer && npm run build`
- (선택) 최소 단위 테스트 1개 추가:
  - “Graph 빌드 결과에 grade 노드가 포함되지 않는다”
  - “subject→domain 스킵 엣지가 생성된다”

---

## Acceptance Criteria
- `/graph`에서 `grade` 노드가 보이지 않는다.
- `/graph`에서 `subject`가 `domain`으로 직접 연결되어 트리 구조가 유지된다.
- `progression` 엣지는 dashed 스타일로 유지되고 legend도 보인다.
- 클릭 시 우측 상세 패널에서 domain/standard 노드의 `Grade` 메타가 확인된다.

