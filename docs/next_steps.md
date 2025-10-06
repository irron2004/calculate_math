# Follow-up Development Checklist

1. **Front-end Integration of Curriculum APIs** ✅
   - MathGame now loads curriculum problems via `/api/v1/concepts` and `/api/v1/templates/.../generate`, honoring S1→S3 progression and LRC evaluation.
   - Lens·step metadata is surfaced for each prompt.

2. **Template Catalogue Expansion** ✅
   - Added multi-context templates for 비율·비례와 좌표→직선/원 (S1–S3) with tuned distractors and rubric keywords.

3. **Adaptive Session & LRC Loop** ✅
   - `/api/v1/lrc/evaluate`는 사용자별 결과를 저장하며, `/api/v1/lrc/last`를 통해 다음 세션에 반영합니다.
   - 프런트엔드는 추천(`promote/reinforce/remediate`)에 따라 S1→S3 구성을 재배치하고 집중 연습 시나리오를 적용합니다.

4. **Testing & Tooling Enhancements** ✅
   - Vitest 기반의 프런트엔드 테스트 환경을 추가하고 커리큘럼 유틸 로직을 검증합니다.
   - 확장된 템플릿/어댑티브 흐름을 다루는 픽스처를 도입했습니다.
