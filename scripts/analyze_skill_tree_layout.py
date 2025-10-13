#!/usr/bin/env python3
"""Quick schema checks for the ``skill_tree_layout`` experiment analytics feed.

This helper is intended for dry-runs against synthetic or sampled Amplitude/Segment
exports so that we can verify our downstream analysis jobs before ramping traffic.
The script validates the basic record shape and prints a tiny roll-up that matches
the metrics referenced in ``docs/experiments/skill_tree_layout.md``.
"""

from __future__ import annotations

import argparse
import json
from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import Dict, Iterable, Tuple

TARGET_EXPERIMENT_NAME = "skill_tree_layout"
REQUIRED_TOP_LEVEL_FIELDS = ("timestamp", "event_name", "user_id")
REQUIRED_EXPERIMENT_FIELDS = (
    "name",
    "variant",
    "source",
    "bucket",
    "rollout",
    "request_id",
)


def parse_events(path: Path) -> Iterable[Tuple[int, Dict]]:
    """Yield zero-based line index and parsed JSON object for each record."""
    with path.open("r", encoding="utf-8") as handle:
        for idx, raw_line in enumerate(handle, start=1):
            line = raw_line.strip()
            if not line:
                continue
            try:
                event = json.loads(line)
            except json.JSONDecodeError as exc:  # pragma: no cover - defensive
                raise ValueError(f"Line {idx}: invalid JSON payload ({exc})") from exc

            for field in REQUIRED_TOP_LEVEL_FIELDS:
                if field not in event:
                    raise ValueError(f"Line {idx}: missing required field '{field}'")

            try:
                # Accept trailing Z (UTC) by normalising to +00:00
                datetime.fromisoformat(event["timestamp"].replace("Z", "+00:00"))
            except ValueError as exc:
                raise ValueError(
                    f"Line {idx}: timestamp must be ISO 8601 (got {event['timestamp']})"
                ) from exc

            yield idx, event


def validate_experiment_block(event: Dict, line_no: int, target: str) -> Dict:
    """Ensure the nested experiment payload includes the expected fields."""
    experiment = event.get("experiment")
    if not experiment:
        raise ValueError(f"Line {line_no}: missing 'experiment' metadata block")

    if experiment.get("name") != target:
        raise ValueError(
            f"Line {line_no}: experiment name mismatch "
            f"(expected '{target}', got '{experiment.get('name')}')"
        )

    missing = [field for field in REQUIRED_EXPERIMENT_FIELDS if field not in experiment]
    if missing:
        raise ValueError(
            f"Line {line_no}: experiment metadata missing fields {sorted(missing)}"
        )

    return experiment


def run_analysis(path: Path, target: str, expected_variants: Iterable[str]) -> str:
    exposures = Counter()
    session_starts = Counter()
    other_events = Counter()
    seen_users = set()

    for line_no, event in parse_events(path):
        if event["event_name"] == "experiment_exposure":
            experiment = validate_experiment_block(event, line_no, target)
            exposures[experiment["variant"]] += 1
            seen_users.add((event["user_id"], experiment["variant"]))
            continue

        experiment = event.get("experiment")
        if experiment and experiment.get("name") == target:
            validate_experiment_block(event, line_no, target)
            variant = experiment["variant"]
        else:
            variant = None

        if event["event_name"] == "session_started_from_tree" and variant:
            session_starts[variant] += 1
        else:
            other_events[event["event_name"]] += 1

    missing_variants = [v for v in expected_variants if exposures[v] == 0]
    if missing_variants:
        raise ValueError(
            f"No exposures recorded for expected variant(s): {', '.join(missing_variants)}"
        )

    lines = [
        f"Validated {sum(exposures.values())} exposures "
        f"across {len(seen_users)} unique user/variant assignments.",
        "",
        "Exposure counts:",
    ]
    for variant in sorted(exposures):
        lines.append(f"  - {variant}: {exposures[variant]}")

    lines.append("")
    lines.append("Session starts by variant:")
    for variant in sorted(expected_variants):
        lines.append(f"  - {variant}: {session_starts[variant]}")

    if other_events:
        lines.append("")
        lines.append("Other events observed (not part of primary metrics):")
        for name, count in sorted(other_events.items()):
            lines.append(f"  - {name}: {count}")

    return "\n".join(lines)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Dry-run validation for skill_tree_layout experiment analytics."
    )
    parser.add_argument(
        "events_path",
        type=Path,
        help="Path to a JSON Lines file containing analytics events.",
    )
    parser.add_argument(
        "--experiment-name",
        default=TARGET_EXPERIMENT_NAME,
        help="Override the experiment name to validate (default: skill_tree_layout).",
    )
    parser.add_argument(
        "--expected-variant",
        dest="expected_variants",
        action="append",
        default=["tree", "list"],
        help="Expected variant slug. Pass multiple times for additional variants.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    summary = run_analysis(args.events_path, args.experiment_name, args.expected_variants)
    print(summary)


if __name__ == "__main__":  # pragma: no cover - CLI entrypoint
    main()

