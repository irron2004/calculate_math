"""Pydantic schemas for API responses."""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class Node(BaseModel):
    id: str
    nodeType: str
    label: str
    text: Optional[str] = None
    meta: Dict[str, Any] = Field(default_factory=dict)
    order: Optional[float] = None


class Edge(BaseModel):
    id: str
    edgeType: str
    source: str
    target: str
    note: Optional[str] = None


class GraphResponse(BaseModel):
    schemaVersion: int
    nodes: List[Node]
    edges: List[Edge]


class Problem(BaseModel):
    problemId: str
    nodeId: str
    order: int
    prompt: str
    grading: Dict[str, Any]
    answer: Dict[str, Any]


class ErrorDetail(BaseModel):
    code: str
    message: str


class ErrorResponse(BaseModel):
    error: ErrorDetail


class TestStatusResponse(BaseModel):
    status: str
    message: str


# ============================================================
# Auth Models
# ============================================================


class AuthRegisterRequest(BaseModel):
    username: str
    password: str
    name: str
    grade: str
    email: str


class AuthLoginRequest(BaseModel):
    username: str
    password: str


class AuthRefreshRequest(BaseModel):
    refreshToken: str


class AuthLogoutRequest(BaseModel):
    refreshToken: str


class AuthChangePasswordRequest(BaseModel):
    currentPassword: str
    newPassword: str


class AuthUser(BaseModel):
    id: str
    username: str
    name: str
    grade: str
    email: str
    role: str
    status: str
    praiseStickerEnabled: bool = False
    createdAt: str
    lastLoginAt: Optional[str] = None


class AuthTokenResponse(BaseModel):
    accessToken: str
    refreshToken: str
    user: AuthUser


class AuthLogoutResponse(BaseModel):
    success: bool = True


class AuthChangePasswordResponse(BaseModel):
    success: bool = True


class AuthUserListResponse(BaseModel):
    users: List[AuthUser]


# ============================================================
# Student Profile Models
# ============================================================


class StudentProfile(BaseModel):
    studentId: str
    survey: Dict[str, Any] = Field(default_factory=dict)
    placement: Dict[str, Any] = Field(default_factory=dict)
    estimatedLevel: str
    weakTagsTop3: List[str] = Field(default_factory=list)
    createdAt: str
    updatedAt: str


class StudentProfileGetResponse(BaseModel):
    profile: Optional[StudentProfile] = None


class StudentProfileUpsertRequest(BaseModel):
    survey: Dict[str, Any] = Field(default_factory=dict)
    placement: Dict[str, Any] = Field(default_factory=dict)
    estimatedLevel: str
    weakTagsTop3: List[str] = Field(default_factory=list)


class AdminStudentProfileSummary(BaseModel):
    estimatedLevel: Optional[str] = None
    weakTagsTop3: List[str] = Field(default_factory=list)
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None


class AdminStudentInfo(BaseModel):
    id: str
    name: str
    grade: str
    email: str
    profile: Optional[AdminStudentProfileSummary] = None
    praiseStickerEnabled: bool = False


class AdminStudentListResponse(BaseModel):
    students: List[AdminStudentInfo]


class AdminStudentFeaturesUpdateRequest(BaseModel):
    praiseStickerEnabled: bool


class AdminStudentFeaturesUpdateResponse(BaseModel):
    success: bool = True
    praiseStickerEnabled: bool


# ============================================================
# Praise Sticker Models
# ============================================================


class PraiseSticker(BaseModel):
    id: str
    studentId: str
    count: int
    reason: str
    reasonType: str
    homeworkId: Optional[str] = None
    grantedBy: Optional[str] = None
    grantedAt: str


class PraiseStickerCreateRequest(BaseModel):
    count: int
    reason: str


class PraiseStickerListResponse(BaseModel):
    stickers: List[PraiseSticker]


class PraiseStickerSummaryResponse(BaseModel):
    totalCount: int
    recent: List[PraiseSticker]


# ============================================================
# Homework Models
# ============================================================


class HomeworkProblem(BaseModel):
    """A single problem in a homework assignment."""
    id: str
    type: str  # "objective" or "subjective"
    question: str
    options: Optional[List[str]] = None  # For objective (multiple choice)
    answer: Optional[str] = None  # Correct answer (for grading reference)


class HomeworkAssignmentCreate(BaseModel):
    title: str
    description: Optional[str] = None
    problems: List[HomeworkProblem]
    dueAt: Optional[str] = None
    scheduledAt: Optional[str] = None
    targetStudentIds: List[str]


class HomeworkAssignmentCreateResponse(BaseModel):
    id: str
    success: bool = True


class HomeworkAssignmentUpdateRequest(BaseModel):
    title: Optional[str] = None
    dueAt: Optional[str] = None


class HomeworkAssignmentUpdateResponse(BaseModel):
    success: bool = True


class HomeworkAssignmentDeleteResponse(BaseModel):
    success: bool = True


class HomeworkSubmissionFile(BaseModel):
    id: str
    originalName: str
    contentType: str
    sizeBytes: int


class HomeworkSubmissionDetail(BaseModel):
    id: str
    answers: Dict[str, str]  # {problemId: answer}
    submittedAt: str
    files: List[HomeworkSubmissionFile] = Field(default_factory=list)
    reviewStatus: str = "pending"
    reviewedAt: Optional[str] = None
    reviewedBy: Optional[str] = None
    problemReviews: Dict[str, Dict[str, Any]] = Field(default_factory=dict)


class HomeworkAssignmentListItem(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    problems: List[HomeworkProblem]
    dueAt: Optional[str] = None
    scheduledAt: Optional[str] = None
    createdAt: str
    submitted: bool
    submissionId: Optional[str] = None
    submittedAt: Optional[str] = None
    reviewStatus: Optional[str] = None


class HomeworkAssignmentListResponse(BaseModel):
    assignments: List[HomeworkAssignmentListItem]


class HomeworkAssignmentDetail(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    problems: List[HomeworkProblem]
    dueAt: Optional[str] = None
    createdAt: str
    submission: Optional[HomeworkSubmissionDetail] = None


class HomeworkSubmitResponse(BaseModel):
    submissionId: str
    success: bool = True


class HomeworkSubmissionReviewRequest(BaseModel):
    status: str  # "approved" or "returned"
    reviewedBy: Optional[str] = None
    problemReviews: Dict[str, Dict[str, Any]] = Field(default_factory=dict)


class HomeworkSubmissionReviewResponse(BaseModel):
    success: bool = True


# ============================================================
# Admin Homework Models
# ============================================================


class AdminAssignmentSummary(BaseModel):
    """Summary of an assignment for admin list view."""
    id: str
    title: str
    description: Optional[str] = None
    problems: List[HomeworkProblem]
    dueAt: Optional[str] = None
    scheduledAt: Optional[str] = None
    createdBy: str
    createdAt: str
    totalStudents: int
    submittedCount: int
    pendingCount: int
    approvedCount: int
    returnedCount: int
    isScheduled: bool = False


class AdminAssignmentListResponse(BaseModel):
    assignments: List[AdminAssignmentSummary]


class AdminStudentSubmissionSummary(BaseModel):
    """Summary of a student's submission status for an assignment."""
    studentId: str
    assignedAt: str
    submissionId: Optional[str] = None
    submittedAt: Optional[str] = None
    reviewStatus: Optional[str] = None
    reviewedAt: Optional[str] = None
    reviewedBy: Optional[str] = None


class AdminAssignmentDetail(BaseModel):
    """Full assignment detail with student submission summaries."""
    id: str
    title: str
    description: Optional[str] = None
    problems: List[HomeworkProblem]
    dueAt: Optional[str] = None
    scheduledAt: Optional[str] = None
    createdBy: str
    createdAt: str
    students: List[AdminStudentSubmissionSummary]


class AdminSubmissionFile(BaseModel):
    """File info for admin submission view."""
    id: str
    storedPath: str
    originalName: str
    contentType: str
    sizeBytes: int
    createdAt: str


class AdminSubmissionDetail(BaseModel):
    """Full submission detail for admin review."""
    id: str
    assignmentId: str
    studentId: str
    answers: Dict[str, str]
    submittedAt: str
    reviewStatus: str
    reviewedAt: Optional[str] = None
    reviewedBy: Optional[str] = None
    problemReviews: Dict[str, Dict[str, Any]] = Field(default_factory=dict)
    assignmentTitle: str
    assignmentDescription: Optional[str] = None
    problems: List[HomeworkProblem]
    dueAt: Optional[str] = None
    files: List[AdminSubmissionFile] = Field(default_factory=list)


class HomeworkPendingCountResponse(BaseModel):
    """Count of homework items by status for a student."""
    totalAssigned: int
    notSubmitted: int
    returned: int
    pendingReview: int
    approved: int
    actionRequired: int
