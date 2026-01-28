/**
 * Homework system types
 */

export type HomeworkProblemType = 'objective' | 'subjective'

export type HomeworkProblem = {
  id: string
  type: HomeworkProblemType
  question: string
  options?: string[]  // For objective (multiple choice)
  answer?: string     // Correct answer (for admin reference)
}

export type HomeworkAssignment = {
  id: string
  title: string
  description?: string
  problems: HomeworkProblem[]
  dueAt?: string
  createdAt: string
  submitted: boolean
}

export type HomeworkAssignmentDetail = {
  id: string
  title: string
  description?: string
  problems: HomeworkProblem[]
  dueAt?: string
  createdAt: string
  submission?: HomeworkSubmissionInfo
}

export type HomeworkSubmissionFile = {
  id: string
  originalName: string
  contentType: string
  sizeBytes: number
}

export type HomeworkSubmissionInfo = {
  id: string
  answers: Record<string, string>  // {problemId: answer}
  submittedAt: string
  files: HomeworkSubmissionFile[]
}

export type HomeworkSubmitData = {
  studentId: string
  answers: Record<string, string>  // {problemId: answer}
  images: File[]
}

export type CreateAssignmentData = {
  title: string
  description?: string
  problems: HomeworkProblem[]
  dueAt?: string
  targetStudentIds: string[]
}

export type HomeworkStatus = 'not_submitted' | 'submitted' | 'overdue'

export function getHomeworkStatus(assignment: HomeworkAssignment): HomeworkStatus {
  if (assignment.submitted) {
    return 'submitted'
  }

  if (assignment.dueAt) {
    const now = new Date()
    const dueDate = new Date(assignment.dueAt)
    if (now > dueDate) {
      return 'overdue'
    }
  }

  return 'not_submitted'
}

export function isOverdueSoon(assignment: HomeworkAssignment): boolean {
  if (assignment.submitted || !assignment.dueAt) {
    return false
  }

  const now = new Date()
  const dueDate = new Date(assignment.dueAt)
  const hoursUntilDue = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60)

  return hoursUntilDue > 0 && hoursUntilDue <= 24
}

export function createEmptyProblem(index: number): HomeworkProblem {
  return {
    id: `p${index}`,
    type: 'subjective',
    question: '',
    options: undefined,
    answer: undefined
  }
}
