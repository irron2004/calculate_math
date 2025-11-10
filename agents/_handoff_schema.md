```json
{
  "agent": "PM|ARCH|BE|FE|QA|EXEC|DEVOPS|SEC|UX",
  "intent": "PLAN|SPEC|DESIGN|CODE|REVIEW|TEST|RISK|DECISION|OPS",
  "summary": "한 줄 요약",
  "details_md": "상세 설명(Markdown)",
  "artifacts": [
    {"path": "docs/PRD.md", "type": "doc"},
    {"path": "api/openapi.yaml", "type": "spec"},
    {"path": "apps/api/src/.../service.ts", "type": "code"},
    {"path": "tests/e2e/...", "type": "test"}
  ],
  "acceptance_criteria": ["..."],
  "risks": [{"id": "R1", "desc": "...", "severity": "low|medium|high", "mitigation": "..."}],
  "decision_required": false,
  "questions": ["..."],
  "next_actions": ["..."]
}
```
