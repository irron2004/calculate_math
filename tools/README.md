# tools/

문제 원문을 **문제은행 업로드 번들**로 가공하고, 로컬 SQLite DB에 넣기 위한 스크립트 모음.

## 파일

- `problem_bank_ingest.py`
  - `normalize`: raw JSON → normalized bundle
  - `export-payload`: normalized bundle → 기존 payload JSON (`title/description/problems`)
  - `upload`: normalized bundle → SQLite DB import
- `problem_bank_input.example.json`
  - 사용자가 제공한 문제를 어떤 형식으로 적으면 되는지 보여주는 예시
- `problem_bank_weekly_text.py`
  - Slack/문서에 붙여넣은 `월요일 ... 정답` 형식의 주간 텍스트를 일자별 bundle로 파싱
  - bundle 디렉터리 일괄 업로드 또는 parse+upload 한 번에 실행 가능

## 권장 흐름

### 1) raw 문제 파일 준비

예시 파일을 복사해서 사용한다.

```bash
cp tools/problem_bank_input.example.json /tmp/my-problems.json
```

지원하는 문제 필드 alias 예시:

- 질문: `question`, `stem`, `prompt`, `text`
- 타입: `type`, `problemType`, `problem_type`
- 보기: `options`, `choices`
- 정답(객관식): `answer`, `answerKey`, `answerIndex`, `correctIndex`
- 정답(주관식): `answer`, `correctAnswer`, `solution`
- 라벨: `labelKeys`, `labels`

### 2) normalize

```bash
python tools/problem_bank_ingest.py normalize /tmp/my-problems.json --output /tmp/my-problems.bundle.json
```

이 단계에서 생성되는 bundle은 다음을 포함한다.

- `weekKey`
- `dayKey`
- `expectedProblemCount`
- `payload`
- `labelDefinitions`
- `problemLabels`

### 3) dry-run upload

```bash
python tools/problem_bank_ingest.py upload /tmp/my-problems.bundle.json --dry-run
```

### 4) SQLite DB 업로드

```bash
python tools/problem_bank_ingest.py upload /tmp/my-problems.bundle.json --db-path 01_백엔드/backend/data/app.db
```

### 5) 주간 텍스트를 바로 bundle로 변환

Slack 스레드처럼 아래 형식이면 raw JSON으로 다시 옮기지 않고 바로 파싱할 수 있다.

```text
월요일
1. 문제...
① 보기1 ② 보기2 ③ 보기3 ④ 보기4 ⑤ 보기5
...

정답
*월요일*
1. ③
```

```bash
python tools/problem_bank_weekly_text.py parse /tmp/weekly.txt \
  --week-key 2026-W15 \
  --title-prefix "2차함수 최대·최소" \
  --output-dir /tmp/problem-bundles \
  --label-key quadratic_extrema \
  --label-name "2차함수 최대최소"
```

### 6) bundle 디렉터리 일괄 업로드

```bash
python tools/problem_bank_weekly_text.py upload-dir /tmp/problem-bundles \
  --db-path 01_백엔드/backend/data/app.db
```

### 7) parse + upload 한 번에 실행

```bash
python tools/problem_bank_weekly_text.py parse-and-upload /tmp/weekly.txt \
  --week-key 2026-W15 \
  --title-prefix "2차함수 최대·최소" \
  --output-dir /tmp/problem-bundles \
  --db-path 01_백엔드/backend/data/app.db \
  --label-key quadratic_extrema \
  --label-name "2차함수 최대최소"
```

Railway에서 SQLite 파일을 그대로 쓰는 배포라면, Railway shell/run 환경에서 같은 명령을 실행하면 된다. `--db-path`를 생략하면 `DATABASE_PATH` 환경변수 또는 backend 기본 경로를 사용한다.

### 8) 필요 시 plain payload export

기존 `import_problem_bank_from_files.py`나 UI import에 맞는 payload만 따로 뽑고 싶을 때 사용한다.

```bash
python tools/problem_bank_ingest.py export-payload /tmp/my-problems.bundle.json --output /tmp/homework_payload.json
```

## 주의

- `answerIndex`, `correctIndex`는 **1-based index**다.
- `answerKey`는 `A`, `B`, `C` 같은 문자다.
- objective 문제는 보기 2개 이상이 필요하다.
- `weekKey`와 `dayKey`는 업로드 단계에서 필수다.
- 기존 서비스 태그/DB 원본을 덮어쓰는 방식이 아니라, 현재 problem bank import 경로를 재사용한다.
