---
workflow: code
graph_profile: curriculum_viewer_v1
---

# PRD v1 — Curriculum Viewer (성취기준 표준 노드 기반)

## 목적(1차 MVP)
- 한국 초등 수학 교육과정 “성취기준”을 표준 노드로 가져와 트리/그래프 시각화로 보여준다.
- 노드 구조(누락/중복/이상 깊이/순환 등)를 자동 검증하고 리포트한다.
- v1은 **뷰어+검증기**만 만든다(편집/문제풀이/정답률은 v2).

## 기본 가정(필요 시 수정)
- 대상 교과: 수학
- 버전 기준: 2022 개정 교육과정

## 신규 개발 위치(중요)
- 기존 코드는 `.legacy/`에 있다. v1 작업은 **`.legacy/`를 수정하지 않는다**.
- 신규 앱은 `curriculum-viewer/` 디렉터리로 만든다.

## 화면 설계 (MVP v1)

### Screen A — Curriculum Explorer (트리 뷰)
- 좌측: 트리 네비게이션
  - 교과(수학) → 학년군/학년 → 영역 → 성취기준(leaf)
- 상단: 검색(키워드/ID)
- 우측: 노드 상세
  - 노드 텍스트(성취기준 문장)
  - 메타(학년/학년군, 영역, 코드)
  - 부모/자식/경로 표시

### Screen B — Graph View (검증용 DAG/트리)
- 같은 데이터를 그래프로 표시(자동 레이아웃)
- 기능
  - 확대/축소, 드래그, 노드 클릭 시 상세 패널 연동
  - 레벨 필터(예: 영역까지만/성취기준까지)
  - 구조 검증 하이라이트(아래 “검증 규칙” 참고)

### Screen C — Data Health (구조 검증 리포트)
- 자동 검증 결과를 표로 표시
  - 고아 노드(orphan)
  - 중복 ID
  - 부모 누락
  - 깊이 이상치(타입 계층 위반 포함)
  - 순환(사이클)

## 데이터 모델 (표준 노드 스키마)

### CurriculumNode
```json
{
  "id": "MATH-2022-3-NA-001",
  "type": "standard",
  "title": "성취기준",
  "text": "…할 수 있다",
  "subject": "math",
  "grade": 3,
  "grade_band": "3-4",
  "domain": "수와 연산",
  "parent_id": "MATH-2022-3-NA",
  "children_ids": [],
  "source": {
    "provider": "NCIC",
    "doc": "2022개정",
    "ref": "..."
  }
}
```

### NodeType 계층(고정)
- `subject` → `grade_band` → `grade` → `domain` → `standard`

## 검증 규칙(필수)
1. ID 유일성: `id` 중복 금지
2. 부모 존재: `parent_id`가 있으면 반드시 존재
3. 양방향 일관성:
   - A의 `children_ids`에 B가 있으면 B의 `parent_id`는 A
4. 고아 노드 탐지:
   - `subject` 루트가 아닌데 부모가 없거나 트리에 연결되지 않은 노드
5. 깊이/타입 규칙:
   - `standard`는 반드시 `domain` 아래
   - 타입 계층 위반 탐지
6. 사이클 탐지:
   - 순환 경로가 있으면 리포트(그래프 표시/하이라이트)

## 구현 제안(스택/구성)
- 앱: React + TypeScript (Vite 권장)
- 그래프: React Flow
- 자동 레이아웃: dagre 또는 elkjs 중 하나
- 데이터: `curriculum-viewer/public/data/curriculum_math_v1.json` (정적 파일)
- 코드 구조(추천)
  - `curriculum-viewer/src/lib/curriculum/` (타입/검증/인덱싱)
  - `curriculum-viewer/src/features/tree/`
  - `curriculum-viewer/src/features/graph/`
  - `curriculum-viewer/src/features/validation/`

## 비범위(Non-goals)
- 데이터 편집/저장
- 로그인/권한
- 문제/정답률/학습 세션
- 백엔드 API(정적 파일로 시작)

