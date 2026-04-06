from __future__ import annotations

import pytest

from app.homework_problem_bank import validate_weekly_homework_payload


def test_weekly_validator_accepts_valid_payload() -> None:
    payload = {
        "title": "응용 나눗셈 변형 (월요일)",
        "description": "테스트",
        "problems": [
            {
                "type": "subjective",
                "question": "문제 1",
                "answer": "7",
            },
            {
                "type": "objective",
                "question": "문제 2",
                "options": ["6개", "7개", "8개"],
                "answer": "7개",
            },
        ],
    }

    result = validate_weekly_homework_payload(payload, expected_problem_count=2)
    assert result["title"] == payload["title"]
    assert len(result["problems"]) == 2


def test_weekly_validator_rejects_objective_without_options() -> None:
    payload = {
        "title": "t",
        "problems": [
            {
                "type": "objective",
                "question": "문제",
                "answer": "A",
            }
        ],
    }

    with pytest.raises(ValueError, match="options"):
        validate_weekly_homework_payload(payload, expected_problem_count=1)


def test_weekly_validator_rejects_objective_answer_not_in_options() -> None:
    payload = {
        "title": "t",
        "problems": [
            {
                "type": "objective",
                "question": "문제",
                "options": ["A", "B"],
                "answer": "C",
            }
        ],
    }

    with pytest.raises(ValueError, match="answer"):
        validate_weekly_homework_payload(payload, expected_problem_count=1)
