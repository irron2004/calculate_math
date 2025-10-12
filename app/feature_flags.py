"""Feature flag helpers for experiment rollouts."""

from __future__ import annotations

import hashlib
import logging
import secrets
from dataclasses import dataclass
from typing import Any, Optional

from fastapi import Request, Response

from .config import Settings, get_settings

logger = logging.getLogger("calculate_service.experiments")

SKILL_TREE_EXPERIMENT_NAME = "skill_tree_layout"
SKILL_TREE_COOKIE_NAME = "exp_skill_tree_layout"
SKILL_TREE_HEADER_NAME = "X-Experiment-Skill-Tree-Layout"
SKILL_TREE_VARIANTS = {"tree", "list"}
_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30  # 30 days


@dataclass(frozen=True)
class ExperimentAssignment:
    """Represents a single experiment assignment decision."""

    name: str
    variant: str
    source: str
    request_id: Optional[str]
    rollout: int
    bucket: Optional[int] = None

    def to_payload(self) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "name": self.name,
            "variant": self.variant,
            "source": self.source,
            "request_id": self.request_id,
            "rollout": self.rollout,
        }
        if self.bucket is not None:
            payload["bucket"] = self.bucket
        return payload


def _resolve_settings(request: Request) -> Settings:
    stored = getattr(request.app.state, "settings", None)
    if isinstance(stored, Settings):
        return stored
    return get_settings()


def _normalize_variant(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    candidate = value.strip().lower()
    if candidate in SKILL_TREE_VARIANTS:
        return candidate
    return None


def _resolve_subject(request: Request, settings: Settings) -> str:
    session_cookie = request.cookies.get(settings.session_cookie_name)
    if session_cookie:
        return session_cookie
    request_id = getattr(request.state, "request_id", None)
    if request_id:
        return str(request_id)
    forwarded = request.headers.get("X-Request-ID")
    if forwarded:
        return forwarded
    return secrets.token_hex(16)


def _bucket_variant(subject: str, rollout: int) -> tuple[str, int]:
    digest = hashlib.sha256(subject.encode("utf-8")).digest()
    bucket = int.from_bytes(digest[:4], "big") % 100
    if rollout <= 0:
        return "tree", bucket
    if rollout >= 100:
        return "list", bucket
    variant = "list" if bucket < rollout else "tree"
    return variant, bucket


def _log_assignment(
    assignment: ExperimentAssignment,
    subject: str,
    request: Request,
) -> None:
    subject_hash = hashlib.sha256(subject.encode("utf-8")).hexdigest()[:16]
    logger.info(
        "experiment.assignment",
        extra={
            "event": "experiment_assignment",
            "experiment": assignment.name,
            "variant": assignment.variant,
            "source": assignment.source,
            "bucket": assignment.bucket,
            "rollout": assignment.rollout,
            "request_id": assignment.request_id,
            "subject_hash": subject_hash,
            "path": request.url.path,
        },
    )


def assign_skill_tree_variant(request: Request, response: Response) -> ExperimentAssignment:
    """Assign and persist the skill tree layout experiment variant."""

    settings = _resolve_settings(request)
    rollout = settings.skill_tree_list_rollout_percentage
    subject = _resolve_subject(request, settings)
    cookie_variant = _normalize_variant(request.cookies.get(SKILL_TREE_COOKIE_NAME))
    selected_variant: str
    bucket: Optional[int]
    source: str

    if cookie_variant is not None:
        selected_variant = cookie_variant
        bucket = None
        source = "cookie"
    else:
        selected_variant, bucket = _bucket_variant(subject, rollout)
        source = "assignment"
        response.set_cookie(
            SKILL_TREE_COOKIE_NAME,
            selected_variant,
            max_age=_COOKIE_MAX_AGE_SECONDS,
            httponly=True,
            samesite="lax",
            secure=request.url.scheme == "https",
            path="/",
        )

    response.headers[SKILL_TREE_HEADER_NAME] = selected_variant

    assignment = ExperimentAssignment(
        name=SKILL_TREE_EXPERIMENT_NAME,
        variant=selected_variant,
        source=source,
        request_id=getattr(request.state, "request_id", None),
        rollout=rollout,
        bucket=bucket,
    )

    _log_assignment(assignment, subject, request)

    return assignment


__all__ = [
    "ExperimentAssignment",
    "SKILL_TREE_COOKIE_NAME",
    "SKILL_TREE_EXPERIMENT_NAME",
    "SKILL_TREE_HEADER_NAME",
    "assign_skill_tree_variant",
]
