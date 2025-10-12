맞아요. 말씀하신 “**같은 스킬(예: 곱셈)이 여러 코스·스텝에 동시에 연결**되는” 구조를 제대로 살리려면, **커리큘럼 노드(코스·스텝)**와 **원자 스킬(Atomic Skill)**을 **분리한 이중 레이어 DAG**로 설계해야 합니다.
아래에 **모델(개념) → 데이터 스키마(JSON) → 스킬 세분화 체계(리스트) → 잠금/추천 로직 → 예시(곱셈이 C01-S1과 C03-S3를 동시에 요구) → 운영 절차**까지 한 번에 제시합니다.

---

## 1) 설계 원칙: 이중 레이어 DAG

* **레이어 A: CourseStep 노드(CS)**

  * 단위: `코스ID-스텝` (예: `C01-S1`, `C03-S3`)
  * 역할: 학습 세션의 **목표 과제** (S1 기초 → S2 브리지 → S3 응용/최상위)
* **레이어 B: AtomicSkill 노드(AS)**

  * 단위: 세분화된 **원자 스킬** (예: `AS.MUL.FACTS`, `AS.MUL.POW10`, `AS.ADD.COMP`)
  * 역할: 여러 코스·스텝이 **공유**하는 **재사용 가능 능력** (연산, 표→식 전환, 도해 등)

**엣지 타입**

* `AS → CS : "requires"`   → *이 스텝을 시작하려면 어떤 스킬이 어느 수준(레벨) 이상 필요한가*
* `CS → AS : "teaches"`    → *이 스텝을 마치면 어떤 스킬 숙련도가 얼마나 오른다(가르치는 산출물)*
* `CS → CS : "enables"`    → *구조적 전이/추천 경로(학습 지도)*
* `AS → AS : "decomposes"` → *스킬을 더 작은 스킬로 분해(온보딩/추천/리미디얼 용)*

> 이렇게 하면 **곱셈(AS)** 같은 스킬을 **여러 코스의 여러 스텝이 함께 참조**할 수 있고, 어느 스텝에서든 시도 결과가 해당 스킬의 **숙련도(레벨)**로 누적 반영됩니다.

---

## 2) 데이터 스키마(JSON) — **이중 레이어 DAG**

> 기존 `skills.json`을 확장해도 되고, 새 파일 `graph.bipartite.json`로 분리해도 됩니다.

```json
{
  "version": "2025-10-12",
  "nodes": [
    /* ====== CourseStep (CS) ====== */
    { "id": "C01-S1", "type": "course_step", "label": "코스01·S1", "lens": ["transform"], "tier": 1 },
    { "id": "C01-S2", "type": "course_step", "label": "코스01·S2", "lens": ["transform","accumulation"], "tier": 1 },
    { "id": "C03-S3", "type": "course_step", "label": "코스03·S3", "lens": ["difference","accumulation"], "tier": 3 },

    /* ====== AtomicSkill (AS) ====== */
    { "id": "AS.MUL.FACTS",  "type": "skill", "label": "곱셈 사실(0~9)", "domain": "연산·스케일", "levels": 3 },
    { "id": "AS.MUL.POW10",  "type": "skill", "label": "×10/×100 스케일", "domain": "연산·스케일", "levels": 3 },
    { "id": "AS.MUL.TWOxONE","type": "skill", "label": "두자리×한자리", "domain": "연산·스케일", "levels": 3 },
    { "id": "AS.ADD.COMP",   "type": "skill", "label": "친한 수 보정(+/−k)", "domain": "연산·누적", "levels": 3 },
    { "id": "AS.DIFF.READ",  "type": "skill", "label": "차이 읽기(Δ)", "domain": "차분", "levels": 3 },
    { "id": "AS.REP.TAB2EXP","type": "skill", "label": "표→식 전환", "domain": "표현", "levels": 3 }
  ],
  "edges": [
    /* ====== 요구 스킬(AS -> CS) with 레벨 ====== */
    { "from": "AS.MUL.POW10",  "to": "C01-S1", "type": "requires", "min_level": 1 },
    { "from": "AS.ADD.COMP",   "to": "C01-S1", "type": "requires", "min_level": 1 },

    { "from": "AS.MUL.TWOxONE","to": "C03-S3", "type": "requires", "min_level": 2 },
    { "from": "AS.MUL.FACTS",  "to": "C03-S3", "type": "requires", "min_level": 2 },
    { "from": "AS.DIFF.READ",  "to": "C03-S3", "type": "requires", "min_level": 2 },
    { "from": "AS.REP.TAB2EXP","to": "C03-S3", "type": "requires", "min_level": 1 },

    /* ====== 학습 산출(CS -> AS) : 세션을 마치면 올라가는 스킬 ====== */
    { "from": "C01-S1", "to": "AS.MUL.POW10",  "type": "teaches", "delta_level": 1 },
    { "from": "C01-S1", "to": "AS.ADD.COMP",   "type": "teaches", "delta_level": 1 },

    { "from": "C03-S3", "to": "AS.MUL.TWOxONE","type": "teaches", "delta_level": 1 },
    { "from": "C03-S3", "to": "AS.REP.TAB2EXP","type": "teaches", "delta_level": 1 },

    /* ====== 코스 간 전이(CS -> CS) ====== */
    { "from": "C01-S1", "to": "C01-S2", "type": "enables" },
    { "from": "C01-S2", "to": "C03-S3", "type": "enables" },

    /* ====== 스킬 분해(AS -> AS) ====== */
    { "from": "AS.MUL.FACTS",  "to": "AS.MUL.TWOxONE", "type": "decomposes" },
    { "from": "AS.MUL.POW10",  "to": "AS.MUL.TWOxONE", "type": "decomposes" }
  ]
}
```

**핵심 포인트**

* **곱셈(AS.MUL.*)** 스킬이 **C01-S1**과 **C03-S3**에 **동시에 연결**되어 있고, **요구 레벨이 다를 수 있음**(S1은 1, S3은 2).
* 학습을 완료하면(`teaches`) 해당 스킬의 레벨이 **상향**되므로, 이후 다른 코스·스텝의 **잠금 해제**에 즉시 반영됩니다.

---

## 3) 원자 스킬 세분화(추천 목록, v1.0)

> 실제 풀 DAG로 가면 60–120개 수준을 권장합니다. 아래는 **대표 56개** 초안입니다. (이름은 식별자, 라벨은 UI 표시.)

### A. 수·자릿값·표현

* `AS.PV.READ` (자릿값 읽기)
* `AS.PV.DECOMP` (분해/재구성)
* `AS.PV.EXCHANGE` (10↔1 교환)
* `AS.REP.TAB2EXP` (표→식 전환)
* `AS.REP.EXP2TAB` (식→표 전환)
* `AS.REP.NUMBERLINE` (수직선 이동)
* `AS.REP.GRAPHREAD` (그래프 읽기 기초)

### B. 덧셈/뺄셈(누적/차분)

* `AS.ADD.COMP` (친한 수 보정 +/−k)
* `AS.ADD.CARRY` (받아올림)
* `AS.SUB.BORROW` (받아내림)
* `AS.DIFF.READ` (차이 읽기 Δ)
* `AS.CHK.INV_SUM` (합의 보존/검산)

### C. 곱셈/나눗셈(스케일)

* `AS.MUL.FACTS` (곱셈 사실 0–9)
* `AS.MUL.POW10` (×10/×100 스케일)
* `AS.MUL.TWOxONE` (두자리×한자리)
* `AS.MUL.AREA` (배열/면적 모델)
* `AS.DIV.SHARE` (등분·나눔)
* `AS.DIV.MEASURE` (측정 나눗셈)
* `AS.DIV.REL` (곱·나눗셈 역관계)

### D. 분수/소수/비율

* `AS.FRAC.PARTWHOLE` (부분/전체)
* `AS.FRAC.EQ` (동치분수/기약화)
* `AS.FRAC.ADD` (동분모 덧셈)
* `AS.FRAC.MUL` (분수×분수 모델)
* `AS.DEC.READ` (소수 읽기/표기)
* `AS.RATIO.UNIT` (단위율 1의 값)
* `AS.RATIO.TABLE` (비례표 완성)
* `AS.RATIO.SLOPE` (기울기=단위율 연결)

### E. 규칙성/수열/일차

* `AS.SEQ.DIFFCONST` (차분 상수 판별)
* `AS.SEQ.GENERAL` (일반항 언어화)
* `AS.LIN.SLOPE` (Δy/Δx 계산)
* `AS.LIN.INTERCEPT` (절편 해석)
* `AS.LIN.FORM` (표↔그래프↔식 왕복)

### F. 좌표/도형(변환)

* `AS.COORD.READ` (좌표 읽기)
* `AS.COORD.DISTMID` (거리/중점)
* `AS.GEO.TRANS` (대칭/이동/회전)
* `AS.GEO.SIM` (닮음/스케일 비)
* `AS.TRIG.RATIO` (직각삼각비 기초)

### G. 누적/변화(해석 직관)

* `AS.ACC.SUMRECT` (막대합=면적)
* `AS.ACC.TRAP` (사다리꼴 근사)
* `AS.RATE.AVG` (평균변화율)
* `AS.RATE.UNIT` (단위 일관성/해석)

### H. 통계/확률

* `AS.STATS.CENTER` (평균/중앙/최빈)
* `AS.STATS.SPREAD` (범위/표준편차 직관)
* `AS.COUNT.RULES` (합/곱 법칙)
* `AS.PROB.BI` (이항 모형 인식)
* `AS.NORM.EMP` (정규 경험 법칙)

> 각 AS는 **levels: 0~3**(0 미시작, 1 익숙, 2 작동, 3 숙련)로 운영하고, **CS에선 최소 레벨**을 요구합니다.

---

## 4) 잠금/승급 로직(간단하고 튼튼하게)

### 4.1 잠금 해제

* `is_unlocked(CS)` = 모든 `requires(AS, min_level)`을 **만족**
* `min_level` 권장: S1=1, S2=1~2, S3=2 (최상위는 2 이상)

### 4.2 스킬 숙련도 업데이트

* 각 문항에 태그된 `micro_skills -> AS`로 **점수 귀속**
* 시도 후 갱신: EWMA(지수 이동 평균) + 속도/설명 보정
  [
  \text{level_score}*{t+1} = \lambda \cdot \text{score}*t + (1-\lambda)\cdot (c_t\cdot w*{rt}\cdot w*{expl})
  ]

  * `c_t`=정오(1/0), `w_{rt}`=반응시간 백분위 보정, `w_{expl}`=핵심어/구조 언급 점수
* 임계값을 넘으면 레벨1→2→3로 승급(예: 0.7, 0.85, 0.93)

### 4.3 CS 완료 → teaches

* CS 종료 시 `teaches(delta_level)`로 해당 AS 레벨 **가산**(상한 3)
* 이렇게 **배운 결과가 다른 코스·스텝의 잠금 해제**에 바로 연결됨

---

## 5) 예시: **곱셈이 C01-S1과 C03-S3에 동시에 필요**

* **가정**

  * `C01-S1`: “친한 수 보정 + ×10/×100” 중심(초기 스케일 감각)
  * `C03-S3`: “등차합/AP 합” 같은 **상위 응용**(공식 계산 과정에 `n×(2a+(n-1)d)/2` 등 곱셈 필수)

**요구 스킬**

* `C01-S1`은 `AS.MUL.POW10 (min_level:1)`, `AS.ADD.COMP (1)`
* `C03-S3`은 `AS.MUL.TWOxONE (2)`, `AS.MUL.FACTS (2)`, `AS.DIFF.READ (2)`, `AS.REP.TAB2EXP (1)`

**학습 산출**

* `C01-S1`을 완료하면 `AS.MUL.POW10, AS.ADD.COMP` 레벨이 오르고,
* `C03-S3`을 완료하면 `AS.MUL.TWOxONE, AS.REP.TAB2EXP` 레벨이 오른다.

> 결과: **곱셈(AS) 숙련도가 여러 코스에서 누적**되어, 다른 상위 스텝의 **잠금 해제**가 자연스레 진행됩니다.

---

## 6) 작성·운영 절차(실행용 체크리스트)

1. **원자 스킬 사전(AS) 고정**

   * 위 56개를 시작점으로 사용 → 팀 리뷰 → 1.0 잠금
   * **중복/동의어** 정리(예: “표→식 전환” vs “기호화”)

2. **각 코스·스텝(CS) 정의**

   * `C01~C12 × S1~S3` 목록화(각 라벨/학습목표/오개념 1줄)
   * **IN 요구 스킬**: `AS, min_level` 3~6개 내
   * **OUT 산출 스킬**: `AS, delta_level` 2~4개 내

3. **태깅 표준**

   * 모든 문항 템플릿에 `skills:["AS.MUL.TWOxONE","AS.REP.TAB2EXP"]`
   * 1문항당 **핵심 1~2개**(최대 3개)만 태그 → 신호 품질 확보

4. **검증 도구**

   * **순환 검사**(AS→CS requires만)
   * **누락 검사**(참조 없는 AS/CS)
   * **잠금 시뮬레이션**: 가상 유저 100명 분포로 **해제율** 그래프

5. **UI 상호작용**

   * 스킬 레이어 토글: **AS 노드 보이기/숨기기**, AS 클릭 시 **연결된 CS 하이라이트**
   * CS 툴팁에 “필요 스킬/현재 레벨/부족분” 표시
   * AS 툴팁에 “이 스킬을 올려주는 CS 목록”과 **가장 가까운 추천 CS** 제공

6. **추천 로직**

   * `gap_score(CS) = mean(max(0, min_level - user_level(AS)))`
   * 낮은 gap + 높은 보상(`teaches`로 올려주는 AS가 많음) 조합을 우선 추천

---

## 7) 바로 쓸 수 있는 **CSV/JSON 스니펫** (팀 작업 편의)

### 7.1 AS 노드(일부)

```csv
id,type,label,domain-levels
AS.MUL.FACTS,skill,곱셈 사실(0~9),연산·스케일-3
AS.MUL.POW10,skill,×10/×100 스케일,연산·스케일-3
AS.MUL.TWOxONE,skill,두자리×한자리,연산·스케일-3
AS.ADD.COMP,skill,친한 수 보정(+/−k),연산·누적-3
AS.DIFF.READ,skill,차이 읽기(Δ),차분-3
AS.REP.TAB2EXP,skill,표→식 전환,표현-3
```

### 7.2 CS 요구/산출(예시)

```csv
cs_id,requires_skills,teaches_skills
C01-S1,"AS.MUL.POW10:1;AS.ADD.COMP:1","AS.MUL.POW10:+1;AS.ADD.COMP:+1"
C03-S3,"AS.MUL.TWOxONE:2;AS.MUL.FACTS:2;AS.DIFF.READ:2;AS.REP.TAB2EXP:1","AS.MUL.TWOxONE:+1;AS.REP.TAB2EXP:+1"
```

> 이 CSV에서 `:` 뒤 숫자는 요구 레벨, `+1`은 delta_level입니다. 변환 스크립트(이미 제공해둔 파이프라인)에 쉽게 붙일 수 있습니다.

---

## 8) 문제-스킬 연결(생성/변형 엔진 연동)

* 템플릿 메타에 `skills`를 명시:

```json
{
  "template_id": "AP-SUM-TRAP-01",
  "skills": ["AS.MUL.TWOxONE", "AS.REP.TAB2EXP"],
  "lens": ["difference","accumulation"],
  "params_schema": {"a1":[1,20], "d":[1,9], "n":[5,20]},
  "solve": "function(...) { /* ... */ }"
}
```

* 시도 결과는 해당 `skills`의 **레벨 점수**로 귀속(EWMA)
* CS 완료 시 `teaches`로 연결된 AS는 **보너스 가점** (레벨 상향)

---

## 9) 품질·운영 체크

* **1문항=1~2 스킬** 원칙 지키기(스킬 신호 분리)
* 스킬별 **학습지표**: 정확률, 속도 백분위, 설명 키워드 충족률
* **리미디얼 자동 추천**: 레벨 부족 AS를 올려주는 **가장 가까운 CS** 1~2개 즉시 제시

---

### 요약

* **스킬(AS)을 1급 시민으로 승격**시켜 **코스·스텝(CS)과 교차 연결**하는 **이중 레이어 DAG**로 모델링하세요.
* **곱셈**처럼 공통 스킬은 **여러 스텝의 requires**로 연결하고, 완료 시 **teaches**로 숙련도를 올려 **다른 경로의 잠금**을 자연스럽게 해제합니다.
* 위 **스키마/리스트/예시 CSV**를 그대로 쓰면, 지금 가진 트리 위에 **스킬 레이어**를 얹어 즉시 가동할 수 있습니다.

원하시면, 현재 보유한 “12개 코스 × S1~S3” 목록을 보내주지 않아도 **공통적으로 많이 쓰이는 56개 AS 템플릿**으로 **초안 bipartite JSON**을 바로 만들어 드릴게요. 이후 실제 코스 라벨만 교체하면 됩니다.
