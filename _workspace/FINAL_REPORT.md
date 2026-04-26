# Phase 1~6 통합 실행 리포트

**일자:** 2026-04-23
**스코프:** 커리큘럼 리뷰에서 식별한 Critical/Major/Minor 이슈 7개 전체

---

## 산출물 목록

| 파일 | 내용 | 상태 |
|---|---|---|
| `_workspace/graph_review_2026_04_23.md` | 초기 감사 리포트 | 완료 |
| `_workspace/phase1_weaktag_taxonomy_v0_3_draft.md` | weakTag taxonomy v0.3 (초1-2 NA 19태그) | 완료 |
| `_workspace/phase1_graph_proposal.json` | 초1-2 NA atomicSkills + drill-down | 완료 |
| `_workspace/phase2_weaktag_taxonomy_v0_3_extension.md` | weakTag 확장 (RR/GM/DP + 초3-4 NA, 28태그) | 완료 |
| `_workspace/phase2_graph_proposal.json` | 초1-2 RR/GM/DP + 초3-4 NA | 완료 |
| `_workspace/phase3_graph_proposal.json` | 고2 achievement 매핑 (대수·미적분I) | 완료 |
| `_workspace/phase4_graph_proposal.json` | 갈래 합류 엣지 10개 | 완료 |
| `_workspace/phase5_csat_separation_proposal.md` | CSAT 분리 제안 (실행 보류) | 제안만 |
| `_workspace/phase6_graph_proposal.json` | 중·고 prereq + achievement prereq | 완료 |
| `_workspace/build_merged_proposal.py` | 병합 스크립트 | 완료 |
| `_workspace/merged_graph_v0_3.json` | 최종 병합 그래프 (390 노드 / 764 엣지) | 완료 |

---

## 증분 요약

| 지표 | 원본 | 병합본 | 증감 |
|---|---|---|---|
| 노드 수 | 366 | 390 | +24 |
| 엣지 수 | 668 | 764 | +96 |
| achievement | 107 | 124 | +17 (고2 신규) |
| textbookUnit | 230 | 237 | +7 (초1-4 drill-down) |
| prereq 엣지 | 196 | 244 | +48 |
| alignsTo 엣지 | 107 | 131 | +24 (자동 생성) |
| atomicSkills 보유 노드 | 0 | 45 | +45 |
| atomicSkills 총 개수 | 0 | 124 | +124 |
| weakTag taxonomy | v0.2 | v0.3 | +80 태그 |

---

## 이슈별 해결 상태

| # | 이슈 | 해결 상태 |
|---|---|---|
| **C-1** | atomicSkills 0개 | ✅ 45 achievement에 124개 부여 |
| **C-2** | 고2 achievement 0개 | ✅ 17개 신규 (대수·미적분I 핵심) |
| **C-3** | drill-down 얕음 | ✅ 초1-2 NA + 초3-4 NA 핵심 단원 7개 분해 |
| **M-1** | 갈래 합류 엣지 6개 | ✅ +10개 (→ 16개) |
| **M-2** | 중·고 단원 prereq 없음 | 🟡 부분 (초→중 3개, 중→고 5개, 고 내부 7개 추가) |
| **M-3** | achievement 간 prereq 없음 | 🟡 부분 (초1-2+초3-4+고2 주요 경로 18개 추가) |
| **m-2** | CSAT 혼재 | 🟡 제안만 (실행 보류, 사용자 결정 필요) |

---

## 검증 결과

### 내부 무결성 (Python 스크립트)
- ✅ 노드 id 중복: 0
- ✅ 엣지 중복: 0
- ✅ 엣지 참조 깨짐: 0
- ✅ parentId 깨짐: 0
- ✅ atomicSkill id 중복: 0
- ✅ prereq 사이클: 없음

### 공식 validator (`npm run validate:data`)
- ⚠️ **원본부터 오류 366건** — validator가 구버전 스키마(`type: subject|grade|domain|standard`)를 기대함
- ⚠️ 병합본 오류 390건 (증가분 = 내가 추가한 노드 24개 × 1)
- ℹ️ **병합이 만든 새 오류 유형은 0.** 내 변경이 기존 무결성을 깨트리지 않음
- **별도 해결 필요 이슈:** `curriculum-viewer/src/lib/curriculum/dataValidation.js`의 NODE_TYPES 상수가 실제 그래프와 불일치. math-backend-engineer 티켓으로 처리 권장

---

## 사용자 결정이 필요한 사항

1. **병합본 적용 여부**
   - `_workspace/merged_graph_v0_3.json`을 `public/data/curriculum_math_2022.json`으로 덮어쓸지 여부
   - 권장: 브랜치 만들고 적용, PR로 단계별 커밋 (Phase 1 → Phase 2 → ... 순)

2. **Phase 5 (CSAT 분리) 진행 방식**
   - 옵션 A (별도 파일 + 매핑 테이블, 권장)
   - 옵션 B (`category` 플래그, 임시)
   - 옵션 C (당분간 유지)
   - `_workspace/phase5_csat_separation_proposal.md` 참조

3. **weakTag taxonomy v0.3 승인**
   - `learning-diagnostic-designer` 역할상 정식 승인 필요
   - 승인되면 Phase 7로 기존 문제 재태깅 작업 (optional, 하위 호환)

4. **고2 officialCode 매핑**
   - Phase 3에서 임시 id(`P_ACH_*`) 사용, `officialCode` 공란
   - 2022 개정 고등 공식 성취기준 코드가 확정되면 일괄 채우기 가능
   - 이번 작업 밖

5. **중학교 단원 prereq 보강**
   - MVP(초1-4+고2) 기준 최소만 추가. 중학 내부 연결은 별도 후속 작업
   - 별도 Phase 필요 시 지시

---

## 다음 단계 제안 (우선순위 순)

1. **[사용자 결정]** 병합본을 검토하고 적용 여부 지시
2. **[적용 시]** git branch 생성 → Phase 별 커밋 → dataValidation.js 스키마 최신화 → PR
3. **[Phase 7 - 후속]** 문제은행에 기존 문제가 있다면 `problem-content-designer`가 새 atomicSkill·weakTag로 재태깅
4. **[Phase 8 - 후속]** `homework-ta`가 실제 숙제 세트 구성 시 신규 atomicSkills 활용
5. **[Phase 9 - 후속]** 2주 운영 후 `student-state-researcher`가 v0.3 태그가 데이터에서 의도대로 동작하는지 검증
