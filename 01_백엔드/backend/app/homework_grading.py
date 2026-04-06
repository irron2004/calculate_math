from __future__ import annotations

from typing import Optional


def resolve_objective_student_answer(
    student_answer: Optional[str], options: Optional[list[str]]
) -> Optional[str]:
    if student_answer is None:
        return None

    normalized_answer = student_answer.strip()
    if not normalized_answer:
        return None

    if not options:
        return normalized_answer

    try:
        option_index = int(normalized_answer)
    except ValueError:
        return normalized_answer

    if option_index < 1 or option_index > len(options):
        return normalized_answer

    return str(options[option_index - 1])


def is_objective_answer_correct(
    student_answer: Optional[str],
    correct_answer: Optional[str],
    options: Optional[list[str]],
) -> bool:
    if correct_answer is None:
        return False

    resolved_answer = resolve_objective_student_answer(student_answer, options)
    if resolved_answer is None:
        return False

    return resolved_answer == correct_answer
