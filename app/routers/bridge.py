from __future__ import annotations

from fastapi import APIRouter, HTTPException, Path, status

from ..bridge_bank import BridgeDataError, get_bridge_unit, list_bridge_units

router = APIRouter(prefix="/api", tags=["bridge"])


@router.get("/bridge-units", summary="S2 브리지 유닛 목록")
async def bridge_units() -> dict[str, object]:
    units = [unit.summary() for unit in list_bridge_units()]
    return {
        "count": len(units),
        "units": units,
    }


@router.get(
    "/bridge-units/{sequence_id}",
    summary="특정 브리지 유닛 상세",
)
async def bridge_unit_detail(
    sequence_id: str = Path(..., description="브리지 유닛 sequence_id"),
) -> dict[str, object]:
    try:
        unit = get_bridge_unit(sequence_id)
    except BridgeDataError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "type": "https://360me.app/bridge/not-found",
                "title": "브리지 유닛을 찾을 수 없습니다",
                "status": status.HTTP_404_NOT_FOUND,
                "detail": str(exc),
            },
        ) from exc

    return unit.to_dict()


__all__ = ["router"]
