#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

import requests

DEFAULT_API_BASE = os.getenv("API_BASE_URL", "https://calculatemath-production.up.railway.app/api")
DEFAULT_ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
DEFAULT_ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "")


def _prompt(label: str, default: str | None = None) -> str:
    suffix = f" [{default}]" if default else ""
    return input(f"{label}{suffix}: ").strip() or (default or "")


def _normalize_datetime(value: str) -> str | None:
    raw = value.strip()
    if not raw:
        return None
    normalized = raw.replace(" ", "T") if "T" not in raw else raw
    if normalized.endswith("Z"):
        normalized = normalized.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return raw
    if parsed.tzinfo is None:
        local_tz = datetime.now().astimezone().tzinfo
        parsed = parsed.replace(tzinfo=local_tz)
    return parsed.astimezone(timezone.utc).isoformat()


def _load_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def _ensure_problem_ids(problems: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    for idx, problem in enumerate(problems, start=1):
        item = dict(problem)
        item.setdefault("id", f"p{idx}")
        normalized.append(item)
    return normalized


def _resolve_files(paths: list[str]) -> list[Path]:
    if paths:
        return [Path(p) for p in paths]
    candidates = sorted(Path.cwd().glob("homework_2026-01-*.json"))
    if candidates:
        return candidates
    raise SystemExit("No homework json files found. Pass paths explicitly.")


def _login(api_base: str, username: str, password: str) -> str:
    response = requests.post(
        f"{api_base}/auth/login",
        json={"username": username, "password": password},
        timeout=20,
    )
    if response.status_code != 200:
        raise SystemExit(f"Login failed: {response.status_code} {response.text}")
    return response.json()["accessToken"]


def _fetch_students(api_base: str, token: str) -> list[dict[str, Any]]:
    response = requests.get(
        f"{api_base}/admin/users",
        headers={"Authorization": f"Bearer {token}"},
        timeout=20,
    )
    if response.status_code != 200:
        raise SystemExit(f"Failed to fetch students: {response.status_code} {response.text}")
    users = response.json().get("users", [])
    return [u for u in users if u.get("role") == "student"]


def _select_students(students: list[dict[str, Any]], selection: str | None) -> list[str]:
    if not students:
        raise SystemExit("No students found in the system.")
    if selection and selection.lower() != "all":
        return [s.strip() for s in selection.split(",") if s.strip()]

    print("\n학생 목록:")
    for user in students:
        print(f"- {user.get('username')} ({user.get('name')}, {user.get('grade')})")
    picked = _prompt("출제 대상 학생 아이디(콤마) 또는 all", "all")
    if picked.lower() == "all":
        return [u["username"] for u in students]
    return [s.strip() for s in picked.split(",") if s.strip()]


def _build_payload(data: dict[str, Any], due_at: str | None, scheduled_at: str | None, student_ids: list[str]) -> dict[str, Any]:
    title = data.get("title")
    if not title:
        raise ValueError("title is required")
    problems = data.get("problems") or []
    if not isinstance(problems, list) or not problems:
        raise ValueError("problems list is required")
    normalized_problems = _ensure_problem_ids(problems)

    payload: dict[str, Any] = {
        "title": title,
        "description": data.get("description") or None,
        "problems": normalized_problems,
        "dueAt": due_at,
        "scheduledAt": scheduled_at,
        "targetStudentIds": student_ids,
    }
    return payload


def main() -> None:
    parser = argparse.ArgumentParser(description="Publish homework from JSON files.")
    parser.add_argument("files", nargs="*", help="Homework JSON files")
    parser.add_argument("--api-base", default=DEFAULT_API_BASE, help="API base URL")
    parser.add_argument("--admin-user", default=DEFAULT_ADMIN_USERNAME, help="Admin username")
    parser.add_argument("--admin-pass", default=DEFAULT_ADMIN_PASSWORD, help="Admin password")
    parser.add_argument("--students", help="Comma-separated student usernames or 'all'")
    parser.add_argument("--due", help="Due datetime (YYYY-MM-DD HH:MM or ISO)")
    parser.add_argument("--schedule", help="Scheduled datetime (YYYY-MM-DD HH:MM or ISO)")
    parser.add_argument("--dry-run", action="store_true", help="Print payloads without publishing")
    args = parser.parse_args()

    api_base = args.api_base.rstrip("/")
    username = args.admin_user
    password = args.admin_pass or _prompt("관리자 비밀번호")

    token = _login(api_base, username, password)
    students = _fetch_students(api_base, token)
    student_ids = _select_students(students, args.students)

    due_at = _normalize_datetime(args.due or _prompt("마감 일시 (비우면 없음)", ""))
    scheduled_at = _normalize_datetime(args.schedule or _prompt("예약 출제 일시 (비우면 즉시)", ""))

    files = _resolve_files(args.files)
    print(f"\n대상 학생 수: {len(student_ids)}")
    print(f"파일 {len(files)}개 처리합니다.\n")

    for path in files:
        data = _load_json(path)
        try:
            payload = _build_payload(data, due_at, scheduled_at, student_ids)
        except ValueError as exc:
            print(f"[SKIP] {path.name}: {exc}")
            continue

        if args.dry_run:
            print(f"[DRY] {path.name}: {payload['title']}")
            continue

        response = requests.post(
            f"{api_base}/homework/assignments",
            headers={"Authorization": f"Bearer {token}"},
            json=payload,
            timeout=30,
        )
        if response.status_code != 200:
            print(f"[FAIL] {path.name}: {response.status_code} {response.text}")
            continue
        assignment_id = response.json().get("id")
        print(f"[OK] {path.name}: {payload['title']} -> {assignment_id}")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n취소되었습니다.")
        sys.exit(1)
