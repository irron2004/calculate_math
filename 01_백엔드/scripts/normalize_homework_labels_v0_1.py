#!/usr/bin/env python3
from __future__ import annotations

import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parents[1] / "backend" / "data" / "app.db"

LABEL_MAPPINGS: list[tuple[str, str, str]] = [
    ("log_grade2_derived", "hwset-high-2-logarithm-derived", "고2 로그 - 파생"),
    (
        "exp_grade2_ineq_2026w12",
        "hwset-high-2-exponential-inequality-w12",
        "고2 지수부등식 - 2026 W12",
    ),
    ("src_0363", "source-0363", "원본 0363"),
    ("src_0376", "source-0376", "원본 0376"),
    ("src_0373", "source-0373", "원본 0373"),
    ("src_0372", "source-0372", "원본 0372"),
    (
        "exp_substitute_range",
        "concept-exponential-substitute-range-root-count",
        "개념: 치환 후 범위/근개수/항상성립",
    ),
    (
        "exp_given_solution",
        "concept-exponential-inequality-given-solution",
        "개념: 해가 주어진 지수부등식",
    ),
    (
        "exp_system_intersection",
        "concept-exponential-system-inequality-intersection",
        "개념: 연립부등식 교집합",
    ),
    ("day_mon", "day-mon", "요일: 월"),
    ("day_tue", "day-tue", "요일: 화"),
    ("day_wed", "day-wed", "요일: 수"),
    ("day_thu", "day-thu", "요일: 목"),
    ("day_fri", "day-fri", "요일: 금"),
]


def main() -> None:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        before = {row["key"]: dict(row) for row in conn.execute("SELECT * FROM homework_labels")}

        for old_key, new_key, new_label in LABEL_MAPPINGS:
            row = before.get(old_key)
            if row is None:
                existing_new = conn.execute(
                    "SELECT id FROM homework_labels WHERE key = ?",
                    (new_key,),
                ).fetchone()
                if existing_new:
                    print(f"skip: {old_key} missing, already has {new_key}")
                    continue
                raise RuntimeError(f"missing label key: {old_key}")

            duplicate = conn.execute(
                "SELECT id FROM homework_labels WHERE key = ? AND key != ?",
                (new_key, old_key),
            ).fetchone()
            if duplicate:
                raise RuntimeError(
                    f"target key already exists for another row: {old_key} -> {new_key}"
                )

            conn.execute(
                "UPDATE homework_labels SET key = ?, label = ? WHERE key = ?",
                (new_key, new_label, old_key),
            )
            print(f"updated: {old_key} -> {new_key} | {new_label}")

        conn.commit()
    finally:
        conn.close()


if __name__ == "__main__":
    main()
