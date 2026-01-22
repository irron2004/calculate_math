# 문제 생성 (Gemini CLI)

`curriculum-viewer`의 학습 화면은 정적 문제 은행 파일 `public/data/problems_v1.json`을 로드합니다.
이 문서는 **Gemini CLI**를 이용해 특정 노드(보통 `standard`)에 연결된 문제를 생성/갱신하는 방법을 설명합니다.

## TL;DR
- 스크립트: `curriculum-viewer/scripts/generate-problems-gemini.mjs`
- 실행: `npm run generate:problems:gemini -- --node-id <NODE_ID> --cmd '<GEMINI_COMMAND>'`
- 출력: `curriculum-viewer/public/data/problems_v1.json`

## 준비물
- Gemini CLI가 **비대화형 출력**을 지원해야 합니다(표준출력으로 결과를 내보내는 형태).
- 인증/모델 선택 등은 사용 중인 Gemini CLI 방식에 따릅니다.

## 사용 예시

### 1) 노드 텍스트(성취기준 text)를 프롬프트로 사용
```bash
cd curriculum-viewer
npm run generate:problems:gemini -- \
  --node-id MATH-2022-G-2-NA-001 \
  --cmd 'gemini --prompt {{PROMPT}}' \
  --replace
```

### 2) 교과 목표(텍스트 파일)를 프롬프트로 사용
```bash
cd curriculum-viewer
npm run generate:problems:gemini -- \
  --node-id MATH-2022-G-2-NA-001 \
  --goal-file ./goal.txt \
  --cmd 'gemini --prompt {{PROMPT}}' \
  --replace
```

## 옵션
- `--cmd`: 실행할 Gemini CLI 명령
  - `{{PROMPT}}`가 포함되어 있으면 해당 위치를 프롬프트 문자열로 치환합니다.
  - 포함되어 있지 않으면 프롬프트를 stdin으로 전달합니다.
- `--count`: 생성할 문제 개수(기본 5)
- `--replace`: 기존 문제를 덮어쓰기(기본은 append)
- `--out`: 출력 파일 경로(기본 `public/data/problems_v1.json`)

## 출력 스키마
문제 파일은 아래 형태를 따릅니다.
```json
{
  "version": 1,
  "problemsByNodeId": {
    "MATH-2022-G-2-NA-001": [
      { "id": "gen-...", "type": "numeric", "prompt": "...", "answer": "123", "explanation": "..." }
    ]
  }
}
```

## 주의
- 현재 채점기는 `numeric` 타입만 지원합니다.
- `explanation`은 optional이며, 상세 규격은 `docs/problem-explanation.md`를 따릅니다.
- Gemini가 JSON 앞뒤로 설명/코드펜스를 붙일 수 있어, 스크립트는 이를 최대한 제거/추출하지만 완벽하지 않을 수 있습니다.
  - 이 경우 `--cmd`에 출력 형식 강제 옵션(예: “JSON만 출력”)을 추가하거나 프롬프트를 강화하세요.
