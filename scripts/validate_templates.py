#!/usr/bin/env python3
"""Validate template NDJSON structure and provide a quick summary."""

from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path
from typing import Dict, Any

REQUIRED_FIELDS = {"id", "node", "step", "lens", "rep", "ctx", "params"}


def validate_record(record: Dict[str, Any]) -> list[str]:
    errors: list[str] = []
    missing = REQUIRED_FIELDS - record.keys()
    if missing:
        errors.append(f"missing fields: {', '.join(sorted(missing))}")

    params = record.get("params")
    if not isinstance(params, dict):
        errors.append("params must be an object")

    return errors


def main() -> None:
    if len(sys.argv) != 2:
        print("Usage: validate_templates.py path/to/templates.ndjson", file=sys.stderr)
        sys.exit(1)

    path = Path(sys.argv[1])
    if not path.exists():
        print(f"File not found: {path}", file=sys.stderr)
        sys.exit(1)

    total = 0
    error_count = 0
    nodes = Counter()
    steps = Counter()
    contexts = Counter()

    with path.open("r", encoding="utf-8") as handle:
        for line_number, raw in enumerate(handle, start=1):
            raw = raw.strip()
            if not raw:
                continue
            total += 1
            try:
                record = json.loads(raw)
            except json.JSONDecodeError as exc:
                print(f"[line {line_number}] invalid json: {exc}", file=sys.stderr)
                error_count += 1
                continue

            errors = validate_record(record)
            if errors:
                error_count += 1
                joined = "; ".join(errors)
                print(f"[line {line_number}] {record.get('id', '<unknown>')}: {joined}", file=sys.stderr)
                continue

            nodes[record["node"]] += 1
            steps[record["step"]] += 1
            contexts[record["ctx"]] += 1

    print(f"Total records: {total}")
    print(f"Invalid records: {error_count}")
    print("Node distribution:")
    for node, count in nodes.most_common():
        print(f"  - {node}: {count}")
    print("Step distribution:")
    for step, count in steps.most_common():
        print(f"  - {step}: {count}")
    print("Context distribution:")
    for ctx, count in contexts.most_common():
        print(f"  - {ctx}: {count}")

    if error_count:
        sys.exit(1)


if __name__ == "__main__":
    main()
