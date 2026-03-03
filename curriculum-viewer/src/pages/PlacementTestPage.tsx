import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth/AuthProvider'
import { buildAdjacentGradeDiagnostic, type AdjacentGradeDiagnosticPlan } from '../lib/diagnostic/adjacentGradeDiagnostic'
import { PLACEMENT_QUESTIONS_V1, type PlacementQuestion } from '../lib/diagnostic/placementQuestions'
import { formatTagKo } from '../lib/diagnostic/tags'
import { gradeNumericAnswer } from '../lib/learn/grading'
import { loadProblemBank, type Problem } from '../lib/learn/problems'
import { renderMathText } from '../lib/math/renderMathText'
import { upsertMyStudentProfile } from '../lib/studentProfile/api'
import { ROUTES } from '../routes'

type SurveyDraft = {
  grade: string
  confidence: number | null
  recentHardTags: string[]
  studyStyle: 'short' | 'long' | null
  diagnosticMode?: string
}

const SURVEY_STORAGE_KEY = 'onboarding:survey:v1'
const SLOW_THRESHOLD_MS = 60_000

function safeSessionStorageGet(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key)
  } catch {
    return null
  }
}

function safeSessionStorageRemove(key: string): void {
  try {
    window.sessionStorage.removeItem(key)
  } catch {
    // ignore
  }
}

type TagStat = { total: number; correct: number; slow: number }

function gradePlacementAnswer(question: PlacementQuestion, submittedRaw: string): boolean {
  const submitted = submittedRaw.trim()
  if (!submitted) return false

  if (question.answerType === 'choice') {
    return submitted === question.answer
  }

  if (question.answerType === 'numeric') {
    return gradeNumericAnswer(submitted, question.answer).isCorrect
  }

  return submitted.toLowerCase() === question.answer.trim().toLowerCase()
}

export default function PlacementTestPage() {
  const { user, isAdmin } = useAuth()
  const navigate = useNavigate()

  const [survey, setSurvey] = useState<SurveyDraft | null>(null)
  const isAdjacentGradeDiagnosticMode = survey?.diagnosticMode === 'adjacent-grade-na-v1'
  const [diagnosticProblemsByNodeId, setDiagnosticProblemsByNodeId] = useState<Record<string, Problem[]> | null>(null)
  const [diagnosticProblemBankLoading, setDiagnosticProblemBankLoading] = useState(false)
  const [diagnosticProblemBankError, setDiagnosticProblemBankError] = useState<string | null>(null)

  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const activeStartedAtRef = useRef<number>(Date.now())
  const timeSpentByQuestionIdRef = useRef<Record<string, number>>({})
  const editCountByQuestionIdRef = useRef<Record<string, number>>({})

  useEffect(() => {
    if (isAdmin) return
    const raw = safeSessionStorageGet(SURVEY_STORAGE_KEY)
    if (!raw) {
      setSurvey(null)
      return
    }
    try {
      const parsed = JSON.parse(raw) as SurveyDraft
      setSurvey(parsed)
    } catch {
      setSurvey(null)
    }
  }, [isAdmin])

  useEffect(() => {
    if (!isAdjacentGradeDiagnosticMode) {
      setDiagnosticProblemsByNodeId(null)
      setDiagnosticProblemBankLoading(false)
      setDiagnosticProblemBankError(null)
      return
    }

    const controller = new AbortController()
    setDiagnosticProblemBankLoading(true)
    setDiagnosticProblemBankError(null)

    loadProblemBank(controller.signal)
      .then((bank) => {
        if (!controller.signal.aborted) {
          setDiagnosticProblemsByNodeId(bank.problemsByNodeId)
        }
      })
      .catch((err) => {
        if (controller.signal.aborted) return
        setDiagnosticProblemBankError(err instanceof Error ? err.message : '문제 데이터를 불러올 수 없습니다.')
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setDiagnosticProblemBankLoading(false)
        }
      })

    return () => controller.abort()
  }, [isAdjacentGradeDiagnosticMode])

  type DiagnosticState =
    | { status: 'disabled' }
    | { status: 'loading' }
    | { status: 'error'; message: string }
    | { status: 'ready'; questions: PlacementQuestion[]; plan: AdjacentGradeDiagnosticPlan }

  const diagnosticState = useMemo<DiagnosticState>(() => {
    if (!isAdjacentGradeDiagnosticMode) return { status: 'disabled' }
    if (!survey) return { status: 'loading' }
    if (diagnosticProblemBankError) return { status: 'error', message: diagnosticProblemBankError }
    if (diagnosticProblemBankLoading || !diagnosticProblemsByNodeId) return { status: 'loading' }

    const parsedGrade = Number(survey.grade)
    if (!Number.isInteger(parsedGrade) || parsedGrade < 1 || parsedGrade > 6) {
      return { status: 'error', message: '학년 정보가 올바르지 않아 진단을 시작할 수 없습니다. 홈으로 이동해 다시 가입해 주세요.' }
    }

    let planResult: ReturnType<typeof buildAdjacentGradeDiagnostic>
    try {
      planResult = buildAdjacentGradeDiagnostic({
        grade: parsedGrade,
        problemsByNodeId: diagnosticProblemsByNodeId
      })
    } catch (err) {
      return { status: 'error', message: err instanceof Error ? err.message : String(err) }
    }

    if (!planResult.ok) {
      return { status: 'error', message: `진단 문제 수가 부족하거나 설정이 올바르지 않습니다. ${planResult.error}` }
    }

    const questions: PlacementQuestion[] = []
    for (const item of planResult.plan.items) {
      const problems = diagnosticProblemsByNodeId[item.nodeId] ?? []
      const problem = problems.find((p) => p.id === item.problemId) ?? null
      if (!problem) {
        return { status: 'error', message: `문제 데이터를 찾지 못했습니다: ${item.nodeId}:${item.problemId}` }
      }

      questions.push({
        id: `adj:${item.nodeId}:${problem.id}`,
        type: 'subjective',
        prompt: problem.prompt,
        answer: problem.answer,
        answerType: 'numeric',
        tags: [],
        difficulty: 2,
        gradeHint: item.groupGrade,
        estimatedTimeSec: 25
      })
    }

    return { status: 'ready', questions, plan: planResult.plan }
  }, [
    diagnosticProblemBankError,
    diagnosticProblemBankLoading,
    diagnosticProblemsByNodeId,
    isAdjacentGradeDiagnosticMode,
    survey
  ])

  const questions = diagnosticState.status === 'ready' ? diagnosticState.questions : PLACEMENT_QUESTIONS_V1

  const questionSetKey = diagnosticState.status === 'ready' ? 'adjacent-grade-na-v1' : 'placement-v1'
  useEffect(() => {
    setCurrentIndex(0)
    setAnswers({})
    setError(null)
    activeStartedAtRef.current = Date.now()
    timeSpentByQuestionIdRef.current = {}
    editCountByQuestionIdRef.current = {}
  }, [questionSetKey])

  const current = questions[currentIndex] ?? null

  const commitActiveTime = useCallback(() => {
    if (!current) return
    const now = Date.now()
    const elapsed = Math.max(0, now - activeStartedAtRef.current)
    timeSpentByQuestionIdRef.current[current.id] =
      (timeSpentByQuestionIdRef.current[current.id] ?? 0) + elapsed
    activeStartedAtRef.current = now
  }, [current])

  const moveTo = useCallback(
    (nextIndex: number) => {
      commitActiveTime()
      setError(null)
      setCurrentIndex(nextIndex)
    },
    [commitActiveTime]
  )

  const totalCount = questions.length
  const progressPercent = totalCount > 0 ? Math.round(((currentIndex + 1) / totalCount) * 100) : 0

  const allAnswered = useMemo(() => {
    return questions.every((q) => answers[q.id]?.trim())
  }, [answers, questions])

  if (isAdmin) {
    return (
      <section>
        <h1>진단</h1>
        <p className="muted">학생 전용 기능입니다.</p>
        <div className="node-actions" style={{ marginTop: 16 }}>
          <Link to={ROUTES.dashboard} className="button button-ghost">
            홈으로
          </Link>
        </div>
      </section>
    )
  }

  if (!survey) {
    return (
      <section>
        <h1>진단</h1>
        <p className="muted">먼저 1분 설문을 진행해 주세요.</p>
        <div className="node-actions" style={{ marginTop: 16 }}>
          <Link to={ROUTES.onboarding} className="button button-primary">
            설문으로 이동
          </Link>
          <Link to={ROUTES.dashboard} className="button button-ghost">
            홈으로
          </Link>
        </div>
      </section>
    )
  }

  if (isAdjacentGradeDiagnosticMode) {
    if (diagnosticState.status === 'loading') {
      return (
        <section>
          <h1>진단</h1>
          <p className="muted">진단 문제를 준비하는 중...</p>
          <div className="node-actions" style={{ marginTop: 16 }}>
            <Link to={ROUTES.dashboard} className="button button-ghost">
              홈으로
            </Link>
          </div>
        </section>
      )
    }

    if (diagnosticState.status === 'error') {
      return (
        <section>
          <h1>진단</h1>
          <p className="error">{diagnosticState.message}</p>
          <div className="node-actions" style={{ marginTop: 16 }}>
            <Link to={ROUTES.dashboard} className="button button-primary">
              홈으로
            </Link>
          </div>
        </section>
      )
    }
  }

  return (
    <section className="placement">
      <div className="homework-submit-header">
        <Link to={ROUTES.onboarding} className="button button-ghost">
          &larr; 설문으로
        </Link>
      </div>

      <h1>3~5분 진단</h1>
      <p className="muted">
        빠르게 풀고 제출하면, 시작점(레벨)과 약점 태그를 알려줘요.
      </p>

      <div className="homework-player-progress" style={{ marginTop: 12 }}>
        <div className="homework-player-progress-meta">
          <span className="badge">
            {currentIndex + 1} / {totalCount}
          </span>
          <span className="muted">학년: 초{survey.grade}</span>
        </div>
        <div className="homework-player-progress-bar" aria-hidden="true">
          <div className="homework-player-progress-fill" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      {error ? <p className="error" style={{ marginTop: 12 }}>{error}</p> : null}

      {current ? (
        <div className="problem-view" style={{ marginTop: 14 }}>
          <div className="problem-view-header">
            <span className="problem-number">문제 {currentIndex + 1}</span>
            <span className="problem-type-badge">{current.type === 'objective' ? '객관식' : '주관식'}</span>
            <span className="muted" style={{ marginLeft: 'auto' }}>
              {current.tags.map(formatTagKo).join(' · ')}
            </span>
          </div>
          <p className="problem-question">{renderMathText(current.prompt)}</p>

          {current.type === 'objective' && current.options ? (
            <div className="problem-options-answer">
              {current.options.map((option, optionIndex) => {
                const value = String(optionIndex + 1)
                const checked = (answers[current.id] ?? '') === value
                return (
                  <label key={value} className={`problem-option-label ${checked ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name={`answer-${current.id}`}
                      value={value}
                      checked={checked}
                      onChange={(e) => {
                        editCountByQuestionIdRef.current[current.id] =
                          (editCountByQuestionIdRef.current[current.id] ?? 0) + 1
                        setAnswers((prev) => ({ ...prev, [current.id]: e.target.value }))
                      }}
                      disabled={submitting}
                    />
                    <span className="option-number">{value}.</span>
                    <span className="option-text">{renderMathText(option)}</span>
                  </label>
                )
              })}
            </div>
          ) : (
            <div className="problem-text-answer">
              <textarea
                value={answers[current.id] ?? ''}
                onChange={(e) => {
                  editCountByQuestionIdRef.current[current.id] =
                    (editCountByQuestionIdRef.current[current.id] ?? 0) + 1
                  setAnswers((prev) => ({ ...prev, [current.id]: e.target.value }))
                }}
                placeholder="답안을 입력하세요."
                rows={3}
                disabled={submitting}
              />
            </div>
          )}
        </div>
      ) : null}

      <div className="homework-player-nav">
        <button
          type="button"
          className="button button-ghost"
          onClick={() => moveTo(Math.max(currentIndex - 1, 0))}
          disabled={currentIndex === 0 || submitting}
        >
          이전
        </button>
        <div className="homework-player-nav-right">
          <button
            type="button"
            className="button button-ghost"
            onClick={() => moveTo(Math.min(currentIndex + 1, totalCount - 1))}
            disabled={currentIndex >= totalCount - 1 || submitting}
          >
            다음
          </button>
          <button
            type="button"
            className="button button-primary"
            disabled={submitting}
            onClick={async () => {
              setError(null)
              if (!user) return
              if (!allAnswered) {
                const firstMissing = questions.findIndex((q) => !answers[q.id]?.trim())
                if (firstMissing >= 0) {
                  setError(`문제 ${firstMissing + 1}의 답안을 입력하세요.`)
                  moveTo(firstMissing)
                } else {
                  setError('모든 문제의 답안을 입력하세요.')
                }
                return
              }

              commitActiveTime()
              setSubmitting(true)

              try {
                let perQuestion = questions.map((q) => {
                  const submitted = answers[q.id] ?? ''
                  const isCorrect = gradePlacementAnswer(q, submitted)
                  const timeSpentMs = timeSpentByQuestionIdRef.current[q.id] ?? 0
                  const editCount = editCountByQuestionIdRef.current[q.id] ?? 0
                  return {
                    questionId: q.id,
                    tags: q.tags,
                    difficulty: q.difficulty,
                    gradeHint: q.gradeHint,
                    answerRaw: submitted,
                    isCorrect,
                    timeSpentMs,
                    editCount,
                    isSlow: timeSpentMs >= SLOW_THRESHOLD_MS
                  }
                })

                const adjacentPlan = diagnosticState.status === 'ready' ? diagnosticState.plan : null
                let adjacentBreakdown:
                  | null
                  | {
                      grade: number
                      domainCode: string
                      counts: AdjacentGradeDiagnosticPlan['counts']
                      nodeIdsUsed: {
                        pre: string[]
                        post: string[]
                        fill: string[]
                      }
                      groupStats: {
                        pre: { totalCount: number; correctCount: number; accuracy: number }
                        post: { totalCount: number; correctCount: number; accuracy: number }
                        fill: { totalCount: number; correctCount: number; accuracy: number }
                      }
                    } = null

                if (adjacentPlan) {
                  const itemByKey = new Map<string, { group: string; groupGrade: number }>()
                  for (const item of adjacentPlan.items) {
                    itemByKey.set(`${item.nodeId}:${item.problemId}`, { group: item.group, groupGrade: item.groupGrade })
                  }

                  const groupCounts = new Map<string, { totalCount: number; correctCount: number }>()
                  perQuestion = perQuestion.map((row) => {
                    const match = /^adj:([^:]+):([^:]+)$/.exec(String(row.questionId))
                    const nodeId = match?.[1] ?? null
                    const problemId = match?.[2] ?? null
                    const key = nodeId && problemId ? `${nodeId}:${problemId}` : null
                    const meta = key ? itemByKey.get(key) : undefined

                    if (meta) {
                      const stat = groupCounts.get(meta.group) ?? { totalCount: 0, correctCount: 0 }
                      stat.totalCount += 1
                      if (row.isCorrect) stat.correctCount += 1
                      groupCounts.set(meta.group, stat)
                    }

                    return {
                      ...row,
                      diagnosticNodeId: nodeId,
                      diagnosticProblemId: problemId,
                      diagnosticGroup: meta?.group,
                      diagnosticGroupGrade: meta?.groupGrade
                    }
                  })

                  const toStat = (group: 'pre' | 'post' | 'fill') => {
                    const stat = groupCounts.get(group) ?? { totalCount: 0, correctCount: 0 }
                    return {
                      totalCount: stat.totalCount,
                      correctCount: stat.correctCount,
                      accuracy: stat.totalCount > 0 ? stat.correctCount / stat.totalCount : 0
                    }
                  }

                  adjacentBreakdown = {
                    grade: adjacentPlan.grade,
                    domainCode: adjacentPlan.domainCode,
                    counts: adjacentPlan.counts,
                    nodeIdsUsed: {
                      pre: adjacentPlan.preNodeIds,
                      post: adjacentPlan.postNodeIds,
                      fill: adjacentPlan.fillNodeIds
                    },
                    groupStats: {
                      pre: toStat('pre'),
                      post: toStat('post'),
                      fill: toStat('fill')
                    }
                  }
                }

                const correctCount = perQuestion.filter((x) => x.isCorrect).length
                const accuracy = totalCount > 0 ? correctCount / totalCount : 0
                const totalTimeMs = perQuestion.reduce((sum, x) => sum + x.timeSpentMs, 0)

                const tagStats = new Map<string, TagStat>()
                for (const item of perQuestion) {
                  for (const tag of item.tags) {
                    const current = tagStats.get(tag) ?? { total: 0, correct: 0, slow: 0 }
                    current.total += 1
                    if (item.isCorrect) current.correct += 1
                    if (item.isSlow) current.slow += 1
                    tagStats.set(tag, current)
                  }
                }

                const weakTagsTop3 = Array.from(tagStats.entries())
                  .map(([tag, stat]) => {
                    const wrong = stat.total - stat.correct
                    const score = wrong * 2 + stat.slow
                    return { tag, score }
                  })
                  .sort((a, b) => b.score - a.score || a.tag.localeCompare(b.tag))
                  .filter((x) => x.score > 0)
                  .slice(0, 3)
                  .map((x) => x.tag)

                const baseGrade = (() => {
                  const parsed = Number(survey.grade)
                  return Number.isFinite(parsed) ? parsed : Number(user.grade)
                })()

                let levelGrade = baseGrade
                if (accuracy >= 0.85) levelGrade = Math.min(baseGrade + 1, 6)
                else if (accuracy <= 0.5) levelGrade = Math.max(baseGrade - 1, 1)

                const band = accuracy >= 0.85 ? 3 : accuracy >= 0.7 ? 2 : 1
                const estimatedLevel = `E${levelGrade}-${band}`

                await upsertMyStudentProfile({
                  survey,
                  placement: {
                    ...(adjacentBreakdown
                      ? {
                          mode: adjacentPlan?.mode,
                          adjacent: adjacentBreakdown
                        }
                      : {}),
                    totalCount,
                    correctCount,
                    accuracy,
                    totalTimeMs,
                    perQuestion,
                    perTag: Object.fromEntries(
                      Array.from(tagStats.entries()).map(([tag, stat]) => [tag, {
                        totalCount: stat.total,
                        correctCount: stat.correct,
                        slowCount: stat.slow,
                        accuracy: stat.total > 0 ? stat.correct / stat.total : 0
                      }])
                    )
                  },
                  estimatedLevel,
                  weakTagsTop3
                })

                safeSessionStorageRemove(SURVEY_STORAGE_KEY)
                navigate(ROUTES.onboardingResult)
              } catch (err) {
                setError(err instanceof Error ? err.message : '진단 제출에 실패했습니다.')
              } finally {
                setSubmitting(false)
              }
            }}
          >
            {submitting ? '제출 중...' : '제출하기'}
          </button>
        </div>
      </div>
    </section>
  )
}
