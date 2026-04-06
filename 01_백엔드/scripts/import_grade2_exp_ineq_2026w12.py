from __future__ import annotations

import sys
from pathlib import Path
from typing import Any, Dict, List


REPO_ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT = REPO_ROOT / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.db import (  # noqa: E402
    create_homework_label,
    import_homework_problem_batch,
    init_db,
    list_homework_problem_ids_for_batch,
    list_homework_problems_admin,
    set_homework_problem_labels,
)


WEEK_KEY = "2026-W12"
COMMON_LABEL_KEY = "hwset-high-2-exponential-inequality-w12"
COMMON_LABEL_TEXT = "고2 지수부등식 - 2026 W12"

LABELS: list[tuple[str, str]] = [
    (COMMON_LABEL_KEY, COMMON_LABEL_TEXT),
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


def _choice_text(n: int) -> str:
    return f"선지 {n}"


def _choices(values: List[str] | None = None) -> List[str]:
    if values is None:
        return [_choice_text(i) for i in range(1, 6)]
    return values


def _answer_value(options: List[str], answer_no: int) -> str:
    return options[answer_no - 1]


def mcq(
    qid: str,
    source: str,
    stem: str,
    answer_no: int,
    options: List[str] | None = None,
) -> Dict[str, Any]:
    normalized_options = _choices(options)
    return {
        "type": "objective",
        "question": f"{qid} [원본: {source}] {stem}",
        "options": normalized_options,
        "answer": _answer_value(normalized_options, answer_no),
    }


def day_payloads() -> Dict[str, Dict[str, Any]]:
    return {
        "mon": {
            "title": "고2 지수/연립부등식 월요일 10제",
            "description": "원본 0363·0376·0373·0372 기반 (객관식)",
            "problems": [
                mcq(
                    "MON-01",
                    "0363,0376",
                    "방정식 (제한된 범위) 실근의 개수",
                    3,
                    ["0개", "1개", "2개", "3개", "4개"],
                ),
                mcq(
                    "MON-02",
                    "0363,0376",
                    "방정식 (제한된 범위) 실근의 개수",
                    2,
                    ["0개", "1개", "2개", "3개", "4개"],
                ),
                mcq(
                    "MON-03",
                    "0363,0376",
                    "모든 x에 대하여 4^x-4·2^x+k≥0 를 만족하는 k",
                    4,
                    ["1", "2", "3", "4", "5"],
                ),
                mcq(
                    "MON-04",
                    "0363,0376",
                    "방정식 2^x+2^{-x}=k 의 해 조건",
                    3,
                    ["0", "1", "2", "3", "4"],
                ),
                mcq("MON-05", "0373", "(1/4)^x-5(1/2)^x+6<0 의 해", 1),
                mcq("MON-06", "0372", "연립부등식 ① 3^x>3^{2-x}, ② 4^x-5·2^x+4≤0", 2),
                mcq("MON-07", "0372", "연립부등식 ① (1/9)^x<(1/3)^{x+1}, ② 5^x≥25", 3),
                mcq(
                    "MON-08",
                    "0372",
                    "연립부등식 ① 2^{x+1}≤8, ② (1/4)^x-4(1/2)^x+3>0",
                    1,
                ),
                mcq("MON-09", "0372", "연립부등식 ① 5^{2x-1}≤25, ② 4^x-4·2^x+3<0", 4),
                mcq("MON-10", "0372", "연립부등식 ① 2^x-8<0, ② 9^x-10·3^x+9≥0", 5),
            ],
        },
        "tue": {
            "title": "고2 지수/연립부등식 화요일 10제",
            "description": "원본 0363·0376·0373·0372 기반 (객관식)",
            "problems": [
                mcq(
                    "TUE-01",
                    "0363,0376",
                    "방정식 (제한된 범위) 실근의 개수",
                    3,
                    ["0개", "1개", "2개", "3개", "4개"],
                ),
                mcq(
                    "TUE-02",
                    "0363,0376",
                    "방정식 (제한된 범위) 실근의 개수",
                    1,
                    ["0개", "1개", "2개", "3개", "4개"],
                ),
                mcq(
                    "TUE-03",
                    "0363,0376",
                    "모든 x에 대하여 9^x-12·3^x+k≥0 를 만족하는 k",
                    3,
                    ["32", "34", "36", "38", "40"],
                ),
                mcq("TUE-04", "0363,0376", "(1/9)^x-4(1/3)^x+3≤0 의 해", 2),
                mcq(
                    "TUE-05",
                    "0373",
                    "(1/4)^x-p(1/2)^x+q<0 에서 p+q",
                    3,
                    ["7", "8", "9", "10", "11"],
                ),
                mcq(
                    "TUE-06", "0372", "연립부등식 ① 2^{x-1}>4^{-x}, ② 9^x-10·3^x+9<0", 2
                ),
                mcq(
                    "TUE-07",
                    "0372",
                    "연립부등식 ① (1/2)^{x+1}≥8^{-x}, ② 4^x-5·2^x+4>0",
                    3,
                ),
                mcq(
                    "TUE-08",
                    "0372",
                    "연립부등식 ① 5^{x+1}<25^x, ② (1/4)^x-5(1/2)^x+6≥0",
                    2,
                ),
                mcq("TUE-09", "0372", "연립부등식 ① 3^{2x}-10·3^x+9≤0, ② x<1", 3),
                mcq("TUE-10", "0372", "연립부등식 ① 2^x≥1/4, ② 25^x-6·5^x+5<0", 2),
            ],
        },
        "wed": {
            "title": "고2 지수/연립부등식 수요일 10제",
            "description": "원본 0363·0376·0373·0372 기반 (객관식)",
            "problems": [
                mcq(
                    "WED-01",
                    "0363,0376",
                    "4^x-a·2^x+3=0 이 서로 다른 두 실근을 갖는 a",
                    2,
                    ["3", "4", "5", "6", "7"],
                ),
                mcq(
                    "WED-02",
                    "0363,0376",
                    "모든 x에 대하여 9^x-6·3^x+k>0 를 만족하는 k",
                    3,
                    ["8", "9", "10", "11", "12"],
                ),
                mcq(
                    "WED-03",
                    "0363,0376",
                    "모든 x에 대하여 4^x-6·2^x+k≥0 를 만족하는 k",
                    3,
                    ["3", "4", "5", "6", "7"],
                ),
                mcq("WED-04", "0363,0376", "(1/16)^x-(17/4)(1/4)^x+1<0 의 해", 1),
                mcq("WED-05", "0373", "(1/25)^x-(26/5)(1/5)^x+1≤0 의 해", 2),
                mcq("WED-06", "0372", "연립부등식 ① 4^x-5·2^x+4≥0, ② 3^{x-1}<9", 1),
                mcq(
                    "WED-07",
                    "0372",
                    "연립부등식 ① (1/3)^{x-2}>27, ② 25^x-26·5^x+25<0",
                    3,
                    ["선지 1", "선지 2", "공집합", "선지 4", "선지 5"],
                ),
                mcq("WED-08", "0372", "연립부등식 ① 2^{x+2}≥32, ② 4^x-10·2^x+16>0", 3),
                mcq(
                    "WED-09",
                    "0372",
                    "연립부등식 ① 5^{1-x}≤25, ② (1/9)^x-10(1/3)^x+9≤0",
                    1,
                ),
                mcq("WED-10", "0372", "연립부등식 ① 3^{2x}-4·3^x+3<0, ② 2^x>1/2", 1),
            ],
        },
        "thu": {
            "title": "고2 지수/연립부등식 목요일 10제",
            "description": "원본 0363·0376·0373·0372 기반 (객관식)",
            "problems": [
                mcq(
                    "THU-01",
                    "0363,0376",
                    "방정식 4^x-7·2^x+10=0 의 실근 개수",
                    3,
                    ["0개", "1개", "2개", "3개", "4개"],
                ),
                mcq(
                    "THU-02",
                    "0363,0376",
                    "방정식 4^x-3·2^x+2=0 의 실근 개수",
                    2,
                    ["0개", "1개", "2개", "3개", "4개"],
                ),
                mcq(
                    "THU-03",
                    "0363,0376",
                    "모든 x에 대하여 9^x-4·3^x+k≥0 를 만족하는 k",
                    3,
                    ["2", "3", "4", "5", "6"],
                ),
                mcq(
                    "THU-04",
                    "0363,0376",
                    "모든 x에 대하여 9^x-4·3^x+k≥0 를 만족하는 k (변형)",
                    3,
                    ["1", "2", "3", "4", "5"],
                ),
                mcq(
                    "THU-05",
                    "0373",
                    "(1/4)^x-p(1/2)^x+q<0 조건식",
                    2,
                    ["선지 1", "선지 2", "0", "1", "2"],
                ),
                mcq(
                    "THU-06",
                    "0372",
                    "연립부등식 ① 5^{x-1}≥125, ② 4^x-5·2^x+6<0",
                    5,
                    ["선지 1", "선지 2", "선지 3", "선지 4", "공집합"],
                ),
                mcq("THU-07", "0372", "연립부등식 ① (1/2)^x<4, ② 9^x-4·3^x+3≥0", 2),
                mcq("THU-08", "0372", "연립부등식 ① 2^{2x}-5·2^x+4≤0, ② 3^{x+1}>1", 2),
                mcq("THU-09", "0372", "연립부등식 ① 25^x-6·5^x+5>0, ② 2^{x-1}≤1", 2),
                mcq("THU-10", "0372", "연립부등식 ① 4^x-8·2^x+12<0, ② (1/3)^x≤1", 4),
            ],
        },
        "fri": {
            "title": "고2 지수/연립부등식 금요일 10제",
            "description": "원본 0363·0376·0373·0372 기반 (객관식)",
            "problems": [
                mcq(
                    "FRI-01",
                    "0363,0376",
                    "방정식 4^x-8·2^x+12=0 의 실근 개수",
                    3,
                    ["0개", "1개", "2개", "3개", "4개"],
                ),
                mcq(
                    "FRI-02",
                    "0363,0376",
                    "방정식 9^x-2·3^x+1=0 의 실근 개수",
                    2,
                    ["0개", "1개", "2개", "3개", "4개"],
                ),
                mcq(
                    "FRI-03",
                    "0363,0376",
                    "모든 x에 대하여 4^x-10·2^x+k>0 를 만족하는 k",
                    4,
                    ["23", "24", "25", "26", "27"],
                ),
                mcq(
                    "FRI-04",
                    "0363,0376",
                    "모든 x에 대하여 4^x-10·2^x+k≥0 를 만족하는 k",
                    3,
                    ["7", "8", "9", "10", "11"],
                ),
                mcq(
                    "FRI-05",
                    "0373",
                    "(1/9)^x-p(1/3)^x+q≤0 에서 p+q",
                    3,
                    ["9", "10", "11", "12", "13"],
                ),
                mcq("FRI-06", "0372", "연립부등식 ① 5^x<125, ② 4^x-6·2^x+8≥0", 1),
                mcq(
                    "FRI-07",
                    "0372",
                    "연립부등식 ① (1/4)^x-5(1/2)^x+4>0, ② 3^{x-1}≤1",
                    1,
                ),
                mcq("FRI-08", "0372", "연립부등식 ① 9^x-10·3^x+9>0, ② 2^x≥2", 2),
                mcq("FRI-09", "0372", "연립부등식 ① 2^{x+1}>1, ② 25^x-26·5^x+25≤0", 2),
                mcq(
                    "FRI-10", "0372", "연립부등식 ① 3^{2x}-12·3^x+27<0, ② (1/2)^x<8", 4
                ),
            ],
        },
    }


def _ensure_labels(db_path: Path) -> None:
    for key, label_text in LABELS:
        try:
            create_homework_label(
                key=key,
                label=label_text,
                kind="preset",
                created_by="seed-script",
                path=db_path,
            )
        except ValueError:
            pass


def _label_keys_for_problem(day_key: str, order_index: int) -> list[str]:
    day_label = f"day-{day_key}"
    if 1 <= order_index <= 4:
        return [
            COMMON_LABEL_KEY,
            day_label,
            "source-0363",
            "source-0376",
            "concept-exponential-substitute-range-root-count",
        ]
    if order_index == 5:
        return [
            COMMON_LABEL_KEY,
            day_label,
            "source-0373",
            "concept-exponential-inequality-given-solution",
        ]
    return [
        COMMON_LABEL_KEY,
        day_label,
        "source-0372",
        "concept-exponential-system-inequality-intersection",
    ]


def import_all(db_path: Path) -> None:
    init_db(db_path)
    _ensure_labels(db_path)
    payloads = day_payloads()
    summary: list[str] = []

    for day_key in ["mon", "tue", "wed", "thu", "fri"]:
        payload = payloads[day_key]
        result = import_homework_problem_batch(
            week_key=WEEK_KEY,
            day_key=day_key,
            payload=payload,
            imported_by="seed-script",
            expected_problem_count=10,
            path=db_path,
        )
        batch_id = result["batchId"]
        problem_ids = list_homework_problem_ids_for_batch(batch_id, path=db_path)
        for index, problem_id in enumerate(problem_ids, start=1):
            set_homework_problem_labels(
                problem_id=problem_id,
                label_keys=_label_keys_for_problem(day_key, index),
                path=db_path,
            )
        summary.append(
            f"{day_key}: batch={batch_id}, created={result['createdProblemCount']}, skipped={result['skippedProblemCount']}"
        )

    print("Imported grade2 exponential inequality homework bank:")
    for line in summary:
        print(f"- {line}")

    sample_rows = list_homework_problems_admin(
        week_key=WEEK_KEY,
        day_key="mon",
        limit=3,
        offset=0,
        path=db_path,
    )
    print("Sample(mon, first 3):")
    for row in sample_rows:
        print(
            f"- {row['id']} labels={row.get('labelKeys', [])} answer={row.get('answer')}"
        )


def main() -> None:
    db_path = BACKEND_ROOT / "data" / "app.db"
    import_all(db_path)


if __name__ == "__main__":
    main()
