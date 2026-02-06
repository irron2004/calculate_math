import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth/AuthProvider'
import { useCurriculum } from '../lib/curriculum/CurriculumProvider'
import { listAssignments, HomeworkApiError } from '../lib/homework/api'
import { getHomeworkStatus } from '../lib/homework/types'
import type { HomeworkAssignment } from '../lib/homework/types'
import { formatTagKo } from '../lib/diagnostic/tags'
import { getMyStudentProfile } from '../lib/studentProfile/api'
import type { StudentProfile } from '../lib/studentProfile/types'
import { loadLearningGraphV1 } from '../lib/studentLearning/graph'
import { computeNodeProgressV1, recommendNextNodeIds } from '../lib/studentLearning/progress'
import type { AttemptSessionStoreV1, LearningGraphV1, NodeProgressV1 } from '../lib/studentLearning/types'
import { createBrowserSessionRepository } from '../lib/repository/sessionRepository'
import { ROUTES } from '../routes'

type RecentActivity = {
  sessionId: string
  nodeId: string
  accuracy: number
  cleared: boolean
  updatedAt: string
}

function getRecentActivities(store: AttemptSessionStoreV1, maxCount: number): RecentActivity[] {
  const activities: RecentActivity[] = []

  for (const session of Object.values(store.sessionsById)) {
    if (session.status !== 'SUBMITTED') continue
    const accuracy = session.grading?.accuracy
    if (typeof accuracy !== 'number') continue

    activities.push({
      sessionId: session.sessionId,
      nodeId: session.nodeId,
      accuracy,
      cleared: Boolean(session.grading?.cleared),
      updatedAt: session.updatedAt
    })
  }

  activities.sort((a, b) => {
    if (a.updatedAt !== b.updatedAt) return a.updatedAt > b.updatedAt ? -1 : 1
    return a.sessionId.localeCompare(b.sessionId)
  })

  return activities.slice(0, maxCount)
}

function computeSummary(progressByNodeId: Record<string, NodeProgressV1>) {
  const entries = Object.values(progressByNodeId)
  const totalCount = entries.length
  const clearedCount = entries.filter((p) => p.status === 'CLEARED').length
  const inProgressCount = entries.filter((p) => p.status === 'IN_PROGRESS').length
  const availableCount = entries.filter((p) => p.status === 'AVAILABLE').length
  const lockedCount = entries.filter((p) => p.status === 'LOCKED').length

  const accuracies = entries.map((p) => p.bestAccuracy).filter((a): a is number => a !== null)
  const avgAccuracy = accuracies.length > 0 ? accuracies.reduce((sum, a) => sum + a, 0) / accuracies.length : null

  return { totalCount, clearedCount, inProgressCount, availableCount, lockedCount, avgAccuracy }
}

export default function DashboardPage() {
  const { user, isAdmin } = useAuth()
  const { index } = useCurriculum()
  const navigate = useNavigate()
  const userId = user?.username ?? null

  const [learningGraph, setLearningGraph] = useState<LearningGraphV1 | null>(null)
  const [graphError, setGraphError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [homeworkAssignments, setHomeworkAssignments] = useState<HomeworkAssignment[]>([])
  const [homeworkLoading, setHomeworkLoading] = useState(false)
  const [homeworkError, setHomeworkError] = useState<string | null>(null)

  const [profile, setProfile] = useState<StudentProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function run() {
      setGraphError(null)
      setLoading(true)
      try {
        const loaded = await loadLearningGraphV1(controller.signal)
        setLearningGraph({ nodes: loaded.nodes, edges: loaded.edges })
      } catch (err) {
        if (controller.signal.aborted) return
        setGraphError(err instanceof Error ? err.message : String(err))
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    run()
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!user || isAdmin) return
    const controller = new AbortController()

    async function run() {
      setProfileLoading(true)
      setProfileError(null)
      try {
        const data = await getMyStudentProfile(controller.signal)
        if (!controller.signal.aborted) setProfile(data)
      } catch (err) {
        if (controller.signal.aborted) return
        setProfileError(err instanceof Error ? err.message : '진단 정보를 불러올 수 없습니다.')
      } finally {
        if (!controller.signal.aborted) setProfileLoading(false)
      }
    }

    run()
    return () => controller.abort()
  }, [isAdmin, user])

  useEffect(() => {
    if (!user || isAdmin) return
    const controller = new AbortController()
    const studentId = user.username

    async function run() {
      setHomeworkLoading(true)
      setHomeworkError(null)
      try {
        const data = await listAssignments(studentId, controller.signal)
        if (!controller.signal.aborted) {
          setHomeworkAssignments(data)
        }
      } catch (err) {
        if (controller.signal.aborted) return
        if (err instanceof HomeworkApiError) {
          setHomeworkError(err.message)
        } else {
          setHomeworkError('숙제 목록을 불러오는 중 오류가 발생했습니다.')
        }
      } finally {
        if (!controller.signal.aborted) setHomeworkLoading(false)
      }
    }

    run()
    return () => controller.abort()
  }, [isAdmin, user])

  const store = useMemo(() => {
    if (!userId) return null
    const repo = createBrowserSessionRepository()
    return repo ? repo.readStore(userId) : null
  }, [userId])

  const progressByNodeId = useMemo(() => {
    if (!learningGraph || !store) return null
    return computeNodeProgressV1({ graph: learningGraph, store })
  }, [learningGraph, store])

  const summary = useMemo(() => {
    if (!progressByNodeId) return null
    return computeSummary(progressByNodeId)
  }, [progressByNodeId])

  const recommendedNodeIds = useMemo(() => {
    if (!learningGraph || !store) return []
    return recommendNextNodeIds({ graph: learningGraph, store, maxCount: 3 })
  }, [learningGraph, store])

  const recentActivities = useMemo(() => {
    if (!store) return []
    return getRecentActivities(store, 5)
  }, [store])

  const actionableHomework = useMemo(() => {
    return homeworkAssignments.filter((assignment) => {
      const status = getHomeworkStatus(assignment)
      return status === 'not_submitted' || status === 'returned'
    })
  }, [homeworkAssignments])

  const nextHomework = useMemo(() => {
    if (actionableHomework.length === 0) return null

    const toComparableTime = (isoString: string | null | undefined): number => {
      if (!isoString) return Number.POSITIVE_INFINITY
      const time = new Date(isoString).getTime()
      return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time
    }

    const sorted = [...actionableHomework].sort((a, b) => {
      const aDue = toComparableTime(a.dueAt)
      const bDue = toComparableTime(b.dueAt)
      if (aDue !== bDue) return aDue - bDue
      return a.createdAt > b.createdAt ? -1 : 1
    })

    return sorted[0]
  }, [actionableHomework])

  const getNodeLabel = (nodeId: string): string => {
    const node = index?.nodeById.get(nodeId)
    return node?.title ?? nodeId
  }

  const formatDue = (isoString: string): string => {
    const date = new Date(isoString)
    return date.toLocaleString('ko-KR', {
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <section className="dashboard">
        <h1>홈</h1>
        <p className="muted">로딩 중...</p>
      </section>
    )
  }

  if (graphError) {
    return (
      <section className="dashboard">
        <h1>홈</h1>
        <p className="error">그래프 로딩 실패: {graphError}</p>
      </section>
    )
  }

  return (
    <section className="dashboard">
      <div className="dashboard-welcome">
        <span className="welcome-emoji">👋</span>
        <h1>안녕, {user?.name ?? user?.username ?? '친구'}!</h1>
        <p>오늘도 함께 수학 모험을 떠나볼까요?</p>
      </div>

      {!isAdmin && (
        <>
          {!profileLoading && !profile && (
            <div className="dashboard-onboarding">
              <h2>🧭 4분 진단으로 시작점 잡기</h2>
              <p className="muted" style={{ marginTop: 6 }}>
                맞춤 숙제를 더 잘 받으려면, 1분 설문 + 3~5분 진단을 해보세요.
              </p>
              {profileError ? (
                <p className="error" style={{ marginTop: 8 }}>
                  {profileError}
                </p>
              ) : null}
              <div className="node-actions" style={{ marginTop: 12 }}>
                <Link to={ROUTES.onboarding} className="button button-primary">
                  진단 시작
                </Link>
                <Link to={ROUTES.mypage} className="button button-ghost">
                  일단 숙제하기
                </Link>
              </div>
            </div>
          )}

          {profile ? (
            <div className="dashboard-profile">
              <span className="badge badge-ok">레벨 {profile.estimatedLevel}</span>
              {profile.weakTagsTop3.length > 0 ? (
                <span className="muted">
                  약점: {profile.weakTagsTop3.map(formatTagKo).join(', ')}
                </span>
              ) : null}
            </div>
          ) : null}
        </>
      )}

      {!isAdmin && (
        <div className="dashboard-homework">
          <h2>🎯 오늘의 숙제</h2>
          {homeworkLoading && <p className="muted">숙제 목록을 불러오는 중...</p>}
          {homeworkError && <p className="error">{homeworkError}</p>}
          {!homeworkLoading && !homeworkError && (
            <>
              {nextHomework ? (
                <div className="dashboard-mission-card">
                  <div className="dashboard-mission-meta">
                    <div className="dashboard-mission-title">{nextHomework.title}</div>
                    {nextHomework.dueAt ? (
                      <div className="muted">마감: {formatDue(nextHomework.dueAt)}</div>
                    ) : (
                      <div className="muted">마감: 없음</div>
                    )}
                  </div>
                  <div className="dashboard-mission-actions">
                    <Link
                      to={`/mypage/homework/${nextHomework.id}`}
                      className="button button-primary"
                    >
                      지금 숙제 풀기
                    </Link>
                    <Link to={ROUTES.mypage} className="button button-ghost">
                      전체 숙제
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="dashboard-mission-card dashboard-mission-card--empty">
                  <p className="muted">지금 해야 할 숙제가 없어요.</p>
                  <div className="dashboard-mission-actions">
                    <Link to={ROUTES.mypage} className="button button-ghost">
                      숙제 확인하기
                    </Link>
                  </div>
                </div>
              )}

              {actionableHomework.length > 1 ? (
                <div className="homework-list">
                  {actionableHomework
                    .filter((assignment) => assignment.id !== nextHomework?.id)
                    .slice(0, 2)
                    .map((assignment) => {
                      const status = getHomeworkStatus(assignment)
                      const badgeClass =
                        status === 'returned' ? 'badge badge-error' : 'badge'
                      const badgeLabel = status === 'returned' ? '반려' : '미제출'
                      return (
                        <div key={assignment.id} className={`homework-card homework-card--${status}`}>
                          <div className="homework-card-header">
                            <h3 className="homework-card-title">{assignment.title}</h3>
                            <span className={badgeClass}>{badgeLabel}</span>
                          </div>
                          {assignment.dueAt && (
                            <div className="homework-card-meta">
                              <span className="muted">마감: {formatDue(assignment.dueAt)}</span>
                            </div>
                          )}
                          <div className="homework-card-actions">
                            <Link
                              to={`/mypage/homework/${assignment.id}`}
                              className="button button-primary button-small"
                            >
                              {status === 'returned' ? '재제출' : '제출하기'}
                            </Link>
                          </div>
                        </div>
                      )
                    })}
                </div>
              ) : null}
            </>
          )}
        </div>
      )}

      {/* 학습 현황 요약 */}
      {summary && (
        <div className="dashboard-summary">
          <h2>📊 학습 현황</h2>
          <div className="summary-cards">
            <div className="summary-card">
              <span className="summary-card-icon">⭐</span>
              <span className="summary-label">완료</span>
              <span className="summary-value">{summary.clearedCount} / {summary.totalCount}</span>
            </div>
            <div className="summary-card">
              <span className="summary-card-icon">📚</span>
              <span className="summary-label">진행 중</span>
              <span className="summary-value">{summary.inProgressCount}</span>
            </div>
            <div className="summary-card">
              <span className="summary-card-icon">🚀</span>
              <span className="summary-label">도전 가능</span>
              <span className="summary-value">{summary.availableCount}</span>
            </div>
            <div className="summary-card">
              <span className="summary-card-icon">🎯</span>
              <span className="summary-label">평균 정답률</span>
              <span className="summary-value">
                {summary.avgAccuracy !== null ? `${Math.round(summary.avgAccuracy * 100)}%` : '-'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 추천 노드 */}
      {recommendedNodeIds.length > 0 && (
        <div className="dashboard-recommend">
          <h2>✨ 오늘의 추천</h2>
          <ul className="recommend-list">
            {recommendedNodeIds.map((nodeId) => {
              const progress = progressByNodeId?.[nodeId]
              const statusLabel = progress?.status === 'IN_PROGRESS' ? '(진행 중)' : ''
              return (
                <li key={nodeId} className="recommend-item">
                  <span className="recommend-label">
                    {getNodeLabel(nodeId)} {statusLabel}
                  </span>
                  <button
                    type="button"
                    className="button button-primary button-small"
                    onClick={() => navigate(`${ROUTES.learn}/${encodeURIComponent(nodeId)}`)}
                  >
                    도전하기
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* 최근 학습 이력 */}
      {recentActivities.length > 0 && (
        <div className="dashboard-recent">
          <h2>📝 최근 학습</h2>
          <ul className="recent-list">
            {recentActivities.map((activity) => (
              <li key={activity.sessionId} className="recent-item">
                <span className="recent-label">{getNodeLabel(activity.nodeId)}</span>
                <span className={`recent-status ${activity.cleared ? 'cleared' : 'in-progress'}`}>
                  {activity.cleared ? 'CLEARED' : 'IN_PROGRESS'}
                </span>
                <span className="recent-accuracy">{Math.round(activity.accuracy * 100)}%</span>
                <Link
                  to={`${ROUTES.eval}/${encodeURIComponent(activity.sessionId)}`}
                  className="button button-ghost button-small"
                >
                  결과 보기
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 빠른 이동 */}
      <div className="dashboard-actions">
        <Link to={ROUTES.map} className="button button-ghost">
          지도 보기 (Beta)
        </Link>
      </div>
    </section>
  )
}
