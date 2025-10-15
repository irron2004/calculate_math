#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
codex_docs.py — Docs-driven pipeline bootstrapper

Generates/updates lightweight PRD and architecture docs.
Works offline without LLM; if LLM_API_KEY is provided, can enhance content.

Env:
  - LLM_BASE_URL (default: https://api.openai.com/v1)
  - LLM_MODEL (default: gpt-4o-mini)
  - LLM_API_KEY (optional; if omitted, writes templates only)
"""
import os
import pathlib

LLM_BASE = os.getenv("LLM_BASE_URL", "https://api.openai.com/v1")
LLM_MODEL = os.getenv("LLM_MODEL", "gpt-4o-mini")
LLM_KEY = os.getenv("LLM_API_KEY")


PRD_TMPL = """# PRD (v0)
## 제품 목표
{idea}
## 페르소나 / 문제 / 가치
사용자(학습자/부모/교사)가 수학 학습 진행도를 직관적으로 파악하고, 단계별 학습을 진행할 수 있도록 지원한다.
## 핵심 기능
- 스킬트리 첫 화면(React)
- /api/v1/skills/tree (평문 JSON)
- 진행도/보스전
## 비기능 요구사항
- LCP≤2.5s / INP≤200ms / CLS≤0.1
- API 오류: RFC 9457 Problem Details
"""

ARCH_TMPL = """# Architecture
- FastAPI + Uvicorn (app/*)
- React(Vite) frontend (frontend/*)
- Data: docs/dag.md → scripts/dag_to_skills.py → app/data/skills.json (validate: scripts/validate_skills.py)
- Tests: pytest (backend), Vitest/RTL (frontend)
"""


def call_llm(system: str, user: str) -> str:
    if not LLM_KEY:
        return ""  # offline mode
    import json
    import requests  # only if online

    h = {"Authorization": f"Bearer {LLM_KEY}", "Content-Type": "application/json"}
    p = {"model": LLM_MODEL, "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}]}
    r = requests.post(f"{LLM_BASE}/chat/completions", headers=h, json=p, timeout=120)
    r.raise_for_status()
    return r.json()["choices"][0]["message"]["content"]


def main():
    repo = pathlib.Path(__file__).resolve().parents[1]
    docs = repo / "docs"
    docs.mkdir(exist_ok=True, parents=True)

    idea_path = docs / "idea.md"
    if idea_path.exists():
        idea = idea_path.read_text(encoding="utf-8").strip()
    else:
        idea = "Skill-tree learning app"
        idea_path.write_text(idea + "\n", encoding="utf-8")

    prd_text = PRD_TMPL.format(idea=idea)
    (docs / "PRD.md").write_text(prd_text, encoding="utf-8")
    (docs / "architecture.md").write_text(ARCH_TMPL, encoding="utf-8")

    print("Docs generated/updated: docs/idea.md, docs/PRD.md, docs/architecture.md")


if __name__ == "__main__":
    main()

