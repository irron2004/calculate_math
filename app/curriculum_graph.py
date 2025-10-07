"""Utility helpers for loading curriculum graph assets."""

from __future__ import annotations

import json
from copy import deepcopy
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict

_BASE_DIR = Path(__file__).resolve().parent
_GRAPH_PATH = _BASE_DIR / "data" / "curriculum_graph_v0_1.json"
_HOME_COPY_PATH = _BASE_DIR / "data" / "curriculum_home_copy_v0_1.json"


@lru_cache(maxsize=1)
def _load_graph_template() -> Dict[str, Any]:
    with _GRAPH_PATH.open("r", encoding="utf-8") as stream:
        return json.load(stream)


@lru_cache(maxsize=1)
def _load_home_copy_template() -> Dict[str, Any]:
    with _HOME_COPY_PATH.open("r", encoding="utf-8") as stream:
        return json.load(stream)


def get_curriculum_graph() -> Dict[str, Any]:
    """Return a deep copy of the global curriculum graph payload."""
    return deepcopy(_load_graph_template())


def get_home_copy() -> Dict[str, Any]:
    """Return tooltip copy for the student/guardian home pathway map."""
    return deepcopy(_load_home_copy_template())


def build_user_graph(user_id: str) -> Dict[str, Any]:
    """Return the curriculum graph with placeholder user personalization."""
    graph = get_curriculum_graph()
    for node in graph.get("nodes", []):
        node.setdefault("mastery", 0.0)
        node.setdefault("lrc", None)
    meta = graph.setdefault("meta", {})
    user_meta = meta.setdefault("user", {})
    user_meta.update({"id": user_id, "mastery_source": "placeholder"})
    return graph


__all__ = [
    "build_user_graph",
    "get_curriculum_graph",
    "get_home_copy",
]
