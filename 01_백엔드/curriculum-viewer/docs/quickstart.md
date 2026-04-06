# Curriculum Viewer v1 — Quickstart / 품질 게이트

이 문서는 `curriculum-viewer/` 작업자가 **실행/테스트/검증/빌드**를 빠르게 재현하기 위한 최소 절차를 정리한다.

## 1) 설치

```bash
cd curriculum-viewer
npm ci
```

## 2) 실행(Dev Server)

```bash
cd curriculum-viewer
npm run dev
```

## 2.1) 관리자 모드(Author)

- 기본 관리자 계정: `admin / admin`
- `/author`에서 그래프 편집(노드 드래그/엣지 연결/레이아웃 저장) 가능

## 3) 테스트(품질 게이트)

```bash
cd curriculum-viewer
npm test
```

## 4) 데이터 검증(validator) 재현

### 4.0 exit code 정책

- **error가 1개라도 있으면** exit code `1`
- **warning만 있으면** exit code `0`
- **issue가 없으면** exit code `0`

### 4.1 정상 데이터(성공)

```bash
cd curriculum-viewer
npm run validate:data
```

기본 검증 대상 파일:
- `curriculum-viewer/public/data/curriculum_math_v1.json`

별도 파일 지정:

```bash
cd curriculum-viewer
npm run validate:data -- --file <path>
```

### 4.2 대표 실패 케이스(중복 id)

1) 실패 재현

```bash
cd curriculum-viewer
npm run validate:data -- --file docs/fixtures/invalid_curriculum_duplicate_id.json
```

2) 복구(해결)
- `docs/fixtures/invalid_curriculum_duplicate_id.json`에서 중복된 `id`를 제거하거나, 서로 다른 `id`로 변경한다.
- 이후 아래 커맨드가 다시 성공(Exit code 0)하는지 확인한다.

```bash
cd curriculum-viewer
npm run validate:data
```

## 5) 빌드(품질 게이트)

```bash
cd curriculum-viewer
npm run build
```
