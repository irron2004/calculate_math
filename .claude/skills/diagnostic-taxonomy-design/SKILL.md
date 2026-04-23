---
name: diagnostic-taxonomy-design
description: 오답 원인 taxonomy(weakTag)와 개념 상태 전이 규칙을 설계한다. weakTag 추가/수정, 상태값(약점확인/보강중/재확인필요/해결됨) 정의, "해결됨" 판단 기준 설계가 필요할 때 반드시 이 스킬을 쓴다. "weakTag", "taxonomy", "상태 전이", "해결 기준", "오답 원인", "진단 체계" 표현이 나오면 트리거한다.
---

# Diagnostic Taxonomy Design

학생 오답과 개념 해결 상태를 해석 가능하게 만드는 taxonomy·전이 규칙 설계 절차.

## 언제 쓰는가

- 신규 weakTag 추가
- 기존 taxonomy 버전 업
- 개념 상태값 정의/수정
- "해결됨" 판단 기준 재설계
- 상태 전이 규칙 점검

## 워크플로우

### 1. 기존 taxonomy 버전 확인
`03_문서/docs/homework_label_taxonomy_and_naming_rule_v0_2.md`에서 현재 버전 확인. 변경은 항상 버전 올림(v0.2 → v0.3). 하위 호환성 영향을 먼저 정리한다.

### 2. weakTag 네이밍 규칙

`{개념영역}_{오류유형}` snake_case. 너무 추상적인 태그 지양.

| 좋음 | 나쁨 |
|---|---|
| `받아올림_누락` | `계산실수` |
| `분배법칙_오적용` | `개념부족` |
| `부등호_방향_반전` | `실수함` |

### 3. weakTag 정의 형식

```markdown
## tag: 받아올림_누락
- **정의**: 2자리 이상 덧셈에서 받아올림 연산이 필요한데 적용하지 않은 경우
- **관련 노드**: na_add_2digit_carry, na_add_3digit, na_add_decimal
- **예시 오답**: 37 + 58 = 85 (1을 십의 자리로 올리지 않음)
- **확인 경로**: 3개 이상의 받아올림 문제에서 반복 발생 시 약점확인
```

### 4. 상태 전이 규칙

상태는 **전이 규칙표**로 정의한다. "어떤 이벤트 → 어느 상태".

```markdown
## 상태 전이표 (v0.3)

| 현재 상태 | 이벤트 | 다음 상태 | 조건 |
|---|---|---|---|
| - | 동일 weakTag 2회 이상 발생 (최근 7일) | 약점확인 | - |
| 약점확인 | 보강 세트 배정 | 보강중 | - |
| 보강중 | 보강 세트 완료 + 정답률 70% 이상 | 재확인필요 | - |
| 보강중 | 보강 세트 완료 + 정답률 50% 미만 | 약점확인 | 보강 주기 초기화 |
| 재확인필요 | 재확인 세트 정답률 80% 이상 | 해결됨 | 동일 weakTag 최근 14일 미재발 |
| 해결됨 | 동일 weakTag 재발 | 약점확인 | 해결 후 30일 이내 |
```

### 5. "해결됨" 기준은 엄격하게

단순 정답 n회로 해결됨 판정 금지. 조합 기준:
- **시간 간격**: 최소 2회 이상, 최소 N일 간격
- **난이도 분포**: 도전(심화) 난이도 포함
- **재출현 검증**: 해결 판정 후 일정 기간 모니터링

### 6. 산출물

- `_workspace/weaktag_taxonomy_v{n}.md` — tag 목록 + 정의 + 관련 노드
- `_workspace/state_transition_rules.md` — 전이표
- `_workspace/resolution_criteria.md` — 해결 판단 기준
- `_workspace/taxonomy_migration_v{old}_to_v{new}.md` — 변경점 diff + 마이그레이션 영향

### 7. 영향 전파

taxonomy 변경 시 알릴 대상:
- `problem-content-designer` — 기존 문제 재태깅 범위
- `math-backend-engineer` — DB 스키마·이넘 변경 여부
- `student-state-researcher` — 과거 데이터 재분석 필요 여부

## 의존 스킬

- `problem-bank-curation` — taxonomy 변경 시 문제 재태깅 영향
- `student-state-analysis` — 상태 전이 규칙 변경 시 과거 데이터 재분석 영향
- `math-backend-implementation` — DB 스키마/enum 변경 영향

## 원칙

- **개념 기반 네이밍** — 추상적 태그 지양
- **버전 관리 필수** — 변경은 diff로 설명
- **관찰 가능해야 한다** — 실제 제출 데이터에서 측정 가능한 상태만 정의
- **해결됨은 엄격하게** — 시간 + 난이도 + 재출현 조합
- **하위 호환 결정** — 변경 시 기존 데이터 처리 방침 명시

## 참고
- `03_문서/docs/homework_label_taxonomy_and_naming_rule_v0_2.md`
- `03_문서/docs/homework_label_structured_schema_v0_1.md`
- `03_문서/docs/homework_label_sqlite_implementation_v0_1.md`
