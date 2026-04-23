---
name: problem-bank-curation
description: 수학 문제를 작성하고 숙제 세트를 구성한다. 문제 출제, 해설 작성, 난이도·weakTag·nodeId 태깅, 숙제 세트 구성, 문제 업로드가 필요할 때 반드시 이 스킬을 쓴다. "문제 만들어줘", "문제 출제", "숙제 세트", "문제은행", "태깅", "업로드" 같은 표현이 나오면 트리거한다.
---

# Problem Bank Curation

스킬 그래프에 연결된 문제와 숙제 세트를 만드는 절차.

## 언제 쓰는가

- 특정 노드의 문제 신규 작성
- 기존 문제 품질 수정 (오답/해설/난이도)
- 숙제 세트(확인/측정/도전) 구성
- 문제은행 업로드 준비
- 문제-노드 매핑 재검토

## 워크플로우

### 1. 대상 노드 확인
`curriculum-graph-design`의 산출물 또는 `public/data/curriculum_math_2022.json`에서 대상 노드의 `atomicSkills`를 읽는다. 문제는 이 atomicSkills를 측정할 수 있어야 한다.

### 2. weakTag 확보
`diagnostic-taxonomy-design` 산출물에서 현재 taxonomy를 확인한다. 필요한 태그가 없으면 **먼저 diagnostic-designer에게 제안**하고 추가될 때까지 기다린다. 임의로 새 태그를 만들지 않는다.

### 3. 문제 설계

각 문제는 **어떤 오답이 어떤 weakTag를 의미하는지** 미리 설계한다.

```json
{
  "id": "p_na_add_2digit_carry_001",
  "primaryNodeId": "na_add_2digit_carry",
  "supportingNodeIds": [],
  "difficulty": 2,
  "prompt": "37 + 58 = ?",
  "answer": "95",
  "distractors": [
    {"value": "85", "weakTag": "받아올림_누락", "rationale": "일의 자리 받아올림을 적용하지 않음"},
    {"value": "915", "weakTag": "자리값_혼동", "rationale": "받아올림을 십의 자리가 아닌 백의 자리로 보냄"}
  ],
  "explanation": "7 + 8 = 15이므로 5를 쓰고 1을 십의 자리로 올림. 3 + 5 + 1 = 9. 답은 95."
}
```

### 4. 난이도 분포
**같은 노드 내 상대값(1~5).** 숙제 세트 구성 시:
- 확인(쉬움, 1~2): 30%
- 측정(표준, 3): 50%
- 도전(심화, 4~5): 20%

### 5. 숙제 세트 구성

`_workspace/homework_set_{name}.json`:
```json
{
  "setId": "hw_na_add_2digit_carry_w01",
  "targetNodes": ["na_add_2digit_carry"],
  "problems": ["p_...", "p_...", "..."],
  "intendedOutcome": "받아올림 개념 해결 여부 측정",
  "minCountForResolution": 5
}
```

### 6. 인입 검증

업로드 전 `tools/problem_bank_ingest.py`의 스키마에 맞는지 확인:
```bash
python tools/problem_bank_ingest.py --dry-run --file _workspace/problems_{nodeId}.json
```

`tools/problem_bank_input.example.json`을 참고해 필드명을 정확히 맞춘다.

### 7. 실제 업로드
검증 통과 후에만 실제 업로드. 실패 시 에러 전문을 `math-backend-engineer`에게 전달.

## 의존 스킬

- `diagnostic-taxonomy-design` — weakTag 정의 및 버전 확인
- `curriculum-graph-design` — 대상 노드의 atomicSkills 확인

## 원칙

- **nodeId 없는 문제는 만들지 않는다.**
- **오답이 의미 있어야 한다** — 각 distractor에 weakTag + rationale.
- **난이도는 노드 내 상대값** — 노드 간 비교 금지.
- **숙제 세트는 루프를 닫는다** — 확인/측정/도전 혼합.
- **taxonomy는 diagnostic-designer가 정한다** — 새 태그 필요 시 요청만.

## 참고
- `03_문서/docs/problem-bank-import-runbook.md`
- `03_문서/docs/problem_ops_and_progress_management.md`
- `tools/problem_bank_input.example.json`
