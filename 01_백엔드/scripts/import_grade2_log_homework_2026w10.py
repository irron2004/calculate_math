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
    set_homework_problem_labels,
)


WEEK_KEY = "2026-W10"
COMMON_LABEL_KEY = "hwset-high-2-logarithm-derived"
COMMON_LABEL_TEXT = "고2 로그 - 파생"


def mcq(
    qid: str,
    source: str,
    stem: str,
    options: List[str],
    answer_index: int,
) -> Dict[str, Any]:
    return {
        "type": "objective",
        "question": f"{qid} [원본: {source}] {stem}",
        "options": options,
        "answer": options[answer_index - 1],
    }


def day_payloads() -> Dict[str, Dict[str, Any]]:
    return {
        "tue": {
            "title": "3/3(화) 고2 로그 파생 객관식",
            "description": "오답 원본 추적 태그 포함 (0303-01~10)",
            "problems": [
                mcq(
                    "0303-01",
                    "0185",
                    "log_2 a=4, log_a b=3 일 때 log_2 b 의 값은?",
                    ["7", "8", "9", "10", "12"],
                    1,
                ),
                mcq(
                    "0303-02",
                    "0186",
                    "log_5 x=3/2 일 때 x 는?",
                    ["sqrt(5)", "5sqrt(5)", "25sqrt(5)", "125", "25"],
                    2,
                ),
                mcq(
                    "0303-03",
                    "0187",
                    "t=log_3 2 일 때 3^(2t+1) 의 값은?",
                    ["6", "8", "12", "18", "24"],
                    3,
                ),
                mcq(
                    "0303-04",
                    "0192",
                    "log_2 24 - log_2 3 + 2log_2(1/2) 의 값은?",
                    ["-1", "0", "1", "2", "3"],
                    3,
                ),
                mcq(
                    "0303-05",
                    "0204",
                    "log_2 M=3, log_2 N=-1 일 때 log_2(MN^2) 의 값은?",
                    ["-3", "-1", "0", "1", "5"],
                    4,
                ),
                mcq(
                    "0303-06",
                    "0204",
                    "log_5 A=2 일 때 log_5(1/A^3) 의 값은?",
                    ["-6", "-3", "-2", "2", "6"],
                    1,
                ),
                mcq(
                    "0303-07",
                    "0205",
                    "log_7 2=a, log_7 3=b 일 때 log_(1/7)54 는?",
                    ["a+3b", "-(a+3b)", "-a+3b", "a-3b", "3a+b"],
                    2,
                ),
                mcq(
                    "0303-08",
                    "0205",
                    "log_(1/2)8 의 값은?",
                    ["-3", "-2", "-1", "2", "3"],
                    1,
                ),
                mcq(
                    "0303-09",
                    "0192",
                    "log_3 15=2+a 일 때 a 는?",
                    ["log_3 5", "log_3(5/3)", "log_3(15/2)", "log_3(3/5)", "log_5 3"],
                    2,
                ),
                mcq(
                    "0303-10",
                    "0201",
                    "A=log_2 8, B=log_3 9, C=log_(1/3)9 의 대소관계는?",
                    ["A<B<C", "A<C<B", "B<A<C", "C<B<A", "C<A<B"],
                    4,
                ),
            ],
        },
        "wed": {
            "title": "3/4(수) 고2 로그 파생 객관식",
            "description": "오답 원본 추적 태그 포함 (0304-01~10)",
            "problems": [
                mcq(
                    "0304-01",
                    "0203",
                    "(log_2 7)/(log_7 2) 를 간단히 하면?",
                    ["(log_2 7)^2", "1", "log_2 7", "1/log_2 7", "log_7 7"],
                    1,
                ),
                mcq(
                    "0304-02",
                    "0203",
                    "log_9 3 의 값은?",
                    ["1/3", "1/2", "2", "3", "-1/2"],
                    2,
                ),
                mcq(
                    "0304-03",
                    "0204",
                    "log_3 M=2, log_3 N=-1 일 때 log_3(M^2/N) 의 값은?",
                    ["-5", "-3", "1", "3", "5"],
                    5,
                ),
                mcq(
                    "0304-04",
                    "0205",
                    "log_(1/2)32 의 값은?",
                    ["-5", "-4", "-3", "4", "5"],
                    1,
                ),
                mcq(
                    "0304-05",
                    "0192",
                    "log_2 3 + log_2 12 - log_2 18 의 값은?",
                    ["-1", "0", "1", "2", "3"],
                    3,
                ),
                mcq(
                    "0304-06",
                    "0201",
                    "A=5^(log_5 2), B=log_2 8, C=2^(log_2 5) 의 대소관계는?",
                    ["A<B<C", "A<C<B", "B<A<C", "C<A<B", "B<C<A"],
                    1,
                ),
                mcq(
                    "0304-07",
                    "0203",
                    "t=log_a b 일 때 (log_a b/log_b a)+(log_b a/log_a b) 는?",
                    ["t+1/t", "t^2+1/t^2", "(t+1)^2", "2", "1"],
                    2,
                ),
                mcq(
                    "0304-08",
                    "0203",
                    "log_2 3=a 일 때 log_3 8 은?",
                    ["a/3", "3/a", "a^3", "1/a", "3a"],
                    2,
                ),
                mcq(
                    "0304-09",
                    "0204",
                    "log_5 2=a, log_5 3=b 일 때 log_5 12 는?",
                    ["a+b", "2a+b", "a+2b", "2a-b", "b-2a"],
                    2,
                ),
                mcq(
                    "0304-10",
                    "0205",
                    "log_7 2=a, log_7 3=b 일 때 log_(1/7)(2/21) 는?",
                    ["a+b+1", "-a+b+1", "a-b-1", "-a-b+1", "-a+b-1"],
                    2,
                ),
            ],
        },
        "thu": {
            "title": "3/5(목) 고2 로그 파생 객관식",
            "description": "오답 원본 추적 태그 포함 (0305-01~10)",
            "problems": [
                mcq(
                    "0305-01",
                    "0206",
                    "a=log_3 10, b=log_3(5/2), log_3 20=pa+qb 일 때 p+q 는?",
                    ["-1", "0", "1", "2", "3"],
                    3,
                ),
                mcq(
                    "0305-02",
                    "0207",
                    "log_2 3=a, log_3 5=b 일 때 log_30 40 은?",
                    [
                        "(1+a+ab)/(3+ab)",
                        "(3+ab)/(1+a+ab)",
                        "(3+a+ab)/(1+a+ab)",
                        "(3+ab)/(1+a)",
                        "(3+ab)/(a+ab)",
                    ],
                    2,
                ),
                mcq(
                    "0305-03",
                    "0207",
                    "log_2 3=a, log_3 5=b 일 때 log_6 20 은?",
                    [
                        "(2+ab)/(1+a+ab)",
                        "(1+a)/(2+ab)",
                        "(2+a+ab)/(1+a)",
                        "(2+ab)/(1+a)",
                        "(2+ab)/(a+ab)",
                    ],
                    4,
                ),
                mcq(
                    "0305-04",
                    "0208",
                    "log_3 2=a, log_3 5=b, log_7 5=c 일 때 log_21 70 은?",
                    [
                        "(a+b+b/c)/(1+b/c)",
                        "(a+b+b/c)/(1+c)",
                        "(a+b+c)/(1+b/c)",
                        "(a+b+b/c)/(b/c)",
                        "(a+b)/(1+b/c)",
                    ],
                    1,
                ),
                mcq(
                    "0305-05",
                    "0208",
                    "log_3 2=a, log_3 5=b, log_7 5=c 일 때 log_14 35 는?",
                    [
                        "(b+b/c)/(a+b)",
                        "(b+b/c)/(a+b+b/c)",
                        "(b-b/c)/(a+b/c)",
                        "(b+b/c)/(a-b/c)",
                        "(b+b/c)/(a+b/c)",
                    ],
                    5,
                ),
                mcq(
                    "0305-06",
                    "0205",
                    "log_7 2=a, log_7 5=b 일 때 log_(1/7)20 은?",
                    ["2a+b", "-(2a+b)", "-2a+b", "2a-b", "-(a+2b)"],
                    2,
                ),
                mcq(
                    "0305-07",
                    "0206",
                    "log_2 3=a, log_2 5=b, log_2 75=pa+qb 일 때 p+q 는?",
                    ["1", "2", "4", "3", "5"],
                    4,
                ),
                mcq(
                    "0305-08",
                    "0207",
                    "log_2 3=a, log_3 5=b 일 때 log_60 45 는?",
                    [
                        "(2+a+ab)/(2a+ab)",
                        "(2a+ab)/(2+a)",
                        "(2a+ab)/(2+a+ab)",
                        "(2a+ab)/(2+a+2ab)",
                        "(a+ab)/(2+a+ab)",
                    ],
                    3,
                ),
                mcq(
                    "0305-09",
                    "0208",
                    "log_3 2=a, log_3 5=b, log_7 5=c 일 때 log_28 140 은?",
                    [
                        "(2a+b+b/c)/(2a+b)",
                        "(2a+b+b/c)/(2a+b/c+1)",
                        "(2a+b)/(2a+b/c)",
                        "(2a+b+b/c)/(a+b/c)",
                        "(2a+b+b/c)/(2a+b/c)",
                    ],
                    5,
                ),
                mcq(
                    "0305-10",
                    "0206",
                    "a=log_3 4, b=log_3 9, log_3 12=pa+qb 일 때 p+q 는?",
                    ["1", "3/2", "2", "5/2", "3"],
                    2,
                ),
            ],
        },
        "fri": {
            "title": "3/6(금) 고2 로그 파생 객관식",
            "description": "오답 원본 추적 태그 포함 (0306-01~10)",
            "problems": [
                mcq(
                    "0306-01",
                    "0202",
                    "2^(log_2 3) * 3^(log_3 5) 의 값은?",
                    ["5", "10", "15", "20", "30"],
                    3,
                ),
                mcq(
                    "0306-02",
                    "0202",
                    "5^(log_5 2 - 2log_5 3) 의 값은?",
                    ["2/9", "9/2", "2/3", "3/2", "9"],
                    1,
                ),
                mcq(
                    "0306-03",
                    "0202",
                    "3^(log_3 12) / 2^(log_2 3) 의 값은?",
                    ["2", "3", "4", "6", "12"],
                    3,
                ),
                mcq(
                    "0306-04",
                    "0209",
                    "x=2^a, y=2^b 일 때 log_(xy^2)(x^3y) 는?",
                    [
                        "(a+2b)/(3a+b)",
                        "(3a+b)/(a+2b)",
                        "(3a+b)/(a+b)",
                        "(3a+b)/(2a+b)",
                        "(a+3b)/(a+2b)",
                    ],
                    2,
                ),
                mcq(
                    "0306-05",
                    "0209",
                    "x=3^a, y=3^b 일 때 log_(x^2y)(xy^4) 는?",
                    [
                        "(2a+b)/(a+4b)",
                        "(a+4b)/(a+b)",
                        "(a+4b)/(2a+4b)",
                        "(a+4b)/(2a+b)",
                        "(4a+b)/(2a+b)",
                    ],
                    4,
                ),
                mcq(
                    "0306-06",
                    "0210",
                    "4^a=5 일 때 log_64 25 = p a, p 는?",
                    ["1/3", "2/3", "3/2", "2", "3"],
                    2,
                ),
                mcq(
                    "0306-07",
                    "0211",
                    "27^x=a, 27^y=b 일 때 log_3(a/b^2)=px+qy, pq 는?",
                    ["-18", "-12", "-9", "6", "18"],
                    1,
                ),
                mcq(
                    "0306-08",
                    "0211",
                    "16^x=a, 16^y=b 일 때 log_2(a^2*sqrt(b))=px+qy, p+q 는?",
                    ["6", "8", "10", "12", "16"],
                    3,
                ),
                mcq(
                    "0306-09",
                    "0187",
                    "t=log_5 2 일 때 5^(t-1) 의 값은?",
                    ["5/2", "2/5", "10", "1/10", "1/5"],
                    2,
                ),
                mcq(
                    "0306-10",
                    "0202",
                    "(1/3)^(log_(1/3)5) 의 값은?",
                    ["1/5", "3", "1/3", "5", "15"],
                    4,
                ),
            ],
        },
        "sat": {
            "title": "3/7(토) 고2 로그 파생 객관식",
            "description": "오답 원본 추적 태그 포함 (0307-01~10)",
            "problems": [
                mcq(
                    "0307-01",
                    "0189",
                    "log_(x-1)(5-x) 가 정의되도록 하는 정수 x 의 개수는?",
                    ["0", "1", "2", "3", "4"],
                    3,
                ),
                mcq(
                    "0307-02",
                    "0190",
                    "log_(x-2)(7-x), log_(x-1)(x-4) 가 모두 정의되도록 하는 정수 x 의 개수는?",
                    ["0", "1", "2", "3", "4"],
                    3,
                ),
                mcq(
                    "0307-03",
                    "0191",
                    "모든 실수 x 에 대해 log_a(ax^2-4ax+9) 가 정의되도록 하는 정수 a 의 개수는?",
                    ["0", "1", "2", "3", "4"],
                    2,
                ),
                mcq(
                    "0307-04",
                    "0212",
                    "9^x=16^y=144 일 때 1/x + 1/y 의 값은?",
                    ["1/2", "1", "3/2", "2", "3"],
                    2,
                ),
                mcq(
                    "0307-05",
                    "0212",
                    "4^x=16^y=256 일 때 1/x + 1/y 의 값은?",
                    ["1/4", "1/2", "2/3", "3/4", "1"],
                    4,
                ),
                mcq(
                    "0307-06",
                    "0201",
                    "A=2^(log_2 7-1), B=log_7 49, C=log_(1/7)7 의 대소관계는?",
                    ["A<B<C", "A<C<B", "B<C<A", "C<B<A", "C<A<B"],
                    4,
                ),
                mcq(
                    "0307-07",
                    "0202",
                    "3^(log_3 20-log_3 5) 의 값은?",
                    ["2", "3", "4", "5", "6"],
                    3,
                ),
                mcq(
                    "0307-08",
                    "0207",
                    "log_2 3=a, log_2 5=b 일 때 log_15 40 은?",
                    [
                        "(a+b)/(3+b)",
                        "(3+b)/(a+b)",
                        "(3+ab)/(a+b)",
                        "(3+b)/(1+a+b)",
                        "(3+ab)/(1+a+b)",
                    ],
                    2,
                ),
                mcq(
                    "0307-09",
                    "0208",
                    "log_3 2=a, log_3 5=b, log_7 5=c 일 때 log_56 280 은?",
                    [
                        "(3a+b+b/c)/(3a+b)",
                        "(3a+b)/(3a+b/c)",
                        "(3a+b/c)/(3a+b+b/c)",
                        "(3a+b+b/c)/(3a+b/c+1)",
                        "(3a+b+b/c)/(3a+b/c)",
                    ],
                    5,
                ),
                mcq(
                    "0307-10",
                    "0192",
                    "log_2 18=1+a 일 때 a 의 값은?",
                    ["log_2 3", "log_2 9", "log_2 6", "log_2(9/2)", "log_3 2"],
                    2,
                ),
            ],
        },
    }


def ensure_common_label(db_path: Path) -> None:
    try:
        create_homework_label(
            key=COMMON_LABEL_KEY,
            label=COMMON_LABEL_TEXT,
            kind="preset",
            created_by="seed-script",
            path=db_path,
        )
    except ValueError:
        pass


def import_all(db_path: Path) -> None:
    init_db(db_path)
    ensure_common_label(db_path)

    summary: list[str] = []
    payloads = day_payloads()
    for day_key in ["tue", "wed", "thu", "fri", "sat"]:
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
        for problem_id in problem_ids:
            set_homework_problem_labels(
                problem_id=problem_id,
                label_keys=[COMMON_LABEL_KEY],
                path=db_path,
            )
        summary.append(
            f"{day_key}: batch={batch_id}, created={result['createdProblemCount']}, skipped={result['skippedProblemCount']}"
        )

    print("Imported grade2 logarithm homework bank:")
    for line in summary:
        print(f"- {line}")


def main() -> None:
    db_path = BACKEND_ROOT / "data" / "app.db"
    import_all(db_path)


if __name__ == "__main__":
    main()
