# Curriculum Progression DAG v2 — Bipartite Specification

이 문서는 기존 커리큘럼 DAG를 **코스 스텝(CourseStep)**과 **원자 스킬(AtomicSkill)**의 이중 레이어 그래프로 재구성하기 위한 사양입니다. 곱셈처럼 여러 코스·스텝에서 공유하는 스킬을 하나의 노드로 관리할 수 있도록 설계되었습니다.

---

## 1. 설계 개요

| 레이어 | 노드 타입 | 예시 | 설명 |
| ------ | ---------- | ---- | ---- |
| A | `course_step` | `C01-S1`, `C03-S3` | 학습 세션 단위. 스텝 시작 시 필요한 스킬 레벨(`requires`)과 완료 시 상승하는 스킬(`teaches`)을 정의합니다. |
| B | `skill` | `AS.MUL.FACTS`, `AS.ADD.COMP` | 여러 스텝에서 재사용되는 원자 스킬. 레벨(0~3)을 추적해 잠금/추천에 활용합니다. |

**엣지 타입**

* `skill → course_step` (`requires`): 스텝 시작 전 필요 스킬과 요구 레벨.
* `course_step → skill` (`teaches`): 스텝 완료 시 상승하는 스킬과 상승량.
* `course_step → course_step` (`enables`): 구조적 전이/추천 경로.
* `skill → skill` (`decomposes`): 스킬 분해 관계(온보딩/리미디얼 추천).

---

## 2. 데이터 스키마(JSON)

샘플 JSON은 `docs/graph_bipartite_example.json`에 저장되어 있습니다. 주요 구조는 아래와 같습니다.

```jsonc
{
  "version": "2025-10-12",
  "nodes": [
    { "id": "C01-S1", "type": "course_step", "label": "코스01·S1", "lens": ["transform"], "tier": 1 },
    { "id": "AS.MUL.FACTS", "type": "skill", "label": "곱셈 사실(0~9)", "domain": "연산·스케일", "levels": 3 }
  ],
  "edges": [
    { "from": "AS.MUL.FACTS", "to": "C03-S3", "type": "requires", "min_level": 2 },
    { "from": "C03-S3", "to": "AS.MUL.TWOxONE", "type": "teaches", "delta_level": 1 }
  ]
}
```

필요 시 `palette`, `xp` 등 기존 필드를 확장해 포함할 수 있습니다.

---

## 3. 원자 스킬 목록(v1.0 초안)

초기 운영을 위해 56개 스킬을 권장합니다. 대표 예시는 아래와 같으며, 전체 목록은 부록에 수록했습니다.

* 수·자릿값·표현: `AS.PV.READ`, `AS.REP.TAB2EXP`, `AS.REP.NUMBERLINE`
* 덧셈/뺄셈: `AS.ADD.COMP`, `AS.ADD.CARRY`, `AS.SUB.BORROW`
* 곱셈/나눗셈: `AS.MUL.FACTS`, `AS.MUL.POW10`, `AS.MUL.TWOxONE`, `AS.DIV.REL`
* 분수/소수/비율: `AS.FRAC.PARTWHOLE`, `AS.RATIO.TABLE`
* 규칙성/일차: `AS.SEQ.DIFFCONST`, `AS.LIN.FORM`
* 좌표/도형: `AS.COORD.READ`, `AS.GEO.TRANS`
* 누적/변화: `AS.ACC.SUMRECT`, `AS.RATE.UNIT`
* 통계/확률: `AS.STATS.CENTER`, `AS.PROB.BI`

각 스킬은 레벨 `0~3`을 사용합니다.

---

## 4. 잠금 및 숙련도 로직

1. **잠금 해제**: 모든 `requires` 조건의 `min_level` 이상일 때 스텝이 열립니다.
2. **스킬 레벨 갱신**: 문항에 태깅된 스킬에 대해 EWMA 방식으로 정확도/속도/설명 점수를 반영합니다.
3. **스텝 완료 보상**: `teaches` 엣지를 따라 해당 스킬 레벨을 `delta_level`만큼 상승(최대 레벨 3).

---

## 5. CSV 포맷 예시

운영 도구와의 연동을 위해 CSV 형태를 병행할 수 있습니다.

```csv
id,type,label,domain-levels
AS.MUL.FACTS,skill,곱셈 사실(0~9),연산·스케일-3
AS.MUL.POW10,skill,×10/×100 스케일,연산·스케일-3
AS.ADD.COMP,skill,친한 수 보정(+/−k),연산·누적-3
```

```csv
cs_id,requires_skills,teaches_skills
C01-S1,"AS.MUL.POW10:1;AS.ADD.COMP:1","AS.MUL.POW10:+1;AS.ADD.COMP:+1"
C03-S3,"AS.MUL.TWOxONE:2;AS.MUL.FACTS:2;AS.DIFF.READ:2;AS.REP.TAB2EXP:1","AS.MUL.TWOxONE:+1;AS.REP.TAB2EXP:+1"
```

---

## 6. 운영 체크리스트

1. 원자 스킬 사전 확정 → 중복/동의어 정리.
2. 코스/스텝 정의 시 `requires`/`teaches` 각각 3~6, 2~4개로 유지.
3. 문항 템플릿에 `skills` 태그(1~2개 권장) 추가.
4. 순환/누락 검사를 자동화하는 검증 스크립트 준비.
5. UI에는 스킬 레이어 토글, 부족 스킬 표시, 추천 스텝 노출.
6. 추천: 부족 레벨 평균(`gap_score`)과 보상(`teaches`)의 균형으로 정렬.

---

## 7. 예시: 곱셈 스킬 공유

* `C01-S1`은 `AS.MUL.POW10(레벨 ≥1)`을 요구하고 완료 시 같은 스킬을 올려 줍니다.
* `C03-S3`은 `AS.MUL.TWOxONE`, `AS.MUL.FACTS` 등 곱셈 스킬을 레벨 ≥2로 요구합니다.
* 사용자가 `C01-S1`을 완료하면 곱셈 관련 스킬 레벨이 상승하여 `C03-S3` 잠금 해제에 기여합니다.

이 구조를 통해 동일 스킬이 여러 코스·스텝에서 동시에 활용되고, 학습 결과가 곧바로 다른 경로의 잠금 해제로 반영됩니다.

---

## 부록: 원자 스킬 전체 목록(카테고리별)

### A. 수·자릿값·표현
`AS.PV.READ`, `AS.PV.DECOMP`, `AS.PV.EXCHANGE`, `AS.REP.TAB2EXP`, `AS.REP.EXP2TAB`, `AS.REP.NUMBERLINE`, `AS.REP.GRAPHREAD`

### B. 덧셈/뺄셈(누적/차분)
`AS.ADD.COMP`, `AS.ADD.CARRY`, `AS.SUB.BORROW`, `AS.DIFF.READ`, `AS.CHK.INV_SUM`

### C. 곱셈/나눗셈(스케일)
`AS.MUL.FACTS`, `AS.MUL.POW10`, `AS.MUL.TWOxONE`, `AS.MUL.AREA`, `AS.DIV.SHARE`, `AS.DIV.MEASURE`, `AS.DIV.REL`

### D. 분수/소수/비율
`AS.FRAC.PARTWHOLE`, `AS.FRAC.EQ`, `AS.FRAC.ADD`, `AS.FRAC.MUL`, `AS.DEC.READ`, `AS.RATIO.UNIT`, `AS.RATIO.TABLE`, `AS.RATIO.SLOPE`

### E. 규칙성/수열/일차
`AS.SEQ.DIFFCONST`, `AS.SEQ.GENERAL`, `AS.LIN.SLOPE`, `AS.LIN.INTERCEPT`, `AS.LIN.FORM`

### F. 좌표/도형(변환)
`AS.COORD.READ`, `AS.COORD.DISTMID`, `AS.GEO.TRANS`, `AS.GEO.SIM`, `AS.TRIG.RATIO`

### G. 누적/변화(해석 직관)
`AS.ACC.SUMRECT`, `AS.ACC.TRAP`, `AS.RATE.AVG`, `AS.RATE.UNIT`

### H. 통계/확률
`AS.STATS.CENTER`, `AS.STATS.SPREAD`, `AS.COUNT.RULES`, `AS.PROB.BI`, `AS.NORM.EMP`
