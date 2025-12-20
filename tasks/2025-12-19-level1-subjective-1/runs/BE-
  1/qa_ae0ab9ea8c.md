Test Results

  - pytest -q tests/test_level1_dataset.py → FAIL
  - Dev 안내 20s 기준 실행은 타임아웃; 타임아웃 60s로 재실
    행 시 수집 단계에서 오류 확인(약 28s)

  Repro Steps

  - pytest -q tests/test_level1_dataset.py 실행

  Logs/Symptoms

  - SyntaxError: invalid syntax
  - 위치: app/routers/practice.py:1
  - 호출 경로: tests/test_level1_dataset.py → app/
    __init__.py → app/routers/__init__.py → app/routers/
    practice.py

  Suspected Cause

  - app/routers/practice.py가 Python 코드가 아닌 단일 문장
    으로 덮여 있어 모듈 import 시 SyntaxError 발생

  Fix Suggestions

  - app/routers/practice.py에 정상적인 FastAPI router 구현
    을 복원하거나, 사용하지 않는다면 app/routers/
    __init__.py:1 및 app/__init__.py:25의 import/include를
    제거 또는 조건화
  - 수정 후 pytest -q tests/test_level1_dataset.py 재실행
    (Dev 안내 20s 내 완료 여부 확인 필요)

  Notes

  - 현재 수집 실패로 Level1 스키마/검증/엔드포인트 동작 확
    인 불가
