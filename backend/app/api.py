"""API routes for graph and problem read endpoints."""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import List
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, File, Form, Query, UploadFile
from fastapi.responses import JSONResponse

from .db import (
    check_homework_submission_exists,
    create_homework_assignment,
    create_homework_submission,
    fetch_latest_graph,
    fetch_problems,
    get_homework_assignment,
    get_homework_assignment_admin,
    get_homework_submission_for_review,
    get_homework_submission_with_files,
    get_pending_homework_count,
    get_submission_admin,
    get_submission_file,
    list_all_homework_assignments_admin,
    list_homework_assignments_for_student,
    save_homework_submission_file,
    update_homework_submission_review,
)
from .email_service import send_homework_notification
from .models import (
    AdminAssignmentDetail,
    AdminAssignmentListResponse,
    AdminSubmissionDetail,
    ErrorResponse,
    GraphResponse,
    HomeworkAssignmentCreate,
    HomeworkAssignmentCreateResponse,
    HomeworkAssignmentDetail,
    HomeworkAssignmentListResponse,
    HomeworkPendingCountResponse,
    HomeworkSubmitResponse,
    HomeworkSubmissionReviewRequest,
    HomeworkSubmissionReviewResponse,
    Problem,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")


@router.get("/health")
def health_check() -> dict:
    """Health check endpoint for container orchestration."""
    return {"status": "ok"}


@router.get("/graph/draft", response_model=GraphResponse, responses={404: {"model": ErrorResponse}})
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


@router.get("/graph/published", response_model=GraphResponse, responses={404: {"model": ErrorResponse}})
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


@router.get("/problems", response_model=List[Problem], responses={404: {"model": ErrorResponse}})
def list_problems(nodeId: str = Query(..., min_length=1)) -> List[Problem] | JSONResponse:
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
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/jpg", "image/pjpeg", "image/png", "image/webp"}
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
def create_assignment(data: HomeworkAssignmentCreate) -> HomeworkAssignmentCreateResponse | JSONResponse:
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

    # Validate each problem
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
        if problem.type == "objective" and (not problem.options or len(problem.options) < 2):
            return JSONResponse(
                status_code=400,
                content={
                    "error": {
                        "code": "INVALID_PROBLEM",
                        "message": f"Objective problem {i + 1} needs at least 2 options",
                    }
                },
            )

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
    scheduled_at = data.scheduledAt.strip() if data.scheduledAt and data.scheduledAt.strip() else None

    # Convert problems to dict for storage
    problems_data = [p.model_dump() for p in data.problems]

    assignment_id = create_homework_assignment(
        title=data.title.strip(),
        problems=problems_data,
        created_by="admin",  # TODO: Get from auth context
        target_student_ids=normalized_student_ids,
        description=data.description,
        due_at=due_at,
        scheduled_at=scheduled_at,
    )

    return HomeworkAssignmentCreateResponse(id=assignment_id)


@router.get(
    "/homework/assignments",
    response_model=HomeworkAssignmentListResponse,
    responses={400: {"model": ErrorResponse}},
)
def list_assignments(
    studentId: str = Query(..., min_length=1),
) -> HomeworkAssignmentListResponse | JSONResponse:
    """List homework assignments for a student."""
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
) -> HomeworkAssignmentDetail | JSONResponse:
    """Get a single homework assignment detail."""
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
) -> HomeworkSubmitResponse | JSONResponse:
    """Submit homework with answers and optional images."""
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

    return HomeworkSubmissionReviewResponse()


# ============================================================
# Admin Homework Endpoints
# ============================================================


@router.get(
    "/homework/admin/assignments",
    response_model=AdminAssignmentListResponse,
)
def list_admin_assignments() -> AdminAssignmentListResponse:
    """Admin: List all homework assignments with submission statistics."""
    assignments = list_all_homework_assignments_admin()
    return AdminAssignmentListResponse(assignments=assignments)


@router.get(
    "/homework/admin/assignments/{assignment_id}",
    response_model=AdminAssignmentDetail,
    responses={404: {"model": ErrorResponse}},
)
def get_admin_assignment(assignment_id: str) -> AdminAssignmentDetail | JSONResponse:
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


@router.get(
    "/homework/admin/submissions/{submission_id}",
    response_model=AdminSubmissionDetail,
    responses={404: {"model": ErrorResponse}},
)
def get_admin_submission(submission_id: str) -> AdminSubmissionDetail | JSONResponse:
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
    submission_id: str, file_id: str
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

    file_path = Path(file_info["storedPath"])
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
) -> HomeworkPendingCountResponse:
    """Get count of homework items by status for a student."""
    counts = get_pending_homework_count(studentId)
    return HomeworkPendingCountResponse(**counts)
