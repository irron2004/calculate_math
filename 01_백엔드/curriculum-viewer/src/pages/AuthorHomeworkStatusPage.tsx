import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useToast } from '../components/Toast'
import { listStudents } from '../lib/auth/api'
import type { StudentInfo } from '../lib/auth/types'
import {
  getAssignmentAdmin,
  getSubmissionAdmin,
  getSubmissionFileUrl,
  listAssignmentsAdmin,
  listAssignmentsAdminForStudent,
  listWrongProblemsAdminForStudent,
  updateAssignmentAdmin,
  deleteAssignmentAdmin,
  reviewSubmission,
  HomeworkApiError
} from '../lib/homework/api'
import { extendDueAtByWeek } from '../lib/homework/dueAt'
import { renderMathText } from '../lib/math/renderMathText'
import type {
  AdminAssignmentDetail,
  AdminAssignmentSummary,
  AdminStudentAssignmentStatus,
  AdminWrongProblemItem,
  AdminSubmissionDetail,
  HomeworkProblemReview
} from '../lib/homework/types'

type ReviewState = Record<string, { needsRevision: boolean; comment: string }>

type ViewMode = 'list' | 'assignment' | 'submission' | 'wrongProblems'

type MainTab = 'students' | 'assignments'

type SubmissionBackMode = 'assignment' | 'students' | 'wrongProblems'

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

function toDateTimeLocalValue(value?: string | null): string {
  if (!value) return ''
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (/^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}$/.test(trimmed)) {
    return trimmed
  }
  const date = new Date(trimmed)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (num: number) => String(num).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`
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

function tryLocalStorageSet(key: string, value: string): boolean {
  try {
    if (typeof localStorage === 'undefined') return false
    localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
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
  const { showToast } = useToast()

  const [students, setStudents] = useState<StudentInfo[]>([])
  const studentsById = useMemo(() => {
    const map = new Map<string, StudentInfo>()
    for (const s of students) {
      map.set(s.id, s)
    }
    return map
  }, [students])

  const [viewMode, setViewMode] = useState<ViewMode>('list')

  const [mainTab, setMainTab] = useState<MainTab>('students')
  const [submissionBackMode, setSubmissionBackMode] = useState<SubmissionBackMode>('assignment')
  const [submissionShowWrongOnly, setSubmissionShowWrongOnly] = useState(false)

  // Assignments list
  const [assignments, setAssignments] = useState<AdminAssignmentSummary[]>([])
  const [assignmentsLoading, setAssignmentsLoading] = useState(false)
  const [assignmentsError, setAssignmentsError] = useState<string | null>(null)

  const [submissionAlarmEnabled, setSubmissionAlarmEnabled] = useState(() => {
    try {
      return localStorage.getItem('authorHomeworkStatus.submissionAlarm') === '1'
    } catch {
      return false
    }
  })
  const [browserNotificationEnabled, setBrowserNotificationEnabled] = useState(() => {
    try {
      return localStorage.getItem('authorHomeworkStatus.browserNotification') === '1'
    } catch {
      return false
    }
  })
  const submissionAlarmInitializedRef = useRef(false)
  const submissionAlarmPendingByIdRef = useRef(new Map<string, number>())

  const handleToggleSubmissionAlarm = useCallback(
    (enabled: boolean) => {
      setSubmissionAlarmEnabled(enabled)
      tryLocalStorageSet('authorHomeworkStatus.submissionAlarm', enabled ? '1' : '0')

      submissionAlarmInitializedRef.current = false
      submissionAlarmPendingByIdRef.current = new Map()

      showToast(
        enabled ? '제출 알림을 켰습니다. 새 제출이 있으면 알려줄게요.' : '제출 알림을 껐습니다.',
        'info'
      )
    },
    [showToast]
  )

  const handleToggleBrowserNotification = useCallback(
    async (enabled: boolean) => {
      if (!enabled) {
        setBrowserNotificationEnabled(false)
        tryLocalStorageSet('authorHomeworkStatus.browserNotification', '0')
        showToast('브라우저 알림을 껐습니다.', 'info')
        return
      }

      if (typeof window === 'undefined' || !("Notification" in window)) {
        showToast('이 브라우저는 알림을 지원하지 않습니다.', 'warning')
        setBrowserNotificationEnabled(false)
        return
      }

      if (Notification.permission === 'granted') {
        setBrowserNotificationEnabled(true)
        tryLocalStorageSet('authorHomeworkStatus.browserNotification', '1')
        showToast('브라우저 알림을 켰습니다.', 'success')
        return
      }

      let result: NotificationPermission | null = null
      try {
        result = await Notification.requestPermission()
      } catch {
        result = null
      }
      if (result === 'granted') {
        setBrowserNotificationEnabled(true)
        tryLocalStorageSet('authorHomeworkStatus.browserNotification', '1')
        showToast('브라우저 알림을 켰습니다.', 'success')
        return
      }

      setBrowserNotificationEnabled(false)
      tryLocalStorageSet('authorHomeworkStatus.browserNotification', '0')
      showToast('브라우저 알림 권한이 없어 알림을 켤 수 없습니다.', 'warning')
    },
    [showToast]
  )

  const maybeNotifyNewSubmissions = useCallback(
    (nextAssignments: AdminAssignmentSummary[]) => {
      if (!submissionAlarmEnabled) return

      const nextPendingById = new Map<string, number>()
      for (const a of nextAssignments) {
        nextPendingById.set(a.id, a.pendingCount)
      }

      if (!submissionAlarmInitializedRef.current) {
        submissionAlarmInitializedRef.current = true
        submissionAlarmPendingByIdRef.current = nextPendingById
        return
      }

      const prevPendingById = submissionAlarmPendingByIdRef.current
      const increases: Array<{ title: string; delta: number }> = []
      for (const a of nextAssignments) {
        const prev = prevPendingById.get(a.id) ?? 0
        const next = a.pendingCount
        if (next > prev) {
          increases.push({ title: a.title, delta: next - prev })
        }
      }

      submissionAlarmPendingByIdRef.current = nextPendingById

      if (increases.length === 0) return

      const totalDelta = increases.reduce((sum, e) => sum + e.delta, 0)
      const label =
        increases.length === 1
          ? increases[0].title
          : `${increases[0].title} 외 ${increases.length - 1}개`

      showToast(`새 제출물 ${totalDelta}건: ${label}`, 'info')

      if (
        browserNotificationEnabled &&
        typeof window !== 'undefined' &&
        ("Notification" in window) &&
        Notification.permission === 'granted' &&
        typeof document !== 'undefined' &&
        document.visibilityState !== 'visible'
      ) {
        try {
          new Notification('새 숙제 제출', {
            body: `${label} (+${totalDelta})`
          })
        } catch {
          setBrowserNotificationEnabled(false)
          tryLocalStorageSet('authorHomeworkStatus.browserNotification', '0')
        }
      }
    },
    [browserNotificationEnabled, showToast, submissionAlarmEnabled]
  )

  const [selectedStudentIdForStatus, setSelectedStudentIdForStatus] = useState<string | null>(null)
  const [studentAssignments, setStudentAssignments] = useState<AdminStudentAssignmentStatus[]>([])
  const [studentAssignmentsLoading, setStudentAssignmentsLoading] = useState(false)
  const [studentAssignmentsError, setStudentAssignmentsError] = useState<string | null>(null)
  const [studentOnlyActionRequired, setStudentOnlyActionRequired] = useState(false)
  const [studentMessage, setStudentMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [studentSubmitting, setStudentSubmitting] = useState(false)

  const [studentWrongProblems, setStudentWrongProblems] = useState<AdminWrongProblemItem[]>([])
  const [studentWrongProblemsLoading, setStudentWrongProblemsLoading] = useState(false)
  const [studentWrongProblemsError, setStudentWrongProblemsError] = useState<string | null>(null)

  // Selected assignment detail
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null)
  const [assignmentDetail, setAssignmentDetail] = useState<AdminAssignmentDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDueAt, setEditDueAt] = useState('')
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editMessage, setEditMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  )

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

  // Load students from server
  useEffect(() => {
    const controller = new AbortController()
    listStudents(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setStudents(data)
      })
      .catch(() => {
        if (!controller.signal.aborted) setStudents([])
      })
    return () => controller.abort()
  }, [])

  // Load all assignments
  const loadAssignments = useCallback(async (signal: AbortSignal) => {
    setAssignmentsLoading(true)
    setAssignmentsError(null)
    try {
      const data = await listAssignmentsAdmin(signal)
      if (!signal.aborted) {
        maybeNotifyNewSubmissions(data)
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
  }, [maybeNotifyNewSubmissions])

  const loadStudentAssignments = useCallback(
    async (studentId: string, signal: AbortSignal) => {
      setStudentAssignmentsLoading(true)
      setStudentAssignmentsError(null)

      try {
        const data = await listAssignmentsAdminForStudent(studentId, signal)
        if (!signal.aborted) {
          setStudentAssignments(data.assignments)
        }
      } catch (err) {
        if (signal.aborted) return
        if (err instanceof HomeworkApiError) {
          setStudentAssignmentsError(err.message)
        } else {
          setStudentAssignmentsError('학생별 숙제 현황을 불러오는 중 오류가 발생했습니다.')
        }
      } finally {
        if (!signal.aborted) setStudentAssignmentsLoading(false)
      }
    },
    []
  )

  const loadStudentWrongProblems = useCallback(
    async (studentId: string, signal: AbortSignal) => {
      setStudentWrongProblemsLoading(true)
      setStudentWrongProblemsError(null)
      try {
        const data = await listWrongProblemsAdminForStudent(studentId, undefined, signal)
        if (!signal.aborted) {
          setStudentWrongProblems(data.wrongProblems)
        }
      } catch (err) {
        if (signal.aborted) return
        if (err instanceof HomeworkApiError) {
          setStudentWrongProblemsError(err.message)
        } else {
          setStudentWrongProblemsError('오답 목록을 불러오는 중 오류가 발생했습니다.')
        }
      } finally {
        if (!signal.aborted) setStudentWrongProblemsLoading(false)
      }
    },
    []
  )

  useEffect(() => {
    if (submissionAlarmEnabled) return
    const controller = new AbortController()
    loadAssignments(controller.signal)
    return () => controller.abort()
  }, [loadAssignments, submissionAlarmEnabled])

  useEffect(() => {
    if (!submissionAlarmEnabled) return
    if (typeof window === 'undefined') return

    const controller = new AbortController()
    loadAssignments(controller.signal)

    const intervalId = window.setInterval(() => {
      const tick = new AbortController()
      loadAssignments(tick.signal)
    }, 30_000)

    return () => {
      controller.abort()
      window.clearInterval(intervalId)
    }
  }, [loadAssignments, submissionAlarmEnabled])

  useEffect(() => {
    if (mainTab !== 'students') return
    if (selectedStudentIdForStatus) return
    if (students.length === 0) return
    setSelectedStudentIdForStatus(students[0].id)
  }, [mainTab, selectedStudentIdForStatus, students])

  useEffect(() => {
    if (mainTab !== 'students') return
    if (!selectedStudentIdForStatus) return

    const controller = new AbortController()
    loadStudentAssignments(selectedStudentIdForStatus, controller.signal)
    return () => controller.abort()
  }, [loadStudentAssignments, mainTab, selectedStudentIdForStatus])

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

  useEffect(() => {
    if (!assignmentDetail) {
      setEditTitle('')
      setEditDueAt('')
      setEditMessage(null)
      return
    }
    setEditTitle(assignmentDetail.title ?? '')
    setEditDueAt(toDateTimeLocalValue(assignmentDetail.dueAt ?? null))
    setEditMessage(null)
  }, [assignmentDetail])

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

  const openSubmission = useCallback(
    (
      submissionId: string,
      options: {
        backMode: SubmissionBackMode
        showWrongOnly?: boolean
      }
    ) => {
      setSelectedSubmissionId(submissionId)
      setSubmissionBackMode(options.backMode)
      setSubmissionShowWrongOnly(Boolean(options.showWrongOnly))
      setReviewMessage(null)
      setViewMode('submission')
    },
    []
  )

  const handleSelectAssignment = useCallback((assignmentId: string) => {
    setMainTab('assignments')
    setSelectedAssignmentId(assignmentId)
    setSelectedSubmissionId(null)
    setViewMode('assignment')
    setReviewMessage(null)
  }, [])

  const handleSelectSubmission = useCallback((submissionId: string) => {
    openSubmission(submissionId, { backMode: 'assignment' })
  }, [openSubmission])

  const handleBackToList = useCallback(() => {
    setViewMode('list')
    setSelectedAssignmentId(null)
    setSelectedSubmissionId(null)
    setReviewMessage(null)
  }, [])

  const handleOpenStudentWrongProblems = useCallback(async () => {
    if (!selectedStudentIdForStatus) return
    setViewMode('wrongProblems')
    setStudentWrongProblemsError(null)
    const controller = new AbortController()
    await loadStudentWrongProblems(selectedStudentIdForStatus, controller.signal)
  }, [loadStudentWrongProblems, selectedStudentIdForStatus])

  const handleBackToAssignment = useCallback(() => {
    setViewMode('assignment')
    setSelectedSubmissionId(null)
    setReviewMessage(null)
  }, [])

  const handleBackFromSubmission = useCallback(() => {
    if (submissionBackMode === 'students') {
      setViewMode('list')
      setMainTab('students')
      setSelectedAssignmentId(null)
      setSelectedSubmissionId(null)
      setReviewMessage(null)
      return
    }
    if (submissionBackMode === 'wrongProblems') {
      setViewMode('wrongProblems')
      setMainTab('students')
      setSelectedAssignmentId(null)
      setSelectedSubmissionId(null)
      setReviewMessage(null)
      return
    }
    handleBackToAssignment()
  }, [handleBackToAssignment, submissionBackMode])

  const handleAssignmentUpdate = useCallback(async () => {
    if (!assignmentDetail) return
    const trimmedTitle = editTitle.trim()
    if (!trimmedTitle) {
      setEditMessage({ type: 'error', text: '숙제 이름을 입력하세요.' })
      return
    }

    setEditSubmitting(true)
    setEditMessage(null)

    try {
      await updateAssignmentAdmin(assignmentDetail.id, {
        title: trimmedTitle,
        dueAt: editDueAt.trim() ? editDueAt.trim() : null
      })
      setEditMessage({ type: 'success', text: '숙제 정보가 수정되었습니다.' })

      const controller = new AbortController()
      await loadAssignments(controller.signal)
      await loadAssignmentDetail(assignmentDetail.id, controller.signal)
    } catch (err) {
      if (err instanceof HomeworkApiError) {
        setEditMessage({ type: 'error', text: err.message })
      } else {
        setEditMessage({ type: 'error', text: '숙제 수정 중 오류가 발생했습니다.' })
      }
    } finally {
      setEditSubmitting(false)
    }
  }, [assignmentDetail, editDueAt, editTitle, loadAssignmentDetail, loadAssignments])

  const handleExtendDueAtByWeek = useCallback(async () => {
    if (!assignmentDetail?.dueAt) return

    const hasUnsubmitted = assignmentDetail.students.some((student) => !student.submissionId)
    if (!hasUnsubmitted) return

    const nextDueAt = extendDueAtByWeek(assignmentDetail.dueAt)
    if (!nextDueAt) {
      setEditMessage({ type: 'error', text: '현재 마감일을 연장할 수 없습니다.' })
      return
    }

    const confirmed = window.confirm('이 숙제의 전체 마감일을 1주일 연장할까요?')
    if (!confirmed) return

    setEditSubmitting(true)
    setEditMessage(null)
    try {
      await updateAssignmentAdmin(assignmentDetail.id, {
        title: assignmentDetail.title,
        dueAt: nextDueAt
      })
      setEditMessage({ type: 'success', text: '마감일을 1주일 연장했습니다.' })

      const controller = new AbortController()
      await loadAssignments(controller.signal)
      await loadAssignmentDetail(assignmentDetail.id, controller.signal)
    } catch (err) {
      if (err instanceof HomeworkApiError) {
        setEditMessage({ type: 'error', text: err.message })
      } else {
        setEditMessage({ type: 'error', text: '마감일 연장 중 오류가 발생했습니다.' })
      }
    } finally {
      setEditSubmitting(false)
    }
  }, [assignmentDetail, loadAssignmentDetail, loadAssignments])

  const handleExtendDueAtForStudent = useCallback(
    async (assignment: AdminStudentAssignmentStatus) => {
      if (!selectedStudentIdForStatus) return
      if (assignment.submissionId) return

      const dueAtRaw = (assignment.dueAt ?? '').trim()
      if (!dueAtRaw) {
        setStudentMessage({ type: 'error', text: '마감일이 없는 숙제는 연장할 수 없습니다.' })
        return
      }

      const nextDueAt = extendDueAtByWeek(dueAtRaw)
      if (!nextDueAt) {
        setStudentMessage({ type: 'error', text: '현재 마감일을 연장할 수 없습니다.' })
        return
      }

      const confirmed = window.confirm(
        '이 학생이 미제출한 숙제입니다. 이 숙제의 전체 마감일을 1주일 연장할까요?'
      )
      if (!confirmed) return

      setStudentSubmitting(true)
      setStudentMessage(null)
      try {
        await updateAssignmentAdmin(assignment.id, {
          title: assignment.title,
          dueAt: nextDueAt
        })
        setStudentMessage({ type: 'success', text: '마감일을 1주일 연장했습니다.' })

        const controller = new AbortController()
        await loadStudentAssignments(selectedStudentIdForStatus, controller.signal)
      } catch (err) {
        if (err instanceof HomeworkApiError) {
          setStudentMessage({ type: 'error', text: err.message })
        } else {
          setStudentMessage({ type: 'error', text: '마감일 연장 중 오류가 발생했습니다.' })
        }
      } finally {
        setStudentSubmitting(false)
      }
    },
    [loadStudentAssignments, selectedStudentIdForStatus]
  )

  const handleAssignmentDelete = useCallback(
    async (assignmentId: string) => {
      const confirmed = window.confirm('이 숙제를 삭제할까요? 제출 기록도 함께 삭제됩니다.')
      if (!confirmed) return

      setEditMessage(null)
      setAssignmentsError(null)

      try {
        await deleteAssignmentAdmin(assignmentId)
        const controller = new AbortController()
        await loadAssignments(controller.signal)
        if (selectedAssignmentId === assignmentId) {
          handleBackToList()
        }
      } catch (err) {
        const message =
          err instanceof HomeworkApiError ? err.message : '숙제 삭제 중 오류가 발생했습니다.'
        if (viewMode === 'assignment') {
          setEditMessage({ type: 'error', text: message })
        } else {
          setAssignmentsError(message)
        }
      }
    },
    [handleBackToList, loadAssignments, selectedAssignmentId, viewMode]
  )

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

  const wrongProblemIds = useMemo(() => {
    const ids = new Set<string>()
    if (!submissionDetail) return ids

    for (const problem of submissionDetail.problems) {
      const studentAnswer = (submissionDetail.answers[problem.id] ?? '').trim()
      const review = reviewState[problem.id] ?? { needsRevision: false, comment: '' }
      const comment = review.comment.trim()

      if (problem.type === 'objective') {
        const correctAnswer = (problem.answer ?? '').trim()
        if (correctAnswer && studentAnswer !== correctAnswer) {
          ids.add(problem.id)
        }
        continue
      }

      if (review.needsRevision || comment.length > 0) {
        ids.add(problem.id)
      }
    }

    return ids
  }, [reviewState, submissionDetail])

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
  const renderStudentStatusView = () => {
    const summary = {
      total: studentAssignments.length,
      submitted: studentAssignments.filter((a) => a.submitted).length,
      pending: studentAssignments.filter((a) => a.reviewStatus === 'pending').length,
      approved: studentAssignments.filter((a) => a.reviewStatus === 'approved').length,
      returned: studentAssignments.filter((a) => a.reviewStatus === 'returned').length
    }

    const filtered = studentOnlyActionRequired
      ? studentAssignments.filter((a) => !a.submissionId || a.reviewStatus === 'returned')
      : studentAssignments

    return (
      <>
        <h2>학생별 숙제 현황</h2>
        <div className="admin-homework-toolbar">
          <label className="form-field" style={{ minWidth: 220 }}>
            학생
            <select
              value={selectedStudentIdForStatus ?? ''}
              onChange={(e) => {
                setSelectedStudentIdForStatus(e.target.value || null)
                setStudentOnlyActionRequired(false)
                setStudentMessage(null)
                setStudentWrongProblems([])
                setStudentWrongProblemsError(null)
              }}
              disabled={students.length === 0}
            >
              <option value="">학생을 선택하세요</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.name} ({student.id})
                </option>
              ))}
            </select>
          </label>

          <label className="admin-review-checkbox">
            <input
              type="checkbox"
              checked={studentOnlyActionRequired}
              onChange={(e) => setStudentOnlyActionRequired(e.target.checked)}
              disabled={studentAssignmentsLoading || studentAssignments.length === 0}
            />
            미제출/반려만
          </label>

          <button
            type="button"
            className="button button-ghost button-small"
            onClick={handleOpenStudentWrongProblems}
            disabled={!selectedStudentIdForStatus || studentWrongProblemsLoading}
            style={{ marginLeft: 8 }}
          >
            오답 모아보기
          </button>
        </div>

        {selectedStudentIdForStatus ? (
          <SubmissionStats
            total={summary.total}
            submitted={summary.submitted}
            pending={summary.pending}
            approved={summary.approved}
            returned={summary.returned}
          />
        ) : null}

        {studentAssignmentsLoading && <p className="muted">학생별 숙제 현황을 불러오는 중...</p>}
        {studentAssignmentsError && <p className="error">{studentAssignmentsError}</p>}
        {studentMessage && (
          <p className={studentMessage.type === 'success' ? 'success' : 'error'}>{studentMessage.text}</p>
        )}

        {!studentAssignmentsLoading && !studentAssignmentsError && selectedStudentIdForStatus && filtered.length === 0 && (
          <p className="muted">표시할 숙제가 없습니다.</p>
        )}

        {!studentAssignmentsLoading && !studentAssignmentsError && selectedStudentIdForStatus && filtered.length > 0 && (
          <div className="admin-students-table-wrap">
            <table className="admin-students-table">
              <thead>
                <tr>
                  <th>숙제</th>
                  <th>마감</th>
                  <th>상태</th>
                  <th>제출</th>
                  <th>액션</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((assignment) => {
                  const canExtend = !assignment.submissionId && Boolean((assignment.dueAt ?? '').trim())
                  const extendTitle =
                    !assignment.submissionId && !(assignment.dueAt ?? '').trim()
                      ? '마감일이 없는 숙제는 연장할 수 없습니다.'
                      : undefined
                  return (
                    <tr key={assignment.id}>
                      <td>
                        <span className="student-name">
                          {assignment.title}
                          <ScheduledBadge scheduledAt={assignment.scheduledAt} isScheduled={assignment.isScheduled} />
                        </span>
                        <span className="muted" style={{ marginLeft: 8 }}>
                          (문제 {assignment.problemCount}개)
                        </span>
                      </td>
                      <td>
                        {assignment.dueAt ? (
                          formatDateTime(assignment.dueAt)
                        ) : (
                          <span className="muted">-</span>
                        )}
                      </td>
                      <td>
                        <StatusBadge status={assignment.reviewStatus} />
                      </td>
                      <td>
                        {assignment.submittedAt ? (
                          formatDateTime(assignment.submittedAt)
                        ) : (
                          <span className="muted">-</span>
                        )}
                      </td>
                      <td>
                        {assignment.submissionId ? (
                          <>
                            <button
                              type="button"
                              className="button button-ghost button-small"
                              onClick={() =>
                                openSubmission(assignment.submissionId!, { backMode: 'students', showWrongOnly: false })
                              }
                            >
                              제출물 보기
                            </button>
                            <button
                              type="button"
                              className="button button-ghost button-small"
                              onClick={() =>
                                openSubmission(assignment.submissionId!, { backMode: 'students', showWrongOnly: true })
                              }
                              disabled={studentSubmitting}
                              style={{ marginLeft: 8 }}
                            >
                              오답 보기
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="button button-ghost button-small"
                            onClick={() => handleExtendDueAtForStudent(assignment)}
                            disabled={!canExtend || studentSubmitting}
                            title={extendTitle}
                          >
                            1주일 연장하기
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </>
    )
  }

  const renderAssignmentListView = () => (
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
                <p className="admin-assignment-desc">{renderMathText(assignment.description)}</p>
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
                <button
                  type="button"
                  className="button button-ghost button-small"
                  onClick={() => handleAssignmentDelete(assignment.id)}
                >
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )

  const renderListView = () => (
    <>
      <div className="admin-assignment-actions" style={{ marginTop: 0 }}>
        <button
          type="button"
          className={`button button-small ${mainTab === 'students' ? 'button-primary' : 'button-ghost'}`}
          onClick={() => {
            setMainTab('students')
            setViewMode('list')
          }}
        >
          학생별
        </button>
        <button
          type="button"
          className={`button button-small ${mainTab === 'assignments' ? 'button-primary' : 'button-ghost'}`}
          onClick={() => {
            setMainTab('assignments')
            setViewMode('list')
          }}
        >
          숙제별
        </button>
      </div>

      {mainTab === 'students' ? renderStudentStatusView() : renderAssignmentListView()}
    </>
  )

  const renderWrongProblemsView = () => {
    if (!selectedStudentIdForStatus) {
      return (
        <>
          <button type="button" className="button button-ghost button-small" onClick={handleBackToList}>
            &larr; 목록으로
          </button>
          <p className="muted">학생을 선택하세요.</p>
        </>
      )
    }

    const studentName = getStudentName(selectedStudentIdForStatus)
    const rows = studentWrongProblems

    return (
      <>
        <button type="button" className="button button-ghost button-small" onClick={handleBackToList}>
          &larr; 학생별 현황으로
        </button>

        <div className="admin-assignment-summary" style={{ marginTop: 12 }}>
          <h2>{studentName} 오답 모아보기</h2>
          <p className="muted">총 {rows.length}개</p>
        </div>

        {studentWrongProblemsLoading && <p className="muted">오답 목록을 불러오는 중...</p>}
        {studentWrongProblemsError && <p className="error">{studentWrongProblemsError}</p>}

        {!studentWrongProblemsLoading && !studentWrongProblemsError && rows.length === 0 && (
          <p className="muted">오답이 없습니다.</p>
        )}

        {!studentWrongProblemsLoading && !studentWrongProblemsError && rows.length > 0 && (
          <div className="admin-assignment-list">
            {rows.map((item) => {
              const reviewComment = item.review?.comment?.trim() ?? ''
              const needsRevision = Boolean(item.review?.needsRevision)
              return (
                <div
                  key={`${item.submissionId}_${item.problemId}`}
                  className="admin-assignment-card"
                  style={{ borderLeft: '4px solid var(--danger, #e55)' }}
                >
                  <div className="admin-assignment-header">
                    <h3 style={{ margin: 0 }}>{item.assignmentTitle}</h3>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <StatusBadge status={item.reviewStatus} />
                      <span className="muted">제출: {formatDateTime(item.submittedAt)}</span>
                    </div>
                  </div>

                  <p style={{ margin: '10px 0 0' }}>{renderMathText(item.question)}</p>

                  <div className="admin-assignment-meta" style={{ marginTop: 8 }}>
                    <span className="muted">문항: {item.problemId} (#{item.problemIndex})</span>
                    <span className="muted">형태: {item.type === 'objective' ? '객관식' : '주관식'}</span>
                  </div>

                  {item.type === 'objective' ? (
                    <div style={{ marginTop: 8, display: 'grid', gap: 4 }}>
                      <div>
                        <span className="muted">학생 답:</span> {item.studentAnswer ?? <span className="muted">(없음)</span>}
                      </div>
                      <div>
                        <span className="muted">정답:</span> {item.correctAnswer ?? <span className="muted">(없음)</span>}
                      </div>
                    </div>
                  ) : null}

                  {(needsRevision || reviewComment) && (
                    <div style={{ marginTop: 8 }}>
                      {needsRevision && <span className="badge badge-error">반려/수정 필요</span>}
                      {reviewComment && <p className="muted" style={{ margin: '6px 0 0' }}>{reviewComment}</p>}
                    </div>
                  )}

                  <div className="admin-assignment-actions" style={{ marginTop: 10 }}>
                    <button
                      type="button"
                      className="button button-ghost button-small"
                      onClick={() => openSubmission(item.submissionId, { backMode: 'wrongProblems', showWrongOnly: true })}
                    >
                      제출물 오답 보기
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </>
    )
  }

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

    const hasUnsubmitted = assignmentDetail.students.some((student) => !student.submissionId)

    return (
      <>
        <button type="button" className="button button-ghost button-small" onClick={handleBackToList}>
          &larr; 목록으로
        </button>

        <div className="admin-assignment-summary">
          <h2>{assignmentDetail.title}</h2>
          {assignmentDetail.description && (
            <p className="muted">{renderMathText(assignmentDetail.description)}</p>
          )}
          <div className="admin-assignment-meta">
            {assignmentDetail.dueAt && (
              <span className="muted">
                마감: {formatDateTime(assignmentDetail.dueAt)}
                {hasUnsubmitted ? (
                  <button
                    type="button"
                    className="button button-ghost button-small"
                    onClick={handleExtendDueAtByWeek}
                    disabled={editSubmitting}
                    style={{ marginLeft: 8 }}
                  >
                    마감 1주일 연장
                  </button>
                ) : null}
              </span>
            )}
            {assignmentDetail.scheduledAt && (
              <span className="muted">예약: {formatDateTime(assignmentDetail.scheduledAt)}</span>
            )}
            <span className="muted">출제일: {formatDate(assignmentDetail.createdAt)}</span>
            <span className="muted">문제 수: {assignmentDetail.problems.length}개</span>
          </div>
        </div>

        <div className="admin-assignment-edit">
          <h3>숙제 정보 수정</h3>
          <div className="admin-assignment-edit-grid">
            <label className="form-field">
              숙제 이름
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                disabled={editSubmitting}
              />
            </label>
            <label className="form-field">
              마감일 (선택)
              <input
                type="datetime-local"
                value={editDueAt}
                onChange={(e) => setEditDueAt(e.target.value)}
                disabled={editSubmitting}
              />
              <span className="muted">비우면 마감 없음</span>
            </label>
          </div>
          {editMessage && (
            <p className={editMessage.type === 'success' ? 'success' : 'error'}>
              {editMessage.text}
            </p>
          )}
          <div className="admin-assignment-edit-actions">
            <button
              type="button"
              className="button button-primary button-small"
              onClick={handleAssignmentUpdate}
              disabled={editSubmitting}
            >
              저장
            </button>
            <button
              type="button"
              className="button button-ghost button-small"
              onClick={() => {
                setEditTitle(assignmentDetail.title ?? '')
                setEditDueAt(toDateTimeLocalValue(assignmentDetail.dueAt ?? null))
                setEditMessage(null)
              }}
              disabled={editSubmitting}
            >
              되돌리기
            </button>
            <button
              type="button"
              className="button button-ghost button-small"
              onClick={() => handleAssignmentDelete(assignmentDetail.id)}
              disabled={editSubmitting}
            >
              삭제
            </button>
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

    const visibleProblems = submissionShowWrongOnly
      ? submissionDetail.problems.filter((problem) => wrongProblemIds.has(problem.id))
      : submissionDetail.problems

    return (
      <>
        <button
          type="button"
          className="button button-ghost button-small"
          onClick={handleBackFromSubmission}
        >
          {submissionBackMode === 'students' ? '← 학생별 현황으로' : '← 학생 목록으로'}
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
          <div className="admin-assignment-actions" style={{ marginTop: 8 }}>
            <label className="admin-review-checkbox">
              <input
                type="checkbox"
                checked={submissionShowWrongOnly}
                onChange={(e) => setSubmissionShowWrongOnly(e.target.checked)}
                disabled={wrongProblemIds.size === 0}
              />
              오답만 보기 ({wrongProblemIds.size}개)
            </label>
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
          {visibleProblems.map((problem, index) => {
            const answer = submissionDetail.answers[problem.id] || ''
            const review = reviewState[problem.id] ?? { needsRevision: false, comment: '' }
            const isWrong = wrongProblemIds.has(problem.id)

            return (
              <div key={problem.id} className={`admin-problem-card ${isWrong ? 'is-wrong' : ''}`}>
                <div className="admin-problem-header">
                  <span className="problem-number">문제 {index + 1}</span>
                  <span className="problem-type-badge">
                    {problem.type === 'objective' ? '객관식' : '주관식'}
                  </span>
                  {isWrong && <span className="badge badge-error">오답</span>}
                </div>
                <p className="problem-question">{renderMathText(problem.question)}</p>

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
                          <span className="option-text">{renderMathText(option)}</span>
                          {isSelected && <span className="selected-mark">학생 답안</span>}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="admin-problem-answer">
                    <strong>학생 답안:</strong>
                    <div className="answer-text">{renderMathText(answer || '(미응답)')}</div>
                  </div>
                )}

                {problem.answer && (
                  <div className="admin-problem-answer muted">
                    <strong>정답:</strong> {renderMathText(problem.answer)}
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

      <div className="admin-homework-toolbar" style={{ alignItems: 'center' }}>
        <label className="admin-review-checkbox">
          <input
            type="checkbox"
            checked={submissionAlarmEnabled}
            onChange={(e) => handleToggleSubmissionAlarm(e.target.checked)}
          />
          제출 알림
        </label>

        {typeof window !== 'undefined' && 'Notification' in window ? (
          <label className="admin-review-checkbox">
            <input
              type="checkbox"
              checked={browserNotificationEnabled}
              onChange={(e) => {
                void handleToggleBrowserNotification(e.target.checked)
              }}
              disabled={!submissionAlarmEnabled}
            />
            브라우저 알림
          </label>
        ) : (
          <span className="muted" style={{ fontSize: 12 }}>
            브라우저 알림 미지원
          </span>
        )}

        <span className="muted" style={{ fontSize: 12 }}>
          {submissionAlarmEnabled
            ? '30초마다 새 제출을 확인합니다.'
            : '페이지를 열어둔 상태에서만 동작합니다.'}
        </span>
      </div>

      <div className="admin-homework-content">
        {viewMode === 'list' && renderListView()}
        {viewMode === 'assignment' && renderAssignmentView()}
        {viewMode === 'submission' && renderSubmissionView()}
        {viewMode === 'wrongProblems' && renderWrongProblemsView()}
      </div>
    </section>
  )
}
