import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import ImageUploader from '../components/ImageUploader'
import { useAuth } from '../lib/auth/AuthProvider'
import { getAssignment, HomeworkApiError, submitHomework } from '../lib/homework/api'
import type { HomeworkAssignmentDetail, HomeworkProblem, HomeworkProblemReview } from '../lib/homework/types'

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

type ProblemViewProps = {
  problem: HomeworkProblem
  index: number
  answer: string
  onAnswerChange: (answer: string) => void
  feedback?: HomeworkProblemReview
  disabled?: boolean
}

function ProblemView({ problem, index, answer, onAnswerChange, feedback, disabled }: ProblemViewProps) {
  return (
    <div className="problem-view">
      <div className="problem-view-header">
        <span className="problem-number">문제 {index + 1}</span>
        <span className="problem-type-badge">
          {problem.type === 'objective' ? '객관식' : '주관식'}
        </span>
      </div>
      <p className="problem-question">{problem.question}</p>

      {problem.type === 'objective' && problem.options ? (
        <div className="problem-options-answer">
          {problem.options.map((option, optionIndex) => (
            <label key={optionIndex} className="problem-option-label">
              <input
                type="radio"
                name={`answer-${problem.id}`}
                value={String(optionIndex + 1)}
                checked={answer === String(optionIndex + 1)}
                onChange={(e) => onAnswerChange(e.target.value)}
                disabled={disabled}
              />
              <span className="option-number">{optionIndex + 1}.</span>
              <span className="option-text">{option}</span>
            </label>
          ))}
        </div>
      ) : (
        <div className="problem-text-answer">
          <textarea
            value={answer}
            onChange={(e) => onAnswerChange(e.target.value)}
            placeholder="답안을 입력하세요."
            rows={4}
            disabled={disabled}
          />
        </div>
      )}
      {feedback?.comment && (
        <p className="problem-review-comment">
          <strong>반려 사유:</strong> {feedback.comment}
        </p>
      )}
    </div>
  )
}

type ProblemSubmissionViewProps = {
  problem: HomeworkProblem
  index: number
  answer: string
}

function ProblemSubmissionView({ problem, index, answer }: ProblemSubmissionViewProps) {
  return (
    <div className="problem-submission-view">
      <div className="problem-view-header">
        <span className="problem-number">문제 {index + 1}</span>
        <span className="problem-type-badge">
          {problem.type === 'objective' ? '객관식' : '주관식'}
        </span>
      </div>
      <p className="problem-question">{problem.question}</p>

      {problem.type === 'objective' && problem.options ? (
        <div className="problem-options-answer submitted">
          {problem.options.map((option, optionIndex) => {
            const isSelected = answer === String(optionIndex + 1)
            return (
              <div
                key={optionIndex}
                className={`problem-option-label ${isSelected ? 'selected' : ''}`}
              >
                <span className="option-number">{optionIndex + 1}.</span>
                <span className="option-text">{option}</span>
                {isSelected && <span className="selected-mark">✓</span>}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="problem-text-answer submitted">
          <p className="submitted-answer-text">{answer || '(미응답)'}</p>
        </div>
      )}
    </div>
  )
}

export default function HomeworkSubmitPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [assignment, setAssignment] = useState<HomeworkAssignmentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [images, setImages] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [submitMessage, setSubmitMessage] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

  const loadAssignment = useCallback(
    async (signal: AbortSignal) => {
      if (!user || !id) return

      setLoading(true)
      setError(null)

      try {
        const data = await getAssignment(id, user.username, signal)
        if (!signal.aborted) {
          setAssignment(data)
          // Initialize answers from submission or empty
          if (data.submission) {
            setAnswers(data.submission.answers)
          } else {
            const initialAnswers: Record<string, string> = {}
            for (const problem of data.problems) {
              initialAnswers[problem.id] = ''
            }
            setAnswers(initialAnswers)
          }
        }
      } catch (err) {
        if (signal.aborted) return
        if (err instanceof HomeworkApiError) {
          setError(err.message)
        } else {
          setError('숙제를 불러오는 중 오류가 발생했습니다.')
        }
      } finally {
        if (!signal.aborted) {
          setLoading(false)
        }
      }
    },
    [id, user]
  )

  useEffect(() => {
    const controller = new AbortController()
    loadAssignment(controller.signal)
    return () => controller.abort()
  }, [loadAssignment])

  const handleAnswerChange = useCallback((problemId: string, answer: string) => {
    setAnswers((prev) => ({ ...prev, [problemId]: answer }))
  }, [])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()

      if (!user || !id || !assignment) return

      // Validate all answers are filled
      for (const problem of assignment.problems) {
        if (!answers[problem.id]?.trim()) {
          setSubmitMessage({
            type: 'error',
            text: `문제 ${assignment.problems.indexOf(problem) + 1}의 답안을 입력하세요.`
          })
          return
        }
      }

      setSubmitting(true)
      setSubmitMessage(null)

      try {
        await submitHomework(id, {
          studentId: user.username,
          answers,
          images
        })

        setSubmitMessage({ type: 'success', text: '숙제가 제출되었습니다!' })

        setTimeout(() => {
          navigate('/mypage')
        }, 1500)
      } catch (err) {
        if (err instanceof HomeworkApiError) {
          setSubmitMessage({ type: 'error', text: err.message })
        } else {
          setSubmitMessage({ type: 'error', text: '제출 중 오류가 발생했습니다.' })
        }
      } finally {
        setSubmitting(false)
      }
    },
    [answers, assignment, id, images, navigate, user]
  )

  if (!user) {
    return (
      <section>
        <h1>숙제 제출</h1>
        <p className="error">로그인이 필요합니다.</p>
      </section>
    )
  }

  if (loading) {
    return (
      <section>
        <h1>숙제 제출</h1>
        <p className="muted">숙제를 불러오는 중...</p>
      </section>
    )
  }

  if (error || !assignment) {
    return (
      <section>
        <h1>숙제 제출</h1>
        <p className="error">{error || '숙제를 찾을 수 없습니다.'}</p>
        <Link to="/mypage" className="button button-ghost">
          돌아가기
        </Link>
      </section>
    )
  }

  const submission = assignment.submission
  const reviewStatus = submission?.reviewStatus
  const isReturned = reviewStatus === 'returned'
  const isPending = reviewStatus === 'pending'
  const isApproved = reviewStatus === 'approved'
  const isAlreadySubmitted = Boolean(submission)
  const isOverdue =
    assignment.dueAt && new Date(assignment.dueAt) < new Date() && !isAlreadySubmitted

  const allAnswersFilled = assignment.problems.every(
    (problem) => answers[problem.id]?.trim()
  )

  return (
    <section>
      <div className="homework-submit-header">
        <Link to="/mypage" className="button button-ghost">
          &larr; 목록으로
        </Link>
      </div>

      <h1>{assignment.title}</h1>

      {assignment.description && (
        <p className="homework-description">{assignment.description}</p>
      )}

      {assignment.dueAt && (
        <p className={`homework-due ${isOverdue ? 'error' : 'muted'}`}>
          마감: {formatDateTime(assignment.dueAt)}
          {isOverdue && ' (마감됨)'}
        </p>
      )}

      {submission && (
        <div className="homework-review-status">
          {isPending && <span className="badge badge-warn">검토 중</span>}
          {isApproved && <span className="badge badge-ok">완료 처리됨</span>}
          {isReturned && <span className="badge badge-error">반려됨</span>}
        </div>
      )}

      {submitMessage && (
        <p className={submitMessage.type === 'success' ? 'success' : 'error'}>
          {submitMessage.text}
        </p>
      )}

      {isAlreadySubmitted && !isReturned ? (
        <div className="homework-submission-view">
          <h3>제출 내용</h3>
          <p className="muted">제출 시간: {formatDateTime(submission!.submittedAt)}</p>

          <div className="problems-list submitted">
            {assignment.problems.map((problem, index) => (
              <ProblemSubmissionView
                key={problem.id}
                problem={problem}
                index={index}
                answer={submission!.answers[problem.id] || ''}
              />
            ))}
          </div>

          {submission!.files.length > 0 && (
            <div className="homework-files-view">
              <h4>첨부 파일 ({submission!.files.length}개)</h4>
              <ul>
                {submission!.files.map((file) => (
                  <li key={file.id}>{file.originalName}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : isOverdue ? (
        <div className="homework-overdue-notice">
          <p className="error">마감 기한이 지났습니다. 제출할 수 없습니다.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <fieldset disabled={submitting}>
            <h3>{isReturned ? '재제출' : '문제'} ({assignment.problems.length}개)</h3>

            {isReturned && submission && (
              <p className="homework-returned-note">
                반려된 문제를 수정해서 다시 제출하세요. 마지막 제출 시간: {formatDateTime(submission.submittedAt)}
              </p>
            )}

            <div className="problems-list">
              {assignment.problems.map((problem, index) => (
                <ProblemView
                  key={problem.id}
                  problem={problem}
                  index={index}
                  answer={answers[problem.id] || ''}
                  onAnswerChange={(answer) => handleAnswerChange(problem.id, answer)}
                  feedback={submission?.problemReviews?.[problem.id]}
                  disabled={submitting}
                />
              ))}
            </div>

            <h3>첨부 파일 (선택)</h3>
            <ImageUploader value={images} onChange={setImages} disabled={submitting} />

            <div className="node-actions" style={{ marginTop: '1.5rem' }}>
              <button
                type="submit"
                className="button button-primary"
                disabled={submitting || !allAnswersFilled}
              >
                {submitting ? '제출 중...' : isReturned ? '재제출하기' : '제출하기'}
              </button>
              <Link to="/mypage" className="button button-ghost">
                취소
              </Link>
            </div>
          </fieldset>
        </form>
      )}
    </section>
  )
}
