from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter, Request

from ..skills_loader import get_skill_graph

router = APIRouter(prefix="/api/v1", tags=["skills"])


@router.get("/skills/tree")
async def api_get_skill_tree(request: Request) -> Dict[str, Any]:
    # TODO: integrate user progress once authentication/progress storage is available.
    skill_graph = get_skill_graph()
    response: Dict[str, Any] = {
        "graph": skill_graph,
        "progress": {},
        "unlocked": {},
    }
    return response


__all__ = ["router"]
