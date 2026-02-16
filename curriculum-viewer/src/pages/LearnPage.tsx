import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import NodeDetail from '../components/NodeDetail'
import Scratchpad, { type ScratchpadHandle } from '../components/Scratchpad'
import type { DetailPanelContext } from '../components/AppLayout'
import { useAuth } from '../lib/auth/AuthProvider'
import { useCurriculum } from '../lib/curriculum/CurriculumProvider'
import { normalizeNumericInput } from '../lib/learn/grading'
import type { Problem } from '../lib/learn/problems'
import { loadProblemBank } from '../lib/learn/problems'
import {
  createEmptyAttemptSessionStoreV1,
  getDraftAttemptSession,
  submitAttemptSession,
  upsertDraftAttemptSession,
  updateDraftResponse
} from '../lib/studentLearning/attemptSession'
import type { AttemptSessionStoreV1 } from '../lib/studentLearning/types'
import { createBrowserSessionRepository } from '../lib/repository/sessionRepository'
import { ROUTES } from '../routes'
import './LearnPage.css'

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

  const [showResumeModal, setShowResumeModal] = useState(false)
  const [resumeAnsweredCount, setResumeAnsweredCount] = useState(0)

  const pendingByProblemIdRef = useRef<Record<string, string>>({})
  const autoSaveTimerRef = useRef<number | null>(null)

  // 레벨 2: 풀이 과정 기록
  const [activeProblemId, setActiveProblemId] = useState<string | null>(null)
  const activeProblemIdRef = useRef<string | null>(null)
  const activeStartedAtRef = useRef<number>(Date.now())
  const isTimingPausedRef = useRef(false)
  const timeSpentByProblemIdRef = useRef<Record<string, number>>({})
  const editCountByProblemIdRef = useRef<Record<string, number>>({})
  const valueAtFocusRef = useRef<Record<string, string>>({})
  const scratchpadByProblemIdRef = useRef<Record<string, string | null>>({})
  const pendingProcessProblemIdsRef = useRef<Set<string>>(new Set())
  const isLoadingScratchpadRef = useRef(false)
  const scratchpadRef = useRef<ScratchpadHandle>(null)

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
    // node/user 변경 시 레벨2 상태 초기화 (mixing 방지)
    setActiveProblemId(null)
    activeProblemIdRef.current = null
    activeStartedAtRef.current = Date.now()
    isTimingPausedRef.current = false
    timeSpentByProblemIdRef.current = {}
    editCountByProblemIdRef.current = {}
    valueAtFocusRef.current = {}
    scratchpadByProblemIdRef.current = {}
    pendingProcessProblemIdsRef.current.clear()
    isLoadingScratchpadRef.current = false
    scratchpadRef.current?.clear()

    setShowResumeModal(false)
    setResumeAnsweredCount(0)

    if (!nodeId || !userId) {
      setAnswerByProblemId({})
      setSessionId(null)
      storeRef.current = createEmptyAttemptSessionStoreV1()
      return
    }

    const repo = createBrowserSessionRepository()
    const store = repo ? repo.readStore(userId) : createEmptyAttemptSessionStoreV1()
    const existingDraft = getDraftAttemptSession(store, nodeId)
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
    const nextTimeSpent: Record<string, number> = {}
    const nextEditCounts: Record<string, number> = {}
    const nextScratchpads: Record<string, string | null> = {}
    for (const [problemId, response] of Object.entries(session.responses)) {
      nextAnswers[problemId] = response.inputRaw
      nextTimeSpent[problemId] = response.timeSpentMs ?? 0
      nextEditCounts[problemId] = response.answerEditCount ?? 0
      nextScratchpads[problemId] = response.scratchpadStrokesJson ?? null
    }

    setAnswerByProblemId(nextAnswers)
    timeSpentByProblemIdRef.current = nextTimeSpent
    editCountByProblemIdRef.current = nextEditCounts
    scratchpadByProblemIdRef.current = nextScratchpads

    if (existingDraft && Object.keys(existingDraft.responses).length > 0) {
      const answeredCount = Object.values(existingDraft.responses).reduce((acc, response) => {
        return normalizeNumericInput(response.inputRaw).length > 0 ? acc + 1 : acc
      }, 0)
      if (answeredCount > 0) {
        setResumeAnsweredCount(answeredCount)
        setShowResumeModal(true)
      }
    }
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
    const pendingAnswers = pendingByProblemIdRef.current
    const pendingProcess = pendingProcessProblemIdsRef.current
    const keys = new Set<string>([
      ...Object.keys(pendingAnswers),
      ...Array.from(pendingProcess)
    ])
    if (keys.size === 0) return

    const draft = ensureDraftSession(nodeId)
    if (!draft) return

    let nextStore = draft.store
    const nowMs = Date.now()
    const now = new Date(nowMs).toISOString()
    for (const problemId of keys) {
      const existingInputRaw =
        nextStore.sessionsById[draft.sessionId]?.responses[problemId]?.inputRaw ?? ''
      const inputRaw = pendingAnswers[problemId] ?? existingInputRaw

      const baseTimeSpentMs = timeSpentByProblemIdRef.current[problemId] ?? 0
      const isActive = activeProblemIdRef.current === problemId
      const timeSpentMs = isActive && !document.hidden && !isTimingPausedRef.current
        ? baseTimeSpentMs + Math.max(0, nowMs - activeStartedAtRef.current)
        : baseTimeSpentMs

      nextStore = updateDraftResponse({
        store: nextStore,
        sessionId: draft.sessionId,
        problemId,
        inputRaw,
        now,
        timeSpentMs,
        answerEditCount: editCountByProblemIdRef.current[problemId] ?? 0,
        scratchpadStrokesJson: scratchpadByProblemIdRef.current[problemId] ?? null
      })
    }

    pendingByProblemIdRef.current = {}
    pendingProcessProblemIdsRef.current.clear()
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

  // 문항 전환 함수
  const switchActiveProblem = useCallback((newProblemId: string) => {
    const prevProblemId = activeProblemIdRef.current
    if (prevProblemId === newProblemId) return

    const nowMs = Date.now()

    if (prevProblemId) {
      // 이전 문항 시간 누적
      if (!document.hidden && !isTimingPausedRef.current) {
        const elapsed = Math.max(0, nowMs - activeStartedAtRef.current)
        timeSpentByProblemIdRef.current[prevProblemId] =
          (timeSpentByProblemIdRef.current[prevProblemId] ?? 0) + elapsed
      }

      // 이전 문항 스크래치패드 저장
      if (scratchpadRef.current) {
        scratchpadByProblemIdRef.current[prevProblemId] = scratchpadRef.current.getStrokesJson()
      }

      pendingProcessProblemIdsRef.current.add(prevProblemId)
      scheduleAutoSave()
    }

    activeProblemIdRef.current = newProblemId
    setActiveProblemId(newProblemId)
    activeStartedAtRef.current = nowMs
    isTimingPausedRef.current = document.hidden

    // 새 문항 스크래치패드 로드
    if (scratchpadRef.current) {
      isLoadingScratchpadRef.current = true
      scratchpadRef.current.loadStrokesJson(scratchpadByProblemIdRef.current[newProblemId] ?? null)
    }
  }, [scheduleAutoSave])

  // 입력 focus 시 현재값 기록
  const handleInputFocus = useCallback((problemId: string, currentValue: string) => {
    valueAtFocusRef.current[problemId] = currentValue
    switchActiveProblem(problemId)
  }, [switchActiveProblem])

  // 입력 blur 시 수정 횟수 카운트
  const handleInputBlur = useCallback((problemId: string, currentValue: string) => {
    const prevValue = valueAtFocusRef.current[problemId] ?? ''
    if (normalizeNumericInput(currentValue) !== normalizeNumericInput(prevValue)) {
      editCountByProblemIdRef.current[problemId] =
        (editCountByProblemIdRef.current[problemId] ?? 0) + 1
      pendingProcessProblemIdsRef.current.add(problemId)
      scheduleAutoSave()
    }
  }, [scheduleAutoSave])

  // visibilitychange 이벤트: 탭 전환 시 시간 측정 일시정지/재개
  useEffect(() => {
    const handleVisibilityChange = () => {
      const activeId = activeProblemIdRef.current
      const nowMs = Date.now()

      if (document.hidden) {
        // 탭 숨김: 현재 문항 시간 누적
        if (activeId && !isTimingPausedRef.current) {
          const elapsed = Math.max(0, nowMs - activeStartedAtRef.current)
          timeSpentByProblemIdRef.current[activeId] =
            (timeSpentByProblemIdRef.current[activeId] ?? 0) + elapsed
          pendingProcessProblemIdsRef.current.add(activeId)
          scheduleAutoSave()
        }
        isTimingPausedRef.current = true
        activeStartedAtRef.current = nowMs
      } else {
        // 탭 복귀: 타이머 리셋
        isTimingPausedRef.current = false
        activeStartedAtRef.current = nowMs
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [scheduleAutoSave])

  // 첫 로드 시 1번 문항 active
  useEffect(() => {
    if (problems.length === 0) return
    const activeId = activeProblemIdRef.current
    if (activeId && problems.some((p) => p.id === activeId)) return
    switchActiveProblem(problems[0].id)
  }, [problems, switchActiveProblem])

  const activeProblemNumber = useMemo(() => {
    if (!activeProblemId) return null
    const idx = problems.findIndex((p) => p.id === activeProblemId)
    return idx >= 0 ? idx + 1 : null
  }, [activeProblemId, problems])

  const handleScratchpadStrokeStart = useCallback(() => {
    // pen stroke는 active 전환 트리거이므로, 혹시 active가 없다면 1번을 선택
    if (activeProblemIdRef.current) return
    if (problems.length === 0) return
    switchActiveProblem(problems[0].id)
  }, [problems, switchActiveProblem])

  const handleScratchpadStrokesChange = useCallback((strokesJson: string) => {
    const activeId = activeProblemIdRef.current
    if (!activeId) return
    scratchpadByProblemIdRef.current[activeId] = strokesJson
    if (isLoadingScratchpadRef.current) {
      isLoadingScratchpadRef.current = false
      return
    }
    pendingProcessProblemIdsRef.current.add(activeId)
    scheduleAutoSave()
  }, [scheduleAutoSave])

  const handleSubmitClick = () => {
    if (!nodeId || !userId || problems.length === 0) return
    if (!allAnswered) return
    setShowConfirmModal(true)
  }

  const confirmSubmit = () => {
    setShowConfirmModal(false)
    setShowResumeModal(false)

    if (!nodeId || !userId || problems.length === 0) return
    if (!allAnswered) return

    if (autoSaveTimerRef.current !== null) {
      window.clearTimeout(autoSaveTimerRef.current)
      autoSaveTimerRef.current = null
    }
    pendingByProblemIdRef.current = {}
    pendingProcessProblemIdsRef.current.clear()

    // 현재 활성 문항의 시간 및 스크래치패드 최종 저장
    const activeId = activeProblemIdRef.current
    if (activeId) {
      const nowMs = Date.now()
      if (!document.hidden && !isTimingPausedRef.current) {
        const elapsed = Math.max(0, nowMs - activeStartedAtRef.current)
        timeSpentByProblemIdRef.current[activeId] =
          (timeSpentByProblemIdRef.current[activeId] ?? 0) + elapsed
      }

      if (scratchpadRef.current) {
        scratchpadByProblemIdRef.current[activeId] = scratchpadRef.current.getStrokesJson()
      }
    }

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
        now,
        // 레벨 2 데이터 포함
        timeSpentMs: timeSpentByProblemIdRef.current[problem.id] ?? 0,
        answerEditCount: editCountByProblemIdRef.current[problem.id] ?? 0,
        scratchpadStrokesJson: scratchpadByProblemIdRef.current[problem.id] ?? null
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
    setShowResumeModal(false)
    setAnswerByProblemId({})

    // 레벨 2 데이터 초기화
    setActiveProblemId(null)
    activeProblemIdRef.current = null
    activeStartedAtRef.current = Date.now()
    isTimingPausedRef.current = false
    timeSpentByProblemIdRef.current = {}
    editCountByProblemIdRef.current = {}
    valueAtFocusRef.current = {}
    scratchpadByProblemIdRef.current = {}
    pendingProcessProblemIdsRef.current.clear()
    isLoadingScratchpadRef.current = false
    if (scratchpadRef.current) {
      scratchpadRef.current.clear()
    }

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

          <div className="learn-split-container">
            <div className="learn-split-left">
              <ol className="problem-list">
                {problems.map((problem, idx) => {
                  const isUnanswered = unansweredIndices.includes(idx + 1)
                  const isActive = activeProblemId === problem.id
                  return (
                    <li
                      key={problem.id}
                      className={`problem-card ${isUnanswered ? 'problem-unanswered' : ''} ${isActive ? 'problem-active' : ''}`}
                      onClick={() => switchActiveProblem(problem.id)}
                    >
                      <h3 className="problem-title">
                        <span className="problem-number">{idx + 1}.</span> {problem.prompt}
                      </h3>
                      <div className="problem-answer">
                        <input
                          value={answerByProblemId[problem.id] ?? ''}
                          onChange={(event) => handleAnswerChange(problem.id, event.target.value)}
                          onFocus={() => handleInputFocus(problem.id, answerByProblemId[problem.id] ?? '')}
                          onBlur={(event) => handleInputBlur(problem.id, event.target.value)}
                          placeholder="정답 입력"
                        />
                      </div>
                    </li>
                  )
                })}
              </ol>
            </div>

            <div className="learn-split-right">
              <Scratchpad
                ref={scratchpadRef}
                problemNumber={activeProblemNumber}
                onStrokeStart={handleScratchpadStrokeStart}
                onStrokesChange={handleScratchpadStrokesChange}
              />
            </div>
          </div>

          {showResumeModal ? (
            <div
              className="modal-overlay"
              onClick={() => setShowResumeModal(false)}
            >
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h2>이어서 풀기</h2>
                <p>이전 답안이 있습니다.</p>
                <p className="muted">입력된 문항: {resumeAnsweredCount}개</p>
                <div className="modal-actions">
                  <button type="button" className="button button-primary" onClick={() => setShowResumeModal(false)}>
                    이어서 하기
                  </button>
                  <button
                    type="button"
                    className="button button-ghost"
                    onClick={() => {
                      setShowResumeModal(false)
                      resetAttempt()
                    }}
                  >
                    처음부터
                  </button>
                </div>
              </div>
            </div>
          ) : null}

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
