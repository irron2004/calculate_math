import { useState } from 'react'
import type { AttemptResponse, GradingResultV1 } from '../lib/studentLearning/types'
import { renderMathText } from '../lib/math/renderMathText'
import Scratchpad from './Scratchpad'

function hasNonEmptyStrokesJson(json: string | null | undefined): boolean {
  if (!json) return false
  try {
    const parsed = JSON.parse(json)
    return Array.isArray(parsed) && parsed.length > 0
  } catch {
    return false
  }
}

function formatTimeSpent(timeSpentMs: number): string {
  const sec = Math.max(0, Math.round(timeSpentMs / 1000))
  return `${sec}초`
}

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
          <p className="explanation-text">{renderMathText(explanation)}</p>
        </div>
      )}
    </div>
  )
}

export default function EvalResultList(props: {
  perProblem: GradingResultV1['perProblem']
  responses: Record<string, AttemptResponse>
}) {
  const [openProblemId, setOpenProblemId] = useState<string | null>(null)

  return (
    <ol className="problem-list">
      {Object.entries(props.perProblem).map(([problemId, result], index) => {
        const submitted = props.responses?.[problemId]?.inputRaw ?? ''
        const submittedLabel = submitted.trim().length > 0 ? submitted : '-'
        const showExplanation = !result.isCorrect && result.explanation

        const response = props.responses?.[problemId]
        const timeSpentMs = response?.timeSpentMs ?? result.timeSpentMs ?? 0
        const answerEditCount = response?.answerEditCount ?? result.answerEditCount ?? 0
        const scratchpadStrokesJson =
          response?.scratchpadStrokesJson ?? result.scratchpadStrokesJson ?? null
        const hasMemo = hasNonEmptyStrokesJson(scratchpadStrokesJson)
        const isOpen = openProblemId === problemId

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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <p className="muted">
                집중 시간: {formatTimeSpent(timeSpentMs)} · 수정: {answerEditCount}회
              </p>
              <button
                type="button"
                className="button button-ghost button-small"
                onClick={() => setOpenProblemId(isOpen ? null : problemId)}
              >
                {isOpen ? '풀이 접기' : '풀이 보기'}
              </button>
            </div>
            <p className={result.isCorrect ? 'problem-result correct' : 'problem-result wrong'}>
              <span className="result-emoji">{result.isCorrect ? '🎉' : '💪'}</span>
              {result.isCorrect ? '정답이에요!' : '다시 도전해봐요!'}
              {result.expectedAnswer ? (
                <>
                  {' · 정답: '}
                  {renderMathText(result.expectedAnswer)}
                </>
              ) : null}
            </p>
            {showExplanation && <ExplanationToggle explanation={result.explanation!} />}

            {isOpen ? (
              hasMemo ? (
                <div style={{ marginTop: 12, height: 360 }}>
                  <Scratchpad
                    readOnly
                    problemNumber={index + 1}
                    strokesJson={scratchpadStrokesJson}
                  />
                </div>
              ) : (
                <p className="muted" style={{ marginTop: 12 }}>
                  풀이 없음
                </p>
              )
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}
