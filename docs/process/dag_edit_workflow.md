# DAG 편집 워크플로우 (콘텐츠 운영)

목표: `graph.bipartite.json` 원본을 안전하게 편집하고, `skills.ui.json`으로 투영하는 과정을 운영 리스크 없이 관리합니다.

## 흐름
1) 콘텐츠 기획자: 구글 시트/노션에서 CS/AS/엣지 테이블 편집(템플릿 제공)
2) 스크립트: 시트 → JSON 변환(로컬/CI), `graph.bipartite.json` 갱신 제안(PR)
3) CI 검증: 중복 ID/고아 노드/사이클/티어 역전/스키마 준수 실패 시 PR 차단
4) 머지 후: `skills.ui.json` 빌드 + `version`(UTC+SHA8) 업데이트, 체인지로그 기록

## 규칙
- 모든 노드/엣지는 stable ID 사용(대소문자/구분자 정책 따르기)
- 코스/스텝/스킬 라벨 변경은 **ID 불변** 원칙 유지
- `requires`는 Phase 1=ALL 규칙, 제한적 ANY는 Phase 2까지 보류(교사 모드 한정)

## 산출물
- `graph.bipartite.json`(원본), `app/data/skills.ui.json`(투영)
- `docs/specs/TASK-XXXX/changelog.md` 또는 공용 `docs/pm/DECISIONS.md`에 변경 근거 링크

## CI 검증 실패 메시지 예시와 해결 가이드
- 사이클 감지: "cycle_detected: C03-S2 -> C05-S1 -> C03-S2" → 엣지 방향 재검토, enables/requires 혼동 확인
- 고아 노드: "orphan_node: AS.DIFF.READ" → 해당 노드를 참조하는 CS 추가 또는 제거
- ID 충돌: "duplicate_id: CS.C01.S1" → ID 정책에 맞춰 새 ID 부여(라벨 변경만으로 해결 금지)

## 릴리즈 롤백 절차
1) 이전 배포 버전 태그 확인(`skills.ui.json.version`)
2) 해당 아티팩트로 롤백 배포 → 캐시 무효화(`/api/v1/skills/tree` coldload)
3) 헬스체크 확인(`/health`, `/api/v1/skills/tree` 200)
