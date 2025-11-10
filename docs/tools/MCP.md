# MCP.md — Tooling Playbook

Codex supports the Model Context Protocol (MCP) to extend its capabilities with external tools. This project favors a “super Claude” style bundle that covers documentation lookup, browser automation, rapid edits, and semantic code understanding.

## Recommended Servers

| Server             | Purpose                                               | Quick Attach Command (STDIO)                                   |
|--------------------|-------------------------------------------------------|-----------------------------------------------------------------|
| `context7`         | Fetch up-to-date framework docs (FastAPI, React, etc.)| `codex mcp add context7 -- npx -y @upstash/context7-mcp`        |
| `playwright`       | Run browser-based regression or a11y checks           | `codex mcp add playwright -- npx -y @playwright/mcp@latest`     |
| `morph-fast-apply` | Apply large multi-file diffs safely and preview them  | `codex mcp add morph-fast-apply -e MORPH_API_KEY=$MORPH_API_KEY -- npx -y @morph-llm/morph-fast-apply` |
| `serena`           | Semantic code navigation and symbol-aware refactors   | `codex mcp add serena -- uvx --from git+https://github.com/oraios/serena serena start-mcp-server` |
| `tavily`           | Reliable web search (release notes, ecosystem news)   | Configure via remote URL in `~/.codex/config.toml` (see below)  |

> Store API keys in environment variables before launching Codex. Never hard-code secrets inside this repository.

## Sample `~/.codex/config.toml`

```toml
experimental_use_rmcp_client = true

[mcp_servers.context7]
command = "npx"
args = ["-y", "@upstash/context7-mcp"]

[mcp_servers.playwright]
command = "npx"
args = ["-y", "@playwright/mcp@latest"]

[mcp_servers.morph-fast-apply]
command = "npx"
args = ["-y", "@morph-llm/morph-fast-apply"]
[mcp_servers.morph-fast-apply.env]
MORPH_API_KEY = "morph-***"  # export MORPH_API_KEY before use

[mcp_servers.serena]
command = "uvx"
args = ["--from", "git+https://github.com/oraios/serena", "serena", "start-mcp-server"]

[mcp_servers.tavily]
url = "https://mcp.tavily.com/mcp/?tavilyApiKey=tvly-***"
```

Replace the placeholders with real keys or inject them at runtime via environment variables (`codex mcp add ... -e KEY=value`).

## Usage Patterns
- **Context7**: cite specific documentation when altering FastAPI routers, Pydantic validation rules, or React hooks. Include the doc version/source in notes.
- **Playwright**: generate end-to-end coverage for flows like login → session start → skill tree navigation. Save artifacts under `frontend/tests/e2e/`.
- **Morph Fast Apply**: preview bulk edits (e.g., renaming `TemplateEngine` fields) before committing. Always inspect the generated diff.
- **Serena**: locate symbol references across Python and TypeScript when refactoring shared identifiers (`SkillNode`, `SessionPayload`, etc.).
- **Tavily**: gather recent ecosystem changes (Pydantic releases, React/Vite updates) and list URLs/dates in design discussions or PR descriptions.

## Safety Notes
- Only attach MCP servers you trust; each server can execute arbitrary code.
- Keep MCP processes updated (re-run `codex mcp add ...` after upgrading versions).
- Disconnect unused servers with `codex mcp remove <name>` to minimize attack surface.

