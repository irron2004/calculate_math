---
workflow: code
graph_profile: frontend
---

# Research Graph hover UX 개선 (2026-02-07)

## Goal
`/author/research-graph`에서 노드에 마우스를 올릴 때(hover) 발생하는 **깜빡임(flicker)** 을 제거하고,
hover 시 **단원 목표 + 예시 문제**를 안정적으로 보여준다.

추가로, 그래프의 엣지 타입이 많아 헷갈리는 문제를 완화하기 위해 **엣지 범례(legend) + 표시 필터(토글)** 를 제공한다.

## Background / Problem
- 관리자용 research-graph에서 노드 hover 시 UI가 **깜빡이거나**(hover 상태가 빠르게 on/off) 패널이 불안정하게 보인다.
- 그래프에는 `contains`, `alignsTo`, `prereq` 3가지 엣지가 동시에 표시되어 **시각적으로 복잡**하고 의미가 혼동된다.

### Edge 타입 의미(현재 데이터 기준)
데이터 파일: `curriculum-viewer/public/data/curriculum_math_2022.json`
- `contains`: **구조(소속/포함)** 관계. 예: root → schoolLevel → gradeBand → domain → textbookUnit
- `alignsTo`: **단원(textbookUnit) ↔ 성취기준(achievement) 정렬/대응**. “이 단원은 이 성취기준들을 다룬다”
- `prereq`: **선수(선행학습) 관계**. `source`를 알고 있어야 `target`을 학습/이해하기 쉬움

## Scope (In)
1) Hover flicker 해결
- 노드 hover 시 highlight/패널이 **안정적으로 유지**되도록 이벤트/상태 업데이트를 개선
- 빠른 이동(노드↔노드, 노드↔패널)에서도 깜빡임 없이 동작

2) Hover 정보 표시(목표 + 예시 문제)
- `textbookUnit` 노드 hover 시:
  - 단원 목표: `alignsTo`로 연결된 `achievement`의 `label + text` 표시
  - 예시 문제: `curriculum-viewer/public/data/problems_2022_v1.json`에서 해당 achievement의 예시 문제 prompt 1~2개 표시
- `achievement` 노드 hover 시:
  - 목표: 자기 자신 `label + text`
  - 예시 문제: 해당 노드 id로 매칭되는 prompt 1~2개 표시
- 데이터가 없을 때는 오류 없이 자연스럽게 생략(또는 “없음” 안내)

3) 엣지 범례 + 표시 필터
- `contains`, `alignsTo`, `prereq` 각각의 의미와 스타일을 간단히 설명하는 범례 추가
- 엣지 타입별 표시/숨김 토글 추가(예: `contains` 숨기기, `alignsTo` 숨기기, `prereq`만 보기)

## Out of Scope
- 모든 노드에 대한 예시 문제 100% 커버리지 확장
- prereq 자동 추론/생성
- UI 디자인 전면 리뉴얼(기능/안정성 우선)

## Acceptance Criteria
- 노드 hover 시 **깜빡임이 재현되지 않는다**.
- hover 시 단원 목표/예시 문제(데이터 있는 경우)가 **즉시 확인 가능**하다.
- 엣지 범례가 있어 `contains/alignsTo/prereq` 차이를 사용자가 이해할 수 있다.
- 엣지 타입 토글로 그래프 복잡도를 줄일 수 있다(토글이 즉시 반영되고 에러 없음).

## Implementation Notes (suggested)
- 원인 후보:
  - hover 상태 변화가 ReactFlow 노드/엣지 재렌더를 유발하면서 enter/leave 이벤트가 연쇄적으로 발생
  - edge label/overlay가 마우스 히트 영역을 흔들어 `onNodeMouseLeave`를 유발
- 해결 방향(예시):
  - hover 해제에 짧은 debounce(예: 80~150ms) 적용 + 재진입 시 cancel
  - hover panel 위로 마우스를 옮겨도 “최근 hover 노드”를 유지(패널 읽기 UX)
  - edge label이 hover를 방해하면 label의 pointer-events 처리 검토

## Related Files
- UI: `curriculum-viewer/src/pages/AuthorResearchGraphPage.tsx`
- Edge styles: `curriculum-viewer/src/lib/curriculum2022/view.ts`
- Graph data: `curriculum-viewer/public/data/curriculum_math_2022.json`
- Example problems: `curriculum-viewer/public/data/problems_2022_v1.json`

## Commands
- `cd curriculum-viewer && npm run dev`
- `cd curriculum-viewer && npm test`

