import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth/AuthProvider'
import { changePassword } from '../lib/auth/api'
import { listAssignments, HomeworkApiError } from '../lib/homework/api'
import type { HomeworkAssignment } from '../lib/homework/types'
import { getHomeworkStatus, isOverdueSoon } from '../lib/homework/types'
import { ROUTES } from '../routes'

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

  if (status === 'approved') {
    return <span className="badge badge-ok">완료</span>
  }

  if (status === 'pending') {
    return <span className="badge badge-warn">검토 중</span>
  }

  if (status === 'returned') {
    return <span className="badge badge-error">반려</span>
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
      {(status === 'not_submitted' || status === 'returned') && (
        <div className="homework-card-actions">
          <Link
            to={`/mypage/homework/${assignment.id}`}
            className="button button-primary"
          >
            {status === 'returned' ? '재제출' : '제출하기'}
          </Link>
        </div>
      )}
      {(status === 'pending' || status === 'approved') && (
        <div className="homework-card-actions">
          <Link
            to={`/mypage/homework/${assignment.id}`}
            className="button button-ghost"
          >
            {status === 'pending' ? '검토 중 보기' : '제출 내용 보기'}
          </Link>
        </div>
      )}
    </div>
  )
}

export default function MyPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [assignments, setAssignments] = useState<HomeworkAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null)
  const [passwordSubmitting, setPasswordSubmitting] = useState(false)

  const loadAssignments = useCallback(async (signal: AbortSignal) => {
    if (!user) return

    setLoading(true)
    setError(null)

    try {
      const data = await listAssignments(user.username, signal)
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

  const pendingAssignments = assignments.filter((a) => {
    const status = getHomeworkStatus(a)
    return status === 'not_submitted' || status === 'returned'
  })
  const overdueAssignments = assignments.filter(
    (a) => getHomeworkStatus(a) === 'overdue'
  )
  const reviewAssignments = assignments.filter(
    (a) => getHomeworkStatus(a) === 'pending'
  )
  const completedAssignments = assignments.filter(
    (a) => getHomeworkStatus(a) === 'approved'
  )

  return (
    <section>
      <h1>마이 페이지</h1>
      <p className="muted">{user.name}님, 환영합니다.</p>

      <section className="homework-section">
        <h2>비밀번호 변경</h2>
        <form
          className="form"
          onSubmit={async (event) => {
            event.preventDefault()
            setPasswordError(null)
            setPasswordSuccess(null)

            if (!currentPassword || !newPassword || !confirmPassword) {
              setPasswordError('모든 비밀번호 항목을 입력하세요.')
              return
            }
            if (newPassword.length < 8) {
              setPasswordError('새 비밀번호는 8자 이상이어야 합니다.')
              return
            }
            if (newPassword !== confirmPassword) {
              setPasswordError('새 비밀번호가 일치하지 않습니다.')
              return
            }
            if (currentPassword === newPassword) {
              setPasswordError('현재 비밀번호와 다른 비밀번호를 입력하세요.')
              return
            }

            try {
              setPasswordSubmitting(true)
              await changePassword(currentPassword, newPassword)
              setPasswordSuccess('비밀번호가 변경되었습니다. 다시 로그인해 주세요.')
              setCurrentPassword('')
              setNewPassword('')
              setConfirmPassword('')
              await logout()
              navigate(ROUTES.login, {
                replace: true,
                state: { notice: '비밀번호가 변경되었습니다. 다시 로그인해 주세요.' }
              })
            } catch (err) {
              setPasswordError(err instanceof Error ? err.message : '비밀번호 변경에 실패했습니다.')
            } finally {
              setPasswordSubmitting(false)
            }
          }}
        >
          <label className="form-field">
            현재 비밀번호
            <input
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          </label>
          <label className="form-field">
            새 비밀번호
            <input
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </label>
          <label className="form-field">
            새 비밀번호 확인
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </label>
          {passwordError ? <p className="error">{passwordError}</p> : null}
          {passwordSuccess ? <p className="muted">{passwordSuccess}</p> : null}
          <button
            type="submit"
            className="button button-primary"
            disabled={passwordSubmitting}
          >
            {passwordSubmitting ? '변경 중...' : '비밀번호 변경'}
          </button>
        </form>
      </section>

      {loading && <p className="muted">숙제 목록을 불러오는 중...</p>}
      {error && (
        <div className="homework-error-notice">
          <p className="muted">숙제 목록을 불러올 수 없습니다.</p>
          <p className="muted">할당된 숙제가 없거나 서버 연결에 문제가 있습니다.</p>
        </div>
      )}

      {!loading && !error && assignments.length === 0 && (
        <p className="muted">할당된 숙제가 없습니다.</p>
      )}

      {pendingAssignments.length > 0 && (
        <>
          <h2>제출 필요 ({pendingAssignments.length})</h2>
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

      {reviewAssignments.length > 0 && (
        <>
          <h2>검토 중 ({reviewAssignments.length})</h2>
          <div className="homework-list">
            {reviewAssignments.map((assignment) => (
              <AssignmentCard key={assignment.id} assignment={assignment} />
            ))}
          </div>
        </>
      )}

      {completedAssignments.length > 0 && (
        <>
          <h2>완료 ({completedAssignments.length})</h2>
          <div className="homework-list">
            {completedAssignments.map((assignment) => (
              <AssignmentCard key={assignment.id} assignment={assignment} />
            ))}
          </div>
        </>
      )}
    </section>
  )
}
