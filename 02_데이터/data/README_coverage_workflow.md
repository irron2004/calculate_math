# Curriculum Coverage Workflow (KR-MATH-2022) — 템플릿 사용법

이 폴더의 3개 CSV는 “**누락 0**(모든 성취기준이 최소 1개 노드에 매핑됨)”을 만들기 위한 기본 워크플로우입니다.

## 1) 파일 설명
### (1) standards_master_template.csv
- ‘공식 성취기준(standard_id)’의 **단일 진실(SSOT, Single Source of Truth)** 입니다.
- 목표: **교육과정의 모든 성취기준을 한 줄씩** 채우는 것.
- 최소 필드: `standard_id, title_ko, text_ko, stage, grade_band, domain`

### (2) poster_nodes_A2_v1.csv
- A2 포스터(=A4 4장 출력)에서 크게 볼 ‘덩어리 노드(클러스터)’ 목록입니다.
- 각 노드는 여러 성취기준을 묶어 보여줍니다.
- 목표: 각 poster node의 `covers_standard_ids`(구분자 `|`)를 채워서
  **standards_master의 모든 standard_id가 최소 1회 이상 등장**하게 합니다.

### (3) skill_nodes_template.csv
- 수능/경시/시중문제 태깅에 쓰는 **원자 스킬(Atomic Skill)** 목록입니다.
- 원자 스킬은 “단일 행동 + 단일 개념 + 단일 표현”을 목표로 합니다.
- 목표: 문제(아이템)마다 `skill_id`로 태깅 가능하도록 스킬을 세분화합니다.
- `covers_standard_ids`로 교육과정과 추적가능성을 유지합니다.

## 2) 권장 작업 순서 (누락 0 달성)
1. **standards_master 채우기**
   - 교육부/NCIC의 공식 성취기준 표를 가져와 `standard_id` 기준으로 정리합니다.
2. **poster_nodes 매핑**
   - 각 큰 덩어리 노드에 해당되는 성취기준을 `covers_standard_ids`로 채웁니다.
   - 예: `2수01-01|2수01-02|2수01-03`
3. **원자 스킬(Atomic Skill) 세분화**
   - 수능/경시 문제를 태깅하면서 필요한 스킬을 추가합니다.
   - 스킬은 여러 성취기준을 커버할 수 있으나(1:N), 역방향 추적이 가능해야 합니다.
4. **QA(검증)**
   - 미커버(누락) 성취기준: standards_master에 있는데 어디에도 매핑되지 않은 기준
   - 고아 노드: prereq가 없고 어디에도 연결되지 않는 노드
   - 장거리 의존: 너무 먼 선행(학습 점프가 큰 경우) → 중간 노드 추가 필요

## 3) 필드 규칙
- 리스트 필드는 `|`(파이프)로 구분합니다.
- ID 네이밍 권장:
  - poster node: `P_<STAGE>_<DOMAIN>_<TOPIC>`
  - atomic skill: `AS_<TOPIC>_<SUBTOPIC>`
