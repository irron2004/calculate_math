import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth/AuthProvider'
import { PLACEMENT_QUESTIONS_V1, type PlacementQuestion } from '../lib/diagnostic/placementQuestions'
import { formatTagKo } from '../lib/diagnostic/tags'
import { gradeNumericAnswer } from '../lib/learn/grading'
import { upsertMyStudentProfile } from '../lib/studentProfile/api'
import { ROUTES } from '../routes'

type SurveyDraft = {
  grade: string
  confidence: number | null
  recentHardTags: string[]
  studyStyle: 'short' | 'long' | null
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
  const questions = PLACEMENT_QUESTIONS_V1

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
          <p className="problem-question">{current.prompt}</p>

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
                    <span className="option-text">{option}</span>
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
                const perQuestion = questions.map((q) => {
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

