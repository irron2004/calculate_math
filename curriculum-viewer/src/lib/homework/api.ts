/**
 * Homework API functions
 */

import type {
  AdminAssignmentDetail,
  AdminAssignmentSummary,
  AdminSubmissionDetail,
  CreateAssignmentData,
  HomeworkAssignment,
  HomeworkAssignmentDetail,
  HomeworkPendingCount,
  HomeworkSubmitData,
  HomeworkSubmissionReviewData,
} from './types'
import { authFetch } from '../auth/api'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

type ApiError = {
  error: {
    code: string
    message: string
  }
}

function isApiError(data: unknown): data is ApiError {
  if (typeof data !== 'object' || data === null) return false
  const obj = data as Record<string, unknown>
  if (typeof obj.error !== 'object' || obj.error === null) return false
  const err = obj.error as Record<string, unknown>
  return typeof err.code === 'string' && typeof err.message === 'string'
}

export class HomeworkApiError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.name = 'HomeworkApiError'
  }
}

/**
 * Create a new homework assignment (Admin only)
 */
export async function createAssignment(
  data: CreateAssignmentData,
  signal?: AbortSignal
): Promise<{ id: string }> {
  const response = await authFetch(`${API_BASE}/homework/assignments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: data.title,
      description: data.description || null,
      problems: data.problems,
      dueAt: data.dueAt || null,
      scheduledAt: data.scheduledAt || null,
      targetStudentIds: data.targetStudentIds,
    }),
    signal,
  })

  const json = await response.json()

  if (!response.ok) {
    if (isApiError(json)) {
      throw new HomeworkApiError(json.error.code, json.error.message)
    }
    throw new HomeworkApiError('UNKNOWN', 'Failed to create assignment')
  }

  return { id: json.id }
}

/**
 * List homework assignments for a student
 */
export async function listAssignments(
  studentId: string,
  signal?: AbortSignal
): Promise<HomeworkAssignment[]> {
  const params = new URLSearchParams({ studentId })
  const response = await authFetch(`${API_BASE}/homework/assignments?${params}`, {
    signal,
  })

  const json = await response.json()

  if (!response.ok) {
    if (isApiError(json)) {
      throw new HomeworkApiError(json.error.code, json.error.message)
    }
    throw new HomeworkApiError('UNKNOWN', 'Failed to list assignments')
  }

  return json.assignments as HomeworkAssignment[]
}

/**
 * Get a single homework assignment detail
 */
export async function getAssignment(
  assignmentId: string,
  studentId: string,
  signal?: AbortSignal
): Promise<HomeworkAssignmentDetail> {
  const params = new URLSearchParams({ studentId })
  const response = await authFetch(
    `${API_BASE}/homework/assignments/${assignmentId}?${params}`,
    { signal }
  )

  const json = await response.json()

  if (!response.ok) {
    if (isApiError(json)) {
      throw new HomeworkApiError(json.error.code, json.error.message)
    }
    throw new HomeworkApiError('UNKNOWN', 'Failed to get assignment')
  }

  return json as HomeworkAssignmentDetail
}

/**
 * Submit homework with answers and optional images
 */
export async function submitHomework(
  assignmentId: string,
  data: HomeworkSubmitData,
  signal?: AbortSignal
): Promise<{ submissionId: string }> {
  const formData = new FormData()
  formData.append('studentId', data.studentId)
  formData.append('answersJson', JSON.stringify(data.answers))

  for (const image of data.images) {
    formData.append('images', image)
  }

  const response = await authFetch(
    `${API_BASE}/homework/assignments/${assignmentId}/submit`,
    {
      method: 'POST',
      body: formData,
      signal,
    }
  )

  const json = await response.json()

  if (!response.ok) {
    if (isApiError(json)) {
      throw new HomeworkApiError(json.error.code, json.error.message)
    }
    throw new HomeworkApiError('UNKNOWN', 'Failed to submit homework')
  }

  return { submissionId: json.submissionId }
}

/**
 * Review a homework submission (Admin only)
 */
export async function reviewSubmission(
  submissionId: string,
  data: HomeworkSubmissionReviewData,
  signal?: AbortSignal
): Promise<void> {
  const response = await authFetch(`${API_BASE}/homework/submissions/${submissionId}/review`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      status: data.status,
      reviewedBy: data.reviewedBy || null,
      problemReviews: data.problemReviews
    }),
    signal
  })

  const json = await response.json()

  if (!response.ok) {
    if (isApiError(json)) {
      throw new HomeworkApiError(json.error.code, json.error.message)
    }
    throw new HomeworkApiError('UNKNOWN', 'Failed to review submission')
  }
}

// ============================================================
// Admin API Functions
// ============================================================

/**
 * Admin: List all homework assignments with submission statistics
 */
export async function listAssignmentsAdmin(
  signal?: AbortSignal
): Promise<AdminAssignmentSummary[]> {
  const response = await authFetch(`${API_BASE}/homework/admin/assignments`, { signal })

  const json = await response.json()

  if (!response.ok) {
    if (isApiError(json)) {
      throw new HomeworkApiError(json.error.code, json.error.message)
    }
    throw new HomeworkApiError('UNKNOWN', 'Failed to list admin assignments')
  }

  return json.assignments as AdminAssignmentSummary[]
}

/**
 * Admin: Get assignment detail with all student submission summaries
 */
export async function getAssignmentAdmin(
  assignmentId: string,
  signal?: AbortSignal
): Promise<AdminAssignmentDetail> {
  const response = await authFetch(
    `${API_BASE}/homework/admin/assignments/${assignmentId}`,
    { signal }
  )

  const json = await response.json()

  if (!response.ok) {
    if (isApiError(json)) {
      throw new HomeworkApiError(json.error.code, json.error.message)
    }
    throw new HomeworkApiError('UNKNOWN', 'Failed to get admin assignment')
  }

  return json as AdminAssignmentDetail
}

/**
 * Admin: Get full submission detail for review
 */
export async function getSubmissionAdmin(
  submissionId: string,
  signal?: AbortSignal
): Promise<AdminSubmissionDetail> {
  const response = await authFetch(
    `${API_BASE}/homework/admin/submissions/${submissionId}`,
    { signal }
  )

  const json = await response.json()

  if (!response.ok) {
    if (isApiError(json)) {
      throw new HomeworkApiError(json.error.code, json.error.message)
    }
    throw new HomeworkApiError('UNKNOWN', 'Failed to get submission')
  }

  return json as AdminSubmissionDetail
}

/**
 * Admin: Get file download URL
 */
export function getSubmissionFileUrl(submissionId: string, fileId: string): string {
  return `${API_BASE}/homework/admin/submissions/${submissionId}/files/${fileId}`
}

/**
 * Get count of homework items by status for a student
 */
export async function getPendingCount(
  studentId: string,
  signal?: AbortSignal
): Promise<HomeworkPendingCount> {
  const params = new URLSearchParams({ studentId })
  const response = await authFetch(`${API_BASE}/homework/pending-count?${params}`, { signal })

  const json = await response.json()

  if (!response.ok) {
    if (isApiError(json)) {
      throw new HomeworkApiError(json.error.code, json.error.message)
    }
    throw new HomeworkApiError('UNKNOWN', 'Failed to get pending count')
  }

  return json as HomeworkPendingCount
}
