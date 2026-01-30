---
workflow: code
graph_profile: frontend
---

# Research Graph hover tooltip: description + example (v1)

## Goal
`/author/research-graph`에서 노드에 마우스를 올리면(hover) 아래 정보를 빠르게 확인할 수 있게 한다.
- **단원 목표**: 해당 단원이 다루는 성취기준/목표(요약)
- **문제 예시**: 목표를 평가할 수 있는 간단한 예시 문제 1~2개

> 핵심은 “UI 구현”보다 먼저 **노드 메타데이터(목표/예시)의 스키마/저장 위치/매핑 규칙**을 확정하는 것.

## Background
- 2022 그래프 데이터: `curriculum-viewer/public/data/curriculum_math_2022.json`
  - `achievement` 노드는 `text`(목표 설명)를 이미 갖고 있음.
  - `textbookUnit -> achievement`는 `alignsTo` 엣지로 연결되어 있어 “단원 목표”를 유도할 수 있음.
- 기존 문제 은행: `curriculum-viewer/public/data/problems_v1.json`
  - `problemsByNodeId` 키가 2022 노드 id(`2수01-01` 등)와 일치하지 않아 research-graph hover에서 바로 재사용하기 어려움.

## Design (Data Model)
### 1) Tooltip 대상/규칙
- **textbookUnit 노드**: “단원 목표”는 연결된 `alignsTo` 대상 `achievement`의 `label + text`를 표시.
- **achievement 노드**: “목표”는 node의 `label + text`를 표시.
- **proposed(manual/research) 노드**: 우선 `reason/note`를 목표/설명으로 표시(없으면 생략).

### 2) 문제 예시 데이터 스키마(제안)
- 별도 파일로 관리: `curriculum-viewer/public/data/problems_2022_v1.json`
- 형태는 기존과 동일한 **nodeId → problems[] 맵**을 유지:
  - key는 **achievement id**를 기본으로 사용(단원은 alignsTo로 achievement를 찾은 뒤 예시를 합성).
  - 문제 schema는 `curriculum-viewer/src/lib/learn/problems.ts`의 `Problem`(numeric)와 호환.

예시:
```json
{
  "version": 1,
  "problemsByNodeId": {
    "2수01-01": [
      { "id": "2수01-01-1", "type": "numeric", "prompt": "…", "answer": "10", "explanation": "…" }
    ]
  }
}
```

### 3) 최소 커버리지(v1)
- v1에서는 “작동 확인용”으로 **우선 10개 achievement**에 문제 예시를 작성/생성한다.
- 이후 확대 방식:
  - alignsTo가 있는 achievement(현재 72개)부터 순차적으로 확장
  - 도메인(NA/RR/GM/DP) 우선순위 또는 학년군 우선순위로 확장

## Scope (In)
- 2022 노드 모델/로더에서 `achievement.text`를 UI에서 사용할 수 있게 유지(파싱 필드 반영).
- `problems_2022_v1.json` 스키마 확정 + 샘플 데이터(10개 achievement).
- research-graph hover UI:
  - 노드 hover 시 tooltip/panel에 목표 + 예시 문제 표시
  - 데이터가 없으면 “없음”이 아니라 조용히 생략(UX: 노이즈 최소화)
- “어떻게 예시 문제를 추가할지” 작성 가이드(README 또는 task 하단에 명시).

## Out of Scope
- 모든 노드(전 139개) 100% 커버리지의 문제 예시 작성.
- 문제 생성 자동화 파이프라인(LLM CLI) 고도화/검증.
- tooltip 위치/애니메이션/디자인 완성도 최적화(기능 우선).

## Acceptance Criteria
- `/author/research-graph`에서 노드 hover 시 목표/예시가 표시된다(데이터 있는 노드 기준).
- 데이터가 비어도 렌더/hover에서 오류가 나지 않는다.
- `textbookUnit`은 alignsTo 기반으로 “목표”를 보여준다.
- 예시 문제는 최소 10개 achievement에 대해 1~2문항 제공된다.

## Commands
- `cd curriculum-viewer && npm run dev`
- `cd curriculum-viewer && npm test`

