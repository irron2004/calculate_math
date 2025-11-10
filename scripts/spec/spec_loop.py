#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Spec Loop Runner
- requirements → planner_spec(Claude) → spec_reviewer(Codex) → planner_spec → ...
- 양측이 모두 approve 할 때까지 반복 또는 max_rounds 도달 시 중단.
- 산출물:
  - docs/specs/<TASK>/spec_v<N>.md (버전 스냅샷)
  - docs/specs/<TASK>/changelog.md (요약 변경내역)
  - logs/<TASK>/spec/spec-loop.jsonl (라운드 로그)
사용법:
  python scripts/spec/spec_loop.py --task TASK-0008 --req-file docs/intake/TASK-0008_requirements.md --max-rounds 6
환경변수:
  CLAUDE_CMD_TEMPLATE (planner_spec 용)  e.g. 'claude -f {prompt} -i {input} --output json'
  CODEX_CMD_TEMPLATE   (spec_reviewer 용) e.g. 'codex  -f {prompt} -i {input} --output json'
"""
from __future__ import annotations
import argparse, json, os, subprocess, sys, difflib
from pathlib import Path
from datetime import datetime

ROOT = Path(__file__).resolve().parents[2]
ROLES = ROOT / "roles"
LOGS  = ROOT / "logs"
DOCS  = ROOT / "docs" / "specs"

def sh(cmd: str) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, shell=True, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

def call_agent(template_env_var: str, prompt_path: Path, envelope_path: Path) -> dict:
    tmpl = os.getenv(template_env_var)
    if not tmpl:
        raise SystemExit(f"ENV {template_env_var} not set.")
    cmd = tmpl.format(prompt=str(prompt_path), input=str(envelope_path))
    res = sh(cmd)
    if res.returncode != 0:
        raise SystemExit(f"Agent failed({template_env_var}):\n{res.stderr}\n{res.stdout}")
    try:
        return json.loads(res.stdout.strip())
    except Exception as e:
        raise SystemExit(f"Invalid JSON from agent({template_env_var}): {e}\n{res.stdout[:800]}...")

def write_jsonl(p: Path, obj: dict) -> None:
    p.parent.mkdir(parents=True, exist_ok=True)
    with p.open("a", encoding="utf-8") as f:
        f.write(json.dumps(obj, ensure_ascii=False) + "\n")

def save_spec_version(task: str, v: int, spec_md: str) -> Path:
    d = DOCS / task
    d.mkdir(parents=True, exist_ok=True)
    p = d / f"spec_v{v}.md"
    p.write_text(spec_md, encoding="utf-8")
    return p

def update_changelog(task: str, v: int, prev_md: str|None, curr_md: str) -> None:
    cl = DOCS / task / "changelog.md"
    ts = datetime.utcnow().strftime("%Y-%m-%d %H:%MZ")
    if prev_md is None:
        entry = f"## v{v} — {ts}\n- 최초 초안 작성\n\n"
    else:
        diff = difflib.unified_diff(
            prev_md.splitlines(), curr_md.splitlines(), lineterm="", n=1
        )
        summary = f"- 변경 라인 수(대략): {sum(1 for _ in diff)}\n"
        entry = f"## v{v} — {ts}\n{summary}\n"
    with cl.open("a", encoding="utf-8") as f:
        f.write(entry)

def read_text_or(path: Path, default: str="") -> str:
    return path.read_text(encoding="utf-8") if path and path.exists() else default

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--task", required=True, help="TASK-XXXX")
    ap.add_argument("--req-file", help="요구사항 MD/MDX/TXT 파일 경로")
    ap.add_argument("--requirements", help="요구사항 텍스트(파일이 없을 때)")
    ap.add_argument("--max-rounds", type=int, default=6)
    args = ap.parse_args()

    task = args.task.upper()
    req_text = ""
    if args.req_file:
        req_text = read_text_or(Path(args.req_file))
    if not req_text and args.requirements:
        req_text = args.requirements.strip()
    if not req_text:
        raise SystemExit("requirements가 비어있습니다. --req-file 또는 --requirements 사용")

    spec_log = LOGS / task / "spec" / "spec-loop.jsonl"
    env_dir  = LOGS / task / "spec" / "envelopes"
    env_dir.mkdir(parents=True, exist_ok=True)

    prev_spec_md: str|None = None
    round_i = 0
    while round_i < args.max_rounds:
        round_i += 1
        print(f"\n=== SPEC LOOP: round {round_i} ===")

        env_writer = {
            "task_id": task,
            "requirements": req_text,
            "prev_spec_md": prev_spec_md or "",
            "last_review": read_text_or(spec_log),
        }
        env_writer_path = env_dir / f"writer_round{round_i}.json"
        env_writer_path.write_text(json.dumps(env_writer, ensure_ascii=False, indent=2), encoding="utf-8")

        writer_out = call_agent("CLAUDE_CMD_TEMPLATE", ROLES/"planner-spec.md", env_writer_path)
        if "spec_md" not in writer_out:
            raise SystemExit("planner_spec must return 'spec_md'")
        curr_spec_md = writer_out["spec_md"]
        spec_path = save_spec_version(task, round_i, curr_spec_md)
        update_changelog(task, round_i, prev_spec_md, curr_spec_md)

        write_jsonl(spec_log, {"round": round_i, "role":"planner_spec", "output": writer_out, "spec_path": spec_path.as_posix()})
        print(f"  • spec v{round_i} saved -> {spec_path}")

        env_reviewer = {
            "task_id": task,
            "spec_md": curr_spec_md,
            "acceptance_criteria": writer_out.get("acceptance_criteria", []),
            "prev_spec_md": prev_spec_md or "",
        }
        env_reviewer_path = env_dir / f"reviewer_round{round_i}.json"
        env_reviewer_path.write_text(json.dumps(env_reviewer, ensure_ascii=False, indent=2), encoding="utf-8")

        reviewer_out = call_agent("CODEX_CMD_TEMPLATE", ROLES/"spec-reviewer.md", env_reviewer_path)
        write_jsonl(spec_log, {"round": round_i, "role":"spec_reviewer", "output": reviewer_out})
        print(f"  • review decision: {reviewer_out.get('decision')}")

        if reviewer_out.get("decision") == "approve":
            env_writer_confirm = {
                "task_id": task,
                "requirements": req_text,
                "prev_spec_md": curr_spec_md,
                "last_review": reviewer_out
            }
            env_writer_confirm_path = env_dir / f"writer_confirm_round{round_i}.json"
            env_writer_confirm_path.write_text(json.dumps(env_writer_confirm, ensure_ascii=False, indent=2), encoding="utf-8")
            writer_confirm_out = call_agent("CLAUDE_CMD_TEMPLATE", ROLES/"planner-spec.md", env_writer_confirm_path)
            write_jsonl(spec_log, {"round": round_i, "role":"planner_spec_confirm", "output": writer_confirm_out})
            if writer_confirm_out.get("decision") == "approve":
                print("✅ Spec loop converged: BOTH APPROVED")
                (DOCS/task/"SPEC_FINAL.md").write_text(curr_spec_md, encoding="utf-8")
                print(f"  • final -> {DOCS/task/'SPEC_FINAL.md'}")
                return 0
            else:
                print("↺ Writer not satisfied; continue refining…")

        prev_spec_md = curr_spec_md

    print("⚠️ Spec loop ended without consensus (max_rounds reached).")
    return 1

if __name__ == "__main__":
    sys.exit(main())

