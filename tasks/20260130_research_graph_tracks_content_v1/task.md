---
workflow: code
graph_profile: frontend
---

# Research Graph: track(T1/T2/T3) content format (v1)

## Goal
`/author/research-graph`에서 **T1/T2/T3 트랙을 바꿨을 때** 노드 hover(우측 패널)와 Suggestions 카드에 표시되는 내용이 아래 “양식”으로 일관되게 보이도록 **research patch(T1/T2/T3) 데이터를 정리/보강**한다.

## Background
- hover 패널은 현재 아래 규칙으로 내용을 만든다.
  - `textbookUnit`: `alignsTo`로 연결된 `achievement.label + achievement.text`를 “목표”로 표시
  - `achievement`: `label + text`를 “목표”로 표시
  - 예시 문제: `problems_2022_v1.json`의 `problemsByNodeId[achievementId]`의 `prompt`를 표시(정답 미표시)
- 그런데 현재 `patch_T1/T2/T3.json`은 `prereq` 중심이라,
  - **proposed 단원(P_TU_*)**은 `alignsTo`가 없어 hover 패널에서 목표/예시가 비어보일 수 있다.

## “표시 양식”(v1)
### Node(단원/성취기준) hover 패널
- **목표**: (최대 8개)
  - 단원(textbookUnit): alignsTo된 성취기준 목록
  - 성취기준(achievement): 자기 자신
- **예시 문제**: (최대 2개)
  - `prompt`만 노출(정답/풀이 노출 금지)

### Suggestions 카드(Research Suggestions)
- Node: `reason`은 “왜 필요한지”를 1~2문장으로.
- Edge: `rationale`은 “왜 prereq인지”를 1~2문장으로.
- `confidence`는 0~1 범위 유지.

## Scope (In)
### 1) Patch 데이터 보강 (T1/T2/T3)
수정 대상:
- `curriculum-viewer/public/data/research/patch_T1.json`
- `curriculum-viewer/public/data/research/patch_T2.json`
- `curriculum-viewer/public/data/research/patch_T3.json`

요구사항:
- proposed 단원 노드(`add_nodes[].id`가 `P_TU_`로 시작하는 노드)는 **목표가 비지 않게** 만든다.
  - (권장) `add_edges`에 `edgeType: "alignsTo"`를 추가하여, proposed 단원 → 관련 `achievement`를 연결한다.
  - (권장) `confidence`, `rationale`도 함께 채운다.
  - (예) `P_TU_solid_figures_bridge -> 6수03-03`, `P_TU_solid_figures_bridge -> 6수03-04` 등
- `add_nodes[].reason`는 “bridge가 필요한 이유/어떤 jump를 완화하는지”를 1~2문장으로 정리한다.
- `add_edges[].rationale`는 “해당 단원 성취기준 수행에 직접 필요한 선수” 중심으로 정리한다.

> NOTE: 현재 코드가 research patch의 `alignsTo` 엣지를 UI에 반영하지 않는다면, 아래 ‘Prereq(선행 작업)’도 같이 진행해야 한다.

### 2) 예시 문제 데이터 보강
수정 대상:
- `curriculum-viewer/public/data/problems_2022_v1.json`

요구사항:
- T1/T2/T3에서 alignsTo로 참조되는 **achievement id**마다 예시 문제 1개 이상 제공.
- 문제는 `type: "numeric"`로 통일하고, UI에서는 `prompt`만 보여준다(정답은 파일에 포함 가능).
- 정답/풀이를 문제 본문(prompt)에 포함하지 않는다.

## Prereq (선행 작업: 필요 시)
아래가 아직 구현되어 있지 않다면 함께 처리:
- research patch의 non-prereq 엣지(`alignsTo`, `contains` 등)가 그래프/hover 패널에 반영되도록 처리
  - 예: patch 적용 단계에서 base 그래프 엣지 목록에 “accepted된 add_edges”를 merge
  - hover 패널의 alignsTo 조회도 merge된 엣지를 기준으로 동작

## Acceptance Criteria
- T1/T2/T3 각각 선택 후, proposed 단원 hover 시 **목표(성취기준 텍스트)**와 **예시 문제(prompt)**가 최소 1개 이상 보인다.
- Suggestions 카드에서 Node/Edge가 읽기 쉬운 1~2문장으로 정리돼 있다.
- 문제 예시는 “정답 미표시” 원칙을 지킨다.
- 변경 후 `cd curriculum-viewer && npx vitest run src/pages/AuthorResearchGraphPage.test.tsx` 통과.

## Notes / Authoring Tips
- alignsTo는 “단원 목표/범위”, prereq는 “학습 순서(선수)”, contains는 “트리 구조(포함)”로 사용한다.
- 길이는 짧게(패널에서 스캔 가능해야 함). 한 번에 정답까지 풀어주지 않는다.

