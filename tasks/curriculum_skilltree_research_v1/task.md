---
workflow: code
graph_profile: curriculum_research_3r
---

# Curriculum Skill Tree Research v1 - 3 Researcher Workflow

## 목표
수학 스킬트리(DAG) 구축을 위한 체계적인 연구 수행
- 교육과정 기반 커버리지 분석 (R1)
- 학습 가능한 micro skill 분해 및 선수관계 설계 (R2)
- 전이 연결 및 문항 구조 설계 (R3)

## Target Scope
**BOSS_ID**: `TS_COMB_PROB` (조합/확률 영역)

또는 다음 중 선택:
- `TS_DIFF` (차이/변화)
- `TS_ACCUM` (누적/합)
- `TS_RATIO` (비/비율)
- `TS_SCALE` (척도/측정)

---

## 입력 데이터

### Subgraph Nodes (예시)
```json
[
  { "id": "TS_COMB_PROB", "type": "boss", "name_ko": "조합과 확률", "domain": "DA" },
  { "id": "PERM_BASIC", "type": "step", "name_ko": "순열 기초", "domain": "DA" },
  { "id": "COMB_BASIC", "type": "step", "name_ko": "조합 기초", "domain": "DA" },
  { "id": "PROB_BASIC", "type": "step", "name_ko": "확률 기초", "domain": "DA" }
]
```

### Subgraph Edges (예시)
```json
[
  { "from": "PERM_BASIC", "to": "TS_COMB_PROB", "type": "requires" },
  { "from": "COMB_BASIC", "to": "TS_COMB_PROB", "type": "requires" },
  { "from": "PROB_BASIC", "to": "TS_COMB_PROB", "type": "requires" }
]
```

---

## Ticket 1: R1 Coverage Analysis

**Owner**: Researcher1 (Coverage)
**Goal**: 교육과정 기반 누락/과잉 탐지

### Tasks
1. 주어진 scope에서 교육과정 상 **빠진 선수학습** 찾기
2. **과잉 범위** (불필요하게 어려운 것) 식별
3. 학습 순서상 **위험한 점프** 탐지

### Acceptance Criteria
- [ ] 누락된 기초 개념 10개 이상 식별
- [ ] 과잉 난이도 개념 5개 이상 식별
- [ ] 위험한 점프 5개 이상 식별
- [ ] Graph Patch JSON 출력 (confidence 포함)
- [ ] Standards Tags 정리

### Output
- `coverage_gap_report`
- `missing_prereq_patch` (Graph Patch JSON)

---

## Ticket 2: R2 Progression Analysis

**Owner**: Researcher2 (Progression)
**Goal**: micro skill 분해 + 선수관계 설계

### Tasks
1. 큰 노드를 **학습 가능한 micro**로 분해
2. **필수 선행 (requires)** vs **권장 선행** 구분
3. 학생이 **막히는 이유** (인지부하/표현전환) 분석
4. 장거리 의존을 끊기 위한 **bridge node** 제안

### Acceptance Criteria
- [ ] Micro skill 10~40개 분해
- [ ] 각 micro는 "단일 행동 + 단일 개념 + 단일 표현(C/P/A)"
- [ ] requires는 정말 필수만 (애매한 건 notes로)
- [ ] 막힘 이유 분석 10개 이상
- [ ] Bridge node 제안 10개 이상
- [ ] Graph Patch JSON 출력 (confidence 포함)

### Output
- `micro_skill_decomposition`
- `prereq_patch` (Graph Patch JSON)
- `bridge_node_suggestions`

---

## Ticket 3: R3 Transfer Analysis

**Owner**: Researcher3 (Transfer)
**Goal**: 전이 연결 + 문항 구조 설계

### Tasks
1. 스킬 → 상위 문항 구조 **전이 연결** (enables)
2. **동형 구조** 연결 (analog_of)
3. **문제 생성 템플릿** 설계 (변수만 바꾸면 무한 생성)
4. **Isomorphic Triplets** 설계 (생활/데이터/도형 맥락)

### Acceptance Criteria
- [ ] enables/analog_of 엣지에 근거(notes) 포함
- [ ] Problem Template 5개 이상
- [ ] Isomorphic Triplets 5세트 이상
- [ ] Graph Patch JSON 출력 (confidence 포함)

### Output
- `transfer_edges` (Graph Patch JSON)
- `problem_template_specs`
- `isomorphic_triplets`

---

## 공통 규칙

### Graph Patch JSON 포맷
```json
{
  "researcher": "R1|R2|R3",
  "scope": "<BOSS_ID>",
  "add_nodes": [
    { "id": "...", "type": "micro", "name_ko": "...", "domain": "...", "rep": "C|P|A", "lens": ["..."] }
  ],
  "merge_aliases": [
    { "alias": "OLD_ID", "keep": "NEW_ID" }
  ],
  "add_edges": [
    { "from": "A", "to": "B", "type": "requires|enables|analog_of", "min_level": 1 }
  ],
  "remove_edges": [
    { "from": "X", "to": "Y", "type": "requires" }
  ],
  "notes": [
    { "claim": "...", "reason": "...", "confidence": 0.8 }
  ]
}
```

### 절대 규칙
1. **level은 제안하지 않는다** (DAG에서 자동 계산)
2. 잠금 로직은 **requires**로만
3. 모든 제안에 **confidence (0~1)** 필수

### 충돌 해결 (Reviewer가 적용)
1. `requires` → R2 우선 (인지적 필수 선행)
2. 교육과정 누락 → R1 우선 (기초 빠짐은 치명적)
3. `enables`/`analog_of` → R3 우선 (차별화 요소)

---

## Lens Set (사용 가능한 렌즈)
- `difference` (차이)
- `accumulation` (누적)
- `ratio` (비/비율)
- `scale` (척도)
- `transform` (변환)
- `random` (확률/랜덤)
- `vector` (벡터/방향)

---

## 최종 산출물
1. **Merged Graph Patch** - 3명의 패치를 병합한 최종 결과
2. **Coverage Report** - 교육과정 커버리지 분석
3. **Micro Skill Map** - 분해된 micro skill 목록
4. **Transfer Map** - 전이 연결 구조
5. **Problem Templates** - 문항 생성 템플릿
6. **Isomorphic Triplets** - 동형 문제 세트

---

## 실행 방법

```bash
# .env 설정
ORCH_VERSION=v2              # flow(research1/2/3) 지원 필요
GRAPH_PROFILE=curriculum_research_3r
RESEARCH_CMD=claude           # R1 (Coverage)
RESEARCH_CMD_2=gemini         # R2 (Progression)
RESEARCH_CMD_3=claude         # R3 (Transfer)

# 실행
./agents_up.sh curriculum_skilltree_research_v1
```
