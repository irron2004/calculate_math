"""Utilities for working with problem category configuration."""

from __future__ import annotations

from itertools import cycle
from typing import Iterable

from .config import get_settings
from .problem_bank import list_categories


_ICON_MAP: dict[str, str] = {
    "덧셈": "➕",
    "뺄셈": "➖",
    "곱셈": "✖️",
    "나눗셈": "➗",
}

_DESCRIPTION_MAP: dict[str, str] = {
    "덧셈": "두 자리 수 덧셈으로 기본 연산 감각을 다듬어요.",
    "뺄셈": "받아내림·올림 개념을 시각적으로 연습합니다.",
    "곱셈": "구구단과 배열 모델로 곱셈 패턴을 익혀보세요.",
    "나눗셈": "나눗셈을 등분·몫 관점으로 이해하도록 지도합니다.",
}

_ACCENT_CLASSES: tuple[str, ...] = (
    "from-sky-400/30 to-sky-500/20",
    "from-emerald-400/30 to-emerald-500/20",
    "from-purple-400/30 to-purple-500/20",
    "from-orange-400/30 to-orange-500/20",
)


def resolve_allowed_categories() -> list[str]:
    """Return the list of categories allowed for the current runtime."""

    settings = get_settings()
    configured = getattr(settings, "allowed_problem_categories", None) or []
    normalized = [item for item in configured if isinstance(item, str) and item.strip()]
    if normalized:
        return normalized
    return list_categories()


def resolve_primary_category(categories: Iterable[str] | None = None) -> str | None:
    """Return the primary category for navigation shortcuts."""

    if categories is None:
        categories = resolve_allowed_categories()
    for label in categories:
        if isinstance(label, str) and label.strip():
            return label
    return None


def build_category_cards(categories: Iterable[str]) -> list[dict[str, str]]:
    """Return metadata used to render category hero cards on the homepage."""

    cards: list[dict[str, str]] = []
    accent_cycle = cycle(_ACCENT_CLASSES)
    for label in categories:
        if not isinstance(label, str) or not label.strip():
            continue
        name = label.strip()
        icon = _ICON_MAP.get(name, "📘")
        description = _DESCRIPTION_MAP.get(name, f"{name} 문제 세트를 연습해보세요.")
        accent = next(accent_cycle)
        cards.append(
            {
                "emoji": icon,
                "title": name,
                "description": description,
                "href": f"/problems?category={name}",
                "accent": accent,
                "cta": f"{name} 문제 풀기",
            }
        )
    return cards


__all__ = [
    "build_category_cards",
    "resolve_allowed_categories",
    "resolve_primary_category",
]
