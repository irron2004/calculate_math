import os
import json
import pathlib
import re
import datetime
from typing import List


def load_env_file(env_path: pathlib.Path):
    """Lightweight .env loader (no external deps)."""
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        k = k.strip()
        v = v.strip().split("#", 1)[0].strip().strip("'\"")
        if k and k not in os.environ:
            os.environ[k] = v


class Paths:
    def __init__(self, root: pathlib.Path):
        self.root = root
        self.work_list = root / "docs" / "work_list"
        self.work_list.mkdir(parents=True, exist_ok=True)

    def role_file(self, role: str) -> pathlib.Path:
        return self.root / f"roles/{role}.md"

    def task_file(self, task_id: str) -> pathlib.Path:
        return self.root / f"tasks/{task_id}.md"

    def enhanced_task_file(self, task_id: str, role: str) -> pathlib.Path:
        return self.root / f"tasks/{task_id}_{role}_enhanced.md"

    def output_json(self, task_id: str, role: str) -> pathlib.Path:
        return self.work_list / f"{task_id}_{role}.json"

    def prompt_path(self, task_id: str, role: str) -> pathlib.Path:
        return self.work_list / f"{task_id}_{role}_prompt.txt"

    def raw_path(self, task_id: str, role: str) -> pathlib.Path:
        return self.work_list / f"{task_id}_{role}_raw.txt"

    def summary_path(self, task_id: str) -> pathlib.Path:
        return self.work_list / f"{task_id}_summary.json"

    def work_log_path(self, task_id: str) -> pathlib.Path:
        return self.work_list / f"{task_id}_log.md"

    def queue_path(self, task_id: str) -> pathlib.Path:
        return self.work_list / f"{task_id}_queue.json"


def read_json(p: pathlib.Path):
    return json.loads(p.read_text(encoding="utf-8"))


def save_json(p: pathlib.Path, obj):
    p.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(obj, ensure_ascii=False, indent=2)
    p.write_text(payload, encoding="utf-8")


def safe_resolve(paths: Paths, path_str: str) -> pathlib.Path | None:
    if not path_str:
        return None
    candidate = pathlib.Path(path_str)
    if candidate.is_absolute():
        return None
    try:
        resolved = (paths.root / candidate).resolve()
        resolved.relative_to(paths.root)
    except Exception:
        return None
    return resolved


def extract_candidate_paths(paths: Paths, text: str):
    candidates = set()
    if not text:
        return set()
    for m in re.findall(r"`([^`]+)`", text):
        candidates.add(m.strip())
    for m in re.findall(r"([A-Za-z0-9_.\\/\\-]+/[A-Za-z0-9_.\\/\\-]+)", text):
        candidates.add(m.strip())
    real_paths = set()
    for c in candidates:
        if "://" in c:
            continue
        resolved = safe_resolve(paths, c)
        if resolved and resolved.is_file():
            real_paths.add(resolved)
    return real_paths


def collect_target_files(paths: Paths, task_md: pathlib.Path, action_items):
    files = set()
    try:
        files |= extract_candidate_paths(paths, task_md.read_text(encoding="utf-8"))
    except Exception:
        pass
    for item in action_items or []:
        files |= extract_candidate_paths(paths, item.get("action", ""))
        ctx = item.get("context") or {}
        for key in ("notes", "risks"):
            val = ctx.get(key)
            if isinstance(val, list):
                for v in val:
                    files |= extract_candidate_paths(paths, str(v))
            elif isinstance(val, str):
                files |= extract_candidate_paths(paths, val)
    return sorted(files)


def snapshot_files(paths: Paths, target_paths: List[pathlib.Path], max_chars: int = 4000):
    blocks = []
    for p in target_paths:
        rel = p.relative_to(paths.root)
        try:
            txt = p.read_text(encoding="utf-8")
        except Exception:
            continue
        truncated = txt
        if len(truncated) > max_chars:
            truncated = f"{truncated[: max_chars//2]}\\n... [truncated] ...\\n{truncated[-max_chars//2 :]}"
        blocks.append(f"#### {rel}\\n```\\n{truncated}\\n```")
    return "\\n\\n".join(blocks) if blocks else ""


def maybe_unescape_content(content: str) -> str:
    if not isinstance(content, str):
        content = str(content)
    has_real_newline = "\n" in content
    has_escaped_newline = "\\n" in content
    has_escaped_unicode = "\\u" in content
    if has_real_newline and not has_escaped_newline and not has_escaped_unicode:
        return content
    if has_escaped_newline or has_escaped_unicode:
        try:
            return content.encode("utf-8").decode("unicode_escape")
        except Exception:
            return content
    return content


def apply_edits(paths: Paths, edits):
    applied = []
    for edit in edits or []:
        path_str = edit.get("path") or edit.get("file") or edit.get("uri")
        content = edit.get("content")
        if path_str is None or content is None:
            continue
        content = maybe_unescape_content(content)
        target = safe_resolve(paths, str(path_str))
        if not target:
            print(f"⚠️  edit skipped (unsafe path): {path_str}")
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
        applied.append(str(target.relative_to(paths.root)))
    return applied
