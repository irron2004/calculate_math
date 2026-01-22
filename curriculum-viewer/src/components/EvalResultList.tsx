import { useState } from 'react'
import type { AttemptResponse, GradingResultV1 } from '../lib/studentLearning/types'

function ExplanationToggle({ explanation }: { explanation: string }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="explanation-container">
      <button
        type="button"
        className="explanation-toggle"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? '해설 접기' : '해설 보기'}
      </button>
      {isOpen && (
        <div className="explanation-content">
          <p className="explanation-text">{explanation}</p>
        </div>
      )}
    </div>
  )
}

export default function EvalResultList(props: {
  perProblem: GradingResultV1['perProblem']
  responses: Record<string, AttemptResponse>
}) {
  return (
    <ol className="problem-list">
      {Object.entries(props.perProblem).map(([problemId, result]) => {
        const submitted = props.responses?.[problemId]?.inputRaw ?? ''
        const submittedLabel = submitted.trim().length > 0 ? submitted : '-'
        const showExplanation = !result.isCorrect && result.explanation

        return (
          <li key={problemId} className="problem-card">
            <h3 className="problem-title">{problemId}</h3>
            <p className="muted">내답: {submittedLabel}</p>
            <p className={result.isCorrect ? 'problem-result correct' : 'problem-result wrong'}>
              {result.isCorrect ? '정답' : '오답'}
              {result.expectedAnswer ? ` · 정답: ${result.expectedAnswer}` : null}
            </p>
            {showExplanation && <ExplanationToggle explanation={result.explanation!} />}
          </li>
        )
      })}
    </ol>
  )
}
