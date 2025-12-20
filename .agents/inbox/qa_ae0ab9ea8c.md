# QA Request ae0ab9ea8c

아래 티켓과 Dev 전달 내용을 기준으로 검증해줘.

[티켓 파일]
/mnt/c/Users/irron/Desktop/my/web_service_new/calculate_math/tasks/2025-12-19-level1-subjective-1/tickets/BE-
  1.md

[Dev 전달 내용]
[QA 전달]

  - 변경 요약: Level 1 스키마/검증 로더와 /api/v1/level1
    엔드포인트 추가, 기본 데이터셋 및 문서/테스트 보강.
  - 변경 파일: .env.example, app/__init__.py, app/
    config.py, app/data/level1.json, app/
    level1_loader.py, app/routers/__init__.py, app/
    routers/level1.py, app/schemas/level1.py, docs/
    level1_dataset.md, tests/test_level1_dataset.py
  - 실행 방법: make run
  - 테스트 방법: pytest -q tests/test_level1_dataset.py
    (timeout 20s)
  - 확인 포인트(AC 매핑):
      - 스키마 정의 및 JSON 예시 문서화: app/schemas/
        level1.py, docs/level1_dataset.md
      - 검증 규칙(유니크 ID, 누락 참조, 스킬별 order 중
        복, grading 호환성): app/level1_loader.py, tests/
        test_level1_dataset.py
      - 유효 데이터 시 200 반환: tests/
        test_level1_dataset.py의
        test_level1_endpoint_returns_dataset
      - 오류 시 offending ID 포함 응답: tests/
        test_level1_dataset.py의
        test_level1_endpoint_returns_actionable_errors
        [/QA 전달]

규칙(엄수):
- 첫 줄은 반드시 OK 또는 FAIL 로 시작해라.
- 가능한 경우 Dev가 제시한 테스트 커맨드를 실제로 실행하고, 결과(성공/실패/로그 요약)를 리포트에 포함해라.
- Dev가 테스트 방법을 비워뒀거나, 변경이 있는데 테스트가 없다면 그 자체를 FAIL 사유로 삼아도 된다(특히 버그 수정/회귀 위험이 큰 변경).
- FAIL이면 반드시 포함:
  - 재현 단계
  - 어떤 로그/증상이 문제인지
  - 원인 추정
  - 수정 제안(Dev가 바로 고칠 수 있게)
- 마지막에 아래 마커를 정확히 출력해라.

###BEGIN:ae0ab9ea8c###
(여기에 네 QA 리포트 본문을 작성)
###DONE:ae0ab9ea8c###
