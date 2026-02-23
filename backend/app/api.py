"""API routes for graph and problem read endpoints."""

import json
import logging
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, List
from uuid import uuid4

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Body,
    Depends,
    File,
    Form,
    Query,
    Request,
    UploadFile,
)
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.util import get_remote_address

from .auth import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_user,
    TokenData,
    hash_password,
    hash_token,
    require_admin,
    verify_password,
)
from .db import (
    check_homework_submission_exists,
    create_homework_assignment,
    create_homework_submission,
    create_user,
    create_praise_sticker,
    delete_homework_assignment,
    fetch_latest_graph,
    fetch_problems,
    get_praise_sticker_summary,
    get_homework_assignment,
    get_homework_assignment_admin,
    get_homework_submission_for_review,
    get_homework_submission_with_files,
    get_pending_homework_count,
    get_refresh_token_by_hash,
    get_student_profile,
    get_user_by_email,
    get_user_by_id,
    get_user_by_username,
    get_submission_admin,
    get_submission_file,
    has_praise_sticker_for_homework,
    list_all_homework_assignments_admin,
    list_homework_assignments_for_student,
    list_praise_stickers,
    list_students_with_profiles,
    list_users,
    revoke_all_refresh_tokens,
    revoke_refresh_token,
    save_homework_submission_file,
    store_refresh_token,
    update_homework_assignment,
    update_user_password,
    update_user_praise_sticker_enabled,
    upsert_student_profile,
    update_homework_submission_review,
    update_last_login,
    create_homework_label,
    import_homework_problem_batch,
    list_homework_labels,
    list_homework_problems_admin,
    set_homework_problem_labels,
    get_homework_problem_bank_problems_by_ids,
)
from .email_service import send_homework_notification
from .models import (
    AdminStudentListResponse,
    AdminStudentFeaturesUpdateRequest,
    AdminStudentFeaturesUpdateResponse,
    StudentProfileGetResponse,
    StudentProfileUpsertRequest,
    AdminAssignmentDetail,
    AdminAssignmentListResponse,
    AdminSubmissionDetail,
    AuthChangePasswordRequest,
    AuthChangePasswordResponse,
    AuthLoginRequest,
    AuthLogoutResponse,
    AuthLogoutRequest,
    AuthRefreshRequest,
    AuthRegisterRequest,
    AuthTokenResponse,
    AuthUser,
    AuthUserListResponse,
    ErrorResponse,
    GraphResponse,
    HomeworkAssignmentCreate,
    HomeworkAssignmentCreateResponse,
    HomeworkAssignmentDetail,
    HomeworkAssignmentListResponse,
    HomeworkAssignmentDeleteResponse,
    HomeworkAssignmentUpdateRequest,
    HomeworkAssignmentUpdateResponse,
    HomeworkPendingCountResponse,
    HomeworkSubmitResponse,
    HomeworkSubmissionReviewRequest,
    HomeworkSubmissionReviewResponse,
    Problem,
    PraiseSticker,
    PraiseStickerCreateRequest,
    PraiseStickerListResponse,
    PraiseStickerSummaryResponse,
    StudentProfile,
    TestStatusResponse,
    HomeworkLabel,
    HomeworkLabelCreateRequest,
    HomeworkLabelListResponse,
    HomeworkProblemBankProblem,
    HomeworkProblemBankListResponse,
    HomeworkProblemLabelSetRequest,
    HomeworkProblemLabelSetResponse,
    HomeworkProblemBankImportRequest,
    HomeworkProblemBankImportResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")

# Rate limiter - imported from main to avoid circular import
limiter = Limiter(key_func=get_remote_address)

TEST_ENDPOINT_RESPONSE = {
    "status": "OK",
    "message": "PM intake test endpoint is active.",
}


@router.get("/health")
def health_check() -> dict:
    """Health check endpoint for container orchestration."""
    return {"status": "ok"}


@router.get("/test", response_model=TestStatusResponse)
def test_endpoint() -> TestStatusResponse:
    """PM Intake test endpoint: returns a fixed OK response."""
    return TestStatusResponse(**TEST_ENDPOINT_RESPONSE)


def _build_auth_user(row: dict) -> AuthUser:
    return AuthUser(
        id=row["id"],
        username=row["username"],
        name=row["name"],
        grade=row["grade"],
        email=row["email"],
        role=row["role"],
        status=row["status"],
        praiseStickerEnabled=bool(row.get("praise_sticker_enabled")),
        createdAt=row["created_at"],
        lastLoginAt=row.get("last_login_at"),
    )


# Email validation regex pattern (RFC 5322 simplified)
EMAIL_REGEX = re.compile(
    r"^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?"
    r"(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$"
)


def _is_valid_email(value: str) -> bool:
    normalized = value.strip().lower()
    if not normalized or len(normalized) > 254:
        return False
    return EMAIL_REGEX.match(normalized) is not None


AUTO_STICKER_REASON = "숙제 우수"


def _require_praise_sticker_enabled(user_row: dict) -> JSONResponse | None:
    if bool(user_row.get("praise_sticker_enabled")):
        return None
    return JSONResponse(
        status_code=403,
        content={
            "error": {
                "code": "FEATURE_DISABLED",
                "message": "칭찬 스티커 기능이 비활성화되었습니다.",
            }
        },
    )


def _parse_iso_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def _normalize_datetime(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _is_on_time(submitted_at: str | None, due_at: str | None) -> bool:
    submitted_dt = _parse_iso_datetime(submitted_at)
    due_dt = _parse_iso_datetime(due_at)
    if not submitted_dt or not due_dt:
        return False
    return _normalize_datetime(submitted_dt) <= _normalize_datetime(due_dt)


@router.post(
    "/auth/register",
    response_model=AuthTokenResponse,
    responses={400: {"model": ErrorResponse}, 429: {"model": ErrorResponse}},
)
@limiter.limit("5/minute")
def register_user(
    request: Request,
    data: AuthRegisterRequest = Body(...),
) -> AuthTokenResponse | JSONResponse:
    username = data.username.strip()
    password = data.password.strip()
    name = data.name.strip()
    grade = data.grade.strip()
    email = data.email.strip().lower()

    if not username:
        return JSONResponse(
            status_code=400,
            content={
                "error": {"code": "INVALID_USERNAME", "message": "아이디를 입력하세요."}
            },
        )
    if len(username) < 3:
        return JSONResponse(
            status_code=400,
            content={
                "error": {
                    "code": "INVALID_USERNAME",
                    "message": "아이디는 3자 이상이어야 합니다.",
                }
            },
        )
    if not password or len(password) < 8:
        return JSONResponse(
            status_code=400,
            content={
                "error": {
                    "code": "INVALID_PASSWORD",
                    "message": "비밀번호는 8자 이상이어야 합니다.",
                }
            },
        )
    if not name:
        return JSONResponse(
            status_code=400,
            content={
                "error": {"code": "INVALID_NAME", "message": "이름을 입력하세요."}
            },
        )
    if not grade:
        return JSONResponse(
            status_code=400,
            content={
                "error": {"code": "INVALID_GRADE", "message": "학년을 입력하세요."}
            },
        )
    if not _is_valid_email(email):
        return JSONResponse(
            status_code=400,
            content={
                "error": {
                    "code": "INVALID_EMAIL",
                    "message": "이메일 형식이 올바르지 않습니다.",
                }
            },
        )

    if get_user_by_username(username):
        return JSONResponse(
            status_code=400,
            content={
                "error": {
                    "code": "USERNAME_EXISTS",
                    "message": "이미 존재하는 아이디입니다.",
                }
            },
        )
    if get_user_by_email(email):
        return JSONResponse(
            status_code=400,
            content={
                "error": {
                    "code": "EMAIL_EXISTS",
                    "message": "이미 등록된 이메일입니다.",
                }
            },
        )

    password_hash = hash_password(password)
    try:
        user_id = create_user(
            username=username,
            email=email,
            name=name,
            grade=grade,
            password_hash=password_hash,
            role="student",
            status="active",
        )
    except ValueError as exc:
        code = str(exc)
        message = "이미 존재하는 계정입니다."
        if code == "USERNAME_EXISTS":
            message = "이미 존재하는 아이디입니다."
        elif code == "EMAIL_EXISTS":
            message = "이미 등록된 이메일입니다."
        return JSONResponse(
            status_code=400, content={"error": {"code": code, "message": message}}
        )

    user = get_user_by_id(user_id)
    if not user:
        return JSONResponse(
            status_code=500,
            content={
                "error": {
                    "code": "USER_NOT_FOUND",
                    "message": "사용자 생성에 실패했습니다.",
                }
            },
        )

    access_token, _ = create_access_token(
        user_id=user["id"], username=user["username"], role=user["role"]
    )
    refresh_token, refresh_payload = create_refresh_token(
        user_id=user["id"], username=user["username"], role=user["role"]
    )
    store_refresh_token(
        user_id=user["id"],
        token_hash=hash_token(refresh_token),
        expires_at=datetime.fromtimestamp(
            refresh_payload["exp"], tz=timezone.utc
        ).isoformat(),
    )
    return AuthTokenResponse(
        accessToken=access_token,
        refreshToken=refresh_token,
        user=_build_auth_user(user),
    )


@router.post(
    "/auth/login",
    response_model=AuthTokenResponse,
    responses={401: {"model": ErrorResponse}, 429: {"model": ErrorResponse}},
)
@limiter.limit("10/minute")
def login_user(
    request: Request,
    data: AuthLoginRequest = Body(...),
) -> AuthTokenResponse | JSONResponse:
    username = data.username.strip()
    password = data.password.strip()
    if not username or not password:
        return JSONResponse(
            status_code=401,
            content={
                "error": {
                    "code": "INVALID_CREDENTIALS",
                    "message": "아이디 또는 비밀번호가 올바르지 않습니다.",
                }
            },
        )

    user = get_user_by_username(username)
    if not user or not verify_password(password, user["password_hash"]):
        return JSONResponse(
            status_code=401,
            content={
                "error": {
                    "code": "INVALID_CREDENTIALS",
                    "message": "아이디 또는 비밀번호가 올바르지 않습니다.",
                }
            },
        )
    if user["status"] != "active":
        return JSONResponse(
            status_code=403,
            content={
                "error": {
                    "code": "ACCOUNT_DISABLED",
                    "message": "계정이 비활성화되었습니다.",
                }
            },
        )

    update_last_login(user["id"])
    access_token, _ = create_access_token(
        user_id=user["id"], username=user["username"], role=user["role"]
    )
    refresh_token, refresh_payload = create_refresh_token(
        user_id=user["id"], username=user["username"], role=user["role"]
    )
    store_refresh_token(
        user_id=user["id"],
        token_hash=hash_token(refresh_token),
        expires_at=datetime.fromtimestamp(
            refresh_payload["exp"], tz=timezone.utc
        ).isoformat(),
    )
    return AuthTokenResponse(
        accessToken=access_token,
        refreshToken=refresh_token,
        user=_build_auth_user(user),
    )


@router.post(
    "/auth/refresh",
    response_model=AuthTokenResponse,
    responses={401: {"model": ErrorResponse}, 429: {"model": ErrorResponse}},
)
@limiter.limit("20/minute")
def refresh_token(
    request: Request,
    data: AuthRefreshRequest = Body(...),
) -> AuthTokenResponse | JSONResponse:
    refresh = data.refreshToken.strip()
    if not refresh:
        return JSONResponse(
            status_code=401,
            content={
                "error": {
                    "code": "INVALID_REFRESH",
                    "message": "리프레시 토큰이 없습니다.",
                }
            },
        )

    payload = decode_token(refresh, expected_type="refresh")
    token_hash_value = hash_token(refresh)
    record = get_refresh_token_by_hash(token_hash_value)
    if not record or record.get("revoked_at") is not None:
        return JSONResponse(
            status_code=401,
            content={
                "error": {
                    "code": "INVALID_REFRESH",
                    "message": "리프레시 토큰이 유효하지 않습니다.",
                }
            },
        )
    if record.get("user_id") != payload.get("sub"):
        return JSONResponse(
            status_code=401,
            content={
                "error": {
                    "code": "INVALID_REFRESH",
                    "message": "리프레시 토큰이 유효하지 않습니다.",
                }
            },
        )

    user = get_user_by_id(payload["sub"])
    if not user:
        return JSONResponse(
            status_code=401,
            content={
                "error": {
                    "code": "INVALID_REFRESH",
                    "message": "사용자를 찾을 수 없습니다.",
                }
            },
        )

    revoke_refresh_token(token_hash_value)
    access_token, _ = create_access_token(
        user_id=user["id"], username=user["username"], role=user["role"]
    )
    new_refresh_token, new_refresh_payload = create_refresh_token(
        user_id=user["id"], username=user["username"], role=user["role"]
    )
    store_refresh_token(
        user_id=user["id"],
        token_hash=hash_token(new_refresh_token),
        expires_at=datetime.fromtimestamp(
            new_refresh_payload["exp"], tz=timezone.utc
        ).isoformat(),
    )
    return AuthTokenResponse(
        accessToken=access_token,
        refreshToken=new_refresh_token,
        user=_build_auth_user(user),
    )


@router.post(
    "/auth/logout",
    response_model=AuthLogoutResponse,
    responses={200: {"model": AuthLogoutResponse}},
)
def logout_user(
    data: AuthLogoutRequest = Body(...),
) -> AuthLogoutResponse:
    refresh = data.refreshToken.strip()
    if refresh:
        revoke_refresh_token(hash_token(refresh))
    return AuthLogoutResponse(success=True)


@router.post(
    "/auth/password",
    response_model=AuthChangePasswordResponse,
    responses={
        400: {"model": ErrorResponse},
        401: {"model": ErrorResponse},
        403: {"model": ErrorResponse},
        429: {"model": ErrorResponse},
    },
)
@limiter.limit("5/minute")
def change_password(
    request: Request,
    data: AuthChangePasswordRequest = Body(...),
    user: TokenData = Depends(get_current_user),
) -> AuthChangePasswordResponse | JSONResponse:
    current_password = data.currentPassword.strip()
    new_password = data.newPassword.strip()

    if not current_password or not new_password:
        return JSONResponse(
            status_code=400,
            content={
                "error": {
                    "code": "INVALID_PASSWORD",
                    "message": "비밀번호를 입력하세요.",
                }
            },
        )
    if len(new_password) < 8:
        return JSONResponse(
            status_code=400,
            content={
                "error": {
                    "code": "INVALID_PASSWORD",
                    "message": "비밀번호는 8자 이상이어야 합니다.",
                }
            },
        )
    if current_password == new_password:
        return JSONResponse(
            status_code=400,
            content={
                "error": {
                    "code": "PASSWORD_UNCHANGED",
                    "message": "새 비밀번호를 입력하세요.",
                }
            },
        )

    row = get_user_by_id(user.user_id)
    if not row or not verify_password(current_password, row["password_hash"]):
        return JSONResponse(
            status_code=401,
            content={
                "error": {
                    "code": "INVALID_CREDENTIALS",
                    "message": "현재 비밀번호가 올바르지 않습니다.",
                }
            },
        )
    if row["status"] != "active":
        return JSONResponse(
            status_code=403,
            content={
                "error": {
                    "code": "ACCOUNT_DISABLED",
                    "message": "계정이 비활성화되었습니다.",
                }
            },
        )

    updated = update_user_password(user.user_id, hash_password(new_password))
    if not updated:
        return JSONResponse(
            status_code=500,
            content={
                "error": {
                    "code": "UPDATE_FAILED",
                    "message": "비밀번호 변경에 실패했습니다.",
                }
            },
        )
    revoke_all_refresh_tokens(user.user_id)
    return AuthChangePasswordResponse(success=True)


@router.get(
    "/auth/me",
    response_model=AuthUser,
    responses={401: {"model": ErrorResponse}},
)
def get_me(user=Depends(get_current_user)) -> AuthUser | JSONResponse:
    row = get_user_by_id(user.user_id)
    if not row:
        return JSONResponse(
            status_code=401,
            content={
                "error": {
                    "code": "USER_NOT_FOUND",
                    "message": "사용자를 찾을 수 없습니다.",
                }
            },
        )
    return _build_auth_user(row)


@router.get(
    "/admin/users",
    response_model=AuthUserListResponse,
    responses={403: {"model": ErrorResponse}},
)
def list_admin_users(
    role: str | None = Query(None),
    user=Depends(require_admin),
) -> AuthUserListResponse:
    rows = list_users(role=role)
    users = [_build_auth_user(row) for row in rows]
    return AuthUserListResponse(users=users)


# ============================================================
# Student Profile Endpoints
# ============================================================


@router.get(
    "/student/profile",
    response_model=StudentProfileGetResponse,
    responses={401: {"model": ErrorResponse}, 403: {"model": ErrorResponse}},
)
def get_student_profile_me(
    user=Depends(get_current_user),
) -> StudentProfileGetResponse | JSONResponse:
    if user.role != "student":
        return JSONResponse(
            status_code=403,
            content={
                "error": {"code": "STUDENT_ONLY", "message": "학생 전용 기능입니다."}
            },
        )

    profile = get_student_profile(user.username)
    if not profile:
        return StudentProfileGetResponse(profile=None)

    return StudentProfileGetResponse(profile=StudentProfile(**profile))


@router.post(
    "/student/profile",
    response_model=StudentProfileGetResponse,
    responses={401: {"model": ErrorResponse}, 403: {"model": ErrorResponse}},
)
def upsert_student_profile_me(
    data: StudentProfileUpsertRequest = Body(...),
    user=Depends(get_current_user),
) -> StudentProfileGetResponse | JSONResponse:
    if user.role != "student":
        return JSONResponse(
            status_code=403,
            content={
                "error": {"code": "STUDENT_ONLY", "message": "학생 전용 기능입니다."}
            },
        )

    upsert_student_profile(
        student_id=user.username,
        survey=data.survey,
        placement=data.placement,
        estimated_level=data.estimatedLevel,
        weak_tags_top3=data.weakTagsTop3,
    )
    profile = get_student_profile(user.username)
    if not profile:
        return StudentProfileGetResponse(profile=None)
    return StudentProfileGetResponse(profile=StudentProfile(**profile))


@router.get(
    "/admin/students",
    response_model=AdminStudentListResponse,
    responses={403: {"model": ErrorResponse}},
)
def list_students_admin(user=Depends(require_admin)) -> AdminStudentListResponse:
    students = list_students_with_profiles()
    return AdminStudentListResponse(students=students)


@router.patch(
    "/admin/students/{student_id}/features",
    response_model=AdminStudentFeaturesUpdateResponse,
    responses={403: {"model": ErrorResponse}, 404: {"model": ErrorResponse}},
)
def update_student_features(
    student_id: str,
    data: AdminStudentFeaturesUpdateRequest,
    _admin=Depends(require_admin),
) -> AdminStudentFeaturesUpdateResponse | JSONResponse:
    target = get_user_by_username(student_id)
    if not target or target.get("role") != "student":
        return JSONResponse(
            status_code=404,
            content={
                "error": {
                    "code": "STUDENT_NOT_FOUND",
                    "message": "학생을 찾을 수 없습니다.",
                }
            },
        )

    updated = update_user_praise_sticker_enabled(
        student_id,
        enabled=data.praiseStickerEnabled,
    )
    if not updated:
        return JSONResponse(
            status_code=404,
            content={
                "error": {
                    "code": "STUDENT_NOT_FOUND",
                    "message": "학생을 찾을 수 없습니다.",
                }
            },
        )

    return AdminStudentFeaturesUpdateResponse(
        praiseStickerEnabled=data.praiseStickerEnabled,
    )


# ============================================================
# Praise Sticker Endpoints
# ============================================================


@router.get(
    "/students/{student_id}/stickers",
    response_model=PraiseStickerListResponse,
    responses={403: {"model": ErrorResponse}},
)
def list_student_stickers(
    student_id: str,
    user=Depends(get_current_user),
) -> PraiseStickerListResponse | JSONResponse:
    if user.role != "student" or user.username != student_id:
        return JSONResponse(
            status_code=403,
            content={"error": {"code": "FORBIDDEN", "message": "권한이 없습니다."}},
        )
    user_row = get_user_by_id(user.user_id)
    if not user_row:
        return JSONResponse(
            status_code=403,
            content={"error": {"code": "FORBIDDEN", "message": "권한이 없습니다."}},
        )
    feature_guard = _require_praise_sticker_enabled(user_row)
    if feature_guard:
        return feature_guard
    stickers = list_praise_stickers(student_id)
    return PraiseStickerListResponse(stickers=stickers)


@router.get(
    "/students/{student_id}/sticker-summary",
    response_model=PraiseStickerSummaryResponse,
    responses={403: {"model": ErrorResponse}},
)
def get_student_sticker_summary(
    student_id: str,
    user=Depends(get_current_user),
) -> PraiseStickerSummaryResponse | JSONResponse:
    if user.role != "student" or user.username != student_id:
        return JSONResponse(
            status_code=403,
            content={"error": {"code": "FORBIDDEN", "message": "권한이 없습니다."}},
        )
    user_row = get_user_by_id(user.user_id)
    if not user_row:
        return JSONResponse(
            status_code=403,
            content={"error": {"code": "FORBIDDEN", "message": "권한이 없습니다."}},
        )
    feature_guard = _require_praise_sticker_enabled(user_row)
    if feature_guard:
        return feature_guard
    summary = get_praise_sticker_summary(student_id)
    return PraiseStickerSummaryResponse(**summary)


@router.post(
    "/students/{student_id}/stickers",
    response_model=PraiseSticker,
    responses={
        400: {"model": ErrorResponse},
        403: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
    },
)
def grant_bonus_sticker(
    student_id: str,
    data: PraiseStickerCreateRequest = Body(...),
    admin=Depends(require_admin),
) -> PraiseSticker | JSONResponse:
    if data.count <= 0:
        return JSONResponse(
            status_code=400,
            content={
                "error": {"code": "INVALID_COUNT", "message": "count must be positive"}
            },
        )

    reason = data.reason.strip()
    if not reason:
        return JSONResponse(
            status_code=400,
            content={
                "error": {"code": "INVALID_REASON", "message": "reason cannot be empty"}
            },
        )

    target = get_user_by_username(student_id)
    if not target or target.get("role") != "student":
        return JSONResponse(
            status_code=404,
            content={
                "error": {
                    "code": "STUDENT_NOT_FOUND",
                    "message": "학생을 찾을 수 없습니다.",
                }
            },
        )
    feature_guard = _require_praise_sticker_enabled(target)
    if feature_guard:
        return feature_guard

    sticker = create_praise_sticker(
        student_id=student_id,
        count=data.count,
        reason=reason,
        reason_type="bonus",
        homework_id=None,
        granted_by=admin.username,
    )
    return PraiseSticker(**sticker)


@router.get(
    "/graph/draft",
    response_model=GraphResponse,
    responses={404: {"model": ErrorResponse}},
)
def get_draft_graph() -> GraphResponse | JSONResponse:
    graph = fetch_latest_graph("draft")
    if not graph:
        return JSONResponse(
            status_code=404,
            content={
                "error": {
                    "code": "DRAFT_NOT_FOUND",
                    "message": "Draft graph not found",
                }
            },
        )
    return graph


@router.get(
    "/graph/published",
    response_model=GraphResponse,
    responses={404: {"model": ErrorResponse}},
)
def get_published_graph() -> GraphResponse | JSONResponse:
    graph = fetch_latest_graph("published")
    if not graph:
        return JSONResponse(
            status_code=404,
            content={
                "error": {
                    "code": "PUBLISHED_NOT_FOUND",
                    "message": "Published graph not found",
                }
            },
        )
    return graph


@router.get(
    "/problems", response_model=List[Problem], responses={404: {"model": ErrorResponse}}
)
def list_problems(
    nodeId: str = Query(..., min_length=1),
) -> List[Problem] | JSONResponse:
    problems = fetch_problems(nodeId)
    if problems is None:
        return JSONResponse(
            status_code=404,
            content={
                "error": {
                    "code": "NODE_NOT_FOUND",
                    "message": f"Node '{nodeId}' not found",
                }
            },
        )
    return problems


# ============================================================
# Homework Endpoints
# ============================================================

# File upload constants
MAX_FILE_COUNT = 3
MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024  # 5MB
ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/pjpeg",
    "image/png",
    "image/webp",
}
UPLOAD_BASE_DIR = Path(__file__).resolve().parent.parent / "data" / "uploads"


def _get_upload_dir(submission_id: str) -> Path:
    """Get the upload directory for a submission."""
    upload_dir = UPLOAD_BASE_DIR / submission_id
    upload_dir.mkdir(parents=True, exist_ok=True)
    return upload_dir


def _send_notification_task(submission_id: str) -> None:
    """Background task to send email notification."""
    submission = get_homework_submission_with_files(submission_id)
    if not submission:
        logger.error("Submission not found for notification: %s", submission_id)
        return

    file_paths = [f["storedPath"] for f in submission["files"]]

    send_homework_notification(
        student_id=submission["studentId"],
        student_name=None,  # Could be enhanced to fetch student name
        assignment_title=submission["assignmentTitle"],
        problems=submission["problems"],
        answers=submission["answers"],
        file_paths=file_paths,
    )


def _normalize_student_ids(student_ids: List[str]) -> List[str]:
    """Trim, de-duplicate, and drop empty student ids while preserving order."""
    normalized: List[str] = []
    seen: set[str] = set()
    for raw in student_ids:
        student_id = raw.strip()
        if not student_id or student_id in seen:
            continue
        normalized.append(student_id)
        seen.add(student_id)
    return normalized


@dataclass
class ValidatedFile:
    content: bytes
    size_bytes: int
    content_type: str
    original_name: str
    ext: str


@router.post(
    "/homework/assignments",
    response_model=HomeworkAssignmentCreateResponse,
    responses={400: {"model": ErrorResponse}},
)
def create_assignment(
    data: HomeworkAssignmentCreate,
    _admin=Depends(require_admin),
) -> HomeworkAssignmentCreateResponse | JSONResponse:
    """Create a new homework assignment (Admin only)."""
    if not data.title.strip():
        return JSONResponse(
            status_code=400,
            content={
                "error": {
                    "code": "INVALID_TITLE",
                    "message": "Title cannot be empty",
                }
            },
        )

    normalized_problem_ids: list[str] = []
    seen_problem_ids: set[str] = set()
    for raw_problem_id in data.problemIds:
        pid = raw_problem_id.strip()
        if not pid or pid in seen_problem_ids:
            continue
        normalized_problem_ids.append(pid)
        seen_problem_ids.add(pid)

    if normalized_problem_ids:
        try:
            problems_data = get_homework_problem_bank_problems_by_ids(
                normalized_problem_ids
            )
        except ValueError as exc:
            return JSONResponse(
                status_code=400,
                content={
                    "error": {
                        "code": "INVALID_PROBLEM_IDS",
                        "message": str(exc),
                    }
                },
            )
    else:
        if not data.problems:
            return JSONResponse(
                status_code=400,
                content={
                    "error": {
                        "code": "NO_PROBLEMS",
                        "message": "At least one problem is required",
                    }
                },
            )

        for i, problem in enumerate(data.problems):
            if not problem.question.strip():
                return JSONResponse(
                    status_code=400,
                    content={
                        "error": {
                            "code": "INVALID_PROBLEM",
                            "message": f"Problem {i + 1} has empty question",
                        }
                    },
                )
            if problem.type == "objective" and (
                not problem.options or len(problem.options) < 2
            ):
                return JSONResponse(
                    status_code=400,
                    content={
                        "error": {
                            "code": "INVALID_PROBLEM",
                            "message": f"Objective problem {i + 1} needs at least 2 options",
                        }
                    },
                )

        problems_data = [p.model_dump() for p in data.problems]

    normalized_student_ids = _normalize_student_ids(data.targetStudentIds)
    if not normalized_student_ids:
        return JSONResponse(
            status_code=400,
            content={
                "error": {
                    "code": "NO_STUDENTS",
                    "message": "At least one student must be selected",
                }
            },
        )

    due_at = data.dueAt.strip() if data.dueAt and data.dueAt.strip() else None
    scheduled_at = (
        data.scheduledAt.strip()
        if data.scheduledAt and data.scheduledAt.strip()
        else None
    )
    sticker_reward_count = max(0, int(data.stickerRewardCount))

    assignment_id = create_homework_assignment(
        title=data.title.strip(),
        problems=problems_data,
        created_by="admin",  # TODO: Get from auth context
        target_student_ids=normalized_student_ids,
        description=data.description,
        due_at=due_at,
        scheduled_at=scheduled_at,
        sticker_reward_count=sticker_reward_count,
    )

    return HomeworkAssignmentCreateResponse(id=assignment_id)


@router.get(
    "/homework/assignments",
    response_model=HomeworkAssignmentListResponse,
    responses={400: {"model": ErrorResponse}},
)
def list_assignments(
    studentId: str = Query(..., min_length=1),
    user=Depends(get_current_user),
) -> HomeworkAssignmentListResponse | JSONResponse:
    """List homework assignments for a student."""
    if user.role != "student" or user.username != studentId:
        return JSONResponse(
            status_code=403,
            content={"error": {"code": "FORBIDDEN", "message": "권한이 없습니다."}},
        )
    assignments = list_homework_assignments_for_student(studentId)
    return HomeworkAssignmentListResponse(assignments=assignments)


@router.get(
    "/homework/assignments/{assignment_id}",
    response_model=HomeworkAssignmentDetail,
    responses={404: {"model": ErrorResponse}},
)
def get_assignment(
    assignment_id: str,
    studentId: str = Query(..., min_length=1),
    user=Depends(get_current_user),
) -> HomeworkAssignmentDetail | JSONResponse:
    """Get a single homework assignment detail."""
    if user.role != "student" or user.username != studentId:
        return JSONResponse(
            status_code=403,
            content={"error": {"code": "FORBIDDEN", "message": "권한이 없습니다."}},
        )
    assignment = get_homework_assignment(assignment_id, studentId)
    if not assignment:
        return JSONResponse(
            status_code=404,
            content={
                "error": {
                    "code": "ASSIGNMENT_NOT_FOUND",
                    "message": "Assignment not found or not assigned to this student",
                }
            },
        )
    return assignment


@router.post(
    "/homework/assignments/{assignment_id}/submit",
    response_model=HomeworkSubmitResponse,
    responses={400: {"model": ErrorResponse}, 404: {"model": ErrorResponse}},
)
async def submit_homework(
    assignment_id: str,
    background_tasks: BackgroundTasks,
    studentId: str = Form(...),
    answersJson: str = Form(...),  # JSON string: {"p1": "answer1", "p2": "answer2"}
    images: List[UploadFile] = File(default=[]),
    user=Depends(get_current_user),
) -> HomeworkSubmitResponse | JSONResponse:
    """Submit homework with answers and optional images."""
    if user.role != "student" or user.username != studentId:
        return JSONResponse(
            status_code=403,
            content={"error": {"code": "FORBIDDEN", "message": "권한이 없습니다."}},
        )
    # Parse answers JSON
    try:
        answers = json.loads(answersJson)
        if not isinstance(answers, dict):
            raise ValueError("answers must be an object")
    except (json.JSONDecodeError, ValueError):
        return JSONResponse(
            status_code=400,
            content={
                "error": {
                    "code": "INVALID_ANSWERS",
                    "message": "Invalid answers format. Expected JSON object.",
                }
            },
        )

    # Check if assignment exists and is assigned to student
    assignment = get_homework_assignment(assignment_id, studentId)
    if not assignment:
        return JSONResponse(
            status_code=404,
            content={
                "error": {
                    "code": "ASSIGNMENT_NOT_FOUND",
                    "message": "Assignment not found or not assigned to this student",
                }
            },
        )

    # Check if already submitted
    if check_homework_submission_exists(assignment_id, studentId):
        return JSONResponse(
            status_code=400,
            content={
                "error": {
                    "code": "ALREADY_SUBMITTED",
                    "message": "You have already submitted this homework",
                }
            },
        )

    # Validate that all required problems have answers
    problem_ids = {p["id"] for p in assignment["problems"]}
    for problem_id in problem_ids:
        if problem_id not in answers or not str(answers[problem_id]).strip():
            return JSONResponse(
                status_code=400,
                content={
                    "error": {
                        "code": "MISSING_ANSWER",
                        "message": f"Answer for problem '{problem_id}' is required",
                    }
                },
            )

    # Validate file count
    if len(images) > MAX_FILE_COUNT:
        return JSONResponse(
            status_code=400,
            content={
                "error": {
                    "code": "TOO_MANY_FILES",
                    "message": f"Maximum {MAX_FILE_COUNT} files allowed",
                }
            },
        )

    # Validate files and pre-read contents so we can enforce the size limit
    validated_files: list[ValidatedFile] = []
    ext_by_content_type = {
        "image/jpeg": ".jpg",
        "image/jpg": ".jpg",
        "image/pjpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
    }
    allowed_exts = {".jpg", ".jpeg", ".png", ".webp"}
    mime_by_ext = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
    }

    for image in images:
        original_name = image.filename or "image.jpg"
        ext = Path(original_name).suffix.lower()

        content_type = (image.content_type or "").lower()
        if not content_type:
            inferred = mime_by_ext.get(ext)
            if inferred:
                content_type = inferred

        if content_type not in ALLOWED_CONTENT_TYPES:
            return JSONResponse(
                status_code=400,
                content={
                    "error": {
                        "code": "INVALID_FILE_TYPE",
                        "message": "Only jpg, png, and webp images are allowed",
                    }
                },
            )

        content = await image.read()
        size_bytes = len(content)
        if size_bytes > MAX_FILE_SIZE_BYTES:
            return JSONResponse(
                status_code=400,
                content={
                    "error": {
                        "code": "FILE_TOO_LARGE",
                        "message": f"Each file must be <= {MAX_FILE_SIZE_BYTES // (1024 * 1024)}MB",
                    }
                },
            )

        if ext not in allowed_exts:
            ext = ext_by_content_type.get(content_type, ".jpg")

        validated_files.append(
            ValidatedFile(
                content=content,
                size_bytes=size_bytes,
                content_type=content_type or "image/jpeg",
                original_name=original_name,
                ext=ext,
            )
        )

    # Create submission
    submission_id = create_homework_submission(
        assignment_id=assignment_id,
        student_id=studentId,
        answers=answers,
    )

    # Save files
    if validated_files:
        upload_dir = _get_upload_dir(submission_id)

        for file_info in validated_files:
            file_name = f"{uuid4()}{file_info.ext}"
            file_path = upload_dir / file_name

            # Write file
            with open(file_path, "wb") as f:
                f.write(file_info.content)

            # Save file record
            save_homework_submission_file(
                submission_id=submission_id,
                stored_path=str(file_path),
                original_name=file_info.original_name,
                content_type=file_info.content_type,
                size_bytes=file_info.size_bytes,
            )

    # Send email notification in background
    background_tasks.add_task(_send_notification_task, submission_id)

    return HomeworkSubmitResponse(submissionId=submission_id)


@router.post(
    "/homework/submissions/{submission_id}/review",
    response_model=HomeworkSubmissionReviewResponse,
    responses={400: {"model": ErrorResponse}, 404: {"model": ErrorResponse}},
)
def review_homework_submission(
    submission_id: str,
    data: HomeworkSubmissionReviewRequest,
    _admin=Depends(require_admin),
) -> HomeworkSubmissionReviewResponse | JSONResponse:
    """Review a homework submission (Admin only)."""
    submission = get_homework_submission_for_review(submission_id)
    if not submission:
        return JSONResponse(
            status_code=404,
            content={
                "error": {
                    "code": "SUBMISSION_NOT_FOUND",
                    "message": "Submission not found",
                }
            },
        )

    status = (data.status or "").strip().lower()
    if status not in {"approved", "returned"}:
        return JSONResponse(
            status_code=400,
            content={
                "error": {
                    "code": "INVALID_STATUS",
                    "message": "Status must be 'approved' or 'returned'",
                }
            },
        )

    problems = submission.get("problems", [])
    valid_problem_ids = {p["id"] for p in problems if isinstance(p, dict) and "id" in p}
    incoming_reviews = data.problemReviews or {}

    normalized_reviews: dict[str, dict[str, str | bool]] = {}
    has_issues = False

    for problem_id, review in incoming_reviews.items():
        if problem_id not in valid_problem_ids:
            return JSONResponse(
                status_code=400,
                content={
                    "error": {
                        "code": "INVALID_PROBLEM",
                        "message": f"Problem '{problem_id}' is not part of this assignment",
                    }
                },
            )
        if not isinstance(review, dict):
            continue
        comment_raw = review.get("comment")
        comment = comment_raw.strip() if isinstance(comment_raw, str) else ""
        needs_revision = bool(review.get("needsRevision")) or bool(comment)

        if needs_revision and not comment:
            return JSONResponse(
                status_code=400,
                content={
                    "error": {
                        "code": "MISSING_COMMENT",
                        "message": f"Problem '{problem_id}' requires a comment when marked for revision",
                    }
                },
            )

        if needs_revision or comment:
            normalized_reviews[problem_id] = {
                "needsRevision": needs_revision,
                "comment": comment,
            }
            has_issues = True

    if status == "approved" and has_issues:
        return JSONResponse(
            status_code=400,
            content={
                "error": {
                    "code": "INVALID_REVIEW",
                    "message": "Cannot approve when there are revision comments",
                }
            },
        )

    if status == "returned" and not has_issues:
        return JSONResponse(
            status_code=400,
            content={
                "error": {
                    "code": "EMPTY_REVIEW",
                    "message": "Returned status requires at least one revision comment",
                }
            },
        )

    reviewed_by = (data.reviewedBy or "").strip() or "admin"
    updated = update_homework_submission_review(
        submission_id=submission_id,
        review_status=status,
        problem_reviews=normalized_reviews,
        reviewed_by=reviewed_by,
    )
    if not updated:
        return JSONResponse(
            status_code=404,
            content={
                "error": {
                    "code": "SUBMISSION_NOT_FOUND",
                    "message": "Submission not found",
                }
            },
        )

    if (
        status == "approved"
        and submission.get("reviewStatus") != "approved"
        and _is_on_time(submission.get("submittedAt"), submission.get("dueAt"))
    ):
        homework_id = submission.get("assignmentId")
        student_id = submission.get("studentId")
        if homework_id and student_id:
            target = get_user_by_username(student_id)
            if not target or not bool(target.get("praise_sticker_enabled")):
                return HomeworkSubmissionReviewResponse()
            already_granted = has_praise_sticker_for_homework(
                student_id=student_id,
                homework_id=homework_id,
                reason_type="homework_excellent",
            )
            if not already_granted:
                sticker_reward_count = max(
                    0, int(submission.get("assignmentStickerRewardCount") or 2)
                )
                if sticker_reward_count <= 0:
                    return HomeworkSubmissionReviewResponse()
                create_praise_sticker(
                    student_id=student_id,
                    count=sticker_reward_count,
                    reason=AUTO_STICKER_REASON,
                    reason_type="homework_excellent",
                    homework_id=homework_id,
                    granted_by=None,
                )

    return HomeworkSubmissionReviewResponse()


# ============================================================
# Admin Homework Endpoints
# ============================================================


@router.get(
    "/homework/admin/problem-bank/labels",
    response_model=HomeworkLabelListResponse,
)
def list_problem_bank_labels(
    _admin=Depends(require_admin),
) -> HomeworkLabelListResponse:
    labels = list_homework_labels()
    return HomeworkLabelListResponse(labels=[HomeworkLabel(**l) for l in labels])


@router.post(
    "/homework/admin/problem-bank/labels",
    response_model=HomeworkLabel,
    responses={400: {"model": ErrorResponse}},
)
def create_problem_bank_label(
    data: HomeworkLabelCreateRequest,
    _admin=Depends(require_admin),
) -> HomeworkLabel | JSONResponse:
    try:
        label = create_homework_label(
            key=data.key,
            label=data.label,
            kind=data.kind,
            created_by="admin",
        )
    except ValueError as exc:
        return JSONResponse(
            status_code=400,
            content={
                "error": {
                    "code": "INVALID_LABEL",
                    "message": str(exc),
                }
            },
        )
    return HomeworkLabel(**label)


@router.post(
    "/homework/admin/problem-bank/import",
    response_model=HomeworkProblemBankImportResponse,
    responses={400: {"model": ErrorResponse}},
)
def import_problem_bank(
    data: HomeworkProblemBankImportRequest,
    _admin=Depends(require_admin),
) -> HomeworkProblemBankImportResponse | JSONResponse:
    try:
        result = import_homework_problem_batch(
            week_key=data.weekKey,
            day_key=data.dayKey,
            payload=data.payload,
            imported_by="admin",
        )
    except ValueError as exc:
        return JSONResponse(
            status_code=400,
            content={
                "error": {
                    "code": "INVALID_IMPORT",
                    "message": str(exc),
                }
            },
        )
    return HomeworkProblemBankImportResponse(**result)


@router.get(
    "/homework/admin/problem-bank/problems",
    response_model=HomeworkProblemBankListResponse,
)
def list_problem_bank_problems(
    labelKey: str | None = Query(default=None),
    weekKey: str | None = Query(default=None),
    dayKey: str | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    _admin=Depends(require_admin),
) -> HomeworkProblemBankListResponse:
    problems = list_homework_problems_admin(
        label_key=labelKey,
        week_key=weekKey,
        day_key=dayKey,
        limit=limit,
        offset=offset,
    )
    return HomeworkProblemBankListResponse(
        problems=[HomeworkProblemBankProblem(**p) for p in problems]
    )


@router.put(
    "/homework/admin/problem-bank/problems/{problem_id}/labels",
    response_model=HomeworkProblemLabelSetResponse,
    responses={400: {"model": ErrorResponse}},
)
def set_problem_bank_problem_labels(
    problem_id: str,
    data: HomeworkProblemLabelSetRequest,
    _admin=Depends(require_admin),
) -> HomeworkProblemLabelSetResponse | JSONResponse:
    try:
        set_homework_problem_labels(
            problem_id=problem_id,
            label_keys=data.labelKeys,
        )
    except ValueError as exc:
        return JSONResponse(
            status_code=400,
            content={
                "error": {
                    "code": "INVALID_LABEL_KEYS",
                    "message": str(exc),
                }
            },
        )
    return HomeworkProblemLabelSetResponse()


@router.get(
    "/homework/admin/assignments",
    response_model=AdminAssignmentListResponse,
)
def list_admin_assignments(
    _admin=Depends(require_admin),
) -> AdminAssignmentListResponse:
    """Admin: List all homework assignments with submission statistics."""
    assignments = list_all_homework_assignments_admin()
    return AdminAssignmentListResponse(assignments=assignments)


@router.get(
    "/homework/admin/assignments/{assignment_id}",
    response_model=AdminAssignmentDetail,
    responses={404: {"model": ErrorResponse}},
)
def get_admin_assignment(
    assignment_id: str, _admin=Depends(require_admin)
) -> AdminAssignmentDetail | JSONResponse:
    """Admin: Get assignment detail with all student submission summaries."""
    assignment = get_homework_assignment_admin(assignment_id)
    if not assignment:
        return JSONResponse(
            status_code=404,
            content={
                "error": {
                    "code": "ASSIGNMENT_NOT_FOUND",
                    "message": "Assignment not found",
                }
            },
        )
    return assignment


@router.patch(
    "/homework/admin/assignments/{assignment_id}",
    response_model=HomeworkAssignmentUpdateResponse,
    responses={400: {"model": ErrorResponse}, 404: {"model": ErrorResponse}},
)
def update_admin_assignment(
    assignment_id: str,
    data: HomeworkAssignmentUpdateRequest,
    _admin=Depends(require_admin),
) -> HomeworkAssignmentUpdateResponse | JSONResponse:
    """Admin: Update assignment title or due date."""
    payload = data.model_dump(exclude_unset=True)
    if not payload:
        return JSONResponse(
            status_code=400,
            content={
                "error": {
                    "code": "NO_UPDATE_FIELDS",
                    "message": "No update fields provided",
                }
            },
        )

    title = payload.get("title")
    if "title" in payload:
        if title is None:
            return JSONResponse(
                status_code=400,
                content={
                    "error": {
                        "code": "INVALID_TITLE",
                        "message": "Title cannot be empty",
                    }
                },
            )
        title = title.strip()
        if not title:
            return JSONResponse(
                status_code=400,
                content={
                    "error": {
                        "code": "INVALID_TITLE",
                        "message": "Title cannot be empty",
                    }
                },
            )

    due_at = payload.get("dueAt")
    if "dueAt" in payload and isinstance(due_at, str):
        due_at = due_at.strip()
        if not due_at:
            due_at = None

    update_kwargs: dict[str, Any] = {"assignment_id": assignment_id}
    if "title" in payload:
        update_kwargs["title"] = title
    if "dueAt" in payload:
        update_kwargs["due_at"] = due_at

    updated = update_homework_assignment(**update_kwargs)
    if not updated:
        return JSONResponse(
            status_code=404,
            content={
                "error": {
                    "code": "ASSIGNMENT_NOT_FOUND",
                    "message": "Assignment not found",
                }
            },
        )

    return HomeworkAssignmentUpdateResponse()


@router.delete(
    "/homework/admin/assignments/{assignment_id}",
    response_model=HomeworkAssignmentDeleteResponse,
    responses={404: {"model": ErrorResponse}},
)
def delete_admin_assignment(
    assignment_id: str, _admin=Depends(require_admin)
) -> HomeworkAssignmentDeleteResponse | JSONResponse:
    """Admin: Delete assignment."""
    deleted = delete_homework_assignment(assignment_id)
    if not deleted:
        return JSONResponse(
            status_code=404,
            content={
                "error": {
                    "code": "ASSIGNMENT_NOT_FOUND",
                    "message": "Assignment not found",
                }
            },
        )
    return HomeworkAssignmentDeleteResponse()


@router.get(
    "/homework/admin/submissions/{submission_id}",
    response_model=AdminSubmissionDetail,
    responses={404: {"model": ErrorResponse}},
)
def get_admin_submission(
    submission_id: str, _admin=Depends(require_admin)
) -> AdminSubmissionDetail | JSONResponse:
    """Admin: Get full submission detail for review."""
    submission = get_submission_admin(submission_id)
    if not submission:
        return JSONResponse(
            status_code=404,
            content={
                "error": {
                    "code": "SUBMISSION_NOT_FOUND",
                    "message": "Submission not found",
                }
            },
        )
    return submission


@router.get(
    "/homework/admin/submissions/{submission_id}/files/{file_id}",
    responses={404: {"model": ErrorResponse}},
)
def download_submission_file(
    submission_id: str, file_id: str, _admin=Depends(require_admin)
) -> JSONResponse:
    """Admin: Download a submission file."""
    from fastapi.responses import FileResponse

    file_info = get_submission_file(file_id)
    if not file_info:
        return JSONResponse(
            status_code=404,
            content={
                "error": {
                    "code": "FILE_NOT_FOUND",
                    "message": "File not found",
                }
            },
        )

    # Verify the file belongs to the specified submission
    if file_info["submissionId"] != submission_id:
        return JSONResponse(
            status_code=404,
            content={
                "error": {
                    "code": "FILE_NOT_FOUND",
                    "message": "File not found in this submission",
                }
            },
        )

    file_path = Path(file_info["storedPath"]).resolve()

    # Security: Verify the file is within the allowed upload directory (Path Traversal prevention)
    try:
        file_path.relative_to(UPLOAD_BASE_DIR.resolve())
    except ValueError:
        logger.warning("Path traversal attempt detected: %s", file_info["storedPath"])
        return JSONResponse(
            status_code=404,
            content={
                "error": {
                    "code": "FILE_NOT_FOUND",
                    "message": "File not found",
                }
            },
        )

    if not file_path.exists():
        return JSONResponse(
            status_code=404,
            content={
                "error": {
                    "code": "FILE_MISSING",
                    "message": "File is missing from storage",
                }
            },
        )

    return FileResponse(
        path=file_path,
        filename=file_info["originalName"],
        media_type=file_info["contentType"],
    )


@router.get(
    "/homework/pending-count",
    response_model=HomeworkPendingCountResponse,
    responses={400: {"model": ErrorResponse}},
)
def get_homework_pending_count_endpoint(
    studentId: str = Query(..., min_length=1),
    user=Depends(get_current_user),
) -> HomeworkPendingCountResponse | JSONResponse:
    """Get count of homework items by status for a student."""
    if user.role != "student" or user.username != studentId:
        return JSONResponse(
            status_code=403,
            content={"error": {"code": "FORBIDDEN", "message": "권한이 없습니다."}},
        )
    counts = get_pending_homework_count(studentId)
    return HomeworkPendingCountResponse(**counts)
