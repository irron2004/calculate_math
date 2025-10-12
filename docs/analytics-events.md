# Analytics Events

이 문서는 프런트엔드에서 송신하는 핵심 학습 이벤트와 페이로드 형식을 설명합니다. 모든 이벤트는 `window.analytics.trackEvent`를 통해 전달되며, `frontend/src/utils/analytics.ts`의 래퍼 함수를 통해 호출됩니다.

## 공통 사항

- 모든 이벤트는 undefined/null 값을 제거한 페이로드를 전송합니다.
- `concept_id`는 커리큘럼 개념 ID, `step`은 단계(S1~S3)를 의미합니다.
- `sequence_index`는 커리큘럼 시퀀스 내 위치(0 기반)로, 식별되지 않을 경우 null 입니다.

## 이벤트 정의

### `skill_viewed`

학습 세션이 특정 스킬 단계로 전환될 때 발생합니다.

필드 | 타입 | 설명
---|---|---
`concept_id` | string | 선택된 개념 ID
`concept_name` | string | 개념 이름
`step` | "S1"\|"S2"\|"S3" | 단계 식별자
`node_id` | string | 커리큘럼 그래프 노드 ID (없으면 `concept-step`)
`source` | string | 진입 경로(`initial`, `concept_tab`, `skill_node`, `auto_progress`, `restart`, `resume`, `query_param`, `unknown`)
`sequence_index` | number\|null | 커리큘럼 시퀀스 인덱스
`available` | boolean | 해당 단계가 현재 잠금 해제 상태인지 여부
`completed` | boolean | 사용자가 이미 완료한 단계인지 여부
`lens` | string\|undefined | 주요 렌즈 태그
`problem_count` | number\|undefined | 로드된 문제 수
`problems_source` | string\|undefined | 문제 생성 출처(`generated`, `session_fallback`, `local_fallback`)

### `skill_unlocked`

사용자가 단계를 완료해 다음 단계가 잠금 해제될 때 발생합니다.

필드 | 타입 | 설명
---|---|---
`concept_id` | string | 개념 ID
`concept_name` | string | 개념 이름
`unlocked_step` | "S1"\|"S2"\|"S3" | 새로 열린 단계
`previous_step` | "S1"\|"S2"\|"S3" | 방금 완료한 단계
`node_id` | string | 새 단계의 커리큘럼 노드 ID
`sequence_index` | number\|null | 새 단계의 시퀀스 인덱스
`lens` | string\|undefined | 주요 렌즈 태그

### `boss_passed`

보스 단계(`S3`)를 성공적으로 통과하고 LRC 평가가 통과(`passed=true`)했을 때 발생합니다.

필드 | 타입 | 설명
---|---|---
`concept_id` | string | 개념 ID
`concept_name` | string | 개념 이름
`step` | "S1"\|"S2"\|"S3" | 단계 (`S3`)
`node_id` | string | 보스 노드 ID
`sequence_index` | number\|null | 시퀀스 인덱스
`status` | string | LRC 상태(`gold`, `silver`, 등)
`recommendation` | string | LRC 추천값
`metrics` | Record<string, number> | 세부 지표 (정확도, 반응속도 등)
`score` | number | 세션 점수
`total_questions` | number | 총 문항 수
`correct_count` | number | 정답 문항 수

### `session_started_from_tree`

스킬 트리에서 노드를 클릭하여 세션을 시작할 때 발생합니다.

필드 | 타입 | 설명
---|---|---
`concept_id` | string | 개념 ID
`concept_name` | string | 개념 이름
`step` | "S1"\|"S2"\|"S3" | 단계
`node_id` | string | 노드 ID
`sequence_index` | number\|null | 시퀀스 인덱스
`triggered_by` | string | 트리 인터랙션 종류 (`skill_node`)
`available` | boolean | 선택 시점에서 잠금 해제 여부
`completed` | boolean | 이미 완료된 단계인지 여부
`lens` | string\|undefined | 주요 렌즈 태그

## 참고

- 이벤트 테스트는 `frontend/src/__tests__/analytics.test.ts`에서 수행되며, 각 래퍼가 올바른 이벤트 이름과 페이로드를 전송하는지 검증합니다.
- 새로운 이벤트를 추가할 경우 `frontend/src/utils/analytics.ts`와 본 문서를 함께 업데이트하세요.

