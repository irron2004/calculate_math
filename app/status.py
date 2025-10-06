from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict

from fastapi import FastAPI
from jinja2 import TemplateNotFound, __version__ as jinja_version

from .config import get_settings
from .problem_bank import list_categories


def _get_app_version(app: FastAPI) -> str:
    settings = getattr(app.state, "settings", None)
    if settings is not None:
        return getattr(settings, "app_version", app.version or "unknown")
    if app.version:
        return app.version
    return get_settings().app_version


def _dependency_status() -> Dict[str, Dict[str, Any]]:
    return {
        "jinja2": {
            "status": "ok",
            "version": jinja_version,
        }
    }


def _uptime_status(app: FastAPI) -> Dict[str, Any]:
    started_at = getattr(app.state, "start_time", None)
    if started_at is None:
        return {"status": "unknown"}

    uptime_seconds = max(0, datetime.now(tz=timezone.utc).timestamp() - started_at)
    return {
        "status": "ok",
        "seconds": uptime_seconds,
        "started_at": datetime.fromtimestamp(started_at, tz=timezone.utc).isoformat()
    }


def _templates_status(app: FastAPI) -> Dict[str, Any]:
    templates = getattr(app.state, "templates", None)
    if templates is None:
        return {"status": "error", "detail": "Templates are not configured"}

    try:
        template = templates.get_template("index.html")
    except TemplateNotFound as exc:  # pragma: no cover - defensive guard
        return {"status": "error", "detail": str(exc)}

    return {
        "status": "ok",
        "template": template.name,
    }


def _problem_bank_status() -> Dict[str, Any]:
    try:
        categories = list_categories()
    except Exception as exc:  # pragma: no cover - defensive guard
        return {"status": "error", "detail": str(exc)}

    return {
        "status": "ok" if categories else "error",
        "category_count": len(categories),
    }


def _bridge_status() -> Dict[str, Any]:
    try:
        from .bridge_bank import list_bridge_units

        units = list_bridge_units()
    except Exception as exc:  # pragma: no cover - defensive guard
        return {"status": "error", "detail": str(exc)}

    return {
        "status": "ok" if units else "degraded",
        "unit_count": len(units),
    }


def collect_liveness_status(app: FastAPI) -> Dict[str, Any]:
    version = _get_app_version(app)
    details = {
        "application": {"status": "running"},
        "dependencies": _dependency_status(),
        "uptime": _uptime_status(app),
    }
    return {"status": "healthy", "version": version, "details": details}


def collect_readiness_status(app: FastAPI) -> Dict[str, Any]:
    payload = collect_liveness_status(app)

    readiness_checks = {
        "templates": _templates_status(app),
        "problem_bank": _problem_bank_status(),
        "bridge_units": _bridge_status(),
    }
    is_ready = all(check["status"] == "ok" for check in readiness_checks.values())

    payload["status"] = "ready" if is_ready else "degraded"
    payload["details"]["readiness"] = readiness_checks
    return payload


__all__ = [
    "collect_liveness_status",
    "collect_readiness_status",
]
