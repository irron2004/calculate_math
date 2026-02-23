# 로그인 페이지 새로고침 시 이전 계정 자동 로그인되는 문제 진단서

- 작성일: 2026-02-19
- 대상: `curriculum-viewer` 프론트엔드 인증 흐름

## 1) 문제 정의

로그인 화면(`/login`)에 진입한 상태에서 새로고침하면, 의도와 다르게 이전에 로그인했던 계정으로 다시 인증되는 경우가 간헐적으로 발생한다.

## 2) 관찰된 현상

- 로그아웃 직후 `/login`으로 이동한 뒤 빠르게 새로고침하면 자동 로그인되는 사례가 있음
- 항상 발생하지 않고 간헐적으로 발생함(타이밍 의존)

## 3) 재현 시나리오(추정)

1. 로그인 상태에서 상단 `로그아웃` 버튼 클릭
2. 앱이 `/login`으로 즉시 이동
3. 직후 빠르게 브라우저 새로고침
4. 이전 사용자 세션이 복원되어 로그인 상태로 전환될 수 있음

## 4) 코드 기반 진단

### A. 토큰 저장 위치 및 부트스트랩 복원 동작

- 토큰은 `sessionStorage`에 저장/조회됨  
  - `curriculum-viewer/src/lib/auth/tokenStorage.ts:7`  
  - `curriculum-viewer/src/lib/auth/tokenStorage.ts:25`
- 앱 초기화 시 access/refresh 토큰이 하나라도 있으면 `fetchMe()`를 호출해 사용자 상태를 복원함  
  - `curriculum-viewer/src/lib/auth/AuthProvider.tsx:104`  
  - `curriculum-viewer/src/lib/auth/AuthProvider.tsx:105`  
  - `curriculum-viewer/src/lib/auth/AuthProvider.tsx:113`

### B. 로그아웃 완료 시점

- `AuthProvider.logout()`은 `logoutUser()` 완료를 기다린 뒤 상태/저장소를 정리함  
  - `curriculum-viewer/src/lib/auth/AuthProvider.tsx:177`
- `logoutUser()`는 `/auth/logout` 요청을 보낸 뒤 `clearTokens()`를 호출함  
  - `curriculum-viewer/src/lib/auth/api.ts:119`  
  - `curriculum-viewer/src/lib/auth/api.ts:122`  
  - `curriculum-viewer/src/lib/auth/api.ts:128`

### C. 레이스를 만드는 호출 패턴

다음 화면들은 `logout()`을 `await`하지 않고 즉시 `/login`으로 이동한다.

- `curriculum-viewer/src/components/AppLayout.tsx:87`
- `curriculum-viewer/src/components/AuthorLayout.tsx:75`
- `curriculum-viewer/src/components/RequireAuthor.tsx:42`

반면 아래 코드는 `await logout()`을 사용한다.

- `curriculum-viewer/src/pages/MyPage.tsx:439`

## 5) 근본 원인 결론

핵심 원인은 **로그아웃 처리 완료 전 라우팅 전환으로 인해 발생하는 비동기 레이스 컨디션**이다.

- 로그아웃 API 대기 중 토큰이 아직 `sessionStorage`에 남아 있을 수 있음
- 그 짧은 구간에 `/login`에서 새로고침이 발생하면 앱 부트스트랩이 남아 있는 토큰으로 `fetchMe()`를 수행
- 결과적으로 이전 사용자 인증이 다시 복원됨

## 6) 영향도

- 사용자 관점: 로그아웃 신뢰도 저하, 계정 전환 시 혼란
- 보안/운영 관점: 공유 PC 또는 다계정 운영 환경에서 의도치 않은 재인증 위험

## 7) 권장 조치

1. 모든 로그아웃 버튼 핸들러를 `await logout()` 후 `navigate()` 하도록 통일
2. 필요 시 `logoutUser()`에서 네트워크 요청과 무관하게 토큰을 먼저 제거하는 방식 검토
3. 회귀 테스트 추가  
   - “로그아웃 직후 `/login` 진입 + 즉시 새로고침” 시 비인증 유지 검증
