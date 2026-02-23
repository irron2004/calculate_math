from __future__ import annotations

from typing import Any, Dict, List, Optional


def validate_weekly_homework_payload(
    payload: Any,
    *,
    expected_problem_count: Optional[int] = 20,
) -> Dict[str, Any]:
    if not isinstance(payload, dict):
        raise ValueError("payload must be an object")

    title = payload.get("title")
    if not isinstance(title, str) or not title.strip():
        raise ValueError("title must be a non-empty string")

    description = payload.get("description")
    if description is not None and not isinstance(description, str):
        raise ValueError("description must be a string")

    problems = payload.get("problems")
    if not isinstance(problems, list):
        raise ValueError("problems must be an array")

    if expected_problem_count is not None and len(problems) != expected_problem_count:
        raise ValueError(
            f"problems must have exactly {expected_problem_count} item(s), got {len(problems)}"
        )

    normalized_problems: List[Dict[str, Any]] = []
    for i, problem in enumerate(problems):
        if not isinstance(problem, dict):
            raise ValueError(f"problem {i + 1} must be an object")

        problem_type = problem.get("type")
        if problem_type not in {"objective", "subjective"}:
            raise ValueError(f"problem {i + 1} has invalid type")

        question = problem.get("question")
        if not isinstance(question, str) or not question.strip():
            raise ValueError(f"problem {i + 1} question must be a non-empty string")

        options = problem.get("options")
        if problem_type == "objective":
            if not isinstance(options, list) or len(options) < 2:
                raise ValueError(
                    f"problem {i + 1} options must have at least 2 item(s)"
                )
            normalized_options: List[str] = []
            for j, opt in enumerate(options):
                if not isinstance(opt, str) or not opt.strip():
                    raise ValueError(
                        f"problem {i + 1} options[{j}] must be a non-empty string"
                    )
                normalized_options.append(opt)
            options = normalized_options
        else:
            options = None

        answer = problem.get("answer")
        if answer is not None and not isinstance(answer, str):
            raise ValueError(f"problem {i + 1} answer must be a string")
        if (
            problem_type == "objective"
            and isinstance(answer, str)
            and answer not in (options or [])
        ):
            raise ValueError(f"problem {i + 1} answer must match one of the options")

        normalized_problems.append(
            {
                "type": problem_type,
                "question": question,
                "options": options,
                "answer": answer,
            }
        )

    return {
        "title": title.strip(),
        "description": description.strip() if isinstance(description, str) else None,
        "problems": normalized_problems,
    }
