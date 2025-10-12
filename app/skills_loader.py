"""Utility helpers for loading the curriculum skill DAG."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict

_BASE_DIR = Path(__file__).resolve().parent
_SKILLS_PATH = _BASE_DIR / "data" / "skills.json"


@lru_cache(maxsize=1)
def _load_skill_template() -> Dict[str, Any]:
    with _SKILLS_PATH.open("r", encoding="utf-8") as stream:
        return json.load(stream)


def get_skill_graph() -> Dict[str, Any]:
    """Return a deep copy of the configured skill DAG."""
    from copy import deepcopy

    return deepcopy(_load_skill_template())


__all__ = ["get_skill_graph"]
