# 회원가입 인접학년 진단 유지보수 가이드

## TL;DR
- 진단 모드 키: `adjacent-grade-na-v1`
- 규칙: 인접 학년(전/후학년) `NA`만 사용, 총 8문항
- 데이터 소스: `public/data/problems_v1.json`
- 핵심 로직: `src/lib/diagnostic/adjacentGradeDiagnostic.ts`

## 선택 규칙
- 입력 학년은 `1..6`.
- 기본 배분은 전학년 4문항 + 후학년 4문항.
- 엣지 학년 보정:
  - 1학년: 전학년이 없으므로 같은 학년으로 보충.
  - 6학년: 후학년이 없으므로 같은 학년으로 보충.
- 도메인은 `NA`만 포함.
- 결과 문항 수는 항상 8문항이어야 함.

## 관련 파일
- 가입 후 진단 모드 시드: `src/pages/SignupPage.tsx`
- 진단 문제 생성: `src/lib/diagnostic/adjacentGradeDiagnostic.ts`
- 진단 문제 데이터 정책 테스트: `src/lib/diagnostic/adjacentGradeDiagnosticData.test.ts`
- 문제은행: `public/data/problems_v1.json`
- 배치 및 제출: `src/pages/PlacementTestPage.tsx`
- 결과 표시: `src/pages/PlacementResultPage.tsx`

## 문제 데이터 작성 규칙
- `problemsByNodeId`의 키는 커리큘럼 노드 id(`MATH-2022-G-*-NA-*`)여야 함.
- 각 문제는 최소 필드 포함:
  - `id` (고유)
  - `type` (`numeric`)
  - `prompt`
  - `answer`
- 가급적 짧은 수치형 문항/정답을 사용.

## 검증 명령
```bash
cd curriculum-viewer
npm run test -- src/lib/diagnostic/adjacentGradeDiagnostic.test.ts src/lib/diagnostic/adjacentGradeDiagnosticData.test.ts
npx playwright test e2e/signup-adjacent-grade-diagnostic.spec.ts
```

## 빠른 체크리스트
- [ ] grade=3에서 8문항이 생성된다.
- [ ] grade=6에서도 보정 규칙으로 8문항이 생성된다.
- [ ] 결과 화면에서 `전학년 정확도`, `후학년 정확도`가 보인다.
