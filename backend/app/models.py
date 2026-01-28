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
    targetStudentIds: List[str]


class HomeworkAssignmentCreateResponse(BaseModel):
    id: str
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


class HomeworkAssignmentListItem(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    problems: List[HomeworkProblem]
    dueAt: Optional[str] = None
    createdAt: str
    submitted: bool


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
