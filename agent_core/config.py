import json
import pathlib
from dataclasses import dataclass
from typing import Dict, Any

try:
    import yaml  # type: ignore
except Exception:
    yaml = None


@dataclass
class ProjectConfig:
    project_root: pathlib.Path
    charter_file: pathlib.Path
    default_llm: str = "codex"
    roles: Dict[str, Any] = None
    test_cmd: str = "pytest -q"
    editing_rules: str = ""
    max_rounds: int = 3  
    priority_rank: Dict[str, int] = None


def _load_yaml_or_json(p: pathlib.Path) -> Dict[str, Any]:
    txt = p.read_text(encoding="utf-8")
    if yaml is not None:
        return yaml.safe_load(txt)
    return json.loads(txt)


def load_project_config(root: pathlib.Path) -> ProjectConfig:
    cfg_path = root / "agent_config.yaml"
    if not cfg_path.exists():
        cfg_path = root / "agent_config.json"
    raw = _load_yaml_or_json(cfg_path) if cfg_path.exists() else {}

    charter_file = root / raw.get("charter_file", "AGENTS.md")

    editing_rules = ""
    editing_rules_file = raw.get("editing_rules_file")
    if editing_rules_file:
        try:
            editing_rules = (root / editing_rules_file).read_text(encoding="utf-8")
        except Exception:
            editing_rules = ""

    return ProjectConfig(
        project_root=root,
        charter_file=charter_file,
        default_llm=raw.get("default_llm", "codex"),
        roles=raw.get("roles", {}),
        test_cmd=raw.get("test_cmd",None),
        editing_rules=editing_rules,
        max_rounds=raw.get("max_rounds"),
        priority_rank=raw.get("priority_rank", {"high": 0, "medium": 1, "low": 2}),
    )
