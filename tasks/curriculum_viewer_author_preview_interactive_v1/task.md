---
workflow: code
graph_profile: frontend
---

# Curriculum Viewer — Author Preview 개선 (가능 노드 표시 + 드래그/엣지 연결)

## Goal
관리자(Author) 모드의 Preview 화면에서:
1) **현재 그래프에서 “가능한 노드들”을 한눈에 확인**하고,
2) **마우스로 화면을 드래그/줌**하며,
3) **노드끼리 선(엣지)을 연결**해서 Draft 그래프를 빠르게 편집할 수 있어야 한다.

---

## Current Status
- Author Preview는 Draft 그래프를 `SkillGraphPreview`로 렌더링함
  - `curriculum-viewer/src/pages/AuthorEditorPage.tsx`
  - `curriculum-viewer/src/components/SkillGraphPreview.tsx`
- 현재 Preview는 사실상 **읽기 전용**
  - `nodesDraggable=false`, `nodesConnectable=false`
  - 노드 리스트/검색/가능 노드 표시 없음
- Draft 저장소는 `GraphRepository.saveDraft()`로 localStorage에 저장됨
  - `curriculum-viewer/src/lib/repository/graphRepository.ts`

---

## Definitions
### “가능한 노드” 정의 (Author Preview에서)
Author Preview는 학생 진도 데이터 없이도 쓸 수 있어야 하므로, 2가지 뷰를 제공한다.
1) **Startable Nodes**: 지금 바로 시작 가능한 노드(그래프 구조만으로 결정)
   - 기준(초안):
     - `node.start === true` 이거나
     - `requires` **incoming이 0개**인 노드
2) **Connectable Targets**: 선택한 source 노드에서 “연결 가능한 target 후보”
   - 기준(초안):
     - self-edge 금지
     - 중복 엣지 금지(`edgeType/source/target` 동일)
     - `requires`의 경우 **cycle 금지**
     - `requires`의 경우 **start 노드(target.start===true)로의 incoming 금지**(스키마 규칙 유지)

---

## SSoT
- `curriculum-viewer/docs/author-preview-interaction.md` (final rules + examples, layout positions schema + reset, edge type UI and error messages)

---

## Requirements

### EPIC A-1: “가능한 노드” 패널/표시 (P0)
#### A-1-1 노드 목록 + 검색 UI
- [ ] Preview 화면에 노드 목록 패널 추가(좌/우 사이드)
- [ ] 검색(제목/ID), 카테고리(core/challenge/formal) 필터
- [ ] 노드 클릭 시 Preview 그래프에서 해당 노드로 포커스(fitView)
- **DoD**: Draft 노드가 많아도 원하는 노드를 빠르게 찾고 이동 가능

#### A-1-2 Startable Nodes 섹션
- [ ] Startable Nodes만 모아 별도 섹션으로 표시(개수 포함)
- [ ] 그래프 렌더링에서도 Startable 노드를 시각적으로 강조(테두리/배지 등)
- **DoD**: “시작점 후보”가 즉시 확인 가능

#### A-1-3 Connectable Targets 섹션 (선택/연결 중)
- [ ] source 노드 선택 시 “연결 가능한 타겟 후보” 리스트 표시
- [ ] 엣지 타입 선택(기본 `requires`)에 따라 후보가 동적으로 변경
- [ ] 후보 클릭 시 해당 엣지 생성(= 마우스 연결의 대안 UX)
- **DoD**: 실수로 불가능한 연결을 시도하지 않도록 가이드됨

---

### EPIC A-2: 드래그/줌/레이아웃 (P0)
#### A-2-1 화면 팬/줌 UX
- [ ] 마우스로 캔버스 드래그(팬), 휠 줌 기본 동작 제공
- [ ] MiniMap/Controls는 유지 또는 개선
- **DoD**: 큰 그래프에서도 이동이 편함

#### A-2-2 노드 드래그 이동 + 레이아웃 저장
- [ ] 노드 드래그로 위치를 바꿀 수 있어야 함
- [ ] 변경된 위치를 Draft에 저장(새로고침 후 유지)
  - 저장 위치 제안: `graph.meta.layout.positions[nodeId] = { x, y }`
- [ ] “Reset Layout” 버튼(자동 배치 또는 기본 배치로 복원)
- **DoD**: Author가 원하는 레이아웃을 만들고 유지 가능

---

### EPIC A-3: 엣지 연결/편집 (P0)
#### A-3-1 드래그로 엣지 연결(onConnect)
- [ ] React Flow `onConnect`로 source→target 연결 생성
- [ ] 생성 시 엣지 타입 선택 UI 제공(기본 `requires`)
- [ ] Draft 저장소에 즉시 반영(`graphRepository.saveDraft`)
- **DoD**: 선 연결이 저장되고, Preview/Validate/Publish 플로우에서 재사용 가능

#### A-3-2 엣지 편집(삭제/타입 변경)
- [ ] 엣지 클릭 시 삭제 버튼 또는 타입 변경 UI
- [ ] 키보드 Delete로 삭제(가능하면)
- **DoD**: 잘못 연결한 선을 빠르게 수정 가능

#### A-3-3 제약/검증 UX
- [ ] self-edge/중복/requires cycle/requires→start target 금지 등 제약을 UI에서 차단
- [ ] 차단 시 사용자에게 이유를 명확히 표시(toast/inline message)
- **DoD**: “연결이 안 되는 이유”가 보이고 데이터가 깨지지 않음

---

### EPIC A-4: 테스트/문서 (P1)
- [ ] “connectable target 계산”, “requires cycle 검출”, “layout meta 저장/복원”에 대한 vitest 추가
- [ ] `docs/quickstart.md` 또는 Author 관련 문서에 Preview 편집 기능 사용법 추가(짧게)
- **DoD**: 회귀 방지 + 팀원이 기능을 쉽게 이해

---

## Out of Scope (이번 작업에서는 하지 않음)
- 학생 모드 문제풀이(/learn) 기능 자체 개선
- 서버 연동/협업 편집(동시성/권한)
- 그래프 스키마 버전 업(가능하면 `meta`를 사용해 무버전으로 해결)

---

## Commands
- `cd curriculum-viewer && npm run dev`
- `cd curriculum-viewer && npm test`
- `cd curriculum-viewer && npm run build`
