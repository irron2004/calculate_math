import { useCallback, useEffect, useMemo, useState } from 'react'
import { getAllStudents, type StudentInfo } from '../lib/auth/AuthProvider'
import {
  getAssignmentAdmin,
  getSubmissionAdmin,
  getSubmissionFileUrl,
  listAssignmentsAdmin,
  reviewSubmission,
  HomeworkApiError
} from '../lib/homework/api'
import type {
  AdminAssignmentDetail,
  AdminAssignmentSummary,
  AdminSubmissionDetail,
  HomeworkProblemReview
} from '../lib/homework/types'

type ReviewState = Record<string, { needsRevision: boolean; comment: string }>

type ViewMode = 'list' | 'assignment' | 'submission'

function formatDateTime(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function formatDate(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function StatusBadge({ status }: { status: string | null | undefined }) {
  if (status === 'approved') {
    return <span className="badge badge-ok">완료</span>
  }
  if (status === 'pending') {
    return <span className="badge badge-warn">검토 중</span>
  }
  if (status === 'returned') {
    return <span className="badge badge-error">반려</span>
  }
  return <span className="badge">미제출</span>
}

function SubmissionStats({
  total,
  submitted,
  pending,
  approved,
  returned
}: {
  total: number
  submitted: number
  pending: number
  approved: number
  returned: number
}) {
  const notSubmitted = total - submitted
  return (
    <div className="submission-stats">
      <span className="stat-item" title="전체 학생">
        전체: {total}
      </span>
      {notSubmitted > 0 && (
        <span className="stat-item stat-not-submitted" title="미제출">
          미제출: {notSubmitted}
        </span>
      )}
      {pending > 0 && (
        <span className="stat-item stat-pending" title="검토 대기">
          검토 대기: {pending}
        </span>
      )}
      {returned > 0 && (
        <span className="stat-item stat-returned" title="반려">
          반려: {returned}
        </span>
      )}
      {approved > 0 && (
        <span className="stat-item stat-approved" title="완료">
          완료: {approved}
        </span>
      )}
    </div>
  )
}

function ScheduledBadge({ scheduledAt, isScheduled }: { scheduledAt?: string | null; isScheduled: boolean }) {
  if (!isScheduled || !scheduledAt) return null
  return (
    <span className="badge badge-scheduled" title={`예약: ${formatDateTime(scheduledAt)}`}>
      예약됨
    </span>
  )
}

export default function AuthorHomeworkStatusPage() {
  const [students, setStudents] = useState<StudentInfo[]>([])
  const studentsById = useMemo(() => {
    const map = new Map<string, StudentInfo>()
    for (const s of students) {
      map.set(s.id, s)
    }
    return map
  }, [students])

  const [viewMode, setViewMode] = useState<ViewMode>('list')

  // Assignments list
  const [assignments, setAssignments] = useState<AdminAssignmentSummary[]>([])
  const [assignmentsLoading, setAssignmentsLoading] = useState(false)
  const [assignmentsError, setAssignmentsError] = useState<string | null>(null)

  // Selected assignment detail
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null)
  const [assignmentDetail, setAssignmentDetail] = useState<AdminAssignmentDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  // Selected submission detail
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null)
  const [submissionDetail, setSubmissionDetail] = useState<AdminSubmissionDetail | null>(null)
  const [submissionLoading, setSubmissionLoading] = useState(false)
  const [submissionError, setSubmissionError] = useState<string | null>(null)

  // Review state
  const [reviewState, setReviewState] = useState<ReviewState>({})
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const [reviewMessage, setReviewMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  )

  // Load students from local storage
  useEffect(() => {
    setStudents(getAllStudents())
  }, [])

  // Load all assignments
  const loadAssignments = useCallback(async (signal: AbortSignal) => {
    setAssignmentsLoading(true)
    setAssignmentsError(null)
    try {
      const data = await listAssignmentsAdmin(signal)
      if (!signal.aborted) {
        setAssignments(data)
      }
    } catch (err) {
      if (signal.aborted) return
      if (err instanceof HomeworkApiError) {
        setAssignmentsError(err.message)
      } else {
        setAssignmentsError('숙제 목록을 불러오는 중 오류가 발생했습니다.')
      }
    } finally {
      if (!signal.aborted) setAssignmentsLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    loadAssignments(controller.signal)
    return () => controller.abort()
  }, [loadAssignments])

  // Load assignment detail
  const loadAssignmentDetail = useCallback(async (assignmentId: string, signal: AbortSignal) => {
    setDetailLoading(true)
    setDetailError(null)
    try {
      const detail = await getAssignmentAdmin(assignmentId, signal)
      if (!signal.aborted) {
        setAssignmentDetail(detail)
      }
    } catch (err) {
      if (signal.aborted) return
      if (err instanceof HomeworkApiError) {
        setDetailError(err.message)
      } else {
        setDetailError('숙제 상세를 불러오는 중 오류가 발생했습니다.')
      }
    } finally {
      if (!signal.aborted) setDetailLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!selectedAssignmentId) {
      setAssignmentDetail(null)
      return
    }
    const controller = new AbortController()
    loadAssignmentDetail(selectedAssignmentId, controller.signal)
    return () => controller.abort()
  }, [loadAssignmentDetail, selectedAssignmentId])

  // Load submission detail
  const loadSubmissionDetail = useCallback(async (submissionId: string, signal: AbortSignal) => {
    setSubmissionLoading(true)
    setSubmissionError(null)
    try {
      const detail = await getSubmissionAdmin(submissionId, signal)
      if (!signal.aborted) {
        setSubmissionDetail(detail)
      }
    } catch (err) {
      if (signal.aborted) return
      if (err instanceof HomeworkApiError) {
        setSubmissionError(err.message)
      } else {
        setSubmissionError('제출물을 불러오는 중 오류가 발생했습니다.')
      }
    } finally {
      if (!signal.aborted) setSubmissionLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!selectedSubmissionId) {
      setSubmissionDetail(null)
      return
    }
    const controller = new AbortController()
    loadSubmissionDetail(selectedSubmissionId, controller.signal)
    return () => controller.abort()
  }, [loadSubmissionDetail, selectedSubmissionId])

  // Initialize review state when submission changes
  useEffect(() => {
    if (!submissionDetail) {
      setReviewState({})
      return
    }
    const next: ReviewState = {}
    for (const problem of submissionDetail.problems) {
      const review = submissionDetail.problemReviews?.[problem.id]
      if (review && (review.comment || review.needsRevision)) {
        next[problem.id] = {
          needsRevision: Boolean(review.needsRevision),
          comment: review.comment ?? ''
        }
      }
    }
    setReviewState(next)
  }, [submissionDetail])

  const handleSelectAssignment = useCallback((assignmentId: string) => {
    setSelectedAssignmentId(assignmentId)
    setSelectedSubmissionId(null)
    setViewMode('assignment')
    setReviewMessage(null)
  }, [])

  const handleSelectSubmission = useCallback((submissionId: string) => {
    setSelectedSubmissionId(submissionId)
    setViewMode('submission')
    setReviewMessage(null)
  }, [])

  const handleBackToList = useCallback(() => {
    setViewMode('list')
    setSelectedAssignmentId(null)
    setSelectedSubmissionId(null)
    setReviewMessage(null)
  }, [])

  const handleBackToAssignment = useCallback(() => {
    setViewMode('assignment')
    setSelectedSubmissionId(null)
    setReviewMessage(null)
  }, [])

  const handleReviewChange = useCallback(
    (problemId: string, patch: Partial<{ needsRevision: boolean; comment: string }>) => {
      setReviewState((prev) => {
        const next = { ...prev }
        const current = next[problemId] ?? { needsRevision: false, comment: '' }
        next[problemId] = { ...current, ...patch }
        return next
      })
    },
    []
  )

  const buildProblemReviews = useCallback((): Record<string, HomeworkProblemReview> => {
    const payload: Record<string, HomeworkProblemReview> = {}
    for (const [problemId, review] of Object.entries(reviewState)) {
      const comment = review.comment.trim()
      const needsRevision = review.needsRevision || Boolean(comment)
      if (needsRevision || comment) {
        payload[problemId] = {
          needsRevision,
          comment
        }
      }
    }
    return payload
  }, [reviewState])

  const hasIssues = useMemo(() => {
    return Object.values(reviewState).some((review) => {
      return review.needsRevision || review.comment.trim().length > 0
    })
  }, [reviewState])

  const handleReviewSubmit = useCallback(
    async (status: 'approved' | 'returned') => {
      if (!submissionDetail) return
      setReviewMessage(null)

      if (status === 'approved' && hasIssues) {
        setReviewMessage({ type: 'error', text: '반려 사유가 있으면 완료 처리할 수 없습니다.' })
        return
      }

      if (status === 'returned' && !hasIssues) {
        setReviewMessage({ type: 'error', text: '반려 처리하려면 문제에 사유를 입력하세요.' })
        return
      }

      if (status === 'returned') {
        const missingComment = Object.values(reviewState).some(
          (review) => review.needsRevision && review.comment.trim().length === 0
        )
        if (missingComment) {
          setReviewMessage({ type: 'error', text: '반려 체크된 문제는 사유를 입력하세요.' })
          return
        }
      }

      setReviewSubmitting(true)
      try {
        await reviewSubmission(submissionDetail.id, {
          status,
          reviewedBy: 'admin',
          problemReviews: buildProblemReviews()
        })
        setReviewMessage({
          type: 'success',
          text: status === 'approved' ? '완료 처리되었습니다.' : '반려 처리되었습니다.'
        })

        // Reload data
        const controller = new AbortController()
        await loadAssignments(controller.signal)
        if (selectedAssignmentId) {
          await loadAssignmentDetail(selectedAssignmentId, controller.signal)
        }
        if (selectedSubmissionId) {
          await loadSubmissionDetail(selectedSubmissionId, controller.signal)
        }
      } catch (err) {
        if (err instanceof HomeworkApiError) {
          setReviewMessage({ type: 'error', text: err.message })
        } else {
          setReviewMessage({ type: 'error', text: '검토 처리 중 오류가 발생했습니다.' })
        }
      } finally {
        setReviewSubmitting(false)
      }
    },
    [
      buildProblemReviews,
      hasIssues,
      loadAssignmentDetail,
      loadAssignments,
      loadSubmissionDetail,
      reviewState,
      selectedAssignmentId,
      selectedSubmissionId,
      submissionDetail
    ]
  )

  const getStudentName = useCallback(
    (studentId: string) => {
      const student = studentsById.get(studentId)
      return student?.name ?? studentId
    },
    [studentsById]
  )

  // Render: List View
  const renderListView = () => (
    <>
      <h2>전체 숙제 목록</h2>
      {assignmentsLoading && <p className="muted">숙제 목록을 불러오는 중...</p>}
      {assignmentsError && <p className="error">{assignmentsError}</p>}
      {!assignmentsLoading && !assignmentsError && assignments.length === 0 && (
        <p className="muted">출제된 숙제가 없습니다.</p>
      )}
      {!assignmentsLoading && !assignmentsError && assignments.length > 0 && (
        <div className="admin-assignment-list">
          {assignments.map((assignment) => (
            <div key={assignment.id} className="admin-assignment-card">
              <div className="admin-assignment-header">
                <h3>
                  {assignment.title}
                  <ScheduledBadge scheduledAt={assignment.scheduledAt} isScheduled={assignment.isScheduled} />
                </h3>
                {assignment.dueAt && (
                  <span className="muted">마감: {formatDateTime(assignment.dueAt)}</span>
                )}
              </div>
              {assignment.description && (
                <p className="admin-assignment-desc">{assignment.description}</p>
              )}
              <div className="admin-assignment-meta">
                <span className="muted">문제: {assignment.problems.length}개</span>
                <span className="muted">출제일: {formatDate(assignment.createdAt)}</span>
                {assignment.scheduledAt && (
                  <span className="muted">예약: {formatDateTime(assignment.scheduledAt)}</span>
                )}
              </div>
              <SubmissionStats
                total={assignment.totalStudents}
                submitted={assignment.submittedCount}
                pending={assignment.pendingCount}
                approved={assignment.approvedCount}
                returned={assignment.returnedCount}
              />
              <div className="admin-assignment-actions">
                <button
                  type="button"
                  className="button button-primary button-small"
                  onClick={() => handleSelectAssignment(assignment.id)}
                >
                  상세 보기
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )

  // Render: Assignment Detail View
  const renderAssignmentView = () => {
    if (detailLoading) {
      return <p className="muted">숙제 상세를 불러오는 중...</p>
    }
    if (detailError) {
      return <p className="error">{detailError}</p>
    }
    if (!assignmentDetail) {
      return <p className="muted">숙제를 선택하세요.</p>
    }

    return (
      <>
        <button type="button" className="button button-ghost button-small" onClick={handleBackToList}>
          &larr; 목록으로
        </button>

        <div className="admin-assignment-summary">
          <h2>{assignmentDetail.title}</h2>
          {assignmentDetail.description && (
            <p className="muted">{assignmentDetail.description}</p>
          )}
          <div className="admin-assignment-meta">
            {assignmentDetail.dueAt && (
              <span className="muted">마감: {formatDateTime(assignmentDetail.dueAt)}</span>
            )}
            <span className="muted">출제일: {formatDate(assignmentDetail.createdAt)}</span>
            <span className="muted">문제 수: {assignmentDetail.problems.length}개</span>
          </div>
        </div>

        <h3>학생별 제출 현황 ({assignmentDetail.students.length}명)</h3>
        <div className="admin-students-table-wrap">
          <table className="admin-students-table">
            <thead>
              <tr>
                <th>학생</th>
                <th>제출 일시</th>
                <th>상태</th>
                <th>검토자</th>
                <th>액션</th>
              </tr>
            </thead>
            <tbody>
              {assignmentDetail.students.map((student) => (
                <tr key={student.studentId}>
                  <td>
                    <span className="student-name">{getStudentName(student.studentId)}</span>
                    <span className="student-id muted">({student.studentId})</span>
                  </td>
                  <td>
                    {student.submittedAt ? (
                      formatDateTime(student.submittedAt)
                    ) : (
                      <span className="muted">-</span>
                    )}
                  </td>
                  <td>
                    <StatusBadge status={student.reviewStatus} />
                  </td>
                  <td>
                    {student.reviewedBy ? (
                      <>
                        {student.reviewedBy}
                        {student.reviewedAt && (
                          <span className="muted"> ({formatDate(student.reviewedAt)})</span>
                        )}
                      </>
                    ) : (
                      <span className="muted">-</span>
                    )}
                  </td>
                  <td>
                    {student.submissionId ? (
                      <button
                        type="button"
                        className="button button-ghost button-small"
                        onClick={() => handleSelectSubmission(student.submissionId!)}
                      >
                        검토하기
                      </button>
                    ) : (
                      <span className="muted">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    )
  }

  // Render: Submission Review View
  const renderSubmissionView = () => {
    if (submissionLoading) {
      return <p className="muted">제출물을 불러오는 중...</p>
    }
    if (submissionError) {
      return <p className="error">{submissionError}</p>
    }
    if (!submissionDetail) {
      return <p className="muted">제출물을 선택하세요.</p>
    }

    return (
      <>
        <button
          type="button"
          className="button button-ghost button-small"
          onClick={handleBackToAssignment}
        >
          &larr; 학생 목록으로
        </button>

        <div className="admin-submission-header">
          <h2>{submissionDetail.assignmentTitle}</h2>
          <div className="admin-submission-info">
            <span className="student-name">{getStudentName(submissionDetail.studentId)}</span>
            <StatusBadge status={submissionDetail.reviewStatus} />
          </div>
          <div className="admin-submission-meta">
            <span className="muted">제출 시간: {formatDateTime(submissionDetail.submittedAt)}</span>
            {submissionDetail.reviewedBy && (
              <span className="muted">
                검토자: {submissionDetail.reviewedBy}
                {submissionDetail.reviewedAt && ` (${formatDate(submissionDetail.reviewedAt)})`}
              </span>
            )}
          </div>
        </div>

        {submissionDetail.files.length > 0 && (
          <div className="admin-submission-files">
            <h4>첨부 파일 ({submissionDetail.files.length}개)</h4>
            <ul>
              {submissionDetail.files.map((file) => (
                <li key={file.id}>
                  <a
                    href={getSubmissionFileUrl(submissionDetail.id, file.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="file-link"
                  >
                    {file.originalName}
                  </a>
                  <span className="muted"> ({formatBytes(file.sizeBytes)})</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="admin-homework-problems">
          {submissionDetail.problems.map((problem, index) => {
            const answer = submissionDetail.answers[problem.id] || ''
            const review = reviewState[problem.id] ?? { needsRevision: false, comment: '' }

            return (
              <div key={problem.id} className="admin-problem-card">
                <div className="admin-problem-header">
                  <span className="problem-number">문제 {index + 1}</span>
                  <span className="problem-type-badge">
                    {problem.type === 'objective' ? '객관식' : '주관식'}
                  </span>
                </div>
                <p className="problem-question">{problem.question}</p>

                {problem.type === 'objective' && problem.options ? (
                  <div className="problem-options-display">
                    {problem.options.map((option, optionIndex) => {
                      const isSelected = answer === String(optionIndex + 1)
                      return (
                        <div
                          key={optionIndex}
                          className={`problem-option-display ${isSelected ? 'selected' : ''}`}
                        >
                          <span className="option-number">{optionIndex + 1}.</span>
                          <span className="option-text">{option}</span>
                          {isSelected && <span className="selected-mark">학생 답안</span>}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="admin-problem-answer">
                    <strong>학생 답안:</strong>
                    <div className="answer-text">{answer || '(미응답)'}</div>
                  </div>
                )}

                {problem.answer && (
                  <div className="admin-problem-answer muted">
                    <strong>정답:</strong> {problem.answer}
                  </div>
                )}

                <div className="admin-review-controls">
                  <label className="admin-review-checkbox">
                    <input
                      type="checkbox"
                      checked={review.needsRevision}
                      onChange={(e) =>
                        handleReviewChange(problem.id, { needsRevision: e.target.checked })
                      }
                      disabled={reviewSubmitting}
                    />
                    반려 표시
                  </label>
                  <textarea
                    value={review.comment}
                    onChange={(e) => handleReviewChange(problem.id, { comment: e.target.value })}
                    placeholder="반려 사유를 입력하세요. (반려 체크 시 필수)"
                    rows={3}
                    disabled={reviewSubmitting}
                  />
                </div>
              </div>
            )
          })}
        </div>

        {reviewMessage && (
          <p className={reviewMessage.type === 'success' ? 'success' : 'error'}>
            {reviewMessage.text}
          </p>
        )}

        <div className="admin-review-actions">
          <button
            type="button"
            className="button button-ghost"
            onClick={() => handleReviewSubmit('returned')}
            disabled={reviewSubmitting || !hasIssues}
          >
            {reviewSubmitting ? '처리 중...' : '반려 처리'}
          </button>
          <button
            type="button"
            className="button button-primary"
            onClick={() => handleReviewSubmit('approved')}
            disabled={reviewSubmitting || hasIssues}
          >
            {reviewSubmitting ? '처리 중...' : '완료 처리'}
          </button>
        </div>
      </>
    )
  }

  return (
    <section className="author-homework-status">
      <h1>숙제 현황</h1>
      <p className="muted">학생별 숙제 제출 현황을 확인하고 검토하세요.</p>

      <div className="admin-homework-content">
        {viewMode === 'list' && renderListView()}
        {viewMode === 'assignment' && renderAssignmentView()}
        {viewMode === 'submission' && renderSubmissionView()}
      </div>
    </section>
  )
}
