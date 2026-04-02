#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.app.db import connect, get_database_path
from backend.app.homework_grading import is_objective_answer_correct


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _load_json_list(raw: str | None) -> list[dict[str, Any]]:
    if not raw:
        return []
    try:
        value = json.loads(raw)
    except Exception:
        return []
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, dict)]


def _load_json_dict(raw: str | None) -> dict[str, Any]:
    if not raw:
        return {}
    try:
        value = json.loads(raw)
    except Exception:
        return {}
    if not isinstance(value, dict):
        return {}
    return value


def _is_review_marked_wrong(review_obj: Any) -> bool:
    if not isinstance(review_obj, dict):
        return False
    needs_revision = bool(review_obj.get("needsRevision"))
    comment = review_obj.get("comment")
    comment_text = comment if isinstance(comment, str) else ""
    return needs_revision or bool(comment_text.strip())


def _submission_has_wrong_problem(
    problems: list[dict[str, Any]],
    answers: dict[str, Any],
    reviews: dict[str, Any],
) -> bool:
    for idx, problem_obj in enumerate(problems, start=1):
        problem_id = str(problem_obj.get("id") or f"p{idx}")
        problem_type = str(problem_obj.get("type") or "").strip()
        options = problem_obj.get("options")
        options_list = options if isinstance(options, list) else None
        correct_answer = problem_obj.get("answer")
        correct_answer_str = (
            str(correct_answer) if isinstance(correct_answer, str) else None
        )
        answer_obj = answers.get(problem_id)
        student_answer = (
            str(answer_obj)
            if isinstance(answer_obj, str) and answer_obj.strip()
            else None
        )

        review_marked_wrong = _is_review_marked_wrong(reviews.get(problem_id))

        if problem_type == "objective":
            if correct_answer_str is not None and not is_objective_answer_correct(
                student_answer=student_answer,
                correct_answer=correct_answer_str,
                options=options_list,
            ):
                return True
            if review_marked_wrong:
                return True
        elif problem_type == "subjective" and review_marked_wrong:
            return True

    return False


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--assignment-id")
    parser.add_argument("--student-id")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    conn = connect(get_database_path())
    try:
        clauses: list[str] = []
        params: list[str] = []
        if args.assignment_id:
            clauses.append("hs.assignment_id = ?")
            params.append(args.assignment_id)
        if args.student_id:
            clauses.append("hs.student_id = ?")
            params.append(args.student_id)
        where_clause = ""
        if clauses:
            where_clause = "WHERE " + " AND ".join(clauses)

        rows = conn.execute(
            f"""
            SELECT
                hs.id,
                hs.assignment_id,
                hs.student_id,
                hs.answers_json,
                hs.review_status,
                hs.problem_reviews_json,
                ha.problems_json
            FROM homework_submissions hs
            INNER JOIN homework_assignments ha ON hs.assignment_id = ha.id
            {where_clause}
            ORDER BY hs.submitted_at ASC
            """,
            tuple(params),
        ).fetchall()

        total = len(rows)
        updated = 0

        for row in rows:
            problems = _load_json_list(row["problems_json"])
            answers = _load_json_dict(row["answers_json"])
            reviews = _load_json_dict(row["problem_reviews_json"])
            has_wrong_problem = _submission_has_wrong_problem(
                problems, answers, reviews
            )
            current_status = str(row["review_status"] or "pending")

            next_status = current_status
            if current_status == "pending" and not has_wrong_problem:
                next_status = "approved"
            if current_status == "returned" and not has_wrong_problem:
                next_status = "approved"

            if next_status == current_status:
                continue

            updated += 1
            print(
                f"[{row['id']}] {row['student_id']} {row['assignment_id']} "
                f"{current_status} -> {next_status}"
            )

            if args.dry_run:
                continue

            conn.execute(
                """
                UPDATE homework_submissions
                SET review_status = ?, reviewed_at = ?, reviewed_by = ?
                WHERE id = ?
                """,
                (next_status, _now_iso(), "system_regrade_objective", row["id"]),
            )

        if not args.dry_run:
            conn.commit()

        mode = "dry-run" if args.dry_run else "apply"
        print(f"mode={mode} total={total} updated={updated}")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
