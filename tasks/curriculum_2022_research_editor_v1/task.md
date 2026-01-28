---
workflow: code
graph_profile: frontend
---

# Curriculum 2022 Research Graph Editor (v1)

## Goal
연구 결과로 생성된 prereq 그래프를 **화면에서 수정(연결 추가/삭제, 신규 노드 제안)** 할 수 있는 편집 UI를 만든다.

## Background
- 기준 데이터: `public/data/curriculum_math_2022.json`
- 연구 결과: `tasks/curriculum_2022_prereq_research/runs/*/research_*.md`
- 연구 결과는 여러 파일로 분산되어 있어 UI에서 선택/병합이 필요함

## Scope (In)
- 2022 데이터 기반 그래프 시각화 + prereq 편집
- 연구 결과(T1/T2/T3) 목록/상세 표시 및 수용/제외
- 편집 결과를 **patch JSON**으로 Export
- 로컬 저장(세션/브라우저 저장)으로 변경 유지

## Out of Scope
- 백엔드 API 연동
- 다중 사용자 협업
- contains/alignsTo 편집
- 자동 cycle 해결(검출만)

---

## Data/Loader
### D-1 연구 결과 데이터 정리
- [ ] 연구 결과 JSON을 `curriculum-viewer/public/data/research/` 아래로 복사/정리
  - `manifest.json`에 T1/T2/T3 최신 파일 매핑
- [ ] research patch 스키마 정의 (TS 타입)
- **DoD**: 프론트에서 manifest 로딩 후 연구 결과를 선택 가능

### D-2 2022 그래프 타입/로더
- [ ] `curriculum_math_2022.json` 타입 정의 (`nodeType`, `label`, `edges`)
- [ ] 전용 로더 추가 (`loadCurriculum2022Graph`)
- **DoD**: 2022 그래프를 안정적으로 로딩/에러 표시 가능

---

## UI/Graph Editor
### E-1 Research Graph Editor Page
- [ ] `/author/research-graph` 페이지 추가
- [ ] React Flow 기반 그래프 렌더
  - 기본 노드/엣지 표시
  - prereq edge만 강조
  - proposed node 뱃지/색상 구분
- **DoD**: 연구 결과 기반 그래프가 화면에 표시됨

### E-2 Edge 편집
- [ ] prereq edge 추가 (drag connect)
- [ ] edge 삭제 (클릭 삭제)
- [ ] 기존/연구/수동 추가 edge 스타일 구분
- **DoD**: 화면에서 prereq 연결 추가/삭제 가능

### E-3 Proposed Node 추가
- [ ] 신규 노드 생성 폼 (label + optional note)
- [ ] nodeType은 `textbookUnit`, `proposed: true`
- [ ] ID 규칙 `P_TU_<slug>` 적용 + 충돌 시 `_2` suffix
- **DoD**: 새 노드를 추가하고 edge 연결 가능

### E-4 Research Suggestions Panel
- [ ] T1/T2/T3별 edge 제안 리스트 표시
- [ ] “수용/제외” 버튼 제공
- [ ] 수용 시 그래프에 반영
- **DoD**: 연구 제안을 UI에서 선택적으로 적용 가능

### E-5 Export/Save
- [ ] 현재 변경분을 patch JSON으로 Export
  - `add_nodes`, `add_edges`, `remove_edges`
- [ ] LocalStorage 저장/불러오기
- **DoD**: 새로고침 후 편집 상태 유지 + Export 동작

---

## Tests/Docs
- [ ] research manifest 로더 테스트
- [ ] ID 생성 규칙 테스트
- [ ] patch export 스냅샷 테스트

---

## Commands
- `cd curriculum-viewer && npm run dev`
- `cd curriculum-viewer && npm run test`
