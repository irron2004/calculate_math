---
workflow: code
graph_profile: curriculum_viewer_v1
---

# Graph View 개선 — 학년군 구분 제거 + 학년 간 연결(학습 흐름)

## 배경
- 현재 `curriculum-viewer`의 Graph 화면은 “학년군(1-2/3-4/5-6)” 기준으로 필터링할 수 있고, `전체(all)`로 봐도 학년군별 학습 흐름이 **끊겨 보임**.
- 요구사항: **학년군 구분은 필요 없음**. 1학년/2학년에서 배운 과목(영역)이 3~4학년, 5~6학년으로 **자연스럽게 이어지는 연결**이 그래프에 보여야 한다.

## 목표
1) Graph 화면에서 학년군 필터를 제거하고 항상 전체를 렌더링한다.
2) 학년(grade) 간 “연속성(Progression)” 엣지를 추가해 1~2 → 3~4 → 5~6 흐름이 끊기지 않게 한다.

## 요구사항(해야 할 일)

### 1) UI: 학년군 필터 제거
- `GraphPage`에서 “학년군” 드롭다운/필터 상태를 제거한다.
- 항상 전체 노드/엣지를 렌더링한다.
- (선택) 그래프에서 `grade_band` 노드는 숨겨도 된다. 숨긴다면 `subject → grade`로 바로 이어지도록 “스킵 엣지”를 만들어 시각적으로 자연스럽게 만든다.

### 2) 학년 간 연결 규칙(Progression Edge)
최소 구현(우선순위 높음):
- `domain` 타입 노드 중 `domain_code`가 동일한 노드들을 `grade` 오름차순으로 정렬한 뒤, **인접한 grade끼리** progression edge를 생성한다.
- 예시(샘플 데이터 기준):
  - `MATH-2022-G-1-D-NA → MATH-2022-G-2-D-NA → MATH-2022-G-3-D-NA → MATH-2022-G-4-D-NA → MATH-2022-G-5-D-NA → MATH-2022-G-6-D-NA`
  - 최소한 `MATH-2022-G-2-D-NA → MATH-2022-G-3-D-NA` (학년군 경계) 연결이 **반드시** 보이도록 한다.

추가 고려(선택):
- `domain_code`가 없으면 `domain(title)`을 키로 fallback 해서 연결(단, 잘못 연결될 수 있으므로 문서/코드에 명시).

### 3) 시각/UX
- 기존 `children_ids` 기반 contains edge와 progression edge를 **스타일로 구분**한다.
  - 예: progression은 dashed + 다른 색상 + (선택) 라벨 `progression`
- 툴바/상단에 간단한 legend를 추가한다(contains vs progression).
- 노드 클릭 → 우측 상세 패널 표시 동작은 유지한다.

### 4) 테스트/검증
- progression edge 생성 로직을 `src/lib/...`로 분리하고 unit test를 최소 1개 추가한다.
  - “샘플 데이터에서 NA 도메인 progression edge가 생성됨”을 검증(학년군 경계 포함).
- 아래 커맨드가 모두 PASS여야 한다.
  - `cd curriculum-viewer && npm run validate:data`
  - `cd curriculum-viewer && npm test`
  - `cd curriculum-viewer && npm run build`

## Acceptance Criteria (완료 조건)
- Graph 화면에 “학년군” 필터가 없다.
- Graph 화면이 항상 전체 노드/엣지를 렌더링한다.
- 샘플 데이터에서 `MATH-2022-G-2-D-NA`와 `MATH-2022-G-3-D-NA`가 progression edge로 직접 연결되어 있다(학년군 경계 연결).
- progression edge가 contains edge와 시각적으로 구분된다.
- 테스트/빌드/데이터 검증 스크립트가 모두 0 exit code로 통과한다.

## Non-goals (이번 범위 아님)
- 개념(성취기준) 단위의 정교한 선수학습(prereq) 모델링
- Tree/Health 화면 구현 고도화
