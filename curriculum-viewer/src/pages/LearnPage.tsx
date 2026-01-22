import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import NodeDetail from '../components/NodeDetail'
import type { DetailPanelContext } from '../components/AppLayout'
import { useAuth } from '../lib/auth/AuthProvider'
import { useCurriculum } from '../lib/curriculum/CurriculumProvider'
import { normalizeNumericInput } from '../lib/learn/grading'
import type { Problem } from '../lib/learn/problems'
import { loadProblemBank } from '../lib/learn/problems'
import {
  createEmptyAttemptSessionStoreV1,
  submitAttemptSession,
  upsertDraftAttemptSession,
  updateDraftResponse
} from '../lib/studentLearning/attemptSession'
import type { AttemptSessionStoreV1 } from '../lib/studentLearning/types'
import { createBrowserSessionRepository } from '../lib/repository/sessionRepository'
import { ROUTES } from '../routes'

const AUTO_SAVE_MS = 500

function generateSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `s_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

export default function LearnPage() {
  const { setDetail } = useOutletContext<DetailPanelContext>()
  const navigate = useNavigate()
  const params = useParams()
  const nodeId = params.nodeId ? decodeURIComponent(params.nodeId) : null
  const { user } = useAuth()
  const userId = user?.id ?? null

  const { index, loading: curriculumLoading, error: curriculumError } = useCurriculum()

  const node = useMemo(() => {
    return nodeId && index ? index.nodeById.get(nodeId) ?? null : null
  }, [index, nodeId])

  const [problemBankLoading, setProblemBankLoading] = useState(false)
  const [problemBankError, setProblemBankError] = useState<string | null>(null)
  const [problemsByNodeId, setProblemsByNodeId] = useState<Record<string, Problem[]>>({})

  const [answerByProblemId, setAnswerByProblemId] = useState<Record<string, string>>({})

  const storeRef = useRef<AttemptSessionStoreV1>(createEmptyAttemptSessionStoreV1())
  const [sessionId, setSessionId] = useState<string | null>(null)

  const pendingByProblemIdRef = useRef<Record<string, string>>({})
  const autoSaveTimerRef = useRef<number | null>(null)

  const problems = useMemo(() => {
    if (!nodeId) return []
    return problemsByNodeId[nodeId] ?? []
  }, [nodeId, problemsByNodeId])

  useEffect(() => {
    const controller = new AbortController()

    async function run() {
      setProblemBankLoading(true)
      setProblemBankError(null)

      try {
        const bank = await loadProblemBank(controller.signal)
        setProblemsByNodeId(bank.problemsByNodeId)
      } catch (err) {
        if (controller.signal.aborted) return
        setProblemBankError(err instanceof Error ? err.message : String(err))
      } finally {
        if (!controller.signal.aborted) setProblemBankLoading(false)
      }
    }

    run()
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (nodeId) {
      setDetail(<NodeDetail nodeId={nodeId} />)
      return
    }

    setDetail(
      <div>
        <h2>상세</h2>
        <p>학습할 노드를 선택하세요.</p>
      </div>
    )
  }, [nodeId, setDetail])

  useEffect(() => {
    if (!nodeId || !userId) {
      setAnswerByProblemId({})
      setSessionId(null)
      storeRef.current = createEmptyAttemptSessionStoreV1()
      return
    }

    const repo = createBrowserSessionRepository()
    const store = repo ? repo.readStore(userId) : createEmptyAttemptSessionStoreV1()
    const { store: nextStore, session } = upsertDraftAttemptSession({
      store,
      nodeId,
      sessionId: generateSessionId(),
      now: new Date().toISOString()
    })

    if (nextStore !== store) {
      repo?.writeStore(userId, nextStore)
    }

    storeRef.current = nextStore
    setSessionId(session.sessionId)

    const nextAnswers: Record<string, string> = {}
    for (const [problemId, response] of Object.entries(session.responses)) {
      nextAnswers[problemId] = response.inputRaw
    }

    setAnswerByProblemId(nextAnswers)
  }, [nodeId, userId])

  const [showConfirmModal, setShowConfirmModal] = useState(false)

  const unansweredIndices = useMemo(() => {
    const indices: number[] = []
    problems.forEach((problem, idx) => {
      const raw = answerByProblemId[problem.id] ?? ''
      if (normalizeNumericInput(raw).length === 0) {
        indices.push(idx + 1) // 1-based index
      }
    })
    return indices
  }, [answerByProblemId, problems])

  const allAnswered = useMemo(() => {
    if (problems.length === 0) return false
    return unansweredIndices.length === 0
  }, [problems.length, unansweredIndices])

  const ensureDraftSession = useCallback((desiredNodeId: string): { store: AttemptSessionStoreV1; sessionId: string } | null => {
    if (!userId) return null

    const store = storeRef.current
    const existingId = sessionId
    const existing = existingId ? store.sessionsById[existingId] : null

    if (existingId && existing && existing.status === 'DRAFT' && existing.nodeId === desiredNodeId) {
      return { store, sessionId: existingId }
    }

    const created = upsertDraftAttemptSession({
      store,
      nodeId: desiredNodeId,
      sessionId: generateSessionId(),
      now: new Date().toISOString()
    })

    storeRef.current = created.store
    setSessionId(created.session.sessionId)
    createBrowserSessionRepository()?.writeStore(userId, created.store)

    return { store: created.store, sessionId: created.session.sessionId }
  }, [sessionId, userId])

  const flushPendingAutoSave = useCallback(() => {
    if (!nodeId || !userId) return
    const pending = pendingByProblemIdRef.current
    const keys = Object.keys(pending)
    if (keys.length === 0) return

    const draft = ensureDraftSession(nodeId)
    if (!draft) return

    let nextStore = draft.store
    const now = new Date().toISOString()
    for (const problemId of keys) {
      nextStore = updateDraftResponse({
        store: nextStore,
        sessionId: draft.sessionId,
        problemId,
        inputRaw: pending[problemId] ?? '',
        now
      })
    }

    pendingByProblemIdRef.current = {}
    storeRef.current = nextStore
    createBrowserSessionRepository()?.writeStore(userId, nextStore)
  }, [ensureDraftSession, nodeId, userId])

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current !== null) {
        window.clearTimeout(autoSaveTimerRef.current)
        autoSaveTimerRef.current = null
      }
      flushPendingAutoSave()
    }
  }, [flushPendingAutoSave])

  const scheduleAutoSave = useCallback(() => {
    if (autoSaveTimerRef.current !== null) {
      window.clearTimeout(autoSaveTimerRef.current)
    }

    autoSaveTimerRef.current = window.setTimeout(() => {
      autoSaveTimerRef.current = null
      flushPendingAutoSave()
    }, AUTO_SAVE_MS)
  }, [flushPendingAutoSave])

  const handleSubmitClick = () => {
    if (!nodeId || !userId || problems.length === 0) return
    if (!allAnswered) return
    setShowConfirmModal(true)
  }

  const confirmSubmit = () => {
    setShowConfirmModal(false)

    if (!nodeId || !userId || problems.length === 0) return
    if (!allAnswered) return

    if (autoSaveTimerRef.current !== null) {
      window.clearTimeout(autoSaveTimerRef.current)
      autoSaveTimerRef.current = null
    }
    pendingByProblemIdRef.current = {}

    const draft = ensureDraftSession(nodeId)
    if (!draft) return

    let nextStore = draft.store
    const now = new Date().toISOString()

    for (const problem of problems) {
      nextStore = updateDraftResponse({
        store: nextStore,
        sessionId: draft.sessionId,
        problemId: problem.id,
        inputRaw: answerByProblemId[problem.id] ?? '',
        now
      })
    }

    nextStore = submitAttemptSession({
      store: nextStore,
      sessionId: draft.sessionId,
      problems,
      now
    })

    storeRef.current = nextStore
    createBrowserSessionRepository()?.writeStore(userId, nextStore)
    navigate(`${ROUTES.eval}/${encodeURIComponent(draft.sessionId)}`)
  }

  const cancelSubmit = () => {
    setShowConfirmModal(false)
  }

  const resetAttempt = () => {
    setAnswerByProblemId({})

    if (!nodeId || !userId) return
    pendingByProblemIdRef.current = {}
    if (autoSaveTimerRef.current !== null) {
      window.clearTimeout(autoSaveTimerRef.current)
      autoSaveTimerRef.current = null
    }

    const repo = createBrowserSessionRepository()
    const store = repo ? repo.readStore(userId) : createEmptyAttemptSessionStoreV1()
    const created = upsertDraftAttemptSession({
      store,
      nodeId,
      sessionId: generateSessionId(),
      now: new Date().toISOString()
    })

    storeRef.current = created.store
    setSessionId(created.session.sessionId)
    repo?.writeStore(userId, created.store)
  }

  const handleAnswerChange = (problemId: string, value: string) => {
    setAnswerByProblemId((prev) => ({ ...prev, [problemId]: value }))

    if (!nodeId || !userId) return
    pendingByProblemIdRef.current = { ...pendingByProblemIdRef.current, [problemId]: value }
    scheduleAutoSave()
  }

  return (
    <section>
      <h1>학습</h1>

      {nodeId ? (
        <p className="muted">
          Node: {nodeId} {node?.title ? `· ${node.title}` : null}
        </p>
      ) : null}

      {curriculumLoading ? <p>Loading…</p> : null}
      {curriculumError ? <p className="error">{curriculumError}</p> : null}

      {node && node.type !== 'standard' ? (
        <p className="error">학습은 성취기준(standard) 노드에서만 지원합니다.</p>
      ) : null}

      {node?.text ? (
        <div className="learn-description">
          <h2>설명</h2>
          <p className="detail-text">{node.text}</p>
        </div>
      ) : null}

      {problemBankLoading ? <p>문제 로딩중…</p> : null}
      {problemBankError ? <p className="error">{problemBankError}</p> : null}

      {!problemBankLoading && !problemBankError && problems.length === 0 ? (
        <p className="muted">문제 준비중</p>
      ) : null}

      {problems.length > 0 ? (
        <>
          <div className="learn-progress">
            <span className="learn-progress-count">
              입력 완료: {problems.length - unansweredIndices.length} / {problems.length}
            </span>
            {unansweredIndices.length > 0 && unansweredIndices.length <= 5 ? (
              <span className="learn-progress-missing">
                ({unansweredIndices.join(', ')}번 미입력)
              </span>
            ) : null}
          </div>

          <div className="health-toolbar">
            <button type="button" className="button button-primary" onClick={handleSubmitClick} disabled={!allAnswered}>
              제출
            </button>
            <button type="button" className="button button-ghost" onClick={resetAttempt}>
              다시 풀기
            </button>
            {!allAnswered ? <span className="muted">모든 문제에 답을 입력하면 제출할 수 있어요.</span> : null}
          </div>

          <ol className="problem-list">
            {problems.map((problem, idx) => {
              const isUnanswered = unansweredIndices.includes(idx + 1)
              return (
                <li key={problem.id} className={`problem-card ${isUnanswered ? 'problem-unanswered' : ''}`}>
                  <h3 className="problem-title">
                    <span className="problem-number">{idx + 1}.</span> {problem.prompt}
                  </h3>
                  <div className="problem-answer">
                    <input
                      value={answerByProblemId[problem.id] ?? ''}
                      onChange={(event) => handleAnswerChange(problem.id, event.target.value)}
                      placeholder="정답 입력"
                    />
                  </div>
                </li>
              )
            })}
          </ol>

          {showConfirmModal ? (
            <div className="modal-overlay" onClick={cancelSubmit}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h2>제출 확인</h2>
                <p>정말 제출하시겠습니까?</p>
                <p className="muted">제출 후에는 답안을 수정할 수 없습니다.</p>
                <div className="modal-actions">
                  <button type="button" className="button button-primary" onClick={confirmSubmit}>
                    제출하기
                  </button>
                  <button type="button" className="button button-ghost" onClick={cancelSubmit}>
                    취소
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  )
}
