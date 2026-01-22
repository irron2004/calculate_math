import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth/AuthProvider'
import { useCurriculum } from '../lib/curriculum/CurriculumProvider'
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
  const { user } = useAuth()
  const { index } = useCurriculum()
  const navigate = useNavigate()
  const userId = user?.id ?? null

  const [learningGraph, setLearningGraph] = useState<LearningGraphV1 | null>(null)
  const [graphError, setGraphError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

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

  const getNodeLabel = (nodeId: string): string => {
    const node = index?.nodeById.get(nodeId)
    return node?.title ?? nodeId
  }

  if (loading) {
    return (
      <section className="dashboard">
        <h1>대시보드</h1>
        <p className="muted">로딩 중...</p>
      </section>
    )
  }

  if (graphError) {
    return (
      <section className="dashboard">
        <h1>대시보드</h1>
        <p className="error">그래프 로딩 실패: {graphError}</p>
      </section>
    )
  }

  return (
    <section className="dashboard">
      <h1>대시보드</h1>
      <p className="muted">안녕하세요, {user?.name ?? user?.id ?? '학생'}님!</p>

      {/* 학습 현황 요약 */}
      {summary && (
        <div className="dashboard-summary">
          <h2>학습 현황</h2>
          <div className="summary-cards">
            <div className="summary-card">
              <span className="summary-label">완료</span>
              <span className="summary-value">{summary.clearedCount} / {summary.totalCount}</span>
            </div>
            <div className="summary-card">
              <span className="summary-label">진행 중</span>
              <span className="summary-value">{summary.inProgressCount}</span>
            </div>
            <div className="summary-card">
              <span className="summary-label">도전 가능</span>
              <span className="summary-value">{summary.availableCount}</span>
            </div>
            <div className="summary-card">
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
          <h2>오늘의 추천</h2>
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
          <h2>최근 학습</h2>
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
        <Link to={ROUTES.map} className="button button-primary">
          지도 보기
        </Link>
      </div>
    </section>
  )
}
