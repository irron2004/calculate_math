# Skill Tree Content & Visual Standards Guide

## Overview
이 가이드는 스킬 트리 UI에 투입되는 카피, 로컬라이제이션 키, 아이콘/시각 요소를 일관되게 유지하기 위한 참고 문서입니다. React 컴포넌트(`frontend/src/components/SkillTree.tsx`)와 스타일(`frontend/src/components/SkillTree.css`)을 기준으로 작성되었으며, 디자인·콘텐츠 팀 합의 사항을 반영합니다. 신규 기능이나 리뉴얼 시 본 가이드를 확인하고 필요한 경우 아래 연락 채널을 통해 디자인/콘텐츠 팀과 협업하세요.

- 디자인 파트너: `#calc-design` 슬랙 채널, Figma 파일 **“Calculate Math · Skill Tree”**
- 콘텐츠 파트너: `#calc-content` 슬랙 채널, Confluence 스페이스 **“Learning Narrative”**
- 접근성 컨설트: 분기별 리뷰(`a11y-review@360me.app`), QA 체크리스트 `docs/content_import_checklist.md`

## Localization keys
스킬 트리 문자열은 `skillTree.*` 네임스페이스를 사용합니다. FastAPI/React 레이어 모두 동일한 키를 참조해야 하며, 신규 키 추가 시 로컬/번역 리소스를 동시에 갱신하세요.

| 용도 | 기본 문자열 (KO) | Key | 비고 |
| --- | --- | --- | --- |
| 로딩 상태 | `스킬 트리를 불러오는 중입니다...` | `skillTree.loading` | `role="status" aria-live="polite"`와 함께 사용.【F:frontend/src/components/SkillTree.tsx†L58-L64】 |
| 오류 상태 | `스킬 트리를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.` | `skillTree.error.generic` | 치명적 오류, `role="alert"` 유지.【F:frontend/src/components/SkillTree.tsx†L44-L56】 |
| 빈 상태 | `표시할 스킬 트리 데이터가 없습니다.` | `skillTree.empty` | 데이터 없음 시 노출.【F:frontend/src/components/SkillTree.tsx†L66-L72】 |
| 숙련도 | `숙련도 {percent}%` | `skillTree.node.mastery` | `{percent}`는 반올림된 정수.【F:frontend/src/components/SkillTree.tsx†L132-L135】 |
| 선행 조건 | `선행: {prereqs}` | `skillTree.node.prerequisiteList` | 여러 항목은 `,`로 결합.【F:frontend/src/components/SkillTree.tsx†L139-L142】 |
| 상태 라벨 | `완료`, `학습 가능`, `잠김` | `skillTree.status.completed`, `skillTree.status.available`, `skillTree.status.locked` | 시각적 배지와 일치하도록 UI 텍스트에 사용.【F:frontend/src/components/skillTreeHelpers.ts†L38-L68】【F:frontend/src/components/SkillTree.css†L84-L123】 |

### 키 작성 규칙
1. **영역 기반 접두어**: `skillTree.branch.*`, `skillTree.node.*`처럼 UI 영역을 우선 지정합니다.
2. **상태/행동 구분**: `status`, `action`, `hint` 등의 중간 세그먼트로 의미를 분류합니다.
3. **언어별 축약 금지**: 번역 중 의미 왜곡을 막기 위해 모든 키는 완전한 문장을 기준으로 작성합니다.
4. **JSON 구조 예시**:
   ```json
   {
     "skillTree": {
       "loading": "스킬 트리를 불러오는 중입니다...",
       "error": {
         "generic": "스킬 트리를 불러오지 못했습니다. 잠시 후 다시 시도해주세요."
       },
       "status": {
         "completed": "완료",
         "available": "학습 가능",
         "locked": "잠김"
       }
     }
   }
   ```

## Difficulty & copy guidelines
- **톤 & 보이스**: 학습자가 직접 조작하는 UI이므로 친구 같은 존댓말을 유지하되, 지시형/격려형 문장을 혼합합니다. 오류·경고는 문제 해결 행동을 제시하는 문장으로 마무리합니다.【F:frontend/src/components/SkillTree.tsx†L44-L64】
- **난이도 표기**: 단계(step)는 `S1`~`S6` 시퀀스를 따릅니다. 새로운 단계명을 도입할 때는 `STEP_SEQUENCE` 상수를 먼저 확장하고, 콘텐츠 팀과 난이도 정의를 재확인하세요.【F:frontend/src/components/skillTreeHelpers.ts†L24-L63】
- **마이크로 스킬 요약**: 3개 이하로 잘라서 노출하며, 길이가 긴 항목은 콘텐츠 팀에서 24자 이하 국문 기준으로 작성합니다.【F:frontend/src/components/SkillTree.tsx†L135-L138】
- **선행 개념 표기**: `개념명 단계` 조합(예: `받아올림 덧셈 S2`)을 기본 형식으로 유지합니다. 자동 생성 규칙은 헬퍼에서 `normaliseLabel` 로직을 따르므로, 데이터 소스에서도 `·` 구분자를 사용하세요.【F:frontend/src/components/skillTreeHelpers.ts†L32-L45】

## Iconography & visual standards
- **컬러 토큰**: 상태별 배지 색상은 CSS 변수 대신 고정 RGBA 값을 사용합니다. UI 일관성을 위해 디자인팀과 합의된 팔레트에서만 값을 가져오고, 필요 시 `graph.meta.palette`로 브랜치 컬러를 확장하세요.【F:frontend/src/components/SkillTree.css†L94-L123】【F:frontend/src/components/skillTreeHelpers.ts†L69-L94】
- **브랜치 인디케이터**: `skill-tree__branch-indicator`는 렌즈 팔레트 컬러(없을 경우 기본 `#6366f1`)를 사용합니다. 새 렌즈를 추가하면 Figma 토큰에 동일한 hex 값을 등록하세요.【F:frontend/src/components/SkillTree.tsx†L80-L110】
- **배지 레이아웃**: 단계(step)와 개념명(label)은 한 줄에 표시하며, 줄바꿈이 필요한 경우 콘텐츠 팀과 협의해 2줄 배치 허용 여부를 결정합니다. 버튼 상태(선택/포커스)는 CSS에 정의된 outline을 재사용합니다.【F:frontend/src/components/SkillTree.css†L74-L117】
- **아이콘 사용**: 현재 단계 배지 내부에는 아이콘을 사용하지 않습니다. 아이콘이 필요할 경우 16px, 단색(상태 색상 600 계열) SVG를 추가하고 `aria-hidden="true"`를 지정하세요.

## Tone & accessibility checklist
- **ARIA 역할**: 로딩 영역은 `role="status"`, 오류는 `role="alert"`, 브랜치 섹션은 `<section>`과 `aria-labelledby` 연계를 유지합니다. 새로운 인터랙션을 추가할 경우 동일한 패턴을 따릅니다.【F:frontend/src/components/SkillTree.tsx†L58-L123】
- **키보드 내비게이션**: `.skill-tree__node-trigger`는 `<button>` 요소로 유지하며, 포커스 표시를 CSS `:focus-visible` 스타일로 제공해야 합니다. 새 UI 요소는 `tabindex="0"` 이상만 허용하고, 포커스 트랩을 도입할 때는 a11y 리뷰를 요청하세요.【F:frontend/src/components/SkillTree.tsx†L112-L142】【F:frontend/src/components/SkillTree.css†L117-L123】
- **색 대비**: 배경 대비 비율 4.5:1 이상을 만족해야 합니다. 기존 색상이 기준에 미달할 경우 디자인 팀과 협의 후 팔레트를 조정하고, 변경 사항을 본 문서에 업데이트합니다.
- **복합 텍스트**: 학습자가 부모/교사 대시보드에서 동일한 데이터를 볼 수 있으므로, 수동 입력 카피는 복수 인칭 대신 중립적 서술형을 사용합니다.

## Workflow for updates
1. **기획**: 스킬 트리 구조 변경이 필요하면 그래프 스키마(owner: 데이터팀)를 업데이트하고, `docs/problem_generation_plan.md`와 변경 점을 비교합니다.
2. **콘텐츠 검수**: 새 단계/개념 텍스트는 콘텐츠 팀에서 1차 작성 → 디자인 리뷰 → 로컬라이제이션 번역 → QA.
3. **개발 적용**: React 컴포넌트에 새 키를 매핑하고, FastAPI 응답의 `CurriculumGraph` 데이터에 레이블을 추가합니다.
4. **문서 갱신**: 본 가이드와 README 링크를 업데이트하고, 변경 내역을 릴리즈 노트에 기록합니다.

가이드에 대한 제안이나 오류는 GitHub 이슈 `docs:skill-tree-guide` 라벨을 사용해 보고해주세요.
