/**
 * Homework system types
 */

export type HomeworkProblemType = 'objective' | 'subjective'

export type HomeworkReviewStatus = 'pending' | 'approved' | 'returned'

export type HomeworkProblemReview = {
  needsRevision?: boolean
  comment?: string
}

export type HomeworkProblemBase = {
  id: string
  type: HomeworkProblemType
  question: string
  options?: string[]  // For objective (multiple choice)
}

export type StudentHomeworkProblem = HomeworkProblemBase

export type AdminHomeworkProblem = HomeworkProblemBase & {
  answer?: string
}

export type HomeworkLabelKind = 'preset' | 'custom'

export type HomeworkLabel = {
  id: string
  key: string
  label: string
  kind: HomeworkLabelKind
  createdBy: string
  createdAt: string
  archivedAt?: string | null
}

export type HomeworkAssignment = {
  id: string
  title: string
  description?: string
  problems: StudentHomeworkProblem[]
  dueAt?: string
  scheduledAt?: string | null
  stickerRewardCount?: number
  createdAt: string
  submitted: boolean
  submissionId?: string | null
  submittedAt?: string | null
  reviewStatus?: HomeworkReviewStatus | null
}

export type HomeworkAssignmentDetail = {
  id: string
  title: string
  description?: string
  problems: StudentHomeworkProblem[]
  dueAt?: string
  stickerRewardCount?: number
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
  reviewStatus: HomeworkReviewStatus
  reviewedAt?: string | null
  reviewedBy?: string | null
  problemReviews: Record<string, HomeworkProblemReview>
}

export type HomeworkSubmitData = {
  studentId: string
  answers: Record<string, string>  // {problemId: answer}
  images: File[]
}

export type HomeworkSubmissionReviewData = {
  status: HomeworkReviewStatus
  reviewedBy?: string
  problemReviews: Record<string, HomeworkProblemReview>
}

export type CreateAssignmentData = {
  title: string
  description?: string
  problems?: AdminHomeworkProblem[]
  problemIds?: string[]
  dueAt?: string
  scheduledAt?: string
  stickerRewardCount?: number
  targetStudentIds: string[]
}

export type ProblemBankProblem = {
  id: string
  batchId?: string | null
  weekKey?: string | null
  dayKey?: string | null
  orderIndex: number
  type: HomeworkProblemType
  question: string
  options?: string[] | null
  answer?: string | null
  labelKeys: string[]
  createdAt: string
}

export type ProblemBankImportResult = {
  batchId: string
  createdProblemCount: number
  skippedProblemCount: number
}

export type UpdateAssignmentData = {
  title?: string
  dueAt?: string | null
}

export type HomeworkStatus = 'not_submitted' | 'pending' | 'returned' | 'approved' | 'overdue'

export function getHomeworkStatus(assignment: HomeworkAssignment): HomeworkStatus {
  if (assignment.reviewStatus === 'approved') {
    return 'approved'
  }

  if (assignment.reviewStatus === 'returned') {
    return 'returned'
  }

  if (assignment.reviewStatus === 'pending' || assignment.submitted) {
    return 'pending'
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
  if (assignment.submitted || assignment.reviewStatus || !assignment.dueAt) {
    return false
  }

  const now = new Date()
  const dueDate = new Date(assignment.dueAt)
  const hoursUntilDue = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60)

  return hoursUntilDue > 0 && hoursUntilDue <= 24
}

export function createEmptyProblem(index: number): AdminHomeworkProblem {
  return {
    id: `p${index}`,
    type: 'subjective',
    question: '',
    options: undefined,
    answer: undefined
  }
}

// ============================================================
// Admin Types
// ============================================================

export type AdminAssignmentSummary = {
  id: string
  title: string
  description?: string | null
  problems: AdminHomeworkProblem[]
  dueAt?: string | null
  scheduledAt?: string | null
  stickerRewardCount?: number
  createdBy: string
  createdAt: string
  totalStudents: number
  submittedCount: number
  pendingCount: number
  approvedCount: number
  returnedCount: number
  isScheduled: boolean
}

export type AdminStudentSubmissionSummary = {
  studentId: string
  assignedAt: string
  submissionId?: string | null
  submittedAt?: string | null
  reviewStatus?: HomeworkReviewStatus | null
  reviewedAt?: string | null
  reviewedBy?: string | null
}

export type AdminAssignmentDetail = {
  id: string
  title: string
  description?: string | null
  problems: AdminHomeworkProblem[]
  dueAt?: string | null
  scheduledAt?: string | null
  stickerRewardCount?: number
  createdBy: string
  createdAt: string
  students: AdminStudentSubmissionSummary[]
}

export type AdminSubmissionFile = {
  id: string
  storedPath: string
  originalName: string
  contentType: string
  sizeBytes: number
  createdAt: string
}

export type AdminSubmissionDetail = {
  id: string
  assignmentId: string
  studentId: string
  answers: Record<string, string>
  submittedAt: string
  reviewStatus: HomeworkReviewStatus
  reviewedAt?: string | null
  reviewedBy?: string | null
  problemReviews: Record<string, HomeworkProblemReview>
  assignmentTitle: string
  assignmentDescription?: string | null
  problems: AdminHomeworkProblem[]
  dueAt?: string | null
  files: AdminSubmissionFile[]
}

export type HomeworkPendingCount = {
  totalAssigned: number
  notSubmitted: number
  returned: number
  pendingReview: number
  approved: number
  actionRequired: number
}
