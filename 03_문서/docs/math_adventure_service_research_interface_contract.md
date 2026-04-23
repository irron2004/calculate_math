# 수학 모험 Service-Research Interface Contract

## 0. 문서 목적

이 문서는 `수학 모험`에서 **서비스 조직**과 **Research 조직**이 어떤 규칙으로 연결되는지 정의하는
공식 인터페이스 계약 문서다.

이 문서는 다음 세 가지를 보장하기 위해 존재한다.

1. 서비스 조직이 Research 조직을 기다리지 않고 운영을 계속할 수 있다.
2. Research 조직이 서비스 데이터를 안정적으로 받아 그래프를 설계할 수 있다.
3. 두 조직의 산출물이 나중에 하나의 그래프 기반 학습 시스템으로 무리 없이 합류할 수 있다.

이 문서는 아이디어 메모가 아니라 **운영 계약 문서**다.
따라서 여기서 정의하는 이름 규칙, 데이터 필드, 매핑 상태, handoff 규칙은
향후 OpenClaw의 `soul`, `agent`, `knowledge` 문서가 참조할 수 있는 기준점으로 사용한다.

관련 문서:
- `03_문서/docs/math_adventure_roles_and_agent_rr.md`
- `03_문서/docs/service_goals_kpi_and_roles.md`
- `03_문서/docs/project_roles_and_responsibilities.md`
- `03_문서/docs/curriculum_viewer_v1_contract.md`

---

## 1. 배경

`math_adventure_roles_and_agent_rr.md`에서 수학 모험은 하나의 순차 루프가 아니라,
아래 두 조직으로 분리되었다.

- **서비스 조직**: 문제 출제, 숙제 배정, 채점, 스케줄 관리, 운영
- **Research 조직**: 단원 간 관계 분석, 그래프 노드/엣지 설계, mastery/diagnosis 규칙 설계

이 분리의 이유는 명확하다.

- 숙제 운영은 이미 Beta 서비스로 돌아가고 있다.
- 그래프 설계는 아직 연구 단계다.
- 운영과 연구는 속도와 목적이 다르다.
- 둘을 하나의 루프로 묶으면 Graph Architect 병목과 역할 전환 비용이 커진다.

따라서 두 조직은 분리되어 움직여야 하고,
동시에 **명확한 인터페이스 계약**을 통해 나중에 합류할 수 있어야 한다.

---

## 2. 계약 범위

이 계약은 아래 흐름에 적용한다.

1. 서비스 조직이 문제/숙제에 단원명을 태깅한다.
2. 서비스 조직이 단원 태그, 문제 이력, 오답 패턴, 학생 피드백을 축적한다.
3. Research 조직이 그 데이터를 받아 그래프 노드/엣지와 진단 규칙을 설계한다.
4. 서비스 태그와 Research 노드 사이의 매핑 상태를 관리한다.
5. 매핑 완료된 단원은 나중에 추천/진단/그래프 UI에 연결된다.

이 계약은 아직 다음을 직접 강제하지 않는다.

- 추천 알고리즘의 상세 구현
- 그래프 UI의 전체 화면 설계
- 학생 상태 추적의 최종 저장 모델 전체

즉, 이 문서는 **서비스와 Research 사이의 연결면(interface)** 만 다룬다.

---

## 3. 핵심 원칙

### 3.1 서비스 독립 원칙
서비스 조직은 그래프 완성 여부와 무관하게 문제 출제, 숙제 배정, 채점, 스케줄 관리, 운영을 계속한다.

### 3.2 Research 후행 원칙
Research 조직은 서비스 조직에서 쌓인 단원 태그, 출제 이력, 오답 패턴, 학생 피드백을 입력으로 사용한다.

### 3.3 이름 우선 연결 원칙
두 조직의 최초 연결점은 `단원명`이다.
단, 실제 운영 계약은 이름 하나로 끝나지 않고,
**정규화 규칙 + 매핑 상태 + 변경관리 + handoff 규칙**까지 포함해야 한다.

### 3.4 늦은 결합 원칙
서비스 데이터는 그래프 미완성 상태에서도 먼저 축적될 수 있어야 한다.
그래프 연결은 나중에 붙어도 되며, 기존 문제/숙제 데이터는 유실 없이 보존되어야 한다.

### 3.5 비파괴 매핑 원칙
Research 조직이 그래프를 정교화하더라도, 기존 서비스 태그 원본은 삭제하지 않는다.
모든 변경은 `mapping 추가`, `alias 추가`, `deprecated 처리` 방식으로 기록한다.

### 3.6 서비스 비차단 원칙
Research 조직의 canonical naming 확정 전에도 서비스 조직은 임시 태그로 운영할 수 있다.
단, 그 태그는 나중에 매핑 가능해야 한다.

---

## 4. 인터페이스 객체와 Source of Truth

서비스와 Research는 아래 3개의 객체로 연결된다.

## 4.1 Service Tag Record
서비스 조직이 문제/숙제에 남기는 단원 태그 기록이다.

- 소유 조직: **서비스 조직**
- Source of Truth: 서비스 DB / 문제 메타데이터
- 목적: 실제 운영에서 어떤 단원이 출제되었는지 기록

## 4.2 Research Graph Node
Research 조직이 정의하는 그래프 노드다.

- 소유 조직: **Research 조직**
- Source of Truth: 그래프 명세 문서 / 그래프 데이터셋
- 목적: 선수학습 관계, mastery 기준, 진단 규칙의 기준점

## 4.3 Mapping Record
서비스 태그와 Research 노드를 어떻게 연결할지 기록하는 매핑 테이블이다.

- 매핑 제안 작성: **Research 조직**
- 운영 영향 검토: **서비스 조직**
- 공유 Source of Truth: 공유 매핑 문서 또는 매핑 데이터셋
- 목적: 서비스 데이터와 그래프 노드를 연결하는 공식 합류 지점

---

## 5. 단원명 네이밍 계약

## 5.1 목적
단원명 네이밍 규칙은 서비스 조직이 태깅한 이름과 Research 조직이 정의한 노드 이름이
안정적으로 매핑되도록 하기 위한 최소 공통 규칙이다.

## 5.2 기본 규칙

단원명은 아래 원칙을 따른다.

1. **한 태그는 한 개념만 가리킨다**
   - 허용: `판별식`, `로그의 성질`
   - 비권장: `판별식/근의공식`, `로그와 지수함수`

2. **설명문이 아니라 개념명으로 쓴다**
   - 허용: `이차방정식의 판별식`
   - 비권장: `판별식을 이용해 근의 개수 구하기`

3. **학생 상태를 이름에 섞지 않는다**
   - 허용: `분수의 덧셈`
   - 비권장: `분수의 덧셈 어려움`, `분수의 덧셈 보강`

4. **트랙 정보는 별도 필드로 관리한다**
   - 이름은 개념 자체를 표현한다.
   - `track_code`는 `NA | RR | GM | DP`로 별도 저장한다.

5. **표기 변형은 alias로 관리한다**
   - 예: `로그 성질`, `로그의 성질`
   - canonical name은 하나만 두고 나머지는 alias로 등록한다.

## 5.3 canonical name 규칙

- canonical name은 Research 조직이 승인한다.
- 서비스 조직은 canonical name이 아직 없는 경우에도 임시 태그를 사용할 수 있다.
- 임시 태그는 Mapping Record를 통해 canonical name에 연결한다.

## 5.4 금지 규칙

아래와 같은 태그는 금지한다.

- 두 개 이상의 개념을 `/`, `,`, `및` 으로 묶은 태그
- 단원명 대신 문제 유형이나 풀이 절차를 적은 태그
- 학생 이름, 학급명, 날짜 등 운영 메타데이터가 섞인 태그
- 동일 개념에 대해 띄어쓰기 차이만 있는 중복 태그를 무제한 생성하는 방식

---

## 6. 데이터 교환 계약

## 6.1 Service → Research 최소 필드

서비스 조직은 Research 조직에 단원 태그와 관측 데이터를 넘길 때 아래 필드를 최소로 보장해야 한다.

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `service_tag_id` | string | Yes | 서비스 내부 태그 식별자 |
| `unit_name_raw` | string | Yes | 서비스에서 실제 사용한 원본 단원명 |
| `unit_name_normalized` | string | Yes | 정규화된 단원명 |
| `track_code` | enum | Yes | `NA`, `RR`, `GM`, `DP` |
| `problem_ids` | string[] | Yes | 이 태그가 붙은 대표 문제 ID 목록 |
| `assignment_ids` | string[] | No | 관련 숙제 ID 목록 |
| `observed_error_patterns` | string[] | No | 대표 오답 패턴 |
| `feedback_examples` | string[] | No | 학생/운영자 피드백 예시 |
| `first_seen_at` | datetime | Yes | 태그가 처음 관측된 시점 |
| `last_seen_at` | datetime | Yes | 태그가 마지막으로 관측된 시점 |

## 6.2 Research → Service 최소 필드

Research 조직은 그래프 노드와 매핑 결과를 서비스 조직에 공유할 때 아래 필드를 최소로 보장해야 한다.

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `graph_node_id` | string | Yes | 그래프 내부 노드 식별자 |
| `canonical_unit_name` | string | Yes | 승인된 대표 단원명 |
| `aliases` | string[] | No | 허용되는 별칭 목록 |
| `track_code` | enum | Yes | `NA`, `RR`, `GM`, `DP` |
| `mapping_status` | enum | Yes | `proposed`, `mapped`, `split`, `merged`, `deprecated` |
| `mapped_service_tag_ids` | string[] | Yes | 연결된 서비스 태그 ID 목록 |
| `prerequisite_node_ids` | string[] | No | 선수 노드 목록 |
| `mastery_note` | string | No | mastery 기준 요약 |
| `diagnosis_note` | string | No | 진단 설계 메모 |
| `updated_at` | datetime | Yes | 마지막 갱신 시각 |

## 6.3 Mapping Record 상태값

| 상태 | 의미 |
|---|---|
| `unmapped` | 서비스 태그가 아직 어떤 그래프 노드에도 연결되지 않음 |
| `proposed` | Research 조직이 연결 후보를 제안했지만 확정되지 않음 |
| `mapped` | canonical node로 안정적으로 연결됨 |
| `split` | 하나의 서비스 태그가 여러 노드로 나뉘어야 함 |
| `merged` | 여러 서비스 태그가 하나의 canonical node로 묶임 |
| `deprecated` | 더 이상 직접 쓰지 않고 alias 또는 이전 태그로만 유지 |

## 6.4 데이터 접근 경계

- Research 조직은 그래프 설계와 진단 규칙 설계에 필요한 범위의 데이터만 받는다.
- 가능하면 직접 식별자 대신 내부 참조 ID 또는 비식별화된 값을 사용한다.
- 서비스 조직은 운영 메모와 학생 개인정보를 단원 태그 필드에 섞지 않는다.

---

## 7. 매핑 계약

## 7.1 매핑 책임

- 서비스 조직은 **원본 태그를 정확히 남길 책임**이 있다.
- Research 조직은 **canonical node와 매핑 상태를 정의할 책임**이 있다.
- 서비스 조직은 그 매핑이 실제 운영을 깨지 않는지 검토할 책임이 있다.

## 7.2 매핑 변경 규칙

- `mapped → split`, `mapped → merged`, `mapped → deprecated` 같은 변경은 항상 변경 사유를 남긴다.
- 변경 전후에 어떤 서비스 태그와 어떤 그래프 노드가 영향을 받는지 기록한다.
- 기존 서비스 태그 원본은 삭제하지 않는다.

## 7.3 alias / deprecated 규칙

- 같은 개념의 표기 차이는 alias로 남긴다.
- 더 이상 직접 쓰지 않는 이름은 deprecated로 전환한다.
- alias와 deprecated는 모두 과거 데이터 추적에 사용 가능해야 한다.

---

## 8. handoff 계약

## 8.1 Service → Research handoff

아래 경우 서비스 조직은 handoff packet을 생성해야 한다.

- 새로운 단원 태그가 일정 수 이상 누적되었을 때
- 특정 단원 관련 오답 패턴이 반복적으로 관측되었을 때
- Research 조직이 요청한 태그/문제 샘플이 준비되었을 때

최소 산출물:
- 단원명 태그 목록
- 대표 문제 샘플
- 오답 패턴 요약
- 관련 학생 피드백 요약

## 8.2 Research → Service handoff

아래 경우 Research 조직은 handoff packet을 생성해야 한다.

- 새로운 canonical node가 확정되었을 때
- 태그 충돌이나 이름 통합이 필요할 때
- 특정 단원의 선수관계, mastery 기준, 진단 규칙이 안정화되었을 때

최소 산출물:
- canonical node 목록
- 매핑 상태 변경표
- alias / deprecated 처리 목록
- 서비스 적용 시 주의사항

## 8.3 handoff packet 필수 항목

모든 handoff packet은 아래 항목을 포함해야 한다.

- 역할명
- 작업 목적
- 입력 데이터
- 결정해야 하는 질문
- 출력 형식
- 완료 조건
- 다음 handoff 대상

이 형식은 `math_adventure_roles_and_agent_rr.md`의 handoff 표준과 동일한 형식을 따른다.

---

## 9. 검증 규칙

## 9.1 네이밍 검증

아래 조건을 만족하지 못하면 handoff 전에 수정해야 한다.

- `unit_name_raw`가 비어 있지 않을 것
- `unit_name_normalized`가 비어 있지 않을 것
- `track_code`가 정의되어 있을 것
- 동일 normalized name이 서로 다른 의미로 중복 사용되지 않을 것

## 9.2 매핑 검증

- `mapped` 상태의 서비스 태그는 최소 1개의 `graph_node_id`를 가져야 한다.
- `split` 상태는 분리 대상 노드 목록이 있어야 한다.
- `merged` 상태는 병합 근거와 대표 canonical name이 있어야 한다.

## 9.3 비파괴 검증

- 기존 서비스 태그 원본은 삭제하지 않는다.
- 이름 변경은 overwrite가 아니라 alias/deprecated 기록으로 남긴다.
- 기존 문제/숙제 데이터는 과거 태그 기준으로도 추적 가능해야 한다.

## 9.4 데이터 품질 검증

- Service → Research handoff에는 최소 1개 이상의 대표 문제 ID가 포함되어야 한다.
- 오답 패턴이나 피드백이 포함될 경우, 어떤 태그와 연결되는지 추적 가능해야 한다.
- `last_seen_at`이 오래된 태그라도 삭제하지 않고 상태만 갱신한다.

---

## 10. 운영 cadence

## 10.1 서비스 조직 cadence

- 단원 태깅: 문제 출제 시 즉시
- 피드백/오답 패턴 정리: 운영 루프에 맞춰 지속적
- handoff packet 생성: 주간 또는 필요 시 ad-hoc

## 10.2 Research 조직 cadence

- 태그 수집 및 정규화 검토: 주간
- 노드/엣지 후보 분석: 주기적
- 매핑 상태 갱신: 분석 단위 완료 시

## 10.3 합류 cadence

아래 항목은 최소 주간 단위로 확인한다.

- 신규 태그 수
- unmapped 태그 수
- mapped 전환 수
- split / merged / deprecated 변경 수

---

## 11. 변경관리

## 11.1 이름 변경

- canonical name 변경은 Research 조직이 제안하고 서비스 조직이 검토한다.
- 기존 이름은 즉시 삭제하지 않고 alias 또는 deprecated 상태로 유지한다.

## 11.2 트랙 변경

- 같은 개념이 다른 `track_code`로 이동해야 할 경우,
  단순 overwrite가 아니라 변경 사유와 이전 값을 기록한다.

## 11.3 매핑 변경

- `mapped → split`, `mapped → merged`, `mapped → deprecated` 같은 변경은
  변경 사유와 영향 범위를 함께 남긴다.

## 11.4 버전 관리

- 이 계약 문서는 버전 필드 또는 개정 이력을 가져야 한다.
- 단원명 정규화 규칙, 매핑 상태값, 필수 필드가 변경될 경우 하위 호환성 여부를 함께 기록한다.
- 기존 서비스 데이터에 영향을 주는 변경은 적용 전 공유 검토를 거친다.

---

## 12. 합류 준비 완료 기준

서비스 조직과 Research 조직의 산출물이 실제로 합류 가능하다고 보기 위한 최소 조건은 다음과 같다.

1. 핵심 단원 태그에 대해 canonical node가 정의되어 있다.
2. 주요 서비스 태그가 `mapped` 또는 명시적 `split/merged` 상태를 가진다.
3. alias / deprecated 규칙이 기록되어 있다.
4. 기존 문제/숙제 데이터가 어떤 node로 연결되는지 추적 가능하다.
5. 서비스 조직이 Research 조직의 이름 변경 때문에 운영을 멈추지 않는다.

---

## 13. 운영 지표

이 계약이 실제로 작동하는지 보기 위해 아래 지표를 추적한다.

- 신규 태그 발생 수
- unmapped 태그 누적 수
- mapped 전환율
- 이름 충돌 건수
- alias / deprecated 처리 건수
- 서비스 태그 → 그래프 노드 매핑 리드타임

---

## 14. 권장 후속 문서

이 계약을 실제 운영 체계로 완성하려면 다음 문서가 이어져야 한다.

1. **단원명 네이밍 규칙 문서**
   - canonical naming, alias, normalization 예시 포함
2. **매핑 테이블 운영 문서**
   - `unmapped / proposed / mapped / split / merged / deprecated` 운영 방법
3. **Service → Research handoff 템플릿 문서**
4. **Research → Service handoff 템플릿 문서**

---

## 15. 결론

서비스 조직과 Research 조직이 분리된 현재 구조에서,
`단원명 네이밍 규칙`이 가장 중요한 연결점인 것은 맞다.

하지만 실제 운영을 안정화하려면 이름 규칙만으로는 부족하다.
반드시 함께 있어야 하는 것은 아래 세 가지다.

1. **정규화된 이름 규칙**
2. **서비스 태그 ↔ 그래프 노드 매핑 상태 관리**
3. **명시적인 handoff packet 계약**

이 세 가지가 있어야 두 조직은 서로를 블로킹하지 않으면서도,
나중에 하나의 그래프 기반 학습 시스템으로 안정적으로 합류할 수 있다.
