import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import EvalResultList from '../components/EvalResultList'
import { useAuth } from '../lib/auth/AuthProvider'
import { loadLearningGraphV1 } from '../lib/studentLearning/graph'
import { recommendNextNodeIds } from '../lib/studentLearning/progress'
import type { LearningGraphV1 } from '../lib/studentLearning/types'
import { createBrowserSessionRepository } from '../lib/repository/sessionRepository'
import { ROUTES } from '../routes'

export default function EvalPage() {
  const params = useParams()
  const sessionId = params.sessionId ? decodeURIComponent(params.sessionId) : null
  const { user } = useAuth()
  const navigate = useNavigate()
  const userId = user?.id ?? null

  const label = useMemo(() => {
    if (!sessionId) return null
    return sessionId.length > 60 ? `${sessionId.slice(0, 60)}…` : sessionId
  }, [sessionId])

  const [learningGraph, setLearningGraph] = useState<LearningGraphV1 | null>(null)
  const [graphError, setGraphError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function run() {
      setGraphError(null)
      try {
        const loaded = await loadLearningGraphV1(controller.signal)
        setLearningGraph({ nodes: loaded.nodes, edges: loaded.edges })
      } catch (err) {
        if (controller.signal.aborted) return
        setGraphError(err instanceof Error ? err.message : String(err))
      }
    }

    run()
    return () => controller.abort()
  }, [])

  const storeAndSession = useMemo(() => {
    if (!sessionId || !userId) return { store: null, session: null }
    const repo = createBrowserSessionRepository()
    const store = repo ? repo.readStore(userId) : null
    if (!store) return { store: null, session: null }
    return { store, session: store.sessionsById[sessionId] ?? null }
  }, [sessionId, userId])

  const session = storeAndSession.session
  const store = storeAndSession.store

  const grading = session?.status === 'SUBMITTED' ? session.grading ?? null : null

  const nextNodeId = useMemo(() => {
    if (!grading?.cleared) return null
    if (!learningGraph || !store) return null
    const candidates = recommendNextNodeIds({ graph: learningGraph, store, maxCount: 1 })
    return candidates[0] ?? null
  }, [grading?.cleared, learningGraph, store])

  return (
    <section>
      <h1>평가</h1>
      {label ? <p className="muted">Session: {label}</p> : null}

      {!session ? <p className="error">세션을 찾을 수 없습니다.</p> : null}
      {graphError ? <p className="muted">그래프 로딩 실패: {graphError}</p> : null}

      {grading ? (
        <>
          <div className={`eval-result-banner ${grading.cleared ? 'eval-result-cleared' : 'eval-result-progress'}`}>
            <span className="eval-result-emoji">{grading.cleared ? '🎉' : '💪'}</span>
            <div className="eval-result-text">
              <p className="eval-result-main">
                {grading.cleared ? '축하해요! 완료했어요!' : '조금만 더 힘내요!'}
              </p>
              <p className="eval-result-detail">
                정답: {grading.correctCount} / {grading.totalCount} · 정답률: {Math.round(grading.accuracy * 100)}%
              </p>
            </div>
          </div>

          {grading.perTag && grading.perTag.length > 0 && (
            <div className="tag-accuracy-section">
              <h2>태그별 정답률</h2>
              <ul className="tag-accuracy-list">
                {grading.perTag.map((item) => (
                  <li key={item.tag} className="tag-accuracy-item">
                    <span className="tag-name">{item.tag}</span>
                    <span className="tag-stats">
                      {item.correctCount}/{item.totalCount} ({Math.round(item.accuracy * 100)}%)
                    </span>
                    <div className="tag-bar">
                      <div
                        className="tag-bar-fill"
                        style={{ width: `${Math.round(item.accuracy * 100)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <EvalResultList perProblem={grading.perProblem} responses={session?.responses ?? {}} />
        </>
      ) : session ? (
        <p className="muted">제출 전(DRAFT) 세션입니다.</p>
      ) : null}

      <div className="node-actions">
        {grading?.cleared ? (
          nextNodeId ? (
            <button
              type="button"
              className="button button-primary"
              onClick={() => navigate(`${ROUTES.learn}/${encodeURIComponent(nextNodeId)}`)}
            >
              다음 노드
            </button>
          ) : (
            <Link to={ROUTES.map} className="button button-primary">
              지도
            </Link>
          )
        ) : session?.nodeId ? (
          <button
            type="button"
            className="button button-primary"
            onClick={() => navigate(`${ROUTES.learn}/${encodeURIComponent(session.nodeId)}`)}
          >
            재도전
          </button>
        ) : null}

        <Link to={ROUTES.map} className="button button-ghost">
          지도로 돌아가기
        </Link>
        <Link to={ROUTES.dashboard} className="button button-ghost">
          대시보드
        </Link>
      </div>
    </section>
  )
}
