import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth/AuthProvider'
import { listAssignments, HomeworkApiError } from '../lib/homework/api'
import type { HomeworkAssignment } from '../lib/homework/types'
import { getHomeworkStatus, isOverdueSoon } from '../lib/homework/types'

function formatDate(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

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

type StatusBadgeProps = {
  assignment: HomeworkAssignment
}

function StatusBadge({ assignment }: StatusBadgeProps) {
  const status = getHomeworkStatus(assignment)
  const overdueSoon = isOverdueSoon(assignment)

  if (status === 'submitted') {
    return <span className="badge badge-ok">제출 완료</span>
  }

  if (status === 'overdue') {
    return <span className="badge badge-error">마감됨</span>
  }

  if (overdueSoon) {
    return <span className="badge badge-warn">마감 임박</span>
  }

  return <span className="badge">미제출</span>
}

type AssignmentCardProps = {
  assignment: HomeworkAssignment
}

function AssignmentCard({ assignment }: AssignmentCardProps) {
  const status = getHomeworkStatus(assignment)

  const problemCounts = {
    total: assignment.problems.length,
    objective: assignment.problems.filter((p) => p.type === 'objective').length,
    subjective: assignment.problems.filter((p) => p.type === 'subjective').length
  }

  return (
    <div className={`homework-card homework-card--${status}`}>
      <div className="homework-card-header">
        <h3 className="homework-card-title">{assignment.title}</h3>
        <StatusBadge assignment={assignment} />
      </div>
      {assignment.description && (
        <p className="homework-card-description">{assignment.description}</p>
      )}
      <p className="homework-card-problems">
        총 {problemCounts.total}문제
        {problemCounts.objective > 0 && ` (객관식 ${problemCounts.objective})`}
        {problemCounts.subjective > 0 && ` (주관식 ${problemCounts.subjective})`}
      </p>
      <div className="homework-card-meta">
        <span className="muted">출제일: {formatDate(assignment.createdAt)}</span>
        {assignment.dueAt && (
          <span className="muted">마감: {formatDateTime(assignment.dueAt)}</span>
        )}
      </div>
      {status !== 'submitted' && status !== 'overdue' && (
        <div className="homework-card-actions">
          <Link
            to={`/mypage/homework/${assignment.id}`}
            className="button button-primary"
          >
            제출하기
          </Link>
        </div>
      )}
      {status === 'submitted' && (
        <div className="homework-card-actions">
          <Link
            to={`/mypage/homework/${assignment.id}`}
            className="button button-ghost"
          >
            제출 내용 보기
          </Link>
        </div>
      )}
    </div>
  )
}

export default function MyPage() {
  const { user } = useAuth()

  const [assignments, setAssignments] = useState<HomeworkAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadAssignments = useCallback(async (signal: AbortSignal) => {
    if (!user) return

    setLoading(true)
    setError(null)

    try {
      const data = await listAssignments(user.id, signal)
      if (!signal.aborted) {
        setAssignments(data)
      }
    } catch (err) {
      if (signal.aborted) return
      if (err instanceof HomeworkApiError) {
        setError(err.message)
      } else {
        setError('숙제 목록을 불러오는 중 오류가 발생했습니다.')
      }
    } finally {
      if (!signal.aborted) {
        setLoading(false)
      }
    }
  }, [user])

  useEffect(() => {
    const controller = new AbortController()
    loadAssignments(controller.signal)
    return () => controller.abort()
  }, [loadAssignments])

  if (!user) {
    return (
      <section>
        <h1>마이 페이지</h1>
        <p className="error">로그인이 필요합니다.</p>
      </section>
    )
  }

  const pendingAssignments = assignments.filter(
    (a) => getHomeworkStatus(a) === 'not_submitted'
  )
  const overdueAssignments = assignments.filter(
    (a) => getHomeworkStatus(a) === 'overdue'
  )
  const submittedAssignments = assignments.filter(
    (a) => getHomeworkStatus(a) === 'submitted'
  )

  return (
    <section>
      <h1>마이 페이지</h1>
      <p className="muted">{user.name}님, 환영합니다.</p>

      {loading && <p className="muted">숙제 목록을 불러오는 중...</p>}
      {error && <p className="error">{error}</p>}

      {!loading && !error && assignments.length === 0 && (
        <p className="muted">할당된 숙제가 없습니다.</p>
      )}

      {pendingAssignments.length > 0 && (
        <>
          <h2>미제출 숙제 ({pendingAssignments.length})</h2>
          <div className="homework-list">
            {pendingAssignments.map((assignment) => (
              <AssignmentCard key={assignment.id} assignment={assignment} />
            ))}
          </div>
        </>
      )}

      {overdueAssignments.length > 0 && (
        <>
          <h2>마감된 숙제 ({overdueAssignments.length})</h2>
          <div className="homework-list">
            {overdueAssignments.map((assignment) => (
              <AssignmentCard key={assignment.id} assignment={assignment} />
            ))}
          </div>
        </>
      )}

      {submittedAssignments.length > 0 && (
        <>
          <h2>제출 완료 ({submittedAssignments.length})</h2>
          <div className="homework-list">
            {submittedAssignments.map((assignment) => (
              <AssignmentCard key={assignment.id} assignment={assignment} />
            ))}
          </div>
        </>
      )}
    </section>
  )
}
