#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
import random
import re
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import Any, Iterable, TypedDict, cast

import requests

DEFAULT_BASE_URL = os.getenv(
    "API_BASE_URL", "https://calculatemath-production.up.railway.app"
)
DEFAULT_ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
DEFAULT_ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "")


class ValidationError(Exception):
    pass


class LoginResponse(TypedDict):
    accessToken: str


class WrongProblemReview(TypedDict):
    needsRevision: bool
    comment: str


class WrongProblemItem(TypedDict, total=False):
    assignmentId: str
    assignmentTitle: str
    submissionId: str
    submittedAt: str
    reviewStatus: str
    problemId: str
    problemIndex: int
    type: str
    question: str
    options: list[str] | None
    correctAnswer: str | None
    studentAnswer: str | None
    review: WrongProblemReview


class WrongProblemListResponse(TypedDict):
    studentId: str
    wrongProblems: list[WrongProblemItem]


class ProblemPayload(TypedDict, total=False):
    type: str
    question: str
    options: list[str]
    answer: str


class HomeworkPayload(TypedDict, total=False):
    title: str
    description: str | None
    problems: list[ProblemPayload]


class ImportRequestBody(TypedDict):
    weekKey: str
    dayKey: str
    payload: HomeworkPayload


@dataclass
class ImportedBatch:
    week_key: str
    day_key: str
    batch_id: str


DAY_KEYS = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")
SIMPLE_EXPR_RE = re.compile(r"\b(\d+)\s*([+\-*/xX×])\s*(\d+)\b")


def _prompt(label: str, default: str | None = None) -> str:
    suffix = f" [{default}]" if default else ""
    return input(f"{label}{suffix}: ").strip() or (default or "")


def _normalize_api_base(base_url: str) -> str:
    normalized = base_url.strip().rstrip("/")
    if not normalized:
        raise ValidationError("base URL cannot be empty")
    if normalized.endswith("/api"):
        return normalized
    return f"{normalized}/api"


def _require_str(value: object, field_name: str) -> str:
    if not isinstance(value, str):
        raise ValidationError(f"{field_name} must be a string")
    return value


def _require_int(value: object, field_name: str) -> int:
    if not isinstance(value, int):
        raise ValidationError(f"{field_name} must be an int")
    return value


def _login(api_base: str, username: str, password: str) -> str:
    response = requests.post(
        f"{api_base}/auth/login",
        json={"username": username, "password": password},
        timeout=20,
    )
    if response.status_code != 200:
        raise ValidationError(f"login failed: {response.status_code} {response.text}")
    obj = cast(object, response.json())
    if not isinstance(obj, dict):
        raise ValidationError("login response must be a JSON object")
    token_obj = cast(dict[str, object], obj).get("accessToken")
    if not isinstance(token_obj, str) or not token_obj:
        raise ValidationError("login response missing accessToken")
    return token_obj


def _admin_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _derive_week_day_keys(tag_date: date) -> tuple[str, str]:
    iso_year, iso_week, iso_weekday = tag_date.isocalendar()
    week_key = f"{iso_year}-W{iso_week:02d}"
    day_key = DAY_KEYS[iso_weekday - 1]
    return week_key, day_key


def _fetch_wrong_problems(
    api_base: str, token: str, student_id: str
) -> list[WrongProblemItem]:
    response = requests.get(
        f"{api_base}/homework/admin/students/{student_id}/wrong-problems",
        params={"limit": 500, "offset": 0},
        headers=_admin_headers(token),
        timeout=30,
    )
    if response.status_code != 200:
        raise ValidationError(
            f"failed to fetch wrong problems: {response.status_code} {response.text}"
        )
    obj = cast(object, response.json())
    if not isinstance(obj, dict):
        raise ValidationError("wrong problems response must be a JSON object")
    data = cast(WrongProblemListResponse, obj)
    problems_obj = data.get("wrongProblems")
    if not isinstance(problems_obj, list):
        raise ValidationError("wrongProblems must be a list")
    return cast(list[WrongProblemItem], problems_obj)


def _shuffle_unique(options: Iterable[str], *, seed: int) -> list[str]:
    seen: set[str] = set()
    unique: list[str] = []
    for opt in options:
        t = str(opt)
        if t in seen:
            continue
        seen.add(t)
        unique.append(t)
    rng = random.Random(seed)
    rng.shuffle(unique)
    return unique


def _build_objective_options(correct: int, *, seed: int) -> list[str]:
    rng = random.Random(seed)
    candidates = {correct}
    deltas = [1, 2, 3, 5, 10, 20]
    while len(candidates) < 4:
        delta = rng.choice(deltas)
        sign = rng.choice([-1, 1])
        val = correct + sign * delta
        if val <= 0:
            continue
        candidates.add(val)
    return _shuffle_unique([str(v) for v in candidates], seed=seed)


def _try_parse_simple_expr(question: str) -> tuple[int, str, int] | None:
    match = SIMPLE_EXPR_RE.search(question)
    if not match:
        return None
    try:
        left = int(match.group(1))
        op = match.group(2)
        right = int(match.group(3))
    except ValueError:
        return None
    return left, op, right


def _eval_simple(left: int, op: str, right: int) -> int | None:
    if op == "+":
        return left + right
    if op == "-":
        return left - right
    if op in {"*", "x", "X", "×"}:
        return left * right
    return None


def _make_similar_problem_from(question: str, *, seed: int) -> ProblemPayload | None:
    parsed = _try_parse_simple_expr(question)
    if not parsed:
        return None
    left, op, right = parsed
    if op not in {"+", "-", "*", "x", "X", "×"}:
        return None
    rng = random.Random(seed)
    left2 = max(1, left + rng.choice([-3, -2, -1, 1, 2, 3]))
    right2 = max(1, right + rng.choice([-3, -2, -1, 1, 2, 3]))
    op2 = "*" if op in {"x", "X", "×"} else op
    correct = _eval_simple(left2, op2, right2)
    if correct is None:
        return None
    opts = _build_objective_options(correct, seed=seed)
    return {
        "type": "objective",
        "question": f"{left2} {op2} {right2} = ?",
        "options": opts,
        "answer": str(correct),
    }


def _make_distributive_problem(
    *, two_digit: int, multiplier: int, seed: int
) -> ProblemPayload:
    tens = (two_digit // 10) * 10
    ones = two_digit % 10
    correct = two_digit * multiplier
    options = _build_objective_options(correct, seed=seed)
    question = (
        "괄호를 써서 계산하세요: "
        f"{two_digit}*{multiplier} = ({tens}+{ones})*{multiplier} = "
        f"{tens}*{multiplier} + {ones}*{multiplier} = ?"
    )
    return {
        "type": "objective",
        "question": question,
        "options": options,
        "answer": str(correct),
    }


def _pick_distributive_numbers(*, count: int, seed: int) -> list[tuple[int, int]]:
    rng = random.Random(seed)
    picked: list[tuple[int, int]] = []
    attempts = 0
    while len(picked) < count and attempts < 2000:
        attempts += 1
        two_digit = rng.randint(12, 98)
        if two_digit % 10 == 0:
            continue
        multiplier = rng.randint(2, 9)
        picked.append((two_digit, multiplier))
    return picked


def _ensure_label(
    api_base: str,
    token: str,
    *,
    key: str,
    label: str,
) -> None:
    response = requests.get(
        f"{api_base}/homework/admin/problem-bank/labels",
        headers=_admin_headers(token),
        timeout=20,
    )
    if response.status_code != 200:
        raise ValidationError(
            f"failed to list labels: {response.status_code} {response.text}"
        )
    data = response.json()
    labels = data.get("labels")
    if isinstance(labels, list) and any(
        isinstance(l, dict) and l.get("key") == key for l in labels
    ):
        return

    create_resp = requests.post(
        f"{api_base}/homework/admin/problem-bank/labels",
        json={"key": key, "label": label, "kind": "custom"},
        headers=_admin_headers(token),
        timeout=20,
    )
    if create_resp.status_code != 200:
        raise ValidationError(
            f"failed to create label: {create_resp.status_code} {create_resp.text}"
        )


def _import_problem_bank(
    api_base: str,
    token: str,
    *,
    week_key: str,
    day_key: str,
    payload: HomeworkPayload,
) -> ImportedBatch:
    body: ImportRequestBody = {
        "weekKey": week_key,
        "dayKey": day_key,
        "payload": payload,
    }
    response = requests.post(
        f"{api_base}/homework/admin/problem-bank/import",
        json=body,
        headers=_admin_headers(token),
        timeout=30,
    )
    if response.status_code != 200:
        raise ValidationError(f"import failed: {response.status_code} {response.text}")
    obj = cast(object, response.json())
    if not isinstance(obj, dict):
        raise ValidationError("import response must be a JSON object")
    batch_id_obj = cast(dict[str, object], obj).get("batchId")
    batch_id = _require_str(batch_id_obj, "batchId")
    return ImportedBatch(week_key=week_key, day_key=day_key, batch_id=batch_id)


def _list_problem_bank_problem_ids_for_batch(
    api_base: str,
    token: str,
    *,
    week_key: str,
    day_key: str,
    batch_id: str,
) -> list[str]:
    response = requests.get(
        f"{api_base}/homework/admin/problem-bank/problems",
        params={"weekKey": week_key, "dayKey": day_key, "limit": 500, "offset": 0},
        headers=_admin_headers(token),
        timeout=30,
    )
    if response.status_code != 200:
        raise ValidationError(
            f"failed to list problems: {response.status_code} {response.text}"
        )
    obj = cast(object, response.json())
    if not isinstance(obj, dict):
        raise ValidationError("problem list response must be a JSON object")
    problems_obj = cast(dict[str, object], obj).get("problems")
    if not isinstance(problems_obj, list):
        raise ValidationError("problems must be a list")
    ids: list[str] = []
    for p in cast(list[object], problems_obj):
        if not isinstance(p, dict):
            continue
        if p.get("batchId") != batch_id:
            continue
        pid = p.get("id")
        if isinstance(pid, str) and pid:
            ids.append(pid)
    return ids


def _set_problem_labels(
    api_base: str,
    token: str,
    *,
    problem_id: str,
    label_keys: list[str],
) -> None:
    response = requests.put(
        f"{api_base}/homework/admin/problem-bank/problems/{problem_id}/labels",
        json={"labelKeys": label_keys},
        headers=_admin_headers(token),
        timeout=20,
    )
    if response.status_code != 200:
        raise ValidationError(
            f"failed to set labels for {problem_id}: {response.status_code} {response.text}"
        )


def _create_assignment_from_problem_ids(
    api_base: str,
    token: str,
    *,
    title: str,
    student_id: str,
    problem_ids: list[str],
    due_at: str | None,
) -> str:
    response = requests.post(
        f"{api_base}/homework/assignments",
        json={
            "title": title,
            "problemIds": problem_ids,
            "targetStudentIds": [student_id],
            "dueAt": due_at,
        },
        headers=_admin_headers(token),
        timeout=30,
    )
    if response.status_code != 200:
        raise ValidationError(
            f"failed to create assignment: {response.status_code} {response.text}"
        )
    obj = cast(object, response.json())
    if not isinstance(obj, dict):
        raise ValidationError("assignment response must be a JSON object")
    assignment_id = _require_str(cast(dict[str, object], obj).get("id"), "id")
    return assignment_id


def _iso_due_in_days(days: int) -> str:
    dt = datetime.now(timezone.utc) + timedelta(days=days)
    return dt.replace(microsecond=0).isoformat()


def _wrong_items_to_payload_items(
    wrongs: list[WrongProblemItem], *, max_count: int
) -> list[ProblemPayload]:
    result: list[ProblemPayload] = []
    for item in wrongs:
        if len(result) >= max_count:
            break
        ptype = item.get("type")
        question = item.get("question")
        if (
            not isinstance(ptype, str)
            or not isinstance(question, str)
            or not question.strip()
        ):
            continue

        if ptype == "objective":
            opts = item.get("options")
            ans = item.get("correctAnswer")
            if not isinstance(opts, list) or len(opts) < 2:
                continue
            if not isinstance(ans, str) or not ans.strip():
                continue
            if ans not in opts:
                opts = list(opts) + [ans]
            result.append(
                {
                    "type": "objective",
                    "question": question.strip(),
                    "options": cast(list[str], opts),
                    "answer": ans,
                }
            )
        else:
            result.append({"type": "subjective", "question": question.strip()})
    return result


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Create a tagged practice set from a student's wrong problems."
    )
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL, help="Service base URL")
    parser.add_argument(
        "--admin-user", default=DEFAULT_ADMIN_USERNAME, help="Admin username"
    )
    parser.add_argument(
        "--admin-pass", default=DEFAULT_ADMIN_PASSWORD, help="Admin password"
    )
    parser.add_argument("--student-id", required=True, help="Target student username")
    parser.add_argument(
        "--tag-date",
        default="2026-03-09",
        help="Tag date (YYYY-MM-DD); used to derive weekKey/dayKey",
    )
    parser.add_argument(
        "--tag-key",
        default="tag-2026-03-09-leejiyul",
        help="Problem-bank label key (ASCII recommended)",
    )
    parser.add_argument(
        "--tag-label",
        default="2026-03-09 이지율",
        help="Problem-bank label display name",
    )
    parser.add_argument(
        "--max-wrong", type=int, default=30, help="Max wrong problems to include"
    )
    parser.add_argument(
        "--similar", type=int, default=10, help="How many similar problems to generate"
    )
    parser.add_argument(
        "--distributive",
        type=int,
        default=10,
        help="How many distributive multiplication problems to generate",
    )
    parser.add_argument(
        "--due-days",
        type=int,
        default=7,
        help="Due date days from now (used when --create-assignment)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print plan only; do not call import/label/assignment APIs",
    )
    parser.add_argument(
        "--create-assignment",
        action="store_true",
        help="Create a new homework assignment from the imported problems",
    )
    args = parser.parse_args()
    args_map = cast(dict[str, object], vars(args))

    base_url = _require_str(args_map.get("base_url"), "base_url")
    admin_user = _require_str(args_map.get("admin_user"), "admin_user")
    admin_pass = _require_str(args_map.get("admin_pass"), "admin_pass")
    student_id = _require_str(args_map.get("student_id"), "student_id").strip()
    tag_key = _require_str(args_map.get("tag_key"), "tag_key").strip()
    tag_label = _require_str(args_map.get("tag_label"), "tag_label").strip()
    max_wrong = _require_int(args_map.get("max_wrong"), "max_wrong")
    similar_count = _require_int(args_map.get("similar"), "similar")
    distributive_count = _require_int(args_map.get("distributive"), "distributive")
    due_days = _require_int(args_map.get("due_days"), "due_days")
    dry_run = bool(args_map.get("dry_run"))
    create_assignment = bool(args_map.get("create_assignment"))

    tag_date_raw = _require_str(args_map.get("tag_date"), "tag_date").strip()
    try:
        tag_date = date.fromisoformat(tag_date_raw)
    except ValueError as exc:
        raise ValidationError("tag-date must be YYYY-MM-DD") from exc

    api_base = _normalize_api_base(base_url)
    password = admin_pass or _prompt("Admin password")
    token = _login(api_base, admin_user, password)

    wrongs = _fetch_wrong_problems(api_base, token, student_id)
    wrong_payload_items = _wrong_items_to_payload_items(wrongs, max_count=max_wrong)

    seed = int(datetime.now(timezone.utc).timestamp())
    similar_payload_items: list[ProblemPayload] = []
    for idx, item in enumerate(wrongs, start=1):
        if len(similar_payload_items) >= max(0, similar_count):
            break
        q = item.get("question")
        if not isinstance(q, str):
            continue
        maybe = _make_similar_problem_from(q, seed=seed + idx)
        if maybe is not None:
            similar_payload_items.append(maybe)

    distributive_payload_items: list[ProblemPayload] = []
    pairs = _pick_distributive_numbers(count=max(0, distributive_count), seed=seed)
    for idx, (two_digit, mul) in enumerate(pairs, start=1):
        distributive_payload_items.append(
            _make_distributive_problem(
                two_digit=two_digit, multiplier=mul, seed=seed + 1000 + idx
            )
        )

    week_key, day_key = _derive_week_day_keys(tag_date)
    title = f"오답+괄호 연습 ({student_id}) {tag_date.isoformat()}"
    description = (
        f"tag: {tag_label} ({tag_key})\n"
        f"wrong: {len(wrong_payload_items)}\n"
        f"similar: {len(similar_payload_items)}\n"
        f"distributive: {len(distributive_payload_items)}\n"
    )
    payload: HomeworkPayload = {
        "title": title,
        "description": description,
        "problems": [
            *wrong_payload_items,
            *similar_payload_items,
            *distributive_payload_items,
        ],
    }

    print("\nPlan")
    print(f"- apiBase: {api_base}")
    print(f"- studentId: {student_id}")
    print(
        f"- wrongProblems: {len(wrongs)} (using {len(wrong_payload_items)} in payload)"
    )
    print(f"- weekKey/dayKey: {week_key}/{day_key}")
    print(f"- label: {tag_label} ({tag_key})")
    print(f"- totalProblemsToImport: {len(payload['problems'])}")

    if dry_run:
        print("\nDry-run enabled; no writes performed.")
        return

    if not payload["problems"]:
        raise ValidationError("No problems to import")

    _ensure_label(api_base, token, key=tag_key, label=tag_label)
    imported = _import_problem_bank(
        api_base, token, week_key=week_key, day_key=day_key, payload=payload
    )
    problem_ids = _list_problem_bank_problem_ids_for_batch(
        api_base, token, week_key=week_key, day_key=day_key, batch_id=imported.batch_id
    )
    if not problem_ids:
        raise ValidationError("Import succeeded but no problem ids found for the batch")

    for pid in problem_ids:
        _set_problem_labels(api_base, token, problem_id=pid, label_keys=[tag_key])

    print("\nResult")
    print(f"- batchId: {imported.batch_id}")
    print(f"- labeledProblems: {len(problem_ids)}")

    if create_assignment:
        due_at = _iso_due_in_days(due_days)
        assignment_title = f"{tag_label} 오답+괄호 연습"
        assignment_id = _create_assignment_from_problem_ids(
            api_base,
            token,
            title=assignment_title,
            student_id=student_id,
            problem_ids=problem_ids,
            due_at=due_at,
        )
        print(f"- assignmentId: {assignment_id}")


if __name__ == "__main__":
    try:
        main()
    except ValidationError as exc:
        raise SystemExit(f"error: {exc}")
