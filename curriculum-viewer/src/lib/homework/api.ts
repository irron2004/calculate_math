/**
 * Homework API functions
 */

import type {
  CreateAssignmentData,
  HomeworkAssignment,
  HomeworkAssignmentDetail,
  HomeworkSubmitData,
} from './types'

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
  const response = await fetch(`${API_BASE}/homework/assignments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: data.title,
      description: data.description || null,
      problems: data.problems,
      dueAt: data.dueAt || null,
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
  const response = await fetch(`${API_BASE}/homework/assignments?${params}`, {
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
  const response = await fetch(
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

  const response = await fetch(
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
