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
