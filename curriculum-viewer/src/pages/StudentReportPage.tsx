import { useEffect, useMemo } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import type { DetailPanelContext } from '../components/AppLayout'
import { useAuth } from '../lib/auth/AuthProvider'
import { useCurriculum } from '../lib/curriculum/CurriculumProvider'
import { createBrowserSessionRepository } from '../lib/repository/sessionRepository'
import { loadLearningGraphV1 } from '../lib/studentLearning/graph'
import { computeNodeProgressV1 } from '../lib/studentLearning/progress'
import type { AttemptSessionStoreV1, LearningGraphV1 } from '../lib/studentLearning/types'
import { ROUTES } from '../routes'
import { useState } from 'react'

type WeakTag = {
  tag: string
  totalCount: number
  correctCount: number
  accuracy: number
}

type WeakNode = {
  nodeId: string
  title: string
  accuracy: number
  attempts: number
}

function computeWeakTags(store: AttemptSessionStoreV1): WeakTag[] {
  const tagStats = new Map<string, { total: number; correct: number }>()

  for (const session of Object.values(store.sessionsById)) {
    if (session.status !== 'SUBMITTED' || !session.grading?.perTag) continue

    for (const item of session.grading.perTag) {
      const existing = tagStats.get(item.tag) ?? { total: 0, correct: 0 }
      existing.total += item.totalCount
      existing.correct += item.correctCount
      tagStats.set(item.tag, existing)
    }
  }

  const result: WeakTag[] = []
  for (const [tag, stats] of tagStats.entries()) {
    if (stats.total > 0) {
      result.push({
        tag,
        totalCount: stats.total,
        correctCount: stats.correct,
        accuracy: stats.correct / stats.total
      })
    }
  }

  return result.sort((a, b) => a.accuracy - b.accuracy)
}

function computeWeakNodes(
  store: AttemptSessionStoreV1,
  getNodeTitle: (nodeId: string) => string
): WeakNode[] {
  const nodeStats = new Map<string, { bestAccuracy: number; attempts: number }>()

  for (const session of Object.values(store.sessionsById)) {
    if (session.status !== 'SUBMITTED' || !session.grading) continue

    const existing = nodeStats.get(session.nodeId)
    const accuracy = session.grading.accuracy

    if (!existing) {
      nodeStats.set(session.nodeId, { bestAccuracy: accuracy, attempts: 1 })
    } else {
      nodeStats.set(session.nodeId, {
        bestAccuracy: Math.max(existing.bestAccuracy, accuracy),
        attempts: existing.attempts + 1
      })
    }
  }

  const result: WeakNode[] = []
  for (const [nodeId, stats] of nodeStats.entries()) {
    if (stats.bestAccuracy < 0.8) {
      result.push({
        nodeId,
        title: getNodeTitle(nodeId),
        accuracy: stats.bestAccuracy,
        attempts: stats.attempts
      })
    }
  }

  return result.sort((a, b) => a.accuracy - b.accuracy)
}

function computeOverallStats(store: AttemptSessionStoreV1) {
  let totalProblems = 0
  let totalCorrect = 0
  let totalSessions = 0

  for (const session of Object.values(store.sessionsById)) {
    if (session.status !== 'SUBMITTED' || !session.grading) continue
    totalSessions += 1
    totalProblems += session.grading.totalCount
    totalCorrect += session.grading.correctCount
  }

  return {
    totalSessions,
    totalProblems,
    totalCorrect,
    overallAccuracy: totalProblems > 0 ? totalCorrect / totalProblems : 0
  }
}

export default function StudentReportPage() {
  const { setDetail } = useOutletContext<DetailPanelContext>()
  const { user } = useAuth()
  const { index } = useCurriculum()
  const userId = user?.id ?? null

  const [learningGraph, setLearningGraph] = useState<LearningGraphV1 | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    loadLearningGraphV1(controller.signal)
      .then((g) => setLearningGraph(g))
      .catch(() => {})
    return () => controller.abort()
  }, [])

  const store = useMemo(() => {
    if (!userId) return null
    const repo = createBrowserSessionRepository()
    return repo ? repo.readStore(userId) : null
  }, [userId])

  const progressByNodeId = useMemo(() => {
    if (!learningGraph || !store) return {}
    return computeNodeProgressV1({ graph: learningGraph, store })
  }, [learningGraph, store])

  const getNodeTitle = (nodeId: string): string => {
    return index?.nodeById.get(nodeId)?.title ?? nodeId
  }

  const overallStats = useMemo(() => {
    if (!store) return null
    return computeOverallStats(store)
  }, [store])

  const weakTags = useMemo(() => {
    if (!store) return []
    return computeWeakTags(store)
  }, [store])

  const weakNodes = useMemo(() => {
    if (!store) return []
    return computeWeakNodes(store, getNodeTitle)
  }, [store, index?.nodeById])

  const clearedCount = useMemo(() => {
    return Object.values(progressByNodeId).filter((p) => p.status === 'CLEARED').length
  }, [progressByNodeId])

  const totalNodes = learningGraph?.nodes.length ?? 0

  useEffect(() => {
    setDetail(
      <div>
        <h2>학습 리포트</h2>
        <p className="muted">나의 학습 현황과 약점을 분석합니다.</p>
        <div className="node-actions" style={{ marginTop: 16 }}>
          <Link to={ROUTES.dashboard} className="button button-ghost">
            대시보드
          </Link>
          <Link to={ROUTES.map} className="button button-ghost">
            지도
          </Link>
        </div>
      </div>
    )
  }, [setDetail])

  if (!store) {
    return (
      <section>
        <h1>학습 리포트</h1>
        <p className="muted">로그인 후 학습을 시작하면 리포트가 생성됩니다.</p>
      </section>
    )
  }

  return (
    <section>
      <h1>학습 리포트</h1>

      <div className="report-summary">
        <h2>전체 현황</h2>
        <div className="summary-cards">
          <div className="summary-card">
            <span className="summary-label">클리어 노드</span>
            <span className="summary-value">
              {clearedCount} / {totalNodes}
            </span>
          </div>
          <div className="summary-card">
            <span className="summary-label">총 제출</span>
            <span className="summary-value">{overallStats?.totalSessions ?? 0}회</span>
          </div>
          <div className="summary-card">
            <span className="summary-label">푼 문제</span>
            <span className="summary-value">{overallStats?.totalProblems ?? 0}개</span>
          </div>
          <div className="summary-card">
            <span className="summary-label">전체 정답률</span>
            <span className="summary-value">
              {overallStats ? Math.round(overallStats.overallAccuracy * 100) : 0}%
            </span>
          </div>
        </div>
      </div>

      {weakTags.length > 0 && (
        <div className="report-section">
          <h2>약점 태그 (정답률 낮은 순)</h2>
          <ul className="weak-list">
            {weakTags.slice(0, 5).map((item) => (
              <li key={item.tag} className="weak-item">
                <span className="weak-name">{item.tag}</span>
                <span className="weak-stats">
                  {item.correctCount}/{item.totalCount} ({Math.round(item.accuracy * 100)}%)
                </span>
                <div className="weak-bar">
                  <div
                    className="weak-bar-fill"
                    style={{ width: `${Math.round(item.accuracy * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {weakNodes.length > 0 && (
        <div className="report-section">
          <h2>미클리어 노드 (정답률 낮은 순)</h2>
          <ul className="weak-list">
            {weakNodes.slice(0, 5).map((item) => (
              <li key={item.nodeId} className="weak-item">
                <Link
                  to={`${ROUTES.learn}/${encodeURIComponent(item.nodeId)}`}
                  className="weak-name link-button"
                >
                  {item.title}
                </Link>
                <span className="weak-stats">
                  {Math.round(item.accuracy * 100)}% · {item.attempts}회 시도
                </span>
                <div className="weak-bar">
                  <div
                    className="weak-bar-fill weak-bar-warning"
                    style={{ width: `${Math.round(item.accuracy * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {weakTags.length === 0 && weakNodes.length === 0 && overallStats?.totalSessions === 0 && (
        <p className="muted" style={{ marginTop: 24 }}>
          아직 제출한 학습이 없습니다. 학습을 시작해보세요!
        </p>
      )}

      {weakTags.length === 0 &&
        weakNodes.length === 0 &&
        overallStats &&
        overallStats.totalSessions > 0 && (
          <p style={{ marginTop: 24, color: '#16a34a', fontWeight: 600 }}>
            모든 노드를 클리어했거나 약점이 없습니다. 잘하고 있어요!
          </p>
        )}
    </section>
  )
}
