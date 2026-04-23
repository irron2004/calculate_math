#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, TypedDict, cast


REPO_ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT = REPO_ROOT / "01_백엔드" / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.db import (  # noqa: E402
    create_homework_label,
    import_homework_problem_batch,
    init_db,
    list_homework_problem_ids_for_batch,
    set_homework_problem_labels,
)
from app.homework_problem_bank import validate_weekly_homework_payload  # noqa: E402


DEFAULT_IMPORTED_BY = "tools/problem_bank_ingest"
DEFAULT_DB_PATH = REPO_ROOT / "01_백엔드" / "backend" / "data" / "app.db"
DAY_KEYS = {"mon", "tue", "wed", "thu", "fri", "sat", "sun"}
OBJECTIVE_ALIASES = {
    "objective",
    "obj",
    "mcq",
    "multiple_choice",
    "multiple-choice",
    "choice",
}
SUBJECTIVE_ALIASES = {
    "subjective",
    "subj",
    "short_answer",
    "short-answer",
    "essay",
    "free_text",
    "free-text",
}


class LabelDefinition(TypedDict):
    key: str
    label: str
    kind: str


class NormalizedProblemPayload(TypedDict, total=False):
    type: str
    question: str
    options: list[str]
    answer: str


class PayloadFile(TypedDict):
    title: str
    description: str | None
    problems: list[NormalizedProblemPayload]


class ProblemLabelMapping(TypedDict):
    orderIndex: int
    labelKeys: list[str]


class NormalizedBundle(TypedDict):
    version: int
    weekKey: str
    dayKey: str
    expectedProblemCount: int
    importedBy: str
    payload: PayloadFile
    labelDefinitions: list[LabelDefinition]
    problemLabels: list[ProblemLabelMapping]


class BundleUploadResult(TypedDict):
    batchId: str
    createdProblemCount: int
    skippedProblemCount: int
    appliedProblemLabelCount: int
    ensuredLabelDefinitionCount: int


class ValidationError(Exception):
    pass


def _load_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise ValidationError(f"file not found: {path}") from exc
    except json.JSONDecodeError as exc:
        raise ValidationError(
            f"invalid JSON in {path}: line {exc.lineno} column {exc.colno}"
        ) from exc


def _write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def _require_dict(value: Any, label: str) -> Dict[str, Any]:
    if not isinstance(value, dict):
        raise ValidationError(f"{label} must be an object")
    return cast(Dict[str, Any], value)


def _require_list(value: Any, label: str) -> List[Any]:
    if not isinstance(value, list):
        raise ValidationError(f"{label} must be a list")
    return cast(List[Any], value)


def _first_present_str(data: Dict[str, Any], keys: List[str]) -> Optional[str]:
    for key in keys:
        value = data.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def _optional_str(data: Dict[str, Any], keys: List[str]) -> Optional[str]:
    for key in keys:
        value = data.get(key)
        if value is None:
            continue
        if not isinstance(value, str):
            raise ValidationError(f"{key} must be a string when provided")
        stripped = value.strip()
        if stripped:
            return stripped
    return None


def _optional_int(data: Dict[str, Any], keys: List[str]) -> Optional[int]:
    for key in keys:
        value = data.get(key)
        if value is None:
            continue
        if not isinstance(value, int):
            raise ValidationError(f"{key} must be an integer when provided")
        return value
    return None


def _normalize_day_key(raw_day_key: str) -> str:
    day_key = raw_day_key.strip().lower()
    if day_key not in DAY_KEYS:
        raise ValidationError(
            f"dayKey must be one of {sorted(DAY_KEYS)}, got '{raw_day_key}'"
        )
    return day_key


def _normalize_problem_type(raw_type: Optional[str], *, has_options: bool) -> str:
    if raw_type is None:
        return "objective" if has_options else "subjective"
    lowered = raw_type.strip().lower()
    if lowered in OBJECTIVE_ALIASES:
        return "objective"
    if lowered in SUBJECTIVE_ALIASES:
        return "subjective"
    raise ValidationError(f"unknown problem type: {raw_type}")


def _normalize_options(problem: Dict[str, Any], *, index: int) -> Optional[List[str]]:
    for key in ["options", "choices", "selectOptions", "select_options"]:
        if key not in problem:
            continue
        if problem[key] is None:
            continue
        raw_options = _require_list(problem[key], f"problem[{index}].{key}")
        normalized: List[str] = []
        for option_index, option in enumerate(raw_options, start=1):
            if not isinstance(option, str) or not option.strip():
                raise ValidationError(
                    f"problem[{index}].{key}[{option_index}] must be a non-empty string"
                )
            normalized.append(option.strip())
        return normalized
    return None


def _answer_from_letter(answer_key: str, options: List[str], *, index: int) -> str:
    stripped = answer_key.strip().upper()
    if len(stripped) != 1 or not ("A" <= stripped <= "Z"):
        raise ValidationError(
            f"problem[{index}].answerKey must be a single letter like A/B/C"
        )
    option_index = ord(stripped) - ord("A")
    if option_index < 0 or option_index >= len(options):
        raise ValidationError(
            f"problem[{index}].answerKey points outside options length {len(options)}"
        )
    return options[option_index]


def _answer_from_index(answer_index: int, options: List[str], *, index: int) -> str:
    if answer_index < 1 or answer_index > len(options):
        raise ValidationError(
            f"problem[{index}].answerIndex must be between 1 and {len(options)}"
        )
    return options[answer_index - 1]


def _normalize_objective_answer(
    problem: Dict[str, Any], options: List[str], *, index: int
) -> Optional[str]:
    answer_index = _optional_int(
        problem, ["answerIndex", "answer_index", "correctIndex", "correct_index"]
    )
    if answer_index is not None:
        return _answer_from_index(answer_index, options, index=index)

    answer_key = _optional_str(
        problem, ["answerKey", "answer_key", "correctKey", "correct_key"]
    )
    if answer_key is not None:
        return _answer_from_letter(answer_key, options, index=index)

    answer_value = _optional_str(
        problem,
        [
            "answer",
            "correctAnswer",
            "correct_answer",
            "correct",
            "solution",
            "expectedAnswer",
            "expected_answer",
        ],
    )
    if answer_value is None:
        return None
    if answer_value in options:
        return answer_value
    if answer_value.isdigit():
        return _answer_from_index(int(answer_value), options, index=index)
    if len(answer_value) == 1 and answer_value.isalpha():
        return _answer_from_letter(answer_value, options, index=index)
    raise ValidationError(
        f"problem[{index}].answer must match one option, a 1-based index, or A/B/C..."
    )


def _normalize_subjective_answer(
    problem: Dict[str, Any], *, index: int
) -> Optional[str]:
    answer_index = _optional_int(
        problem, ["answerIndex", "answer_index", "correctIndex", "correct_index"]
    )
    if answer_index is not None:
        raise ValidationError(
            f"problem[{index}] answerIndex/correctIndex can only be used for objective problems"
        )
    answer_key = _optional_str(
        problem, ["answerKey", "answer_key", "correctKey", "correct_key"]
    )
    if answer_key is not None:
        raise ValidationError(
            f"problem[{index}] answerKey/correctKey can only be used for objective problems"
        )
    return _optional_str(
        problem,
        [
            "answer",
            "correctAnswer",
            "correct_answer",
            "correct",
            "solution",
            "expectedAnswer",
            "expected_answer",
        ],
    )


def _normalize_label_keys(raw_value: Any, *, label: str) -> List[str]:
    if raw_value is None:
        return []
    raw_list = _require_list(raw_value, label)
    normalized: List[str] = []
    seen: set[str] = set()
    for item_index, item in enumerate(raw_list, start=1):
        if not isinstance(item, str) or not item.strip():
            raise ValidationError(f"{label}[{item_index}] must be a non-empty string")
        key = item.strip()
        if key in seen:
            continue
        normalized.append(key)
        seen.add(key)
    return normalized


def _normalize_problem(
    raw_problem: Dict[str, Any],
    *,
    index: int,
    common_label_keys: List[str],
) -> tuple[NormalizedProblemPayload, Optional[ProblemLabelMapping]]:
    question = _first_present_str(raw_problem, ["question", "stem", "prompt", "text"])
    if question is None:
        raise ValidationError(
            f"problem[{index}] must include one of question/stem/prompt/text"
        )

    options = _normalize_options(raw_problem, index=index)
    problem_type = _normalize_problem_type(
        _optional_str(raw_problem, ["type", "problemType", "problem_type"]),
        has_options=options is not None,
    )

    if problem_type == "objective":
        if options is None or len(options) < 2:
            raise ValidationError(
                f"problem[{index}] objective problems must provide at least 2 options"
            )
        answer = _normalize_objective_answer(raw_problem, options, index=index)
    else:
        options = None
        answer = _normalize_subjective_answer(raw_problem, index=index)

    normalized_problem: NormalizedProblemPayload = {
        "type": problem_type,
        "question": question,
    }
    if options is not None:
        normalized_problem["options"] = options
    if answer is not None:
        normalized_problem["answer"] = answer

    label_keys = list(common_label_keys)
    for extra_label in _normalize_label_keys(
        raw_problem.get("labelKeys", raw_problem.get("labels")),
        label=f"problem[{index}].labelKeys",
    ):
        if extra_label not in label_keys:
            label_keys.append(extra_label)
    problem_label_mapping = (
        {"orderIndex": index, "labelKeys": label_keys} if label_keys else None
    )
    return normalized_problem, problem_label_mapping


def _normalize_label_definitions(raw_value: Any) -> List[LabelDefinition]:
    if raw_value is None:
        return []
    raw_list = _require_list(raw_value, "labelDefinitions")
    normalized: List[LabelDefinition] = []
    seen: set[str] = set()
    for index, raw_item in enumerate(raw_list, start=1):
        item = _require_dict(raw_item, f"labelDefinitions[{index}]")
        key = _first_present_str(item, ["key"])
        label = _first_present_str(item, ["label", "name"])
        if key is None or label is None:
            raise ValidationError(
                f"labelDefinitions[{index}] must include non-empty key and label"
            )
        kind = _optional_str(item, ["kind"]) or "custom"
        if kind not in {"custom", "preset"}:
            raise ValidationError(
                f"labelDefinitions[{index}].kind must be 'custom' or 'preset'"
            )
        if key in seen:
            raise ValidationError(f"duplicate label definition key: {key}")
        seen.add(key)
        normalized.append({"key": key, "label": label, "kind": kind})
    return normalized


def normalize_bundle(raw_data: Any) -> NormalizedBundle:
    bundle = _require_dict(raw_data, "bundle")
    week_key = _first_present_str(bundle, ["weekKey", "week_key"])
    day_key_raw = _first_present_str(bundle, ["dayKey", "day_key"])
    title = _first_present_str(bundle, ["title"])
    if week_key is None:
        raise ValidationError("bundle must include weekKey")
    if day_key_raw is None:
        raise ValidationError("bundle must include dayKey")
    if title is None:
        raise ValidationError("bundle must include title")

    day_key = _normalize_day_key(day_key_raw)
    description = _optional_str(bundle, ["description"])
    imported_by = (
        _optional_str(bundle, ["importedBy", "imported_by"]) or DEFAULT_IMPORTED_BY
    )
    label_definitions = _normalize_label_definitions(
        bundle.get("labelDefinitions", bundle.get("label_definitions"))
    )
    common_label_keys = _normalize_label_keys(
        bundle.get("commonLabelKeys", bundle.get("common_label_keys")),
        label="commonLabelKeys",
    )

    raw_problems = _require_list(bundle.get("problems"), "problems")
    if not raw_problems:
        raise ValidationError("problems must contain at least one item")

    normalized_problems: List[NormalizedProblemPayload] = []
    problem_labels: List[ProblemLabelMapping] = []
    for index, raw_problem in enumerate(raw_problems, start=1):
        problem = _require_dict(raw_problem, f"problems[{index}]")
        normalized_problem, label_mapping = _normalize_problem(
            problem,
            index=index,
            common_label_keys=common_label_keys,
        )
        normalized_problems.append(normalized_problem)
        if label_mapping is not None:
            problem_labels.append(label_mapping)

    expected_problem_count = _optional_int(
        bundle, ["expectedProblemCount", "expected_problem_count"]
    )
    if expected_problem_count is None:
        expected_problem_count = len(normalized_problems)
    if expected_problem_count < 1:
        raise ValidationError("expectedProblemCount must be >= 1")

    payload_candidate: PayloadFile = {
        "title": title,
        "description": description,
        "problems": normalized_problems,
    }
    normalized_payload = cast(
        PayloadFile,
        validate_weekly_homework_payload(
            payload_candidate, expected_problem_count=expected_problem_count
        ),
    )

    return {
        "version": 1,
        "weekKey": week_key,
        "dayKey": day_key,
        "expectedProblemCount": expected_problem_count,
        "importedBy": imported_by,
        "payload": normalized_payload,
        "labelDefinitions": label_definitions,
        "problemLabels": problem_labels,
    }


def load_bundle(path: Path) -> NormalizedBundle:
    data = _load_json(path)
    bundle = _require_dict(data, "bundle file")
    if "payload" in bundle and "weekKey" in bundle and "dayKey" in bundle:
        normalized = normalize_bundle(
            {
                "weekKey": bundle.get("weekKey"),
                "dayKey": bundle.get("dayKey"),
                "title": _require_dict(bundle.get("payload"), "payload").get("title"),
                "description": _require_dict(bundle.get("payload"), "payload").get(
                    "description"
                ),
                "problems": _require_dict(bundle.get("payload"), "payload").get(
                    "problems"
                ),
                "expectedProblemCount": bundle.get("expectedProblemCount"),
                "importedBy": bundle.get("importedBy"),
                "labelDefinitions": bundle.get("labelDefinitions"),
                "commonLabelKeys": [],
            }
        )

        raw_problem_labels = bundle.get("problemLabels")
        if raw_problem_labels is not None:
            normalized["problemLabels"] = []
            for index, raw_item in enumerate(
                _require_list(raw_problem_labels, "problemLabels"), start=1
            ):
                item = _require_dict(raw_item, f"problemLabels[{index}]")
                order_index = _optional_int(item, ["orderIndex", "order_index"])
                if order_index is None:
                    raise ValidationError(
                        f"problemLabels[{index}] must include orderIndex"
                    )
                normalized["problemLabels"].append(
                    {
                        "orderIndex": order_index,
                        "labelKeys": _normalize_label_keys(
                            item.get("labelKeys", item.get("labels")),
                            label=f"problemLabels[{index}].labelKeys",
                        ),
                    }
                )
        return normalized
    return normalize_bundle(bundle)


def export_payload(bundle: NormalizedBundle) -> PayloadFile:
    return bundle["payload"]


def _ensure_label_definitions(
    label_definitions: List[LabelDefinition], *, db_path: Path, imported_by: str
) -> int:
    ensured_count = 0
    for label in label_definitions:
        try:
            create_homework_label(
                key=label["key"],
                label=label["label"],
                kind=label["kind"],
                created_by=imported_by,
                path=db_path,
            )
            ensured_count += 1
        except ValueError as exc:
            if "already exists" not in str(exc):
                raise
    return ensured_count


def upload_bundle_to_db(
    bundle: NormalizedBundle,
    *,
    db_path: Path,
    imported_by_override: Optional[str] = None,
) -> BundleUploadResult:
    init_db(db_path)
    imported_by = imported_by_override or bundle["importedBy"]
    ensured_label_definition_count = _ensure_label_definitions(
        bundle["labelDefinitions"],
        db_path=db_path,
        imported_by=imported_by,
    )
    import_result = import_homework_problem_batch(
        week_key=bundle["weekKey"],
        day_key=bundle["dayKey"],
        payload=bundle["payload"],
        imported_by=imported_by,
        expected_problem_count=bundle["expectedProblemCount"],
        path=db_path,
    )

    batch_id = str(import_result["batchId"])
    problem_ids = list_homework_problem_ids_for_batch(batch_id, path=db_path)
    problem_id_by_order = {
        order_index: problem_id
        for order_index, problem_id in enumerate(problem_ids, start=1)
    }
    applied_problem_label_count = 0
    for mapping in bundle["problemLabels"]:
        problem_id = problem_id_by_order.get(mapping["orderIndex"])
        if problem_id is None:
            raise ValidationError(
                f"problemLabels references missing orderIndex {mapping['orderIndex']}"
            )
        set_homework_problem_labels(
            problem_id=problem_id,
            label_keys=mapping["labelKeys"],
            path=db_path,
        )
        applied_problem_label_count += 1

    return {
        "batchId": batch_id,
        "createdProblemCount": int(import_result["createdProblemCount"]),
        "skippedProblemCount": int(import_result["skippedProblemCount"]),
        "appliedProblemLabelCount": applied_problem_label_count,
        "ensuredLabelDefinitionCount": ensured_label_definition_count,
    }


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Normalize and upload problem-bank bundles into calculate_math SQLite DB."
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    normalize_parser = subparsers.add_parser(
        "normalize",
        help="Convert a raw problem bundle into a normalized upload bundle.",
    )
    _ = normalize_parser.add_argument("input", help="Raw JSON bundle path")
    _ = normalize_parser.add_argument(
        "--output", required=True, help="Normalized bundle output path"
    )

    export_parser = subparsers.add_parser(
        "export-payload",
        help="Export the normalized homework payload only (title/description/problems).",
    )
    _ = export_parser.add_argument("input", help="Normalized bundle path")
    _ = export_parser.add_argument(
        "--output", required=True, help="Payload JSON output path"
    )

    upload_parser = subparsers.add_parser(
        "upload",
        help="Upload a normalized bundle directly into the SQLite problem bank.",
    )
    _ = upload_parser.add_argument("input", help="Normalized bundle path")
    _ = upload_parser.add_argument(
        "--db-path",
        default=str(DEFAULT_DB_PATH),
        help="SQLite DB path (default: 01_백엔드/backend/data/app.db)",
    )
    _ = upload_parser.add_argument(
        "--imported-by",
        default=None,
        help="Override importedBy value stored in the batch metadata",
    )
    _ = upload_parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate bundle and print summary without writing to DB",
    )
    return parser


def _print_json(payload: Any) -> None:
    print(json.dumps(payload, ensure_ascii=False, indent=2))


def main() -> None:
    parser = _build_parser()
    args = parser.parse_args()

    if args.command == "normalize":
        input_path = Path(args.input)
        output_path = Path(args.output)
        normalized = normalize_bundle(_load_json(input_path))
        _write_json(output_path, normalized)
        _print_json(
            {
                "status": "ok",
                "output": str(output_path),
                "weekKey": normalized["weekKey"],
                "dayKey": normalized["dayKey"],
                "problemCount": len(normalized["payload"]["problems"]),
            }
        )
        return

    if args.command == "export-payload":
        input_path = Path(args.input)
        output_path = Path(args.output)
        bundle = load_bundle(input_path)
        _write_json(output_path, export_payload(bundle))
        _print_json(
            {
                "status": "ok",
                "output": str(output_path),
                "problemCount": len(bundle["payload"]["problems"]),
            }
        )
        return

    if args.command == "upload":
        input_path = Path(args.input)
        db_path = Path(args.db_path)
        bundle = load_bundle(input_path)
        if args.dry_run:
            _print_json(
                {
                    "status": "dry-run",
                    "dbPath": str(db_path),
                    "weekKey": bundle["weekKey"],
                    "dayKey": bundle["dayKey"],
                    "problemCount": len(bundle["payload"]["problems"]),
                    "labelDefinitionCount": len(bundle["labelDefinitions"]),
                    "problemLabelMappingCount": len(bundle["problemLabels"]),
                }
            )
            return
        result = upload_bundle_to_db(
            bundle,
            db_path=db_path,
            imported_by_override=args.imported_by,
        )
        _print_json({"status": "ok", "dbPath": str(db_path), **result})
        return

    raise ValidationError(f"unknown command: {args.command}")


if __name__ == "__main__":
    try:
        main()
    except ValidationError as exc:
        print(f"error: {exc}", file=sys.stderr)
        raise SystemExit(2) from exc
