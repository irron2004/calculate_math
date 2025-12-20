from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from ..level1_loader import (
    Level1DataError,
    Level1ValidationError,
    get_level1_dataset,
)
from ..schemas.level1 import Level1Dataset

router = APIRouter(prefix="/api/v1", tags=["level1"])


@router.get("/level1", response_model=Level1Dataset, summary="Level 1 dataset")
async def get_level1_payload() -> Level1Dataset:
    try:
        return get_level1_dataset()
    except Level1ValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "message": "Level 1 dataset validation failed",
                "errors": [issue.to_dict() for issue in exc.issues],
            },
        ) from exc
    except Level1DataError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"message": str(exc)},
        ) from exc


__all__ = ["router"]
