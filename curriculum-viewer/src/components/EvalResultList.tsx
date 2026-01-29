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
      {Object.entries(props.perProblem).map(([problemId, result], index) => {
        const submitted = props.responses?.[problemId]?.inputRaw ?? ''
        const submittedLabel = submitted.trim().length > 0 ? submitted : '-'
        const showExplanation = !result.isCorrect && result.explanation

        return (
          <li
            key={problemId}
            className={`problem-card ${result.isCorrect ? 'problem-card-correct' : 'problem-card-wrong'}`}
          >
            <h3 className="problem-title">
              <span className="problem-number">{index + 1}</span>
              {problemId}
            </h3>
            <p className="muted">내 답: {submittedLabel}</p>
            <p className={result.isCorrect ? 'problem-result correct' : 'problem-result wrong'}>
              <span className="result-emoji">{result.isCorrect ? '🎉' : '💪'}</span>
              {result.isCorrect ? '정답이에요!' : '다시 도전해봐요!'}
              {result.expectedAnswer ? ` · 정답: ${result.expectedAnswer}` : null}
            </p>
            {showExplanation && <ExplanationToggle explanation={result.explanation!} />}
          </li>
        )
      })}
    </ol>
  )
}
