#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
codex_loop.py — Local/CI autofix loop for this repository

Functions:
  1) Build & validate skills.json from docs/dag.md
  2) Run pytest (with JUnit + coverage XML)
  3) Summarize first failure(s)
  4) Ask an LLM for a minimal unified diff to fix tests
  5) Apply patch, commit, and re-run tests (up to N iterations)

Environment:
  - LLM_API_KEY: required to contact the LLM provider
  - LLM_BASE_URL: base URL for chat completions API (default: https://api.openai.com/v1)
  - LLM_MODEL: model name (default: gpt-4o-mini)
  - CODEX_MAX_ITERS: max patch iterations (default: 2)

Notes:
  - Uses scripts/dag_to_skills.py and scripts/validate_skills.py already present in this repo
  - Safe-by-default: minimal diffs, focuses on app/, tests/, docs/ only via prompt guidance
  - Produces reports/coverage.xml and reports/junit.xml for CI artifacts
"""
import os
import re
import sys
import json
import textwrap
import tempfile
import pathlib
import subprocess
from datetime import datetime

REPO = pathlib.Path(__file__).resolve().parents[1]
REPORTS = REPO / "reports"
REPORTS.mkdir(exist_ok=True, parents=True)

LLM_BASE = os.getenv("LLM_BASE_URL", "https://api.openai.com/v1")
LLM_MODEL = os.getenv("LLM_MODEL", "gpt-4o-mini")
LLM_KEY = os.getenv("LLM_API_KEY")  # required for LLM calls

MAX_ITERS = int(os.getenv("CODEX_MAX_ITERS", "2"))


def run(cmd, check=True):
    print(f"$ {' '.join(cmd)}")
    cp = subprocess.run(cmd, cwd=REPO, capture_output=True, text=True)
    if check and cp.returncode != 0:
        # stream output on failure for easier debugging
        print(cp.stdout)
        print(cp.stderr, file=sys.stderr)
        raise SystemExit(f"Command failed: {' '.join(cmd)}")
    return cp


def build_skills():
    dag_md = REPO / "docs" / "dag.md"
    if dag_md.exists():
        run([
            "python",
            "scripts/dag_to_skills.py",
            "--in",
            "docs/dag.md",
            "--out",
            "app/data/skills.json",
        ])
        schema_path = REPO / "docs" / "skills.schema.json"
        validate_cmd = [
            "python",
            "scripts/validate_skills.py",
            "--in",
            "app/data/skills.json",
        ]
        if schema_path.exists():
            validate_cmd += ["--schema", "docs/skills.schema.json"]
        run(validate_cmd)
    else:
        print("docs/dag.md not found; skipping skills build.")


def pytest_once():
    junit = REPORTS / "junit.xml"
    cov = REPORTS / "coverage.xml"
    cmd = [
        "pytest",
        "-q",
        "--maxfail=1",
        "--disable-warnings",
        f"--junitxml={junit}",
        f"--cov=app",
        f"--cov-report=xml:{cov}",
    ]
    cp = run(cmd, check=False)
    junit_text = ""
    if junit.exists():
        try:
            junit_text = junit.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            junit_text = ""
    return cp.returncode, junit_text


def summarize_failures(junit_xml: str) -> str:
    # Pick first few <failure/> or <error/> messages
    fails = re.findall(r'<failure message="([^"]+)"', junit_xml)
    errs = re.findall(r'<error message="([^"]+)"', junit_xml)
    msgs = fails[:2] + errs[:2]
    return "\n".join(f"- {m}" for m in msgs) or "All tests passed."


def git_branch(branch: str):
    run(["git", "checkout", "-B", branch])


def git_add_commit(msg: str):
    run(["git", "add", "-A"])
    run(["git", "commit", "-m", msg], check=False)


def call_llm(system_prompt: str, user_prompt: str) -> str:
    if not LLM_KEY:
        raise SystemExit("LLM_API_KEY not set")
    import requests  # local import to avoid hard dependency when unused

    headers = {"Authorization": f"Bearer {LLM_KEY}", "Content-Type": "application/json"}
    payload = {
        "model": LLM_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    }
    r = requests.post(f"{LLM_BASE}/chat/completions", headers=headers, json=payload, timeout=120)
    r.raise_for_status()
    return r.json()["choices"][0]["message"]["content"]


PATCH_INSTR = textwrap.dedent(
    """
    You are an expert Python FastAPI/pytest engineer.
    Given the repository structure and the failing pytest summary below,
    return ONLY a unified diff patch to fix the failures. Use minimal, safe changes.
    Do not include explanations. Patch root is repository root.
    Limit changes to app/, tests/, docs/, scripts/, frontend/ unless absolutely necessary.
    """
)


def apply_patch(diff_text: str):
    # Apply a unified diff via git apply, fallback to patch -p1
    with tempfile.NamedTemporaryFile("w+", delete=False, suffix=".patch") as tf:
        tf.write(diff_text)
        tf.flush()
        p = tf.name
    cp = run(["git", "apply", "--whitespace=fix", p], check=False)
    if cp.returncode != 0:
        print("git apply failed; trying patch -p1")
        run(["patch", "-p1", "-i", p])


def main():
    build_skills()
    rc, junit = pytest_once()
    if rc == 0:
        print("✅ All tests passed.")
        return

    summary = summarize_failures(junit)
    print("❌ Test failed:\n", summary)
    ts = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    branch = f"autofix/{ts}"
    git_branch(branch)

    for i in range(MAX_ITERS):
        user_prompt = f"""Repo overview:
- Language: Python 3.11+, FastAPI, pytest
- Pre-step: scripts/dag_to_skills.py generated app/data/skills.json from docs/dag.md
- Request: produce a patch to fix tests.

Failing summary:
{summary}

Constraints:
- Keep API success = plain JSON, errors = RFC 9457 Problem Details
- If /api/v1/skills/tree fails due to missing files, add defensive checks and return 503 Problem Details, not 500.
- Prefer httpx.AsyncClient+ASGITransport for tests over sync TestClient.

Output: unified diff starting with `diff --git a/... b/...`
"""
        diff = call_llm(PATCH_INSTR, user_prompt).strip()
        if "diff --git" not in diff:
            print("No diff returned, abort.")
            break
        apply_patch(diff)
        git_add_commit(f"autofix(iter={i+1}): patch by codex_loop")
        build_skills()
        rc, junit = pytest_once()
        if rc == 0:
            print("✅ Tests passed after autofix.")
            print(f"Branch ready: {branch}")
            return
        summary = summarize_failures(junit)
        print(f"❌ Still failing (iter {i+1}):\n{summary}")

    print(f"❗️Autofix failed after {MAX_ITERS} iterations. See reports/ and branch {branch}")


if __name__ == "__main__":
    main()

