import { useCallback, useEffect, useState } from 'react'
import { getAllStudents, type StudentInfo, useAuth } from '../lib/auth/AuthProvider'
import { createAssignment, HomeworkApiError } from '../lib/homework/api'
import type { HomeworkProblem, HomeworkProblemType } from '../lib/homework/types'
import { createEmptyProblem } from '../lib/homework/types'

type ProblemEditorProps = {
  problem: HomeworkProblem
  index: number
  onChange: (problem: HomeworkProblem) => void
  onRemove: () => void
  disabled?: boolean
}

function ProblemEditor({ problem, index, onChange, onRemove, disabled }: ProblemEditorProps) {
  const handleTypeChange = (type: HomeworkProblemType) => {
    onChange({
      ...problem,
      type,
      options: type === 'objective' ? ['', ''] : undefined
    })
  }

  const handleQuestionChange = (question: string) => {
    onChange({ ...problem, question })
  }

  const handleAnswerChange = (answer: string) => {
    onChange({ ...problem, answer: answer || undefined })
  }

  const handleOptionChange = (optionIndex: number, value: string) => {
    if (!problem.options) return
    const newOptions = [...problem.options]
    newOptions[optionIndex] = value
    onChange({ ...problem, options: newOptions })
  }

  const handleAddOption = () => {
    if (!problem.options) return
    onChange({ ...problem, options: [...problem.options, ''] })
  }

  const handleRemoveOption = (optionIndex: number) => {
    if (!problem.options || problem.options.length <= 2) return
    const newOptions = problem.options.filter((_, i) => i !== optionIndex)
    onChange({ ...problem, options: newOptions })
  }

  return (
    <div className="problem-editor">
      <div className="problem-editor-header">
        <span className="problem-number">문제 {index + 1}</span>
        <button
          type="button"
          className="button button-ghost button-small"
          onClick={onRemove}
          disabled={disabled}
        >
          삭제
        </button>
      </div>

      <div className="problem-type-select">
        <label>
          <input
            type="radio"
            name={`type-${problem.id}`}
            value="subjective"
            checked={problem.type === 'subjective'}
            onChange={() => handleTypeChange('subjective')}
            disabled={disabled}
          />
          주관식
        </label>
        <label>
          <input
            type="radio"
            name={`type-${problem.id}`}
            value="objective"
            checked={problem.type === 'objective'}
            onChange={() => handleTypeChange('objective')}
            disabled={disabled}
          />
          객관식
        </label>
      </div>

      <label className="form-field">
        문제
        <textarea
          value={problem.question}
          onChange={(e) => handleQuestionChange(e.target.value)}
          placeholder="문제 내용을 입력하세요."
          rows={3}
          disabled={disabled}
        />
      </label>

      {problem.type === 'objective' && (
        <div className="problem-options">
          <label className="form-field-label">보기</label>
          {problem.options?.map((option, optionIndex) => (
            <div key={optionIndex} className="problem-option-row">
              <span className="option-number">{optionIndex + 1}.</span>
              <input
                type="text"
                value={option}
                onChange={(e) => handleOptionChange(optionIndex, e.target.value)}
                placeholder={`보기 ${optionIndex + 1}`}
                disabled={disabled}
              />
              {problem.options && problem.options.length > 2 && (
                <button
                  type="button"
                  className="button button-ghost button-small"
                  onClick={() => handleRemoveOption(optionIndex)}
                  disabled={disabled}
                >
                  ×
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            className="button button-ghost button-small"
            onClick={handleAddOption}
            disabled={disabled}
          >
            + 보기 추가
          </button>
        </div>
      )}

      <label className="form-field">
        정답 (선택)
        <input
          type="text"
          value={problem.answer || ''}
          onChange={(e) => handleAnswerChange(e.target.value)}
          placeholder={
            problem.type === 'objective'
              ? '정답 번호 (예: 1)'
              : '정답 내용'
          }
          disabled={disabled}
        />
      </label>
    </div>
  )
}

export default function AuthorHomeworkPage() {
  const { user } = useAuth()

  const [students, setStudents] = useState<StudentInfo[]>([])
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set())

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [problems, setProblems] = useState<HomeworkProblem[]>([createEmptyProblem(1)])

  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    setStudents(getAllStudents())
  }, [])

  const handleToggleStudent = useCallback((studentId: string) => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev)
      if (next.has(studentId)) {
        next.delete(studentId)
      } else {
        next.add(studentId)
      }
      return next
    })
  }, [])

  const handleSelectAll = useCallback(() => {
    if (selectedStudentIds.size === students.length) {
      setSelectedStudentIds(new Set())
    } else {
      setSelectedStudentIds(new Set(students.map((s) => s.id)))
    }
  }, [selectedStudentIds.size, students])

  const handleAddProblem = useCallback(() => {
    setProblems((prev) => [...prev, createEmptyProblem(prev.length + 1)])
  }, [])

  const handleProblemChange = useCallback((index: number, problem: HomeworkProblem) => {
    setProblems((prev) => {
      const next = [...prev]
      next[index] = problem
      return next
    })
  }, [])

  const handleRemoveProblem = useCallback((index: number) => {
    setProblems((prev) => {
      if (prev.length <= 1) return prev
      return prev.filter((_, i) => i !== index)
    })
  }, [])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()

      if (!title.trim()) {
        setMessage({ type: 'error', text: '제목을 입력하세요.' })
        return
      }

      if (problems.length === 0) {
        setMessage({ type: 'error', text: '문제를 하나 이상 추가하세요.' })
        return
      }

      // Validate problems
      for (let i = 0; i < problems.length; i++) {
        const problem = problems[i]
        if (!problem.question.trim()) {
          setMessage({ type: 'error', text: `문제 ${i + 1}의 내용을 입력하세요.` })
          return
        }
        if (problem.type === 'objective') {
          if (!problem.options || problem.options.length < 2) {
            setMessage({ type: 'error', text: `문제 ${i + 1}에 보기를 2개 이상 추가하세요.` })
            return
          }
          for (let j = 0; j < problem.options.length; j++) {
            if (!problem.options[j].trim()) {
              setMessage({ type: 'error', text: `문제 ${i + 1}의 보기 ${j + 1}을(를) 입력하세요.` })
              return
            }
          }
        }
      }

      if (selectedStudentIds.size === 0) {
        setMessage({ type: 'error', text: '학생을 선택하세요.' })
        return
      }

      setSubmitting(true)
      setMessage(null)

      try {
        await createAssignment({
          title: title.trim(),
          description: description.trim() || undefined,
          problems: problems.map((p) => ({
            ...p,
            question: p.question.trim(),
            options: p.options?.map((o) => o.trim()),
            answer: p.answer?.trim() || undefined
          })),
          dueAt: dueAt || undefined,
          targetStudentIds: Array.from(selectedStudentIds)
        })

        setMessage({ type: 'success', text: '숙제가 출제되었습니다.' })
        setTitle('')
        setDescription('')
        setDueAt('')
        setProblems([createEmptyProblem(1)])
        setSelectedStudentIds(new Set())
      } catch (err) {
        if (err instanceof HomeworkApiError) {
          setMessage({ type: 'error', text: err.message })
        } else {
          setMessage({ type: 'error', text: '숙제 출제 중 오류가 발생했습니다.' })
        }
      } finally {
        setSubmitting(false)
      }
    },
    [description, dueAt, problems, selectedStudentIds, title]
  )

  if (!user) {
    return (
      <section>
        <h1>숙제 출제</h1>
        <p className="error">로그인이 필요합니다.</p>
      </section>
    )
  }

  return (
    <section>
      <h1>숙제 출제</h1>
      <p className="muted">학생들에게 숙제를 출제합니다.</p>

      {message && (
        <p className={message.type === 'success' ? 'success' : 'error'}>{message.text}</p>
      )}

      <form onSubmit={handleSubmit}>
        <fieldset disabled={submitting}>
          <h3>학생 선택</h3>
          {students.length === 0 ? (
            <p className="muted">등록된 학생이 없습니다.</p>
          ) : (
            <>
              <div className="node-actions" style={{ marginBottom: '1rem' }}>
                <button type="button" className="button button-ghost" onClick={handleSelectAll}>
                  {selectedStudentIds.size === students.length ? '전체 해제' : '전체 선택'}
                </button>
                <span className="muted">선택: {selectedStudentIds.size}명</span>
              </div>
              <div className="student-select-list">
                {students.map((student) => (
                  <label key={student.id} className="student-select-item">
                    <input
                      type="checkbox"
                      checked={selectedStudentIds.has(student.id)}
                      onChange={() => handleToggleStudent(student.id)}
                    />
                    <span className="student-name">{student.name}</span>
                    <span className="student-grade muted">({student.grade})</span>
                  </label>
                ))}
              </div>
            </>
          )}

          <h3>숙제 정보</h3>
          <label className="form-field">
            제목
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 1단원 복습 문제"
              required
            />
          </label>

          <label className="form-field">
            설명 (선택)
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="숙제에 대한 설명을 입력하세요."
              rows={2}
            />
          </label>

          <label className="form-field">
            마감일 (선택)
            <input
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
            />
          </label>

          <h3>문제 ({problems.length}개)</h3>
          <div className="problems-editor">
            {problems.map((problem, index) => (
              <ProblemEditor
                key={problem.id}
                problem={problem}
                index={index}
                onChange={(p) => handleProblemChange(index, p)}
                onRemove={() => handleRemoveProblem(index)}
                disabled={submitting}
              />
            ))}
          </div>

          <button
            type="button"
            className="button button-ghost"
            onClick={handleAddProblem}
            style={{ marginTop: '1rem' }}
          >
            + 문제 추가
          </button>

          <div className="node-actions" style={{ marginTop: '1.5rem' }}>
            <button
              type="submit"
              className="button button-primary"
              disabled={submitting || selectedStudentIds.size === 0 || problems.length === 0}
            >
              {submitting ? '출제 중...' : '숙제 출제'}
            </button>
          </div>
        </fieldset>
      </form>
    </section>
  )
}
