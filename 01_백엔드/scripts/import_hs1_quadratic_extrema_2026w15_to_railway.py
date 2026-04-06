#!/usr/bin/env python3
from __future__ import annotations

import argparse
from typing import Any

import requests

API_BASE_DEFAULT = "https://calculatemath-production.up.railway.app/api"
WEEK_KEY_DEFAULT = "2026-W15"
DAY_ORDER = ["mon", "tue", "wed", "thu", "fri"]
DAY_KO = {
    "mon": "월",
    "tue": "화",
    "wed": "수",
    "thu": "목",
    "fri": "금",
}

COMMON_LABELS: list[tuple[str, str]] = [
    ("hs1_quad_extrema_2026w15", "고1-이차함수최대최소-주간75제-2026W15"),
    ("hs1_quadratic_extrema", "고1-이차함수의최대최소"),
    ("hs1_abs_quadratic_extrema", "고1-절댓값이차식의최대최소"),
    ("format_mcq_5", "객관식-5지선다"),
    ("source_slack_2026_04_06", "원본-Slack-2026-04-06"),
    ("day-mon", "요일: 월"),
    ("day-tue", "요일: 화"),
    ("day-wed", "요일: 수"),
    ("day-thu", "요일: 목"),
    ("day-fri", "요일: 금"),
]

DAY_DATA: dict[str, list[dict[str, Any]]] = {
    "mon": [
        {"question": "이차함수 y=x^2-4x+7의 최솟값은?", "options": ["1", "2", "3", "4", "5"], "answer": "3", "topic": "quad"},
        {"question": "이차함수 y=-2x^2+8x-1의 최댓값은?", "options": ["4", "5", "6", "7", "8"], "answer": "7", "topic": "quad"},
        {"question": "이차함수 y=2x^2+12x+5의 최솟값은?", "options": ["-13", "-11", "-9", "9", "13"], "answer": "-13", "topic": "quad"},
        {"question": "이차함수 y=-x^2-6x+4의 최댓값은?", "options": ["10", "11", "12", "13", "14"], "answer": "13", "topic": "quad"},
        {"question": "이차함수 y=x^2-2x+3가 -1≤x≤4에서 가질 때, 최댓값은?", "options": ["8", "9", "10", "11", "12"], "answer": "11", "topic": "quad"},
        {"question": "이차함수 y=-x^2+4x-1이 0≤x≤5에서 가질 때, 최솟값은?", "options": ["-8", "-7", "-6", "-5", "-4"], "answer": "-6", "topic": "quad"},
        {"question": "함수 y=|x^2-4x+3|가 0≤x≤4에서 가질 때, 최댓값은?", "options": ["1", "2", "3", "4", "5"], "answer": "3", "topic": "abs"},
        {"question": "함수 y=|x^2-4x+3|가 0≤x≤4에서 가질 때, 최솟값은?", "options": ["0", "1", "2", "3", "4"], "answer": "0", "topic": "abs"},
        {"question": "함수 y=|x^2-2x-3|가 -1≤x≤4에서 가질 때, 최댓값은?", "options": ["1", "2", "3", "4", "5"], "answer": "5", "topic": "abs"},
        {"question": "함수 y=|-x^2+4x-3|가 0≤x≤4에서 가질 때, 최솟값은?", "options": ["0", "1", "2", "3", "4"], "answer": "0", "topic": "abs"},
        {"question": "함수 y=|x^2-4x+1|가 0≤x≤5에서 가질 때, 최댓값은?", "options": ["4", "5", "6", "7", "8"], "answer": "6", "topic": "abs"},
        {"question": "함수 y=|x^2+2x-8|가 -4≤x≤2에서 가질 때, 최솟값은?", "options": ["0", "1", "2", "3", "4"], "answer": "0", "topic": "abs"},
        {"question": "이차함수 y=x^2+2x-8이 -3≤x≤1에서 가질 때, 최댓값은?", "options": ["-7", "-6", "-5", "-4", "-3"], "answer": "-5", "topic": "quad"},
        {"question": "함수 y=|x^2-1|가 -2≤x≤2에서 가질 때, 최댓값은?", "options": ["1", "2", "3", "4", "5"], "answer": "3", "topic": "abs"},
        {"question": "함수 y=|-x^2+2x+3|가 -1≤x≤4에서 가질 때, 최솟값은?", "options": ["0", "1", "2", "3", "4"], "answer": "0", "topic": "abs"},
    ],
    "tue": [
        {"question": "이차함수 y=3x^2-12x+14의 최솟값은?", "options": ["1", "2", "3", "4", "5"], "answer": "2", "topic": "quad"},
        {"question": "이차함수 y=-x^2+2x+8의 최댓값은?", "options": ["5", "6", "7", "8", "9"], "answer": "9", "topic": "quad"},
        {"question": "이차함수 y=2(x+1)^2-5의 최솟값은?", "options": ["-7", "-5", "-3", "3", "5"], "answer": "-5", "topic": "quad"},
        {"question": "이차함수 y=-(x-4)^2+6의 최댓값은?", "options": ["4", "5", "6", "7", "8"], "answer": "6", "topic": "quad"},
        {"question": "이차함수 y=x^2+4x+1이 -3≤x≤2에서 가질 때, 최댓값은?", "options": ["10", "11", "12", "13", "14"], "answer": "13", "topic": "quad"},
        {"question": "이차함수 y=-2x^2+8x-5가 0≤x≤4에서 가질 때, 최솟값은?", "options": ["-6", "-5", "-4", "-3", "-2"], "answer": "-5", "topic": "quad"},
        {"question": "함수 y=|x^2-5x+4|가 0≤x≤5에서 가질 때, 최솟값은?", "options": ["0", "1", "2", "3", "4"], "answer": "0", "topic": "abs"},
        {"question": "함수 y=|x^2-5x+4|가 0≤x≤5에서 가질 때, 최댓값은?", "options": ["1", "2", "3", "4", "5"], "answer": "4", "topic": "abs"},
        {"question": "함수 y=|x^2+4x+3|가 -5≤x≤1에서 가질 때, 최댓값은?", "options": ["5", "6", "7", "8", "9"], "answer": "8", "topic": "abs"},
        {"question": "함수 y=|x^2+4x+3|가 -5≤x≤1에서 가질 때, 최솟값은?", "options": ["0", "1", "2", "3", "4"], "answer": "0", "topic": "abs"},
        {"question": "함수 y=|-x^2+6x-8|가 1≤x≤5에서 가질 때, 최댓값은?", "options": ["1", "2", "3", "4", "5"], "answer": "3", "topic": "abs"},
        {"question": "함수 y=|2x^2-8x+5|가 0≤x≤4에서 가질 때, 최솟값은?", "options": ["0", "1", "2", "3", "4"], "answer": "0", "topic": "abs"},
        {"question": "이차함수 y=2x^2-8x+5가 0≤x≤4에서 가질 때, 최댓값은?", "options": ["3", "4", "5", "6", "7"], "answer": "5", "topic": "quad"},
        {"question": "함수 y=|x^2-4|가 -3≤x≤1에서 가질 때, 최댓값은?", "options": ["4", "5", "6", "7", "8"], "answer": "5", "topic": "abs"},
        {"question": "함수 y=|x^2-6x+5|가 2≤x≤6에서 가질 때, 최댓값은?", "options": ["1", "3", "5", "7", "9"], "answer": "5", "topic": "abs"},
    ],
    "wed": [
        {"question": "이차함수 y=x^2-8x+20의 최솟값은?", "options": ["1", "2", "3", "4", "5"], "answer": "4", "topic": "quad"},
        {"question": "이차함수 y=-x^2+6x-10의 최댓값은?", "options": ["-3", "-2", "-1", "0", "1"], "answer": "-1", "topic": "quad"},
        {"question": "이차함수 y=-3(x-2)^2+5의 최댓값은?", "options": ["2", "3", "4", "5", "6"], "answer": "5", "topic": "quad"},
        {"question": "이차함수 y=(x+3)^2+4의 최솟값은?", "options": ["1", "2", "3", "4", "5"], "answer": "4", "topic": "quad"},
        {"question": "이차함수 y=x^2-x-2가 -2≤x≤3에서 가질 때, 최솟값은?", "options": ["-11/4", "-9/4", "-7/4", "-5/4", "-3/4"], "answer": "-9/4", "topic": "quad"},
        {"question": "이차함수 y=-x^2+4x-2가 1≤x≤4에서 가질 때, 최솟값은?", "options": ["-4", "-3", "-2", "-1", "0"], "answer": "-2", "topic": "quad"},
        {"question": "함수 y=|x^2-6x+8|가 0≤x≤6에서 가질 때, 최솟값은?", "options": ["0", "1", "2", "3", "4"], "answer": "0", "topic": "abs"},
        {"question": "함수 y=|x^2-6x+8|가 0≤x≤6에서 가질 때, 최댓값은?", "options": ["5", "6", "7", "8", "9"], "answer": "8", "topic": "abs"},
        {"question": "함수 y=|x^2-2x-8|가 -2≤x≤4에서 가질 때, 최댓값은?", "options": ["5", "6", "7", "8", "9"], "answer": "8", "topic": "abs"},
        {"question": "함수 y=|x^2-2x-8|가 -2≤x≤4에서 가질 때, 최솟값은?", "options": ["0", "1", "2", "3", "4"], "answer": "0", "topic": "abs"},
        {"question": "함수 y=|x^2-4x+2|가 0≤x≤4에서 가질 때, 최댓값과 최솟값의 합은?", "options": ["1", "2", "3", "4", "5"], "answer": "2", "topic": "abs"},
        {"question": "함수 y=|x^2+2x-3|가 -4≤x≤2에서 가질 때, 최댓값은?", "options": ["1", "2", "3", "4", "5"], "answer": "5", "topic": "abs"},
        {"question": "함수 y=|2x^2+4x-6|가 -3≤x≤2에서 가질 때, 최솟값은?", "options": ["0", "1", "2", "3", "4"], "answer": "0", "topic": "abs"},
        {"question": "이차함수 y=x^2+6x+5가 -5≤x≤0에서 가질 때, 최댓값은?", "options": ["1", "2", "3", "4", "5"], "answer": "5", "topic": "quad"},
        {"question": "함수 y=|-x^2-2x+8|가 -4≤x≤2에서 가질 때, 최댓값은?", "options": ["5", "6", "7", "8", "9"], "answer": "9", "topic": "abs"},
    ],
    "thu": [
        {"question": "이차함수 y=2x^2-4x+7의 최솟값은?", "options": ["3", "4", "5", "6", "7"], "answer": "5", "topic": "quad"},
        {"question": "이차함수 y=-x^2-2x+3의 최댓값은?", "options": ["1", "2", "3", "4", "5"], "answer": "4", "topic": "quad"},
        {"question": "이차함수 y=5(x+2)^2-7의 최솟값은?", "options": ["-9", "-8", "-7", "-6", "-5"], "answer": "-7", "topic": "quad"},
        {"question": "이차함수 y=-(1/2)(x-6)^2+4의 최댓값은?", "options": ["2", "3", "4", "5", "6"], "answer": "4", "topic": "quad"},
        {"question": "이차함수 y=x^2+x-2의 최솟값은?", "options": ["-11/4", "-9/4", "-7/4", "-5/4", "-3/4"], "answer": "-9/4", "topic": "quad"},
        {"question": "이차함수 y=x^2-4x+6이 -1≤x≤2에서 가질 때, 최댓값은?", "options": ["8", "9", "10", "11", "12"], "answer": "12", "topic": "quad"},
        {"question": "이차함수 y=-2x^2+4x+1이 0≤x≤3에서 가질 때, 최솟값은?", "options": ["-7", "-6", "-5", "-4", "-3"], "answer": "-5", "topic": "quad"},
        {"question": "함수 y=|x^2-4x+5|가 0≤x≤4에서 가질 때, 최솟값은?", "options": ["0", "1", "2", "3", "4"], "answer": "1", "topic": "abs"},
        {"question": "함수 y=|x^2-4x+5|가 0≤x≤4에서 가질 때, 최댓값은?", "options": ["1", "2", "3", "4", "5"], "answer": "5", "topic": "abs"},
        {"question": "함수 y=|x^2-4x+1|가 1≤x≤4에서 가질 때, 최댓값은?", "options": ["1", "2", "3", "4", "5"], "answer": "3", "topic": "abs"},
        {"question": "함수 y=|x^2-4x+1|가 1≤x≤4에서 가질 때, 최솟값은?", "options": ["0", "1", "2", "3", "4"], "answer": "0", "topic": "abs"},
        {"question": "함수 y=|x^2+6x+10|가 -4≤x≤1에서 가질 때, 최솟값은?", "options": ["0", "1", "2", "3", "4"], "answer": "1", "topic": "abs"},
        {"question": "함수 y=|x^2+6x+10|가 -4≤x≤1에서 가질 때, 최댓값은?", "options": ["13", "14", "15", "16", "17"], "answer": "17", "topic": "abs"},
        {"question": "함수 y=|-x^2+2x+8|가 -1≤x≤5에서 가질 때, 최댓값은?", "options": ["5", "6", "7", "8", "9"], "answer": "9", "topic": "abs"},
        {"question": "함수 y=|-x^2+2x+8|가 -1≤x≤5에서 가질 때, 최솟값은?", "options": ["0", "1", "2", "3", "4"], "answer": "0", "topic": "abs"},
    ],
    "fri": [
        {"question": "이차함수 y=x^2+8x+13의 최솟값은?", "options": ["-5", "-4", "-3", "-2", "-1"], "answer": "-3", "topic": "quad"},
        {"question": "이차함수 y=-2x^2+12x-10의 최댓값은?", "options": ["5", "6", "7", "8", "9"], "answer": "8", "topic": "quad"},
        {"question": "이차함수 y=5x^2-10x+6의 최솟값은?", "options": ["0", "1", "2", "3", "4"], "answer": "1", "topic": "quad"},
        {"question": "이차함수 y=-(x-1)^2+2의 최댓값은?", "options": ["0", "1", "2", "3", "4"], "answer": "2", "topic": "quad"},
        {"question": "이차함수 y=x^2+2x-3이 -3≤x≤1에서 가질 때, 최댓값은?", "options": ["-2", "-1", "0", "1", "2"], "answer": "0", "topic": "quad"},
        {"question": "이차함수 y=-x^2+6x-5가 1≤x≤5에서 가질 때, 최솟값은?", "options": ["0", "1", "2", "3", "4"], "answer": "0", "topic": "quad"},
        {"question": "함수 y=|x^2-3x-4|가 -1≤x≤4에서 가질 때, 최솟값은?", "options": ["0", "1", "2", "3", "4"], "answer": "0", "topic": "abs"},
        {"question": "함수 y=|x^2-3x-4|가 -1≤x≤4에서 가질 때, 최댓값은?", "options": ["9/4", "4", "5", "25/4", "7"], "answer": "25/4", "topic": "abs"},
        {"question": "함수 y=|x^2-2x+2|가 -2≤x≤3에서 가질 때, 최솟값은?", "options": ["0", "1", "2", "3", "4"], "answer": "1", "topic": "abs"},
        {"question": "함수 y=|x^2-2x+2|가 -2≤x≤3에서 가질 때, 최댓값은?", "options": ["6", "7", "8", "9", "10"], "answer": "8", "topic": "abs"},
        {"question": "함수 y=|-x^2+4x-1|가 0≤x≤4에서 가질 때, 최댓값은?", "options": ["1", "2", "3", "4", "5"], "answer": "3", "topic": "abs"},
        {"question": "함수 y=|x^2-4x+3|가 0≤x≤4에서 가질 때, 최댓값과 최솟값의 곱은?", "options": ["0", "1", "2", "3", "4"], "answer": "0", "topic": "abs"},
        {"question": "함수 y=|x^2+2x-8|가 -2≤x≤3에서 가질 때, 최댓값과 최솟값의 차는?", "options": ["5", "6", "7", "8", "9"], "answer": "8", "topic": "abs"},
        {"question": "함수 y=|2x^2+8x+5|가 -3≤x≤1에서 가질 때, 최댓값은?", "options": ["11", "12", "13", "14", "15"], "answer": "15", "topic": "abs"},
        {"question": "함수 y=|2x^2+8x+5|가 -3≤x≤1에서 가질 때, 최솟값은?", "options": ["0", "1", "2", "3", "4"], "answer": "0", "topic": "abs"},
    ],
}


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


def _problem_label_keys(day_key: str, topic: str) -> list[str]:
    keys = [
        "hs1_quad_extrema_2026w15",
        f"day-{day_key}",
        "format_mcq_5",
        "source_slack_2026_04_06",
    ]
    if topic == "quad":
        keys.append("hs1_quadratic_extrema")
    else:
        keys.append("hs1_abs_quadratic_extrema")
    return keys


def _payload_for_day(day_key: str) -> dict[str, Any]:
    problems = []
    for item in DAY_DATA[day_key]:
        problems.append(
            {
                "type": "objective",
                "question": item["question"],
                "options": item["options"],
                "answer": item["answer"],
            }
        )
    return {
        "title": f"4/{6 + DAY_ORDER.index(day_key)}({DAY_KO[day_key]}) 이차함수 최대·최소 / |2차식| 최대·최소 15제",
        "description": "Slack 합의본 기반 업로드. 객관식 5지선다, 15문항.",
        "problems": problems,
    }


def _import_day(api_base: str, token: str, week_key: str, day_key: str) -> str:
    payload = _payload_for_day(day_key)
    response = requests.post(
        f"{api_base}/homework/admin/problem-bank/import",
        headers=_headers(token),
        json={"weekKey": week_key, "dayKey": day_key, "payload": payload},
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
    print(
        f"{day_key}: batch={batch_id} created={obj.get('createdProblemCount')} skipped={obj.get('skippedProblemCount')}"
    )
    return batch_id


def _list_problem_ids(api_base: str, token: str, week_key: str, day_key: str, batch_id: str) -> list[str]:
    response = requests.get(
        f"{api_base}/homework/admin/problem-bank/problems",
        headers=_headers(token),
        params={"weekKey": week_key, "dayKey": day_key, "limit": 500, "offset": 0},
        timeout=30,
    )
    response.raise_for_status()
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


def _set_problem_labels(api_base: str, token: str, problem_id: str, label_keys: list[str]) -> None:
    response = requests.put(
        f"{api_base}/homework/admin/problem-bank/problems/{problem_id}/labels",
        headers=_headers(token),
        json={"labelKeys": label_keys},
        timeout=20,
    )
    response.raise_for_status()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Import the validated 2026-W15 quadratic-extrema 5-day set into Railway problem bank."
    )
    parser.add_argument("--api-base", default=API_BASE_DEFAULT)
    parser.add_argument("--admin-user", default="admin")
    parser.add_argument("--admin-pass", required=True)
    parser.add_argument("--week-key", default=WEEK_KEY_DEFAULT)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    if args.dry_run:
        for day_key in DAY_ORDER:
            payload = _payload_for_day(day_key)
            print(
                {
                    "dayKey": day_key,
                    "title": payload["title"],
                    "problemCount": len(payload["problems"]),
                    "firstQuestion": payload["problems"][0]["question"],
                }
            )
        return

    api_base = args.api_base.rstrip("/")
    token = _login(api_base, args.admin_user, args.admin_pass)

    for key, label in COMMON_LABELS:
        _ensure_label(api_base, token, key, label)

    for day_key in DAY_ORDER:
        batch_id = _import_day(api_base, token, args.week_key, day_key)
        problem_ids = _list_problem_ids(api_base, token, args.week_key, day_key, batch_id)
        expected_count = len(DAY_DATA[day_key])
        if len(problem_ids) != expected_count:
            raise RuntimeError(
                f"{day_key}: expected {expected_count} imported problems, got {len(problem_ids)}"
            )

        for order_index, problem_id in enumerate(problem_ids, start=1):
            topic = str(DAY_DATA[day_key][order_index - 1]["topic"])
            _set_problem_labels(
                api_base,
                token,
                problem_id,
                _problem_label_keys(day_key, topic),
            )

        print(f"{day_key}: labels applied to {len(problem_ids)} problems")

    print("done")


if __name__ == "__main__":
    main()
