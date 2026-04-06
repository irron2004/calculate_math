#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any, Dict, List, Tuple

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from tools.problem_bank_ingest import normalize_bundle, upload_bundle_to_db  # noqa: E402

DAY_NAME_TO_KEY = {
    "월요일": "mon",
    "화요일": "tue",
    "수요일": "wed",
    "목요일": "thu",
    "금요일": "fri",
    "토요일": "sat",
    "일요일": "sun",
}
KEY_TO_DAY_NAME = {value: key for key, value in DAY_NAME_TO_KEY.items()}
CHOICE_CHAR_TO_INDEX = {"①": 1, "②": 2, "③": 3, "④": 4, "⑤": 5}
INDEX_TO_CHOICE_CHAR = {value: key for key, value in CHOICE_CHAR_TO_INDEX.items()}
QUESTION_RE = re.compile(r"^(\d+)\.\s*(.+)$")
OPTION_RE = re.compile(r"([①②③④⑤])\s*([^①②③④⑤]+?)(?=\s*[①②③④⑤]\s*|$)")
ANSWER_LINE_RE = re.compile(r"^(\d+)\.\s*([①②③④⑤])\s*$")


class ParseError(Exception):
    pass


def _read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except FileNotFoundError as exc:
        raise ParseError(f"file not found: {path}") from exc


def _write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _clean_line(line: str) -> str:
    return line.strip().replace("\u200b", "")


def _parse_day_sections(lines: List[str]) -> Dict[str, List[str]]:
    sections: Dict[str, List[str]] = {}
    current_day: str | None = None
    for raw_line in lines:
        line = _clean_line(raw_line)
        if not line:
            continue
        if line in DAY_NAME_TO_KEY:
            current_day = DAY_NAME_TO_KEY[line]
            sections.setdefault(current_day, [])
            continue
        if line == "정답":
            break
        if current_day is not None:
            sections[current_day].append(line)
    return sections


def _parse_answer_sections(lines: List[str]) -> Dict[str, Dict[int, int]]:
    answers: Dict[str, Dict[int, int]] = {}
    in_answers = False
    current_day: str | None = None
    for raw_line in lines:
        line = _clean_line(raw_line)
        if not line:
            continue
        if line == "정답":
            in_answers = True
            current_day = None
            continue
        if not in_answers:
            continue
        normalized_day = line.strip("*")
        if normalized_day in DAY_NAME_TO_KEY:
            current_day = DAY_NAME_TO_KEY[normalized_day]
            answers.setdefault(current_day, {})
            continue
        if current_day is None:
            continue
        match = ANSWER_LINE_RE.match(line)
        if match is None:
            continue
        number = int(match.group(1))
        choice_char = match.group(2)
        answers[current_day][number] = CHOICE_CHAR_TO_INDEX[choice_char]
    return answers


def _parse_questions(section_lines: List[str]) -> List[Dict[str, Any]]:
    questions: List[Dict[str, Any]] = []
    current_number: int | None = None
    current_stem_lines: List[str] = []
    current_options_line: str | None = None

    def flush() -> None:
        nonlocal current_number, current_stem_lines, current_options_line
        if current_number is None:
            return
        if current_options_line is None:
            raise ParseError(f"question {current_number} is missing options line")
        stem = " ".join(part.strip() for part in current_stem_lines if part.strip())
        if not stem:
            raise ParseError(f"question {current_number} stem is empty")
        option_matches = OPTION_RE.findall(current_options_line)
        if len(option_matches) < 2:
            raise ParseError(f"question {current_number} options could not be parsed")
        options = [text.strip() for _, text in option_matches]
        questions.append({"number": current_number, "question": stem, "options": options})
        current_number = None
        current_stem_lines = []
        current_options_line = None

    for line in section_lines:
        q_match = QUESTION_RE.match(line)
        if q_match:
            flush()
            current_number = int(q_match.group(1))
            current_stem_lines = [q_match.group(2)]
            continue
        if any(choice_char in line for choice_char in CHOICE_CHAR_TO_INDEX):
            if current_number is None:
                raise ParseError("encountered options before any question number")
            current_options_line = line
            continue
        if current_number is not None:
            current_stem_lines.append(line)
    flush()
    return questions


def parse_weekly_text(text: str) -> Dict[str, List[Dict[str, Any]]]:
    lines = text.splitlines()
    day_sections = _parse_day_sections(lines)
    answer_sections = _parse_answer_sections(lines)
    if not day_sections:
        raise ParseError("no weekday sections found")
    if not answer_sections:
        raise ParseError("no answer section found")

    parsed: Dict[str, List[Dict[str, Any]]] = {}
    for day_key, section_lines in day_sections.items():
        questions = _parse_questions(section_lines)
        if day_key not in answer_sections:
            raise ParseError(f"missing answers for {KEY_TO_DAY_NAME[day_key]}")
        answers = answer_sections[day_key]
        for question in questions:
            answer_index = answers.get(question["number"])
            if answer_index is None:
                raise ParseError(
                    f"missing answer for {KEY_TO_DAY_NAME[day_key]} question {question['number']}"
                )
            if answer_index < 1 or answer_index > len(question["options"]):
                raise ParseError(
                    f"answer index out of range for {KEY_TO_DAY_NAME[day_key]} question {question['number']}"
                )
            question["answerIndex"] = answer_index
        parsed[day_key] = questions
    return parsed


def build_bundles(
    parsed: Dict[str, List[Dict[str, Any]]],
    *,
    week_key: str,
    title_prefix: str,
    imported_by: str,
    label_key: str | None,
    label_name: str | None,
) -> List[Tuple[str, Dict[str, Any]]]:
    bundles: List[Tuple[str, Dict[str, Any]]] = []
    for day_key in ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]:
        questions = parsed.get(day_key)
        if not questions:
            continue
        day_name = KEY_TO_DAY_NAME[day_key]
        raw_bundle: Dict[str, Any] = {
            "weekKey": week_key,
            "dayKey": day_key,
            "title": f"{title_prefix} - {day_name}",
            "description": f"주간 문제 텍스트에서 자동 변환된 객관식 세트 ({day_name})",
            "importedBy": imported_by,
            "expectedProblemCount": len(questions),
            "problems": [
                {
                    "question": question["question"],
                    "type": "objective",
                    "options": question["options"],
                    "answerIndex": question["answerIndex"],
                }
                for question in questions
            ],
        }
        if label_key and label_name:
            raw_bundle["labelDefinitions"] = [{"key": label_key, "label": label_name, "kind": "custom"}]
            raw_bundle["commonLabelKeys"] = [label_key]
        bundles.append((day_key, normalize_bundle(raw_bundle)))
    return bundles


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Parse pasted weekly problem text into daily bundles and optionally upload them to DB."
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    parse_parser = subparsers.add_parser("parse", help="Parse weekly text and emit normalized day bundles")
    parse_parser.add_argument("input", help="Path to raw weekly text file")
    parse_parser.add_argument("--week-key", required=True, help="Week key like 2026-W15")
    parse_parser.add_argument("--title-prefix", required=True, help="Daily title prefix")
    parse_parser.add_argument("--output-dir", required=True, help="Output directory for normalized bundle JSON files")
    parse_parser.add_argument("--imported-by", default="tools/problem_bank_weekly_text", help="importedBy metadata")
    parse_parser.add_argument("--label-key", default=None, help="Optional common label key for all imported problems")
    parse_parser.add_argument("--label-name", default=None, help="Optional common label display name")

    upload_parser = subparsers.add_parser("upload-dir", help="Upload all normalized bundle JSON files in a directory")
    upload_parser.add_argument("input_dir", help="Directory containing *.bundle.json files")
    upload_parser.add_argument("--db-path", default=None, help="SQLite DB path; defaults to DATABASE_PATH or backend default")
    upload_parser.add_argument("--imported-by", default=None, help="Override importedBy during upload")
    upload_parser.add_argument("--dry-run", action="store_true", help="Validate and print targets without DB writes")

    full_parser = subparsers.add_parser("parse-and-upload", help="Parse weekly text then upload generated bundles")
    full_parser.add_argument("input", help="Path to raw weekly text file")
    full_parser.add_argument("--week-key", required=True, help="Week key like 2026-W15")
    full_parser.add_argument("--title-prefix", required=True, help="Daily title prefix")
    full_parser.add_argument("--output-dir", required=True, help="Output directory for normalized bundle JSON files")
    full_parser.add_argument("--db-path", default=None, help="SQLite DB path; defaults to DATABASE_PATH or backend default")
    full_parser.add_argument("--imported-by", default="tools/problem_bank_weekly_text", help="importedBy metadata")
    full_parser.add_argument("--label-key", default=None, help="Optional common label key for all imported problems")
    full_parser.add_argument("--label-name", default=None, help="Optional common label display name")
    full_parser.add_argument("--dry-run", action="store_true", help="Validate and print actions without DB writes")
    return parser


def _bundle_paths(input_dir: Path) -> List[Path]:
    bundle_paths = sorted(input_dir.glob("*.bundle.json"))
    if not bundle_paths:
        raise ParseError(f"no *.bundle.json files found in {input_dir}")
    return bundle_paths


def _parse_and_write(args: argparse.Namespace) -> List[Path]:
    if bool(args.label_key) != bool(args.label_name):
        raise ParseError("--label-key and --label-name must be provided together")
    text = _read_text(Path(args.input))
    parsed = parse_weekly_text(text)
    bundles = build_bundles(
        parsed,
        week_key=args.week_key,
        title_prefix=args.title_prefix,
        imported_by=args.imported_by,
        label_key=args.label_key,
        label_name=args.label_name,
    )
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    written_paths: List[Path] = []
    for day_key, bundle in bundles:
        path = output_dir / f"{args.week_key}_{day_key}.bundle.json"
        _write_json(path, bundle)
        written_paths.append(path)
    return written_paths


def _upload_paths(paths: List[Path], *, db_path: str | None, imported_by: str | None, dry_run: bool) -> List[Dict[str, Any]]:
    results: List[Dict[str, Any]] = []
    for path in paths:
        bundle = json.loads(path.read_text(encoding="utf-8"))
        if dry_run:
            results.append(
                {
                    "status": "dry-run",
                    "input": str(path),
                    "weekKey": bundle["weekKey"],
                    "dayKey": bundle["dayKey"],
                    "problemCount": len(bundle["payload"]["problems"]),
                }
            )
            continue
        result = upload_bundle_to_db(
            bundle,
            db_path=Path(db_path) if db_path else None,
            imported_by_override=imported_by,
        )
        results.append({"status": "ok", "input": str(path), **result})
    return results


def main() -> None:
    parser = _build_parser()
    args = parser.parse_args()

    if args.command == "parse":
        written_paths = _parse_and_write(args)
        print(json.dumps({"status": "ok", "written": [str(path) for path in written_paths]}, ensure_ascii=False, indent=2))
        return

    if args.command == "upload-dir":
        paths = _bundle_paths(Path(args.input_dir))
        results = _upload_paths(paths, db_path=args.db_path, imported_by=args.imported_by, dry_run=args.dry_run)
        print(json.dumps({"status": "ok", "results": results}, ensure_ascii=False, indent=2))
        return

    if args.command == "parse-and-upload":
        written_paths = _parse_and_write(args)
        results = _upload_paths(written_paths, db_path=args.db_path, imported_by=args.imported_by, dry_run=args.dry_run)
        print(json.dumps({"status": "ok", "written": [str(path) for path in written_paths], "results": results}, ensure_ascii=False, indent=2))
        return

    raise ParseError(f"unknown command: {args.command}")


if __name__ == "__main__":
    try:
        main()
    except ParseError as exc:
        print(f"error: {exc}", file=sys.stderr)
        raise SystemExit(2) from exc
