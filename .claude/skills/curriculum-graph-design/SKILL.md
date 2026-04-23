---
name: curriculum-graph-design
description: 수학 스킬 그래프의 노드/엣지/선수관계를 설계한다. 단원 추가, 선수관계 정의, drill-down 세분화, 4갈래(NA/RR/GM/DP) 영역 분류, 그래프 검증이 필요할 때 반드시 이 스킬을 쓴다. "노드 설계", "선수관계", "그래프 추가", "단원 연결", "세분화" 같은 표현이 나오면 트리거한다.
---

# Curriculum Graph Design

수학 스킬 그래프에 노드와 엣지를 추가/수정하기 위한 절차.

## 언제 쓰는가

- 새 단원·스킬을 그래프에 추가
- 기존 선수관계(`requires`, `prepares_for`, `enables`) 검토/수정
- 한 노드가 너무 커서 drill-down 세분화
- 4갈래 영역 분류 재검토
- 그래프 구조 검증

## 워크플로우

### 1. 현재 그래프 파악
`public/data/curriculum_math_2022.json`을 읽고 해당 영역의 기존 노드를 나열한다. 겹치는 개념이 이미 있는지 확인한다.

### 2. 영역(branch) 결정
모든 노드는 정확히 한 branch에 속한다.
- **NA** 수와 연산: 계산, 방정식, 함수, 미적분의 계산적 측면
- **RR** 변화와 관계: 규칙·비례·함수의 관계적 측면
- **GM** 도형과 측정: 기하, 측정, 좌표
- **DP** 자료와 가능성: 통계, 확률

상위 단계에서 branch 합류(예: RR 함수 → NA 미적분)가 일어나면 `convergesFrom` 필드로 표시한다.

### 3. 세분화 판단
한 노드에 두 개 이상의 독립 기술이 섞이면 분리한다. 기준:
- 학생이 하나만 잘하고 다른 하나는 못할 수 있는가? → 분리
- 출제 시 서로 다른 weakTag가 붙을 가능성이 있는가? → 분리

예: "2자리 덧셈"은 "받아올림 없는 2자리 덧셈"과 "받아올림 있는 2자리 덧셈"으로 분리 가능.

### 4. 선수관계 정의

| 관계 | 의미 | 예시 |
|---|---|---|
| `requires` | A를 하려면 B가 먼저 | 2자리 덧셈 requires 1자리 덧셈 |
| `prepares_for` | A를 하면 B가 준비됨 | 덧셈 prepares_for 곱셈 |
| `enables` | A가 가능하면 B도 접근 가능 | 함수 enables 미적분 |

각 관계에 **왜**를 한 줄 근거로 남긴다. 근거 없는 관계는 합의되지 않은 관계다.

### 5. atomicSkills 정의
노드 안의 원자 기술을 `atomicSkills` 배열로 나열. 이 배열은 diagnostic-designer의 weakTag와 1:N 매핑될 수 있어야 한다.

### 6. 산출물 작성

`_workspace/curriculum_graph_proposal.json`:
```json
{
  "additions": [
    {
      "id": "na_add_2digit_carry",
      "branch": "NA",
      "label": "받아올림 있는 2자리 덧셈",
      "gradeHint": "초2",
      "atomicSkills": ["받아올림", "자리값 유지"],
      "requires": ["na_add_2digit_no_carry"],
      "prepares_for": ["na_add_3digit"],
      "rationale": "받아올림은 자리값 개념을 요구하므로 받아올림 없는 2자리 덧셈을 분리 선행 노드로 둠"
    }
  ],
  "modifications": [],
  "removals": []
}
```

`_workspace/curriculum_graph_rationale.md`에 각 추가/수정 근거를 서술.

### 7. 검증

`npm run validate:data -- --file public/data/curriculum_math_2022.json`로 기존 그래프가 여전히 통과하는지 확인 (제안 적용 전). 제안 반영 후 재실행.

## 의존 스킬

- `diagnostic-taxonomy-design` — `atomicSkills`가 weakTag와 매핑되는지 확인할 때
- `problem-bank-curation` — 새 노드의 문제 세트 존재 여부 확인할 때

## 원칙

- **학년이 아니라 스킬** — gradeHint는 참고용. 실제 순서는 선수관계로.
- **그래프가 커지는 것은 감수한다** — drill-down이 기본. 합치지 않는다.
- **증거 없는 관계는 만들지 않는다** — 각 관계에 한 줄 근거.
- **기존 id 형식 유지** — `{branch}_{topic}_{modifier}` snake_case.

## 참고
- `03_문서/docs/2022_curriculum.md`
- `backend/CURRICULUM_GRAPH_SCHEMA_V2.md`
