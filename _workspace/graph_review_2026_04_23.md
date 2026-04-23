# 커리큘럼 그래프 리뷰 — 2026-04-23

**대상 파일:** `public/data/curriculum_math_2022.json`
**규모:** 366 노드 · 668 엣지 · 2026-02-15 생성
**기준 스킬:** `curriculum-graph-design`
**기준 비전 문서:** `03_문서/docs/service_goals_kpi_and_roles.md` §1.2 (커리큘럼 구조), `project_roles_and_responsibilities.md` §2.1

---

## 0. 한 줄 결론

**참조 무결성은 완벽하지만, 서비스 비전(drill-down 스킬 그래프 + atomicSkills 기반 진단)과 현재 그래프(성취기준 계층 트리 + 얕은 prereq) 사이에 큰 간극이 있다.** 당장은 "그래프 위에 한 층 더 얹는 방향"이 필요하다.

---

## 1. 구조 요약

### 1-1. 노드 계층 (6층 트리)
```
root (1) → schoolLevel (3) → gradeBand (5) → domain (20) → textbookUnit (230) → achievement (107)
```
- schoolLevel: E(초), M(중), H(고)
- gradeBand: 1-2, 3-4, 5-6, 7-9, 10-12 — **4갈래 구조 전 gradeBand에 일관 적용됨 (NA/RR/GM/DP)**
- textbookUnit 230개 중 100개는 CSAT 문제집 노드(schoolLevel/domainCode 누락)

### 1-2. 엣지 타입 분포
| edgeType | 개수 | 역할 |
|---|---|---|
| `contains` | 365 | 트리 부모-자식 |
| `prereq` | 196 | 선수관계 |
| `alignsTo` | 107 | textbookUnit ↔ achievement 매핑 |

---

## 2. 잘 된 점 ✅

1. **참조 무결성 100%** — parentId 깨짐 0, 엣지 source/target 깨짐 0, 엣지에 전혀 안 걸린 고아 0
2. **4갈래 일관성** — 1-2 ~ 10-12 전 gradeBand에 NA/RR/GM/DP domain 노드 존재
3. **초등 커버리지 촘촘** — E 단계 48 units + 72 achievements
4. **출처 투명성** — meta.sources에 교육부 고시 + NCIC URL, note에 버전 이력 기록
5. **achievement 텍스트 품질** — 성취기준 원문(`text`) + 설명(`description`) 이원 유지

---

## 3. 발견한 이슈 (우선순위순)

### 🔴 Critical (서비스 비전과 직결)

#### C-1. `atomicSkills` 필드 0개 — 진단의 기반이 없다
- 현재 상태: 366개 노드 중 `atomicSkills`를 가진 노드 **0개**
- 비전 문서 요구: `service_goals_kpi_and_roles.md` §4.2는 "AtomicSkill 정의"를 그래프 설계자 핵심 책임으로 명시
- 하네스 스킬 요구:
  - `curriculum-graph-design`: 노드 스키마에 `atomicSkills: [...]` 필수
  - `problem-bank-curation`: 문제 작성 시 "대상 노드의 atomicSkills를 읽는다" 단계
  - `diagnostic-taxonomy-design`: weakTag가 atomicSkills와 1:N 매핑
- **영향:** 이게 없으면 "받아올림_누락" 같은 정밀 weakTag가 어디에 붙을지 정의되지 않아, 3개 연구 스킬 전부가 공중에 뜬다.
- **권고:** 초1-4 + 고2(MVP 범위)의 textbookUnit 부터 atomicSkills 정의부터 시작. 완전체 말고 "이번 주 가르칠 단원" 단위로 증분.

#### C-2. 고등(10-12) achievement 노드 0개
- 현재: 10-12 textbookUnit 45개 / achievement **0개**
- 과거 audit(`02_데이터/data/curriculum_math_2022_full_audit.md`)도 "High is at unit/topic level, course-level achievement standards 매핑 필요"로 명시
- **영향:** MVP 범위가 "초1-4 + 고2"인데, 고2는 진단의 최소 단위(성취기준)가 없어 실질적으로 unit 단위 측정만 가능
- **권고:** 공통수학I/II, 대수, 미적분I 의 공식 성취기준 코드(`10수01-01` 형식)를 10-12에 맞게 도입. 최소 고2 교과 범위만.

#### C-3. Drill-down이 너무 얕다
- 초등 1-2 NA 단원: **3개**만 존재 — "네 자리 이하의 수", "두 자리 수 범위의 덧셈과 뺄셈", "한 자리 수의 곱셈"
- 비전(§1.2): "1자리 덧셈 → 2자리 덧셈 → 3자리 덧셈" 수준으로 최대한 세분화
- 현재는 "두 자리 수 범위의 덧셈과 뺄셈" 한 덩어리 → 받아올림 유무, 자릿수별, 뺄셈 분리 등이 한 노드에 뭉침
- **권고:** textbookUnit 밑에 좀 더 세분화된 `skillNode` 층을 도입하거나, 기존 textbookUnit을 분해. (atomicSkills가 이 역할을 할 수도 있음 — C-1과 연동)

---

### 🟡 Major

#### M-1. 갈래 합류(branch convergence) 거의 없음
- 갈래 경계 넘는 prereq: **6개**뿐
  - 세 자리 수 덧셈 → 길이/들이 측정 (NA→GM)
  - 곱셈/나눗셈 → 평균 (NA→DP)
  - 곱셈/나눗셈 → 비와 비율 (NA→RR)
  - 곱셈 → 등비수열 (NA→RR)
  - 두 자리 덧뺄 → 규칙 (NA→RR)
  - 한 자리 수의 곱셈 → 등비수열 (NA→RR)
- 비전(§1.2): "RR 함수 → NA 미적분" 같은 **상위 단계 합류**가 핵심
- **영향:** 현재 그래프는 각 갈래가 평행하게 흐르기만 함. "함수를 잘해야 미적분이 된다"는 학습 구조가 그래프에 표현 안 됨.
- **권고:** 고등 RR 함수 ↔ NA 미적분, 고등 GM 좌표 ↔ RR 함수 수준의 합류 엣지를 최소 5~10개 추가.

#### M-2. 고등·중등 단원 중 prereq 진입 없음 — 42+35개
- schoolLevel별 prereq 진입 없는 textbookUnit:
  - 고등(H): 42개
  - 중등(M): 35개
  - 초등(E): 6개
- **영향:** 중학교·고등학교 단원이 서로·초등과 연결 안 됨 → 학습 경로가 "같은 학년 내"에 갇힘
- **권고:** 최소 중·고 전환 지점(9→10), 고1→고2 전환의 prereq를 우선 채움.

#### M-3. achievement 끼리 prereq 없음
- achievement 107개 중 prereq 진입 있는 건 **3개**뿐 (104개는 고립)
- 성취기준 간 선후 관계가 정의되어 있지 않음 → "이 성취기준을 먼저 해결해야 다음이 된다" 판단 불가
- 현재 prereq는 거의 전적으로 textbookUnit 수준 (193/196)
- **권고:** textbookUnit 내부에서 성취기준들도 순차적 prereq를 가져야 정밀 진단 가능. 단, C-1(atomicSkills)과 역할 중복될 수 있으니 설계 필요.

#### M-4. textbookUnit 필드 불균일
- `description` 100/230 누락
- `schoolLevel` 100/230 누락 (모두 CSAT 노드)
- `officialCode` 148/230 누락
- `descShort` 100/230만 있음 (CSAT 노드만)
- **판단:** CSAT 노드를 교과 노드와 한 파일에 섞어둔 설계 결정이 누락의 주 원인. 문제집 / 커리큘럼을 분리할지 결정 필요.

---

### 🟢 Minor

#### m-1. 장거리 prereq (gradeBand 3단계 점프) — 2개
- 초1-2 규칙 → 고1-3 등차수열
- 초1-2 한 자리 곱셈 → 고1-3 등비수열
- **판단:** 의도적 연결 같지만, 중간 노드(중학교 수열 기초) 경유 경로가 비어 있어 학생 입장에서 점프가 큼. README §2-4가 "장거리 의존은 중간 노드 추가" 권고.

#### m-2. CSAT 노드 정체성
- 100개 노드가 수능 문제집 구조를 그래프에 투영한 것 — `2025 수능 공통 1번` 같은 문항 단위
- 긍정: 수능 문제를 교과 노드에 매핑하려는 의도는 유용
- 부정: 교과 그래프와 문제집이 한 그래프에 섞이면 검색·시각화·편집이 어지러워짐
- **권고:** 별도 파일(`csat_problems_2025.json` 등)로 분리하고, `problemToNode` 매핑 테이블만 유지하는 구조 고려.

---

## 4. gradeBand × domain 매트릭스 (참고)

textbookUnit + achievement 합계:
| gradeBand | NA | RR | GM | DP | (?CSAT) |
|---|---|---|---|---|---|
| 1-2 | 14 | 2 | 10 | 5 | 0 |
| 3-4 | 15 | 6 | 19 | 6 | 0 |
| 5-6 | 23 | 5 | 11 | 4 | 0 |
| 7-9 | 15 | 28 | 17 | 12 | 0 |
| 10-12 | 6 | 27 | 5 | 7 | 100 |

관찰: **고등 NA 6개, GM 5개** — 10-12 대수 외 갈래가 얇다. 고2 MVP라면 NA(미적분 계산) / GM(기하) 보강 필요.

---

## 5. 권고 — 우선순위 로드맵

1. **Week 1: atomicSkills 도입 (C-1)**
   — 초1-2 NA 3단원부터. weakTag와 1:N 매핑 가능한 원자 스킬 3~5개씩 달기.
   — `learning-diagnostic-designer` 합의된 weakTag v0.3 taxonomy 필요 (공동 작업).
2. **Week 1: textbookUnit drill-down (C-3)**
   — 초1-2 "두 자리 수 범위의 덧셈과 뺄셈"을 "받아올림 없는 / 있는" 등으로 분해.
3. **Week 2: 고2 achievement 추가 (C-2)**
   — 공통수학I/II, 대수, 미적분I 성취기준 코드 매핑.
4. **Week 2: 갈래 합류 엣지 (M-1)**
   — RR 함수 → NA 미적분 prereq 최소 5개.
5. **Week 3: CSAT 노드 분리 (m-2)**
   — 별도 파일로 이동, `alignsTo` 매핑 유지.
6. **Week 3+: 중·고 prereq 보강 (M-2)**, **achievement 간 prereq (M-3)**

---

## 6. 다음 단계

이 리뷰는 구조 감사 결과다. 다음은 팀 작업이 필요하다:
- **atomicSkills·weakTag 설계** → `curriculum-graph-designer` + `learning-diagnostic-designer` 팀
- **Drill-down 실제 분해안** → `curriculum-graph-designer` 단독 후 `problem-content-designer` 검토
- **고2 성취기준 매핑** → `curriculum-graph-designer` 단독
- **CSAT 노드 분리 결정** → 사용자 의사결정 필요 (현재 정책에서 의도 파악)

우선 순위와 어느 작업부터 진행할지 지시받아야 진행 가능.
