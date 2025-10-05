# 수학 놀이터 프론트엔드

1-2학년 학생들을 위한 태블릿 친화적인 수학 학습 앱의 프론트엔드입니다.

## 기술 스택

- **React 18** - 사용자 인터페이스 라이브러리
- **TypeScript** - 타입 안전성
- **Vite** - 빠른 개발 서버 및 빌드 도구
- **React Router** - 클라이언트 사이드 라우팅
- **Lucide React** - 아이콘 라이브러리
- **CSS3** - 스타일링 (모듈화된 CSS)

## 주요 기능

### 학생 기능
- 🎮 **수학 게임**: 덧셈, 뺄셈, 곱셈 문제 풀이
- 📊 **진도 확인**: 학습 현황 및 통계 확인
- 🏆 **성취도**: 배지 및 성취 시스템
- ⏰ **타이머**: 시간 제한이 있는 문제 풀이
- 🔥 **연속 정답**: 연속 정답 보너스 시스템

### 부모 기능
- 👨‍👩‍👧‍👦 **자녀 현황**: 자녀들의 학습 현황 모니터링
- 🔔 **알림**: 자녀의 학습 완료 및 성적 향상 알림
- 📈 **통계**: 전체 학습 통계 확인

### 선생님 기능
- 👥 **학생 관리**: 전체 학생 현황 관리
- 📊 **학년별 통계**: 학년별 학습 통계 확인
- 💬 **메시지**: 학생들에게 메시지 전송

## 프로젝트 구조

```
src/
├── components/          # React 컴포넌트
│   ├── Login.tsx       # 로그인 화면
│   ├── StudentDashboard.tsx  # 학생 대시보드
│   ├── ParentDashboard.tsx   # 부모 대시보드
│   ├── TeacherDashboard.tsx  # 선생님 대시보드
│   ├── MathGame.tsx    # 수학 게임
│   └── *.css           # 컴포넌트별 스타일
├── contexts/           # React Context
│   └── AuthContext.tsx # 인증 컨텍스트
├── types/              # TypeScript 타입 정의
│   └── index.ts        # 공통 타입들
├── utils/              # 유틸리티 함수
├── App.tsx             # 메인 앱 컴포넌트
├── App.css             # 전역 스타일
└── main.tsx            # 앱 진입점
```

## 설치 및 실행

### 필수 요구사항
- Node.js 16.0 이상
- npm 또는 yarn

### 설치
```bash
npm install
```

### 개발 서버 실행
```bash
npm run dev
```

### 빌드
```bash
npm run build
```

### 미리보기
```bash
npm run preview
```

## 데모 계정

### 학생 계정
- **사용자명**: student1
- **비밀번호**: password
- **학년**: 1학년

### 부모 계정
- **사용자명**: parent1
- **비밀번호**: password
- **자녀**: 김철수 (1학년)

### 선생님 계정
- **사용자명**: teacher1
- **비밀번호**: password
- **관리 학생**: 3명

## 주요 컴포넌트 설명

### Login.tsx
- 사용자 역할별 로그인 (학생/부모/선생님)
- 데모 계정 정보 표시
- 태블릿 친화적인 UI

### StudentDashboard.tsx
- 학습 통계 카드 (총 게임 수, 평균 점수, 학습 시간, 연속 학습)
- 수학 게임 시작 버튼
- 학습 옵션 (진도 확인, 성취도, 설정)
- 오늘의 목표 진행률

### MathGame.tsx
- 실시간 수학 문제 생성 (덧셈, 뺄셈, 곱셈)
- 30초 타이머
- 즉시 피드백 (정답/오답)
- 연속 정답 보너스 시스템
- 최종 점수 및 정답률 표시

### ParentDashboard.tsx
- 자녀 현황 카드
- 최근 알림 목록
- 전체 학습 통계

### TeacherDashboard.tsx
- 전체 학생 통계
- 학생별 상세 정보
- 학년별 통계
- 학생 관리 기능

## 스타일링 특징

- **태블릿 최적화**: 터치 친화적인 큰 버튼과 입력 필드
- **반응형 디자인**: 모바일, 태블릿, 데스크톱 지원
- **그라데이션 배경**: 시각적으로 매력적인 UI
- **애니메이션**: 부드러운 전환 효과
- **접근성**: 키보드 네비게이션 및 포커스 관리

## 개발 가이드

### 새 컴포넌트 추가
1. `src/components/` 폴더에 새 컴포넌트 파일 생성
2. TypeScript 인터페이스 정의
3. 컴포넌트별 CSS 파일 생성
4. 필요한 경우 타입 정의 추가

### 스타일링 규칙
- 컴포넌트별 CSS 파일 사용
- BEM 명명 규칙 준수
- 반응형 디자인 필수
- 접근성 고려

### 상태 관리
- React Context API 사용
- 로컬 상태는 useState 훅 사용
- 복잡한 상태는 useReducer 고려

## 배포

### Vercel 배포
```bash
npm run build
vercel --prod
```

### Netlify 배포
```bash
npm run build
netlify deploy --prod --dir=dist
```

## 라이선스

MIT License

## 기여하기

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request
