# 콘텐츠 NDJSON 검증 체크리스트

콘텐츠 스튜디오 초기 템플릿(`docs/content_templates.ndjson`)을 임포트하기 전 빠르게 확인할 수 있는 절차입니다.

1. **구조 검증**
   ```bash
   python scripts/validate_templates.py docs/content_templates.ndjson
   ```
   - 필수 필드(id/node/step/lens/rep/ctx/params)가 모두 존재하는지 검사
   - 노드/스텝/컨텍스트 분포를 출력하여 40/35/25 구성이 유지되는지 확인

2. **샘플 확인**
   ```bash
   head -n 3 docs/content_templates.ndjson
   ```
   - 렌즈(🔺/➗/🔄), 표현(rep), 컨텍스트(ctx)가 기대와 일치하는지 눈으로 검토

3. **파일럿 동형 변환(선택)**
   ```bash
   python scripts/generate_triplets.py docs/content_templates.ndjson > triplets.ndjson
   head -n 3 triplets.ndjson
   ```
   - 생활/데이터/도형 맥락이 자동 생성되는지 확인 후 스튜디오에 추가

4. **임포트 실행**
   - 스튜디오/DB에 `content_templates.ndjson`을 업로드
   - 샘플 문항(예: ALG-AP-S1-001, ALG-PR-S1-001, GEO-COORD-S1-001)을 추려 문제 플레이어에서 노출 확인

**검증 결과 예시**
```
Total records: 100
Invalid records: 0
Node distribution:
  - ALG-AP: 40
  - ALG-PR: 35
  - GEO-COORD: 25
Step distribution:
  - S1: 40
  - S2: 40
  - S3: 20
Context distribution:
  - table: 40
  - graph: 27
  - life: 23
  - geometry: 10
```

필요에 따라 QA 로그를 첨부하거나, 임포트 도중 오류가 발생하면 `docs/qa_action_items.md`의 작업 항목을 참고해 보완합니다.
