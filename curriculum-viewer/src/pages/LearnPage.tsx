import { useEffect, useMemo, useState } from 'react'
import { useOutletContext, useParams } from 'react-router-dom'
import NodeDetail from '../components/NodeDetail'
import type { DetailPanelContext } from '../components/AppLayout'
import { useCurriculum } from '../lib/curriculum/CurriculumProvider'
import { gradeNumericAnswer } from '../lib/learn/grading'
import type { Problem } from '../lib/learn/problems'
import { loadProblemBank } from '../lib/learn/problems'

export default function LearnPage() {
  const { setDetail } = useOutletContext<DetailPanelContext>()
  const params = useParams()
  const nodeId = params.nodeId ? decodeURIComponent(params.nodeId) : null
  const { index, loading: curriculumLoading, error: curriculumError } =
    useCurriculum()

  const node = useMemo(() => {
    return nodeId && index ? index.nodeById.get(nodeId) ?? null : null
  }, [index, nodeId])

  const [problemBankLoading, setProblemBankLoading] = useState(false)
  const [problemBankError, setProblemBankError] = useState<string | null>(null)
  const [problemsByNodeId, setProblemsByNodeId] = useState<
    Record<string, Problem[]>
  >({})

  const [answerByProblemId, setAnswerByProblemId] = useState<
    Record<string, string>
  >({})

  type StoredResult = {
    nodeId: string
    updatedAt: string
    submissions: Record<string, { submitted: string; isCorrect: boolean }>
  }

  const [resultByProblemId, setResultByProblemId] = useState<
    Record<string, { submitted: string; isCorrect: boolean }>
  >({})

  const storageKey = nodeId ? `curriculum-viewer:learn:lastResult:${nodeId}` : null

  const problems = useMemo(() => {
    if (!nodeId) return []
    return problemsByNodeId[nodeId] ?? []
  }, [nodeId, problemsByNodeId])

  useEffect(() => {
    if (!nodeId) {
      setAnswerByProblemId({})
      setResultByProblemId({})
      return
    }

    try {
      const raw = storageKey ? window.localStorage.getItem(storageKey) : null
      if (!raw) {
        setAnswerByProblemId({})
        setResultByProblemId({})
        return
      }

      const parsed = JSON.parse(raw) as StoredResult
      if (parsed.nodeId !== nodeId || typeof parsed.submissions !== 'object') {
        setAnswerByProblemId({})
        setResultByProblemId({})
        return
      }

      const nextAnswers: Record<string, string> = {}
      const nextResults: Record<string, { submitted: string; isCorrect: boolean }> =
        {}

      for (const [problemId, submission] of Object.entries(parsed.submissions)) {
        if (!submission || typeof submission.submitted !== 'string') continue
        nextAnswers[problemId] = submission.submitted
        nextResults[problemId] = {
          submitted: submission.submitted,
          isCorrect: Boolean(submission.isCorrect)
        }
      }

      setAnswerByProblemId(nextAnswers)
      setResultByProblemId(nextResults)
    } catch {
      setAnswerByProblemId({})
      setResultByProblemId({})
    }
  }, [nodeId, storageKey])

  useEffect(() => {
    if (import.meta.env.MODE === 'test') {
      return
    }

    const controller = new AbortController()

    async function run() {
      setProblemBankLoading(true)
      setProblemBankError(null)

      try {
        const bank = await loadProblemBank(controller.signal)
        setProblemsByNodeId(bank.problemsByNodeId)
      } catch (err) {
        if (controller.signal.aborted) return

        const message = err instanceof Error ? err.message : String(err)
        setProblemBankError(message)
      } finally {
        if (!controller.signal.aborted) {
          setProblemBankLoading(false)
        }
      }
    }

    run()

    return () => {
      controller.abort()
    }
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

  const score = useMemo(() => {
    if (problems.length === 0) return null

    let correct = 0
    for (const problem of problems) {
      if (resultByProblemId[problem.id]?.isCorrect) {
        correct += 1
      }
    }

    return { correct, total: problems.length }
  }, [problems, resultByProblemId])

  const submitProblem = (problem: Problem) => {
    if (!nodeId) return

    const submitted = answerByProblemId[problem.id] ?? ''
    const graded = gradeNumericAnswer(submitted, problem.answer)

    const nextResult = {
      submitted,
      isCorrect: graded.isCorrect
    }

    setResultByProblemId((prev) => ({
      ...prev,
      [problem.id]: nextResult
    }))

    if (!storageKey) return

    try {
      const existingRaw = window.localStorage.getItem(storageKey)
      const existing: StoredResult | null = existingRaw
        ? (JSON.parse(existingRaw) as StoredResult)
        : null

      const submissions: StoredResult['submissions'] = {
        ...(existing?.submissions ?? {}),
        [problem.id]: nextResult
      }

      const payload: StoredResult = {
        nodeId,
        updatedAt: new Date().toISOString(),
        submissions
      }

      window.localStorage.setItem(storageKey, JSON.stringify(payload))
    } catch {
      // ignore storage failures
    }
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
        <p className="error">
          학습은 성취기준(standard) 노드에서만 지원합니다.
        </p>
      ) : null}

      {node?.text ? (
        <div className="learn-description">
          <h2>설명</h2>
          <p className="detail-text">{node.text}</p>
        </div>
      ) : null}

      {problemBankLoading ? <p>문제 로딩중…</p> : null}
      {problemBankError ? <p className="error">{problemBankError}</p> : null}

      {score ? (
        <p className="learn-score">
          점수: {score.correct} / {score.total}
        </p>
      ) : null}

      {!problemBankLoading && !problemBankError && problems.length === 0 ? (
        <p className="muted">문제 준비중</p>
      ) : null}

      {problems.length > 0 ? (
        <ol className="problem-list">
          {problems.map((problem) => {
            const result = resultByProblemId[problem.id]
            const isCorrect = result?.isCorrect ?? null

            return (
              <li key={problem.id} className="problem-card">
                <h3 className="problem-title">{problem.prompt}</h3>
                <div className="problem-answer">
                  <input
                    value={answerByProblemId[problem.id] ?? ''}
                    onChange={(event) =>
                      setAnswerByProblemId((prev) => ({
                        ...prev,
                        [problem.id]: event.target.value
                      }))
                    }
                    placeholder="정답 입력"
                  />
                  <button
                    type="button"
                    className="button button-primary"
                    onClick={() => submitProblem(problem)}
                  >
                    제출
                  </button>
                </div>

                {isCorrect !== null ? (
                  <p
                    className={
                      isCorrect ? 'problem-result correct' : 'problem-result wrong'
                    }
                  >
                    {isCorrect ? '정답' : '오답'} · 정답: {problem.answer}
                  </p>
                ) : null}
              </li>
            )
          })}
        </ol>
      ) : null}
    </section>
  )
}
