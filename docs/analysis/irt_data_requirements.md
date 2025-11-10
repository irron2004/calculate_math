# IRT/Rasch 적용을 위한 데이터 요구사항(초안)

## 목표
파일럿 데이터로 난이도/변별도 추정 가능성을 검토하고, Phase 2 적용 여부 결정.

## 최소 데이터 규모(권장)
- 학생 N ≥ 150
- 문항 템플릿 K ≥ 80 (각 템플릿 당 응답 ≥ 50)
- 시도 로그: 정오/반응시간/변형파라미터/스킬태그

## 수집 스키마
- attempt_id, user_id(pseudonym), item_id(template+seed), correct(bool), rt_ms, skills[tag[]], variant_params(json)

## 분석 산출물
- 1PL/2PL 적합도, 난이도/변별도 분포, 모수 안정성, 템플릿 교정 리스트
