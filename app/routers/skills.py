from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter, Request, Response

from ..feature_flags import assign_skill_tree_variant
from ..skills_loader import get_skill_graph
from ..bipartite_loader import get_bipartite_graph

router = APIRouter(prefix="/api/v1", tags=["skills"])


@router.get("/skills/tree")
async def api_get_skill_tree(request: Request, response: Response) -> Dict[str, Any]:
    # TODO: integrate user progress once authentication/progress storage is available.
    skill_graph = get_skill_graph()
    bipartite_graph = get_bipartite_graph()
    assignment = assign_skill_tree_variant(request, response)
    payload: Dict[str, Any] = {
        "graph": skill_graph.model_dump(by_alias=True),
        "bipartite_graph": bipartite_graph.model_dump(by_alias=True),
        "progress": {},
        "unlocked": {},
        "experiment": assignment.to_payload(),
    }
    return payload


__all__ = ["router"]
