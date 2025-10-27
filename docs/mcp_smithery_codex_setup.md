# WSL Codex MCP 설치 가이드 (Smithery)

## 0) 전제 조건
- 대상 환경: WSL2 Ubuntu (권장)
- 필수 버전: Node.js v20 이상
- Smithery CLI는 MCP 레지스트리에서 서버를 검색하고 `install --client <이름>` 형식으로 각 클라이언트에 설치합니다.
- Smithery는 Codex CLI를 공식 지원하며, 서버 페이지의 “Add to your client” 목록에서 `codex` 항목을 확인할 수 있습니다.

## 1) WSL 환경 준비
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
# 새 셸을 연 뒤:
nvm install 20
nvm use 20
node -v       # v20.x 확인
```

## 2) Smithery CLI 설치
```bash
# (권장) 전역 설치
npm i -g @smithery/cli
smithery --help

# 또는 1회성 실행
npx -y @smithery/cli@latest --help
```

## 3) Codex 클라이언트 지원 확인
```bash
npx -y @smithery/cli@latest list clients   # codex 항목 존재 여부 확인
```
출력에 `codex`가 있다면 해당 클라이언트로 MCP 서버를 설치할 수 있습니다.

## 4) MCP 검색 및 설치
```bash
# 예시 검색
smithery search "serena"
smithery search "context7"

# 설치 패턴
npx -y @smithery/cli@latest install <server-id> --client codex

# 예: Redis MCP
npx -y @smithery/cli@latest install @redis/mcp-redis --client codex
```
일부 MCP는 추가 환경 변수나 구성(JSON 형식)을 요구합니다. 필요 시 `--config '<JSON>'` 옵션을 사용하거나 설치 과정의 프롬프트 지시에 따릅니다.

## 5) 설치 확인 및 Codex 연동
```bash
smithery list --client codex    # Codex용으로 설치된 MCP 목록
codex /mcp                      # Codex CLI에서 MCP 상태 확인
```
Smithery는 Codex의 설정 파일(`~/.codex/config.toml`)을 자동으로 갱신합니다. Codex CLI에서 `/mcp` 명령을 실행해 서버가 노출되는지 확인하세요.

## 6) 팁과 추가 도구
- 정확한 서버 ID는 Smithery 서버 상세 페이지의 “Install” 명령을 복사하는 것이 가장 안전합니다.
- 여러 클라이언트(예: claude, cursor, codex)에 같은 MCP를 설치하려면 스크립트로 반복 실행할 수 있습니다.
- 로컬 개발/디버깅이 필요하면 `smithery dev` 또는 `smithery run` 명령을 사용해 핫 리로드 환경을 구성할 수 있습니다.

## 7) 빠른 실행 예시
```bash
npx -y @smithery/cli@latest install @redis/mcp-redis --client codex
smithery list --client codex
codex /mcp
```
위 명령은 Redis MCP 서버를 Codex 클라이언트에 연결한 뒤 설치 결과를 점검하는 데모 시나리오입니다.
