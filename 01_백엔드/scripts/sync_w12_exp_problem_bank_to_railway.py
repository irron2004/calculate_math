from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any

import requests

API_BASE = "https://calculatemath-production.up.railway.app/api"
WEEK_KEY = "2026-W12"
DAY_KEYS = ["mon", "tue", "wed", "thu", "fri"]

LOCAL_DB = Path("backend/data/app.db")
TOKEN_FILES = [
    Path(".sisyphus/evidence/debug-login-calc-prod.json"),
    Path(".sisyphus/evidence/admin-password-reset-login.json"),
    Path(".sisyphus/evidence/admin-login.json"),
]

LABELS: list[tuple[str, str]] = [
    ("hwset-high-2-exponential-inequality-w12", "고2 지수부등식 - 2026 W12"),
    ("source-0363", "원본 0363"),
    ("source-0376", "원본 0376"),
    ("source-0373", "원본 0373"),
    ("source-0372", "원본 0372"),
    ("concept-exponential-substitute-range-root-count", "개념: 치환 후 범위/근개수/항상성립"),
    ("concept-exponential-inequality-given-solution", "개념: 해가 주어진 지수부등식"),
    ("concept-exponential-system-inequality-intersection", "개념: 연립부등식 교집합"),
    ("day-mon", "요일: 월"),
    ("day-tue", "요일: 화"),
    ("day-wed", "요일: 수"),
    ("day-thu", "요일: 목"),
    ("day-fri", "요일: 금"),
]


def _read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _get_refresh_token() -> str:
    for token_file in TOKEN_FILES:
        if not token_file.exists():
            continue
        obj = _read_json(token_file)
        token = obj.get("refreshToken")
        if isinstance(token, str) and token:
            return token
    raise RuntimeError("No refresh token file found")


def _get_access_token() -> str:
    refresh_token = _get_refresh_token()
    response = requests.post(
        f"{API_BASE}/auth/refresh",
        json={"refreshToken": refresh_token},
        timeout=20,
    )
    if response.status_code != 200:
        raise RuntimeError(f"refresh failed: {response.status_code} {response.text}")
    obj = response.json()
    token = obj.get("accessToken")
    if not isinstance(token, str) or not token:
        raise RuntimeError("refresh response missing accessToken")
    return token


def _headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _load_local_payload(day_key: str) -> dict[str, Any]:
    conn = sqlite3.connect(LOCAL_DB)
    conn.row_factory = sqlite3.Row
    try:
        batch = conn.execute(
            """
            SELECT id, title, description
            FROM homework_import_batches
            WHERE week_key = ? AND day_key = ?
            ORDER BY imported_at DESC
            LIMIT 1
            """,
            (WEEK_KEY, day_key),
        ).fetchone()
        if batch is None:
            raise RuntimeError(f"local batch not found: {WEEK_KEY}/{day_key}")

        rows = conn.execute(
            """
            SELECT order_index, type, question, options_json, answer
            FROM homework_problems
            WHERE batch_id = ?
            ORDER BY order_index ASC
            """,
            (batch["id"],),
        ).fetchall()
        problems: list[dict[str, Any]] = []
        for row in rows:
            options = json.loads(row["options_json"]) if row["options_json"] else None
            item: dict[str, Any] = {
                "type": row["type"],
                "question": row["question"],
            }
            if options is not None:
                item["options"] = options
            if row["answer"] is not None:
                item["answer"] = row["answer"]
            problems.append(item)

        return {
            "title": batch["title"],
            "description": batch["description"],
            "problems": problems,
        }
    finally:
        conn.close()


def _ensure_label(token: str, key: str, label: str) -> None:
    response = requests.get(
        f"{API_BASE}/homework/admin/problem-bank/labels",
        headers=_headers(token),
        timeout=20,
    )
    if response.status_code != 200:
        raise RuntimeError(f"label list failed: {response.status_code} {response.text}")
    labels = response.json().get("labels")
    if isinstance(labels, list):
        for item in labels:
            if isinstance(item, dict) and item.get("key") == key:
                return

    create_resp = requests.post(
        f"{API_BASE}/homework/admin/problem-bank/labels",
        headers=_headers(token),
        json={"key": key, "label": label, "kind": "custom"},
        timeout=20,
    )
    if create_resp.status_code != 200:
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


def _import_day(token: str, day_key: str, payload: dict[str, Any]) -> str:
    response = requests.post(
        f"{API_BASE}/homework/admin/problem-bank/import",
        headers=_headers(token),
        json={"weekKey": WEEK_KEY, "dayKey": day_key, "payload": payload},
        timeout=30,
    )
    if response.status_code != 200:
        raise RuntimeError(
            f"import {day_key} failed: {response.status_code} {response.text}"
        )
    obj = response.json()
    batch_id = obj.get("batchId")
    if not isinstance(batch_id, str) or not batch_id:
        raise RuntimeError(f"import {day_key} missing batchId")
    created = obj.get("createdProblemCount")
    skipped = obj.get("skippedProblemCount")
    print(f"{day_key}: batch={batch_id} created={created} skipped={skipped}")
    return batch_id


def _list_batch_problem_ids(token: str, day_key: str, batch_id: str) -> list[str]:
    response = requests.get(
        f"{API_BASE}/homework/admin/problem-bank/problems",
        headers=_headers(token),
        params={"weekKey": WEEK_KEY, "dayKey": day_key, "limit": 500, "offset": 0},
        timeout=30,
    )
    if response.status_code != 200:
        raise RuntimeError(
            f"problem list {day_key} failed: {response.status_code} {response.text}"
        )
    problems = response.json().get("problems")
    if not isinstance(problems, list):
        return []
    ids: list[str] = []
    for item in problems:
        if not isinstance(item, dict):
            continue
        if item.get("batchId") != batch_id:
            continue
        pid = item.get("id")
        if isinstance(pid, str) and pid:
            ids.append(pid)
    return ids


def _set_labels(token: str, problem_id: str, label_keys: list[str]) -> None:
    response = requests.put(
        f"{API_BASE}/homework/admin/problem-bank/problems/{problem_id}/labels",
        headers=_headers(token),
        json={"labelKeys": label_keys},
        timeout=20,
    )
    if response.status_code != 200:
        raise RuntimeError(
            f"set labels failed ({problem_id}): {response.status_code} {response.text}"
        )


def main() -> None:
    token = _get_access_token()
    for key, text in LABELS:
        _ensure_label(token, key, text)

    for day_key in DAY_KEYS:
        payload = _load_local_payload(day_key)
        batch_id = _import_day(token, day_key, payload)
        problem_ids = _list_batch_problem_ids(token, day_key, batch_id)
        if len(problem_ids) != 10:
            raise RuntimeError(
                f"unexpected problem count for {day_key}: {len(problem_ids)}"
            )
        for idx, problem_id in enumerate(problem_ids, start=1):
            _set_labels(token, problem_id, _label_keys_for_problem(day_key, idx))

    print("sync complete")


if __name__ == "__main__":
    main()
