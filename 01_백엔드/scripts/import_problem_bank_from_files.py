#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import TypedDict, cast

import requests

DEFAULT_BASE_URL = os.getenv(
    "API_BASE_URL", "https://calculatemath-production.up.railway.app"
)
DEFAULT_ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
DEFAULT_ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "")

DAY_KEYS = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")
FILENAME_RE = re.compile(r"^homework_(\d{4}-\d{2}-\d{2})\.json$")
REQUIRED_TOP_LEVEL_KEYS = ("title", "description", "problems")


class ProblemPayload(TypedDict, total=False):
    type: str
    question: str
    options: list[str]
    answer: str


class HomeworkPayload(TypedDict):
    title: str
    description: str | None
    problems: list[ProblemPayload]


class ImportRequestBody(TypedDict):
    weekKey: str
    dayKey: str
    payload: HomeworkPayload


class LoginResponse(TypedDict):
    accessToken: str


class ImportResponse(TypedDict, total=False):
    batchId: str
    createdProblemCount: int
    skippedProblemCount: int


class ValidationError(Exception):
    pass


def _require_str(value: object, field_name: str) -> str:
    if not isinstance(value, str):
        raise ValidationError(f"{field_name} must be a string")
    return value


def _require_bool(value: object, field_name: str) -> bool:
    if not isinstance(value, bool):
        raise ValidationError(f"{field_name} must be a boolean")
    return value


def _require_list_of_str(value: object, field_name: str) -> list[str]:
    if not isinstance(value, list):
        raise ValidationError(f"{field_name} must be a list")
    list_obj = cast(list[object], value)
    for idx, item in enumerate(list_obj, start=1):
        if not isinstance(item, str):
            raise ValidationError(f"{field_name}[{idx}] must be a string")
    return cast(list[str], list_obj)


@dataclass
class Row:
    file: str
    date: str
    week_key: str
    day_key: str
    problem_count: str
    batch: str
    created: str
    skipped: str
    result: str


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


def _extract_date_from_filename(path: Path) -> date:
    match = FILENAME_RE.match(path.name)
    if not match:
        raise ValidationError("filename must match homework_YYYY-MM-DD.json")
    try:
        return date.fromisoformat(match.group(1))
    except ValueError as exc:
        raise ValidationError("filename date is not a valid calendar date") from exc


def _derive_week_day_keys(assigned_date: date) -> tuple[str, str]:
    iso_year, iso_week, iso_weekday = assigned_date.isocalendar()
    week_key = f"{iso_year}-W{iso_week:02d}"
    day_key = DAY_KEYS[iso_weekday - 1]
    return week_key, day_key


def _load_payload(path: Path) -> HomeworkPayload:
    try:
        with path.open("r", encoding="utf-8") as handle:
            data_obj = cast(object, json.load(handle))
    except FileNotFoundError as exc:
        raise ValidationError("file not found") from exc
    except json.JSONDecodeError as exc:
        raise ValidationError(
            f"invalid JSON: line {exc.lineno} column {exc.colno}"
        ) from exc

    if not isinstance(data_obj, dict):
        raise ValidationError("top-level JSON must be an object")
    data = cast(dict[str, object], data_obj)

    for key in REQUIRED_TOP_LEVEL_KEYS:
        if key not in data:
            raise ValidationError(f"missing top-level key: {key}")

    problems_obj = data["problems"]
    if not isinstance(problems_obj, list):
        raise ValidationError("problems must be a list")
    problems = cast(list[object], problems_obj)
    if not problems:
        raise ValidationError("problems must be non-empty")

    title = _require_str(data["title"], "title")

    description_obj = data["description"]
    if description_obj is not None and not isinstance(description_obj, str):
        raise ValidationError("description must be a string or null")

    for idx, problem_obj in enumerate(problems, start=1):
        if not isinstance(problem_obj, dict):
            raise ValidationError(f"problem[{idx}] must be an object")

    return {
        "title": title,
        "description": description_obj,
        "problems": cast(list[ProblemPayload], problems),
    }


def _build_import_payload(path: Path) -> tuple[ImportRequestBody, date, str, str, int]:
    assigned_date = _extract_date_from_filename(path)
    payload = _load_payload(path)
    week_key, day_key = _derive_week_day_keys(assigned_date)
    problems = payload["problems"]
    body: ImportRequestBody = {
        "weekKey": week_key,
        "dayKey": day_key,
        "payload": payload,
    }
    return body, assigned_date, week_key, day_key, len(problems)


def _login(api_base: str, username: str, password: str) -> str:
    response = requests.post(
        f"{api_base}/auth/login",
        json={"username": username, "password": password},
        timeout=20,
    )
    if response.status_code != 200:
        raise ValidationError(f"login failed: {response.status_code} {response.text}")

    response_obj = cast(object, response.json())
    if not isinstance(response_obj, dict):
        raise ValidationError("login response must be a JSON object")
    response_data = cast(dict[str, object], response_obj)
    token_obj = response_data.get("accessToken")
    if not isinstance(token_obj, str) or not token_obj:
        raise ValidationError("login response missing accessToken")
    return token_obj


def _import_single(
    api_base: str, token: str, body: ImportRequestBody
) -> ImportResponse:
    response = requests.post(
        f"{api_base}/homework/admin/problem-bank/import",
        json=body,
        headers={"Authorization": f"Bearer {token}"},
        timeout=30,
    )
    if response.status_code != 200:
        raise ValidationError(f"import failed: {response.status_code} {response.text}")
    response_obj = cast(object, response.json())
    if not isinstance(response_obj, dict):
        raise ValidationError("import response must be a JSON object")
    response_data = cast(dict[str, object], response_obj)
    result: ImportResponse = {}
    batch_obj = response_data.get("batchId")
    if isinstance(batch_obj, str):
        result["batchId"] = batch_obj
    created_obj = response_data.get("createdProblemCount")
    if isinstance(created_obj, int):
        result["createdProblemCount"] = created_obj
    skipped_obj = response_data.get("skippedProblemCount")
    if isinstance(skipped_obj, int):
        result["skippedProblemCount"] = skipped_obj
    return result


def _print_rows(rows: list[Row]) -> None:
    headers = [
        "file",
        "date",
        "weekKey",
        "dayKey",
        "problemCount",
        "batch",
        "created",
        "skipped",
        "result",
    ]
    matrix: list[list[str]] = [headers]
    for row in rows:
        matrix.append(
            [
                row.file,
                row.date,
                row.week_key,
                row.day_key,
                row.problem_count,
                row.batch,
                row.created,
                row.skipped,
                row.result,
            ]
        )

    widths = [max(len(r[i]) for r in matrix) for i in range(len(headers))]
    for idx, line in enumerate(matrix):
        print("  ".join(cell.ljust(widths[i]) for i, cell in enumerate(line)))
        if idx == 0:
            print("  ".join("-" * widths[i] for i in range(len(headers))))


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Import problem-bank payloads from homework_YYYY-MM-DD.json files."
    )
    _ = parser.add_argument("files", nargs="+", help="JSON files to import")
    _ = parser.add_argument(
        "--base-url", default=DEFAULT_BASE_URL, help="Service base URL"
    )
    _ = parser.add_argument(
        "--admin-user", default=DEFAULT_ADMIN_USERNAME, help="Admin username"
    )
    _ = parser.add_argument(
        "--admin-pass", default=DEFAULT_ADMIN_PASSWORD, help="Admin password"
    )
    _ = parser.add_argument(
        "--dry-run", action="store_true", help="Validate and print metadata only"
    )
    args = parser.parse_args()
    args_map = cast(dict[str, object], vars(args))
    files = _require_list_of_str(args_map.get("files"), "files")
    base_url = _require_str(args_map.get("base_url"), "base_url")
    admin_user = _require_str(args_map.get("admin_user"), "admin_user")
    admin_pass = _require_str(args_map.get("admin_pass"), "admin_pass")
    dry_run = _require_bool(args_map.get("dry_run"), "dry_run")

    api_base = _normalize_api_base(base_url)
    rows: list[Row] = []
    prepared: list[
        tuple[Path, ImportRequestBody | None, date | None, str, str, int, str | None]
    ] = []
    for raw_file in files:
        path = Path(raw_file)
        try:
            body, assigned_date, week_key, day_key, problem_count = (
                _build_import_payload(path)
            )
        except ValidationError as exc:
            prepared.append((path, None, None, "-", "-", 0, f"error: {exc}"))
            continue
        prepared.append(
            (path, body, assigned_date, week_key, day_key, problem_count, None)
        )

    if dry_run:
        for (
            path,
            _body,
            assigned_date,
            week_key,
            day_key,
            problem_count,
            error,
        ) in prepared:
            if error:
                rows.append(
                    Row(
                        file=path.name,
                        date="-",
                        week_key="-",
                        day_key="-",
                        problem_count="-",
                        batch="-",
                        created="-",
                        skipped="-",
                        result=error,
                    )
                )
                continue
            rows.append(
                Row(
                    file=path.name,
                    date=assigned_date.isoformat() if assigned_date else "-",
                    week_key=week_key,
                    day_key=day_key,
                    problem_count=str(problem_count),
                    batch="-",
                    created="-",
                    skipped="-",
                    result="dry-run",
                )
            )
        _print_rows(rows)
        return

    password = admin_pass or _prompt("Admin password")
    token = _login(api_base, admin_user, password)

    for path, body, assigned_date, week_key, day_key, problem_count, error in prepared:
        if error:
            rows.append(
                Row(
                    file=path.name,
                    date="-",
                    week_key="-",
                    day_key="-",
                    problem_count="-",
                    batch="-",
                    created="-",
                    skipped="-",
                    result=error,
                )
            )
            continue
        try:
            if body is None or assigned_date is None:
                raise ValidationError("internal error: missing parsed payload")
            response_data = _import_single(api_base, token, body)
            rows.append(
                Row(
                    file=path.name,
                    date=assigned_date.isoformat(),
                    week_key=week_key,
                    day_key=day_key,
                    problem_count=str(problem_count),
                    batch=str(response_data.get("batchId", "-")),
                    created=str(response_data.get("createdProblemCount", "-")),
                    skipped=str(response_data.get("skippedProblemCount", "-")),
                    result="ok",
                )
            )
        except ValidationError as exc:
            rows.append(
                Row(
                    file=path.name,
                    date=assigned_date.isoformat() if assigned_date else "-",
                    week_key=week_key,
                    day_key=day_key,
                    problem_count=str(problem_count),
                    batch="-",
                    created="-",
                    skipped="-",
                    result=f"error: {exc}",
                )
            )

    _print_rows(rows)


if __name__ == "__main__":
    try:
        main()
    except ValidationError as exc:
        print(f"error: {exc}")
        sys.exit(1)
    except KeyboardInterrupt:
        print("\ncancelled")
        sys.exit(1)
