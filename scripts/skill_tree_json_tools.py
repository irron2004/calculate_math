"""Utility helpers for validating and visualising levelled skill-tree JSON payloads.

The script accepts a compact JSON structure:

{
    "tree_id": "math_basic",
    "title": "기초 수학 스킬트리",
    "description": "...",
    "skills": [
        {"id": "nat_num", "name": "자연수 이해", "level": 1, "prerequisites": []},
        ...
    ]
}

Validation rules:
- Skill ids must be unique.
- All prerequisites must exist in the same payload (or filtered view) and use a lower
  level than the dependent skill.
- The prerequisite graph must be acyclic.

CLI usage:
  python scripts/skill_tree_json_tools.py docs/skill_tree_math_basic.json --max-level 2 --print-mermaid
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict, deque
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, List, Sequence

__all__ = [
    "Skill",
    "SkillTree",
    "SkillTreeParseError",
    "SkillTreeValidationError",
    "load_skill_tree",
    "validate_skill_tree",
    "to_mermaid",
]


class SkillTreeParseError(RuntimeError):
    """Raised when a JSON payload cannot be parsed into a SkillTree."""


class SkillTreeValidationError(RuntimeError):
    """Raised when a SkillTree violates structural rules."""


@dataclass(frozen=True)
class Skill:
    """Atomic skill definition."""

    id: str
    name: str
    level: int
    description: str | None
    prerequisites: List[str]

    @classmethod
    def from_payload(cls, payload: dict) -> "Skill":
        try:
            skill_id = payload["id"]
            name = payload["name"]
            level = int(payload["level"])
        except (KeyError, TypeError, ValueError) as exc:  # pragma: no cover - simple parsing guard
            raise SkillTreeParseError(f"Invalid skill entry: {payload}") from exc

        prereqs = payload.get("prerequisites") or []
        if not isinstance(prereqs, list):
            raise SkillTreeParseError(f"'prerequisites' for {skill_id} must be a list")

        description = payload.get("description")
        return cls(
            id=str(skill_id),
            name=str(name),
            level=level,
            description=str(description) if description is not None else None,
            prerequisites=[str(item) for item in prereqs],
        )


@dataclass(frozen=True)
class SkillTree:
    """Top-level container for the simplified skill-tree format."""

    tree_id: str
    title: str | None
    description: str | None
    skills: List[Skill]

    @classmethod
    def from_payload(cls, payload: dict) -> "SkillTree":
        try:
            tree_id = payload["tree_id"]
        except KeyError as exc:  # pragma: no cover - shape guard
            raise SkillTreeParseError("Missing 'tree_id' in skill tree payload") from exc

        raw_skills = payload.get("skills")
        if not isinstance(raw_skills, list):
            raise SkillTreeParseError("'skills' must be a list")

        skills = [Skill.from_payload(item) for item in raw_skills]
        return cls(
            tree_id=str(tree_id),
            title=payload.get("title"),
            description=payload.get("description"),
            skills=skills,
        )


def _filter_by_level(skills: Iterable[Skill], max_level: int | None) -> List[Skill]:
    if max_level is None:
        return list(skills)
    return [skill for skill in skills if skill.level <= max_level]


def _toposort(skills: Sequence[Skill], graph: dict[str, list[str]]) -> list[str]:
    indegree: dict[str, int] = defaultdict(int)
    for skill in skills:
        indegree.setdefault(skill.id, 0)
    for deps in graph.values():
        for node_id in deps:
            indegree[node_id] += 1

    queue: deque[str] = deque([node_id for node_id, deg in indegree.items() if deg == 0])
    order: list[str] = []

    while queue:
        current = queue.popleft()
        order.append(current)
        for neighbor in graph.get(current, []):
            indegree[neighbor] -= 1
            if indegree[neighbor] == 0:
                queue.append(neighbor)

    if len(order) != len(skills):
        raise SkillTreeValidationError("Cycle detected in prerequisite graph")
    return order


def validate_skill_tree(
    tree: SkillTree,
    max_level: int | None = None,
    *,
    allow_missing_prereqs: bool = False,
) -> list[str]:
    """Validate the skill tree and return a topological order of skill ids."""

    skills = _filter_by_level(tree.skills, max_level)
    if not skills:
        raise SkillTreeValidationError("No skills available after applying the level filter")

    by_id: dict[str, Skill] = {}
    for skill in skills:
        if skill.id in by_id:
            raise SkillTreeValidationError(f"Duplicate skill id detected: {skill.id}")
        by_id[skill.id] = skill

    adjacency: dict[str, list[str]] = defaultdict(list)
    missing_refs: list[str] = []
    for skill in skills:
        for prereq_id in skill.prerequisites:
            prereq = by_id.get(prereq_id)
            if prereq is None:
                if allow_missing_prereqs:
                    missing_refs.append(f"{skill.id}->{prereq_id}")
                    continue
                raise SkillTreeValidationError(
                    f"{skill.id} references missing prerequisite '{prereq_id}'"
                )
            # Allow same-level prerequisites for datasets that use flat tiers.
            if prereq.level > skill.level:
                raise SkillTreeValidationError(
                    f"{skill.id} (L{skill.level}) requires {prereq_id} (L{prereq.level}) "
                    "with a higher level"
                )
            adjacency[prereq.id].append(skill.id)

    if allow_missing_prereqs and missing_refs:
        print(
            f"Warning: skipped missing prerequisites ({len(missing_refs)}): "
            + ", ".join(missing_refs),
            file=sys.stderr,
        )

    return _toposort(skills, adjacency)


def to_mermaid(tree: SkillTree, max_level: int | None = None) -> str:
    """Render the skill tree into a Mermaid graph definition."""

    skills = _filter_by_level(tree.skills, max_level)
    if not skills:
        raise SkillTreeValidationError("No skills available after applying the level filter")

    by_id = {skill.id: skill for skill in skills}
    lines = ["graph LR"]
    for skill in skills:
        label = f"{skill.name} (L{skill.level})"
        safe_label = label.replace('"', r"\"")
        lines.append(f'  {skill.id}["{safe_label}"]')

    for skill in skills:
        for prereq_id in skill.prerequisites:
            if prereq_id in by_id:
                lines.append(f"  {prereq_id} --> {skill.id}")

    return "\n".join(lines)


def load_skill_tree(path: Path) -> SkillTree:
    """Load a skill tree payload from disk."""

    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:  # pragma: no cover - straightforward IO guard
        raise SkillTreeParseError(f"Skill tree payload not found at {path}") from exc
    except json.JSONDecodeError as exc:  # pragma: no cover - straightforward JSON guard
        raise SkillTreeParseError(f"Invalid JSON payload at {path}: {exc}") from exc

    return SkillTree.from_payload(payload)


def _extract_requires_field(value: object) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(item) for item in value]
    if isinstance(value, dict):
        all_of = value.get("all_of") or []
        if isinstance(all_of, list):
            return [str(item) for item in all_of]
        return []
    return [str(value)]


def _build_tree_from_nodes_payload(
    payload: dict, path: Path, *, skip_boss: bool = False
) -> SkillTree:
    if "nodes" not in payload:
        raise SkillTreeParseError(f"Unsupported JSON shape in {path}")

    raw_nodes = payload.get("nodes") or []
    if not isinstance(raw_nodes, list):
        raise SkillTreeParseError(f"'nodes' must be a list in {path}")

    skills: list[Skill] = []
    for node in raw_nodes:
        if not isinstance(node, dict):
            continue
        node_type = node.get("type")
        if node_type == "course_step":
            continue  # skip course steps when present
        if skip_boss:
            if node.get("kind") == "boss":
                continue
            boss_flag = node.get("boss")
            if boss_flag and str(boss_flag).lower() != "false":
                continue
        skill_id = node.get("id")
        if not skill_id:
            continue
        name = node.get("label") or skill_id
        level = node.get("tier") or node.get("level") or node.get("levels") or 1
        try:
            level = int(level)
        except (TypeError, ValueError):
            level = 1
        prereqs = _extract_requires_field(node.get("requires"))
        skills.append(
            Skill(
                id=str(skill_id),
                name=str(name),
                level=level,
                description=node.get("description"),
                prerequisites=prereqs,
            )
        )

    tree_id = payload.get("tree_id") or payload.get("version") or path.stem
    return SkillTree(
        tree_id=str(tree_id),
        title=payload.get("title"),
        description=payload.get("description"),
        skills=skills,
    )


def _parse_mermaid_block(raw: str, path: Path) -> SkillTree:
    """Minimal Mermaid parser to support graph LR snippets."""

    lines = []
    fenced = False
    for line in raw.splitlines():
        stripped = line.strip()
        if stripped.startswith("```"):
            if "mermaid" in stripped:
                fenced = not fenced and True
                continue
            fenced = not fenced
            continue
        if raw.strip().startswith("graph") or fenced:
            lines.append(line)
        elif "graph" in stripped or "-->" in stripped or "[" in stripped:
            lines.append(line)

    node_def: dict[str, dict[str, object]] = defaultdict(dict)
    prereqs: dict[str, list[str]] = defaultdict(list)

    for line in lines:
        stripped = line.strip()
        if not stripped or stripped.startswith("graph"):
            continue

        if "-->" in stripped:
            parts = stripped.split("-->")
            if len(parts) == 2:
                pre = parts[0].strip()
                post = parts[1].strip()
                prereqs[post].append(pre)
            continue

        if "[" in stripped and "]" in stripped:
            lhs, rest = stripped.split("[", 1)
            skill_id = lhs.strip()
            label = rest.split("]", 1)[0].strip().strip('"')
            level = 1
            name = label
            if "(" in label and "L" in label:
                try:
                    lvl_part = label.split("L")[-1].rstrip(")")
                    level = int("".join(ch for ch in lvl_part if ch.isdigit()))
                except ValueError:
                    level = 1
                name = label.split("(")[0].strip()
            node_def[skill_id]["name"] = name
            node_def[skill_id]["level"] = level

    for post, sources in prereqs.items():
        node_def.setdefault(post, {"name": post, "level": 1})
        for src in sources:
            node_def.setdefault(src, {"name": src, "level": 1})

    skills: list[Skill] = []
    for skill_id, meta in node_def.items():
        skills.append(
            Skill(
                id=str(skill_id),
                name=str(meta.get("name") or skill_id),
                level=int(meta.get("level") or 1),
                description=None,
                prerequisites=list(prereqs.get(skill_id, [])),
            )
        )

    if not skills:
        raise SkillTreeParseError(f"Could not parse Mermaid content in {path}")

    return SkillTree(tree_id=path.stem, title=None, description=None, skills=skills)


def _load_skill_tree_flexible(path: Path, *, skip_boss: bool = False) -> SkillTree:
    raw = path.read_text(encoding="utf-8")
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        return _parse_mermaid_block(raw, path)

    if "skills" in payload:
        return SkillTree.from_payload(payload)
    if "nodes" in payload:
        return _build_tree_from_nodes_payload(payload, path, skip_boss=skip_boss)

    raise SkillTreeParseError(f"Unsupported JSON shape in {path}")


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Validate and render a simplified skill-tree JSON payload."
    )
    parser.add_argument(
        "path",
        type=Path,
        help="Path to a skill-tree JSON file",
    )
    parser.add_argument(
        "--max-level",
        type=int,
        default=None,
        help="Only include skills up to this level when validating and rendering",
    )
    parser.add_argument(
        "--print-mermaid",
        action="store_true",
        help="Print a Mermaid graph to stdout after validation",
    )
    parser.add_argument(
        "--write-mermaid",
        type=Path,
        help="Optional path to write the Mermaid graph. Creates parent directories if needed.",
    )
    parser.add_argument(
        "--wrap-markdown",
        action="store_true",
        help="Wrap the Mermaid output in a Markdown code fence",
    )
    parser.add_argument(
        "--skip-boss",
        action="store_true",
        help="Exclude boss nodes (kind='boss' or boss flag present) when loading 'nodes' payloads",
    )
    parser.add_argument(
        "--allow-missing-prereqs",
        action="store_true",
        help="Skip missing prerequisites instead of failing validation",
    )
    return parser


def _render_mermaid_output(text: str, wrap_markdown: bool) -> str:
    if not wrap_markdown:
        return text
    return f"```mermaid\n{text}\n```"


def main(argv: Sequence[str] | None = None) -> int:
    args = _build_parser().parse_args(argv)

    try:
        tree = _load_skill_tree_flexible(args.path, skip_boss=args.skip_boss)
        validate_skill_tree(
            tree,
            max_level=args.max_level,
            allow_missing_prereqs=args.allow_missing_prereqs,
        )
    except (SkillTreeParseError, SkillTreeValidationError) as exc:
        print(f"Validation failed: {exc}", file=sys.stderr)
        return 1

    mermaid = to_mermaid(tree, max_level=args.max_level)
    rendered = _render_mermaid_output(mermaid, wrap_markdown=args.wrap_markdown)

    if args.write_mermaid:
        args.write_mermaid.parent.mkdir(parents=True, exist_ok=True)
        args.write_mermaid.write_text(rendered, encoding="utf-8")
        print(f"Wrote Mermaid graph to {args.write_mermaid}")

    if args.print_mermaid or not args.write_mermaid:
        print(rendered)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
