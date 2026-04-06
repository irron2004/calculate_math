#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sqlite3
from pathlib import Path
from typing import Any

import requests

API_BASE_DEFAULT = "https://calculatemath-production.up.railway.app/api"
WEEK_KEY = "2026-W12"
DAY_KEYS = ["mon", "tue", "wed", "thu", "fri"]


def _headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _login(api_base: str, username: str, password: str) -> str:
    response = requests.post(
        f"{api_base}/auth/login",
        json={"username": username, "password": password},
        timeout=20,
    )
    if response.status_code != 200:
        raise RuntimeError(f"login failed: {response.status_code} {response.text}")
    token = response.json().get("accessToken")
    if not isinstance(token, str) or not token:
        raise RuntimeError("login response missing accessToken")
    return token


def _is_placeholder_options(options: Any) -> bool:
    return (
        isinstance(options, list)
        and len(options) == 5
        and all(isinstance(x, str) and x.startswith("선지 ") for x in options)
    )


def _choice_index_from_placeholder_answer(answer: Any) -> int:
    if not isinstance(answer, str):
        return 1
    text = answer.strip()
    if not text.startswith("선지 "):
        return 1
    try:
        value = int(text.replace("선지 ", "").strip())
    except ValueError:
        return 1
    if 1 <= value <= 5:
        return value
    return 1


def _replacement_options(order_index: int) -> list[str]:
    mapping = {
        5: ["x < -1", "-1 <= x < 0", "0 <= x < 1", "x >= 1", "empty set"],
        6: ["x < 0", "x <= 0", "0 < x < 1", "x >= 1", "empty set"],
        7: ["x <= -1", "-1 < x <= 0", "0 < x <= 1", "x > 1", "empty set"],
        8: ["x < -2", "-2 <= x < 0", "0 <= x < 2", "x >= 2", "empty set"],
        9: ["x <= -2", "-2 < x < 0", "0 < x <= 2", "x > 2", "empty set"],
        10: ["x < -3", "-3 <= x < 0", "0 < x < 3", "x >= 3", "empty set"],
    }
    return mapping.get(
        order_index,
        ["choice A", "choice B", "choice C", "choice D", "choice E"],
    )


def _ensure_label(api_base: str, token: str, key: str, label: str) -> None:
    response = requests.get(
        f"{api_base}/homework/admin/problem-bank/labels",
        headers=_headers(token),
        timeout=20,
    )
    response.raise_for_status()
    labels = response.json().get("labels")
    if isinstance(labels, list):
        for item in labels:
            if isinstance(item, dict) and item.get("key") == key:
                return

    create_resp = requests.post(
        f"{api_base}/homework/admin/problem-bank/labels",
        headers=_headers(token),
        json={"key": key, "label": label, "kind": "custom"},
        timeout=20,
    )
    if create_resp.status_code not in (200, 400):
        raise RuntimeError(
            f"label create failed ({key}): {create_resp.status_code} {create_resp.text}"
        )


def _label_keys_for_problem(day_key: str, order_index: int) -> list[str]:
    day_label = f"day-{day_key}"
    if 1 <= order_index <= 4:
        return [
            "hwset-high-2-exponential-inequality-w12",
            day_label,
            "source-0363",
            "source-0376",
            "concept-exponential-substitute-range-root-count",
        ]
    if order_index == 5:
        return [
            "hwset-high-2-exponential-inequality-w12",
            day_label,
            "source-0373",
            "concept-exponential-inequality-given-solution",
        ]
    return [
        "hwset-high-2-exponential-inequality-w12",
        day_label,
        "source-0372",
        "concept-exponential-system-inequality-intersection",
    ]


def _load_local_payload(local_db: Path, day_key: str) -> dict[str, Any]:
    conn = sqlite3.connect(local_db)
    conn.row_factory = sqlite3.Row
    try:
        batch_row = conn.execute(
            """
            SELECT id, title, description
            FROM homework_import_batches
            WHERE week_key = ? AND day_key = ?
            ORDER BY imported_at DESC
            LIMIT 1
            """,
            (WEEK_KEY, day_key),
        ).fetchone()
        if batch_row is None:
            raise RuntimeError(f"local batch missing: {WEEK_KEY}/{day_key}")

        problem_rows = conn.execute(
            """
            SELECT order_index, type, question, options_json, answer
            FROM homework_problems
            WHERE batch_id = ?
            ORDER BY order_index ASC
            """,
            (batch_row["id"],),
        ).fetchall()

        problems: list[dict[str, Any]] = []
        for row in problem_rows:
            options = json.loads(row["options_json"]) if row["options_json"] else None
            answer = row["answer"]
            order_index = int(row["order_index"])

            if _is_placeholder_options(options):
                idx = _choice_index_from_placeholder_answer(answer)
                options = _replacement_options(order_index)
                answer = options[idx - 1]

            item: dict[str, Any] = {
                "type": row["type"],
                "question": row["question"],
            }
            if options is not None:
                item["options"] = options
            if answer is not None:
                item["answer"] = answer
            problems.append(item)

        return {
            "title": batch_row["title"],
            "description": batch_row["description"],
            "problems": problems,
        }
    finally:
        conn.close()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--api-base", default=API_BASE_DEFAULT)
    parser.add_argument("--admin-user", default="admin")
    parser.add_argument("--admin-pass", required=True)
    parser.add_argument("--local-db", default="backend/data/app.db")
    args = parser.parse_args()

    api_base = args.api_base.rstrip("/")
    token = _login(api_base, args.admin_user, args.admin_pass)

    _ensure_label(
        api_base, token, "exp_placeholder_archived", "지수부등식-placeholder-보관"
    )

    old_resp = requests.get(
        f"{api_base}/homework/admin/problem-bank/problems",
        headers=_headers(token),
        params={
            "weekKey": WEEK_KEY,
            "labelKey": "hwset-high-2-exponential-inequality-w12",
            "limit": 500,
            "offset": 0,
        },
        timeout=30,
    )
    old_resp.raise_for_status()
    old_items = old_resp.json().get("problems")
    if not isinstance(old_items, list):
        old_items = []
    old_placeholders = [
        p
        for p in old_items
        if isinstance(p, dict) and _is_placeholder_options(p.get("options"))
    ]

    local_db = Path(args.local_db)
    for day_key in DAY_KEYS:
        payload = _load_local_payload(local_db, day_key)
        import_resp = requests.post(
            f"{api_base}/homework/admin/problem-bank/import",
            headers=_headers(token),
            json={"weekKey": WEEK_KEY, "dayKey": day_key, "payload": payload},
            timeout=30,
        )
        import_resp.raise_for_status()
        import_obj = import_resp.json()
        batch_id = import_obj.get("batchId")
        if not isinstance(batch_id, str) or not batch_id:
            raise RuntimeError(f"import missing batchId: {day_key}")

        list_resp = requests.get(
            f"{api_base}/homework/admin/problem-bank/problems",
            headers=_headers(token),
            params={"weekKey": WEEK_KEY, "dayKey": day_key, "limit": 500, "offset": 0},
            timeout=30,
        )
        list_resp.raise_for_status()
        listed = list_resp.json().get("problems")
        if not isinstance(listed, list):
            listed = []
        new_items = [
            p for p in listed if isinstance(p, dict) and p.get("batchId") == batch_id
        ]

        for item in new_items:
            pid = item.get("id")
            order_index = int(item.get("orderIndex") or 0)
            if not isinstance(pid, str) or not pid:
                continue
            set_resp = requests.put(
                f"{api_base}/homework/admin/problem-bank/problems/{pid}/labels",
                headers=_headers(token),
                json={"labelKeys": _label_keys_for_problem(day_key, order_index)},
                timeout=20,
            )
            set_resp.raise_for_status()

    retagged = 0
    for item in old_placeholders:
        pid = item.get("id")
        if not isinstance(pid, str) or not pid:
            continue
        keys = [
            k
            for k in (item.get("labelKeys") or [])
            if isinstance(k, str) and k != "hwset-high-2-exponential-inequality-w12"
        ]
        if "exp_placeholder_archived" not in keys:
            keys.append("exp_placeholder_archived")
        set_resp = requests.put(
            f"{api_base}/homework/admin/problem-bank/problems/{pid}/labels",
            headers=_headers(token),
            json={"labelKeys": keys},
            timeout=20,
        )
        set_resp.raise_for_status()
        retagged += 1

    verify_resp = requests.get(
        f"{api_base}/homework/admin/problem-bank/problems",
        headers=_headers(token),
        params={
            "weekKey": WEEK_KEY,
            "labelKey": "hwset-high-2-exponential-inequality-w12",
            "limit": 500,
            "offset": 0,
        },
        timeout=30,
    )
    verify_resp.raise_for_status()
    verify_items = verify_resp.json().get("problems")
    if not isinstance(verify_items, list):
        verify_items = []
    placeholder_count = sum(
        1
        for p in verify_items
        if isinstance(p, dict) and _is_placeholder_options(p.get("options"))
    )

    print(f"old_placeholder_count={len(old_placeholders)}")
    print(f"retagged_placeholder_count={retagged}")
    print(f"final_exp_count={len(verify_items)}")
    print(f"final_exp_placeholder_count={placeholder_count}")


if __name__ == "__main__":
    main()
