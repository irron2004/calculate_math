"""Utilities for generating procedural arithmetic problem sets."""

from __future__ import annotations

from random import Random
from typing import Dict, List, Optional


_CONTEXT_BY_OPERATION: Dict[str, str] = {
    "add": "life",
    "sub": "life",
    "mul": "data",
    "div": "geometry",
}

_SYMBOL_BY_OPERATION: Dict[str, str] = {
    "add": "+",
    "sub": "-",
    "mul": "×",
    "div": "÷",
}

CATEGORY_LABEL_BY_OPERATION: Dict[str, str] = {
    "add": "덧셈",
    "sub": "뺄셈",
    "mul": "곱셈",
    "div": "나눗셈",
}

CATEGORY_OPERATION_DEFAULTS: Dict[str, tuple[str, int]] = {
    "덧셈": ("add", 2),
    "뺄셈": ("sub", 2),
    "곱셈": ("mul", 1),
    "나눗셈": ("div", 1),
}


def _random_range(randomizer: Random, digits: int) -> int:
    lower = 0 if digits == 1 else 10 ** (digits - 1)
    upper = (10**digits) - 1
    return randomizer.randint(lower, upper)


def _generate_operands(randomizer: Random, operation: str, digits: int) -> tuple[int, int, int]:
    if operation == "div":
        divisor = max(1, _random_range(randomizer, digits) or 1)
        quotient = max(1, _random_range(randomizer, digits) or 1)
        dividend = divisor * quotient
        return dividend, divisor, quotient
    lhs = _random_range(randomizer, digits)
    rhs = _random_range(randomizer, digits)
    if operation == "sub" and lhs < rhs:
        lhs, rhs = rhs, lhs
    return lhs, rhs, 0


def _format_question(operation: str, lhs: int, rhs: int) -> str:
    symbol = _SYMBOL_BY_OPERATION.get(operation, "?")
    return f"{lhs} {symbol} {rhs} = ?"


def _solve(operation: str, lhs: int, rhs: int, quotient: int) -> int:
    if operation == "add":
        return lhs + rhs
    if operation == "sub":
        return lhs - rhs
    if operation == "mul":
        return lhs * rhs
    # division
    return quotient


def generate_problem_set(
    operation: str,
    digits: int,
    count: int,
    *,
    seed: Optional[int] = None,
    include_answers: bool = False,
) -> Dict[str, object]:
    """Generate a deterministic set of arithmetic problems."""

    normalized_operation = operation.lower()
    if normalized_operation not in _SYMBOL_BY_OPERATION:
        raise ValueError(f"Unsupported operation '{operation}'.")

    clamped_digits = max(1, min(digits, 4))
    clamped_count = max(1, min(count, 50))
    randomizer = Random(seed)

    items: List[Dict[str, object]] = []
    for index in range(1, clamped_count + 1):
        lhs, rhs, quotient = _generate_operands(randomizer, normalized_operation, clamped_digits)
        answer = _solve(normalized_operation, lhs, rhs, quotient)
        question = _format_question(normalized_operation, lhs, rhs)
        problem_id = f"{normalized_operation}-{clamped_digits}-{index:02d}-{lhs}-{rhs}"
        entry: Dict[str, object] = {
            "id": problem_id,
            "question": question,
            "ctx": _CONTEXT_BY_OPERATION.get(normalized_operation, "life"),
            "operands": {"lhs": lhs, "rhs": rhs},
        }
        if include_answers:
            entry["answer"] = answer
        items.append(entry)

    return {
        "operation": normalized_operation,
        "digits": clamped_digits,
        "count": len(items),
        "seed": seed,
        "items": items,
    }


def resolve_generated_problem(problem_id: str) -> Optional[Dict[str, object]]:
    """Attempt to resolve a generated problem identifier into its solution metadata."""

    try:
        operation, digits_str, _index_str, lhs_str, rhs_str = problem_id.split("-", 4)
    except ValueError:
        return None

    if operation not in _SYMBOL_BY_OPERATION:
        return None

    try:
        lhs = int(lhs_str)
        rhs = int(rhs_str)
        digits = int(digits_str)
    except ValueError:
        return None

    if operation == "div":
        if rhs == 0 or lhs % rhs != 0:
            return None
        answer = lhs // rhs
    elif operation == "add":
        answer = lhs + rhs
    elif operation == "sub":
        answer = lhs - rhs
    elif operation == "mul":
        answer = lhs * rhs
    else:
        return None

    return {
        "operation": operation,
        "digits": max(1, digits),
        "answer": answer,
        "context": _CONTEXT_BY_OPERATION.get(operation, "life"),
        "category": CATEGORY_LABEL_BY_OPERATION.get(operation, "문제"),
    }


__all__ = [
    "CATEGORY_OPERATION_DEFAULTS",
    "CATEGORY_LABEL_BY_OPERATION",
    "generate_problem_set",
    "resolve_generated_problem",
]
