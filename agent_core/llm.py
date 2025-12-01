import os, sys, subprocess, pathlib, shutil
from .io import snapshot_files
from .config import ProjectConfig


def get_llm_for_role(role: str, config: ProjectConfig) -> str:
    role_cfg = (config.roles or {}).get(role) or (config.roles or {}).get(role.replace("-", "_"), {})
    return (role_cfg.get("llm_backend") or config.default_llm).strip().lower()


def _to_posix_path(p: pathlib.Path) -> str:
    s = str(p).replace("\\", "/")
    if len(s) > 2 and s[1] == ":":
        drive = s[0].lower()
        s = f"/mnt/{drive}{s[2:]}"
    return s


def build_enhanced_task(task_md: pathlib.Path, role: str, action_items, target_files, paths, config: ProjectConfig, prompt_path: pathlib.Path):
    sections = [task_md.read_text(encoding="utf-8")]
    if action_items:
        action_section = "\n\n## 🎯 당신에게 할당된 작업 (Action Items)\n\n"
        for i, item in enumerate(action_items, 1):
            action_section += f"### {i}. {item.get('action')}\n"
            action_section += f"- **우선순위**: {item.get('priority', 'medium')}\n"
            action_section += f"- **마감일**: {item.get('due_date', 'TBD')}\n"
            if item.get("source_role"):
                action_section += f"- **출처**: {item.get('source_role')}\n"
            ctx = item.get("context") or {}
            if ctx.get("notes"):
                action_section += f"- **참고 노트**: {ctx.get('notes')}\n"
            if ctx.get("risks"):
                action_section += f"- **위험요인**: {ctx.get('risks')}\n"
            if ctx.get("artifacts_out"):
                action_section += f"- **산출물**: {ctx.get('artifacts_out')}\n"
            action_section += "\n"
        sections.append(action_section)

    if config.editing_rules:
        sections.append("\n\n" + config.editing_rules + "\n")

    if target_files:
        snapshots = snapshot_files(paths, target_files)
        if snapshots:
            sections.append("\n\n### 📄 현재 파일 스냅샷 (읽기 전용)\n\n" + snapshots)

    enhanced_task_md = paths.enhanced_task_file(task_md.stem, role)
    enhanced_task_md.write_text("".join(sections), encoding="utf-8")
    return enhanced_task_md


def call_llm(paths, config: ProjectConfig, role: str, task_id: str, task_md: pathlib.Path, role_file: pathlib.Path, out_json: pathlib.Path, prompt_path: pathlib.Path, raw_path: pathlib.Path, llm_backend: str, debug: bool):
    if os.getenv("LLM_CALL_MODE", "wrapper") == "wrapper":
        cmd = [
            "bash",
            _to_posix_path(paths.root / "scripts/llm_call.sh"),
            _to_posix_path(role_file),
            _to_posix_path(task_md),
            _to_posix_path(out_json),
        ]
        res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", cwd=str(paths.root))
        if res.returncode != 0 and res.stderr:
            sys.stderr.write(res.stderr)
        return res.returncode

    charter = (paths.root / "AGENTS.md").read_text(encoding="utf-8") if (paths.root / "AGENTS.md").exists() else ""
    prompt = f"""### TEAM CHARTER (AGENTS.md)
{charter}

### ROLE
{role_file.read_text(encoding='utf-8')}

### TASK
{task_md.read_text(encoding='utf-8')}

### IMPORTANT
반드시 JSON 하나만 출력. 자연어/코드블록 금지."""
    prompt_path.write_text(prompt, encoding="utf-8")
    if llm_backend == "codex":
        llm_cmd = os.getenv("CODEX_CMD", "codex")
        llm_model = os.getenv("CODEX_MODEL")
        cmd = [llm_cmd, "exec"]
        # Optional Codex CLI overrides for approval/sandbox behavior.
        # Configure via environment variables (e.g. in .env):
        #   CODEX_FULL_AUTO=1                 -> --full-auto
        #   CODEX_APPROVAL_POLICY=on-request  -> -a on-request
        #   CODEX_SANDBOX_MODE=workspace-write -> -s workspace-write
        full_auto = os.getenv("CODEX_FULL_AUTO", "")
        if full_auto.lower() in ("1", "true", "yes", "on"):
            cmd.append("--full-auto")
        else:
            approval_policy = os.getenv("CODEX_APPROVAL_POLICY", "").strip()
            sandbox_mode = os.getenv("CODEX_SANDBOX_MODE", "").strip()
            if approval_policy:
                cmd += ["-a", approval_policy]
            if sandbox_mode:
                cmd += ["-s", sandbox_mode]
        if llm_model:
            cmd += ["--model", llm_model]
        cmd.append(prompt)
        env = os.environ.copy()
        if "CODEX_HOME" not in env or not pathlib.Path(env["CODEX_HOME"]).exists():
            print("⛔ CODEX_HOME not set or invalid.")
            return 127
    else:
        llm_cmd = os.getenv("CLAUDE_CMD", "claude")
        llm_model = os.getenv("CLAUDE_MODEL", "sonnet")
        cmd = [llm_cmd, "-m", llm_model, "-p", prompt]
        env = os.environ.copy()

    if shutil.which(cmd[0]) is None:
        print(f"⛔ command not found: {cmd[0]}")
        return 127
    res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", env=env)
    if res.returncode != 0:
        if res.stderr:
            sys.stderr.write(res.stderr)
        raw_path.write_text((res.stdout or "") + "\n" + (res.stderr or ""), encoding="utf-8")
        return res.returncode
    raw = res.stdout
    raw_path.write_text(raw, encoding="utf-8")
    try:
        from scripts.extract_json import extract_first_json  # type: ignore
    except Exception:
        def extract_first_json(text: str) -> str:
            s = text.find("{")
            if s < 0:
                return ""
            depth = 0
            ins = False
            esc = False
            for i, ch in enumerate(text[s:], s):
                if ins:
                    if esc:
                        esc = False
                    elif ch == "\\":
                        esc = True
                    elif ch == '"':
                        ins = False
                else:
                    if ch == '"':
                        ins = True
                    elif ch == "{":
                        depth += 1
                    elif ch == "}":
                        depth -= 1
                    if depth == 0:
                        return text[s : i + 1]
            return ""
    j = extract_first_json(raw)
    out_json.write_text(j or raw, encoding="utf-8")
    return 0
