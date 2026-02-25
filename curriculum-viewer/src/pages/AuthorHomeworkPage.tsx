import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../lib/auth/AuthProvider'
import { listStudents } from '../lib/auth/api'
import type { StudentInfo } from '../lib/auth/types'
import { formatTagKo } from '../lib/diagnostic/tags'
import {
  createAssignment,
  createProblemBankLabel,
  HomeworkApiError,
  importProblemBank,
  listProblemBankLabels,
  listProblemBankProblems,
  setProblemBankProblemLabels,
} from '../lib/homework/api'
import { recommendHomeworkProblems } from '../lib/homework/recommendation'
import type {
  AdminHomeworkProblem,
  HomeworkLabel,
  HomeworkProblemType,
  ProblemBankProblem,
} from '../lib/homework/types'
import { createEmptyProblem } from '../lib/homework/types'
import {
  computeDefaultScheduleAndDue,
  formatHomeworkTitleDaySuffix,
  resolveHomeworkDayKey,
  type HomeworkDayKey,
} from '../lib/homework/scheduling'

type ProblemEditorProps = {
  problem: AdminHomeworkProblem
  index: number
  onChange: (problem: AdminHomeworkProblem) => void
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
                  x
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

type JsonHomeworkData = {
  title?: string
  description?: string
  dueAt?: string
  scheduledAt?: string
  stickerRewardCount?: number
  problems?: Array<{
    type?: 'objective' | 'subjective'
    question?: string
    options?: string[]
    answer?: string
  }>
}

const JSON_TEMPLATE = `{
  "title": "숙제 제목",
  "description": "숙제 설명 (선택)",
  "dueAt": "2026-02-01T18:00",
  "scheduledAt": "2026-01-30T09:00",
  "stickerRewardCount": 2,
  "problems": [
    {
      "type": "objective",
      "question": "다음 중 올바른 것은?",
      "options": ["보기 1", "보기 2", "보기 3", "보기 4"],
      "answer": "1"
    },
    {
      "type": "subjective",
      "question": "다음 문제를 풀이하세요.",
      "answer": "정답 (선택)"
    }
  ]
}`

export default function AuthorHomeworkPage() {
  const { user } = useAuth()

  const [students, setStudents] = useState<StudentInfo[]>([])
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set())

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [stickerRewardCount, setStickerRewardCount] = useState('2')
  const [problems, setProblems] = useState<AdminHomeworkProblem[]>([createEmptyProblem(1)])

  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // JSON Import
  const [showJsonImport, setShowJsonImport] = useState(false)
  const [jsonInput, setJsonInput] = useState('')
  const [jsonError, setJsonError] = useState<string | null>(null)

  const [problemSource, setProblemSource] = useState<'manual' | 'bank'>('manual')

  const [bankLabels, setBankLabels] = useState<HomeworkLabel[]>([])
  const [bankProblems, setBankProblems] = useState<ProblemBankProblem[]>([])
  const [bankKnownProblemsById, setBankKnownProblemsById] = useState<Record<string, ProblemBankProblem>>({})
  const [bankSelectedProblemIds, setBankSelectedProblemIds] = useState<Set<string>>(new Set())
  const [bankWeekKey, setBankWeekKey] = useState('')
  const [bankDayKey, setBankDayKey] = useState('')
  const [bankLabelKey, setBankLabelKey] = useState('')
  const [bankLoading, setBankLoading] = useState(false)

  const [bankImportWeekKey, setBankImportWeekKey] = useState('')
  const [bankImportDayKey, setBankImportDayKey] = useState<'mon' | 'tue' | 'wed' | 'thu' | 'fri'>('mon')
  const [bankImportJson, setBankImportJson] = useState('')
  const [bankImportError, setBankImportError] = useState<string | null>(null)

  const [newLabelKey, setNewLabelKey] = useState('')
  const [newLabelLabel, setNewLabelLabel] = useState('')

  const [editingProblemId, setEditingProblemId] = useState<string | null>(null)
  const [editingLabelKeys, setEditingLabelKeys] = useState<Set<string>>(new Set())
  const [savingLabels, setSavingLabels] = useState(false)

  const selectedSingleStudent = useMemo(() => {
    if (selectedStudentIds.size !== 1) return null
    const studentId = Array.from(selectedStudentIds)[0]
    return students.find((s) => s.id === studentId) ?? null
  }, [selectedStudentIds, students])

  const labelMap = useMemo(() => {
    const map = new Map<string, HomeworkLabel>()
    for (const item of bankLabels) {
      map.set(item.key, item)
    }
    return map
  }, [bankLabels])

  useEffect(() => {
    const controller = new AbortController()
    listStudents(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setStudents(data)
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setMessage({ type: 'error', text: err instanceof Error ? err.message : '학생 목록을 불러올 수 없습니다.' })
        }
      })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (problemSource !== 'bank') return
    const controller = new AbortController()
    listProblemBankLabels(controller.signal)
      .then((labels) => {
        if (!controller.signal.aborted) setBankLabels(labels)
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setMessage({ type: 'error', text: err instanceof Error ? err.message : '라벨 목록을 불러올 수 없습니다.' })
        }
      })
    return () => controller.abort()
  }, [problemSource])

  useEffect(() => {
    if (problemSource !== 'bank') return
    const controller = new AbortController()

    setBankLoading(true)
    listProblemBankProblems(
      {
        weekKey: bankWeekKey.trim() || undefined,
        dayKey: bankDayKey.trim() || undefined,
        labelKey: bankLabelKey.trim() || undefined,
        limit: 200,
        offset: 0,
      },
      controller.signal
    )
      .then((problems) => {
        if (controller.signal.aborted) return
        setBankProblems(problems)
        setBankKnownProblemsById((prev) => {
          const next = { ...prev }
          for (const problem of problems) {
            next[problem.id] = problem
          }
          return next
        })
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setMessage({ type: 'error', text: err instanceof Error ? err.message : '문제은행을 불러올 수 없습니다.' })
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setBankLoading(false)
      })
    return () => controller.abort()
  }, [problemSource, bankWeekKey, bankDayKey, bankLabelKey])

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

  const handleToggleBankProblem = useCallback((problemId: string) => {
    setBankSelectedProblemIds((prev) => {
      const next = new Set(prev)
      if (next.has(problemId)) next.delete(problemId)
      else next.add(problemId)
      return next
    })
  }, [])

  const handleSelectAllBankProblems = useCallback(() => {
    setBankSelectedProblemIds((prev) => {
      if (prev.size === bankProblems.length) return new Set()
      return new Set(bankProblems.map((p) => p.id))
    })
  }, [bankProblems])

  const handleLoadRecommended = useCallback(() => {
    if (!selectedSingleStudent?.profile) {
      setMessage({ type: 'error', text: '추천 숙제를 만들려면 학생 진단이 필요합니다.' })
      return
    }
    const recommended = recommendHomeworkProblems(selectedSingleStudent.profile, 10)
    setProblems(recommended)
    if (!title.trim()) {
      setTitle(`${selectedSingleStudent.name} 맞춤 숙제`)
    }
    setMessage({ type: 'success', text: '추천 숙제 세트를 불러왔습니다. 필요하면 수정해서 출제하세요.' })
  }, [selectedSingleStudent, title])

  const handleAddProblem = useCallback(() => {
    setProblems((prev) => [...prev, createEmptyProblem(prev.length + 1)])
  }, [])

  const handleProblemChange = useCallback((index: number, problem: AdminHomeworkProblem) => {
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

  const handleJsonImport = useCallback(() => {
    setJsonError(null)

    try {
      const data = JSON.parse(jsonInput) as JsonHomeworkData

      if (data.title && typeof data.title === 'string') {
        setTitle(data.title)
      }
      if (data.description && typeof data.description === 'string') {
        setDescription(data.description)
      }
      if (data.dueAt && typeof data.dueAt === 'string') {
        setDueAt(data.dueAt)
      }
      if (data.scheduledAt && typeof data.scheduledAt === 'string') {
        setScheduledAt(data.scheduledAt)
      }
      if (typeof data.stickerRewardCount === 'number' && Number.isFinite(data.stickerRewardCount)) {
        setStickerRewardCount(String(Math.max(0, Math.trunc(data.stickerRewardCount))))
      }

      if (data.problems && Array.isArray(data.problems) && data.problems.length > 0) {
        const importedProblems: AdminHomeworkProblem[] = data.problems.map((p, index) => {
          const type = p.type === 'objective' ? 'objective' : 'subjective'
          return {
            id: `p${index + 1}`,
            type,
            question: p.question || '',
            options: type === 'objective' ? (p.options || ['', '']) : undefined,
            answer: p.answer || undefined
          }
        })
        setProblems(importedProblems)
      }

      setShowJsonImport(false)
      setJsonInput('')
      setMessage({ type: 'success', text: 'JSON 데이터를 가져왔습니다. 학생을 선택한 후 출제하세요.' })
    } catch {
      setJsonError('JSON 형식이 올바르지 않습니다.')
    }
  }, [jsonInput])

  const handleCopyTemplate = useCallback(() => {
    navigator.clipboard.writeText(JSON_TEMPLATE).then(() => {
      setMessage({ type: 'success', text: '템플릿이 클립보드에 복사되었습니다.' })
    }).catch(() => {
      // Fallback for older browsers
      setJsonInput(JSON_TEMPLATE)
    })
  }, [])

  const handleBankImport = useCallback(async () => {
    setBankImportError(null)
    if (!bankImportWeekKey.trim()) {
      setBankImportError('weekKey를 입력하세요. (예: 2026-W04)')
      return
    }
    if (!bankImportJson.trim()) {
      setBankImportError('가져올 JSON을 입력하세요.')
      return
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(bankImportJson)
    } catch {
      setBankImportError('JSON 형식이 올바르지 않습니다.')
      return
    }

    try {
      await importProblemBank({ weekKey: bankImportWeekKey.trim(), dayKey: bankImportDayKey, payload: parsed })
      setBankImportJson('')
      setBankImportWeekKey('')
      setBankWeekKey(bankImportWeekKey.trim())
      setBankDayKey(bankImportDayKey)
      setMessage({ type: 'success', text: '문제은행에 import 완료. 목록을 새로고침했습니다.' })
    } catch (err) {
      if (err instanceof HomeworkApiError) {
        setBankImportError(err.message)
      } else {
        setBankImportError('import 중 오류가 발생했습니다.')
      }
    }
  }, [bankImportDayKey, bankImportJson, bankImportWeekKey])

  const handleCreateCustomLabel = useCallback(async () => {
    const key = newLabelKey.trim()
    const label = newLabelLabel.trim()
    if (!key || !label) {
      setMessage({ type: 'error', text: '라벨 key와 라벨 이름을 입력하세요.' })
      return
    }
    try {
      const created = await createProblemBankLabel({ key, label, kind: 'custom' })
      setBankLabels((prev) => {
        if (prev.find((x) => x.key === created.key)) return prev
        return [...prev, created].sort((a, b) => a.key.localeCompare(b.key))
      })
      setNewLabelKey('')
      setNewLabelLabel('')
      setMessage({ type: 'success', text: '라벨을 추가했습니다.' })
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : '라벨 생성 실패' })
    }
  }, [newLabelKey, newLabelLabel])

  const handleOpenLabelEditor = useCallback((problem: ProblemBankProblem) => {
    setEditingProblemId(problem.id)
    setEditingLabelKeys(new Set(problem.labelKeys ?? []))
  }, [])

  const handleToggleEditingLabel = useCallback((labelKey: string) => {
    setEditingLabelKeys((prev) => {
      const next = new Set(prev)
      if (next.has(labelKey)) next.delete(labelKey)
      else next.add(labelKey)
      return next
    })
  }, [])

  const handleSaveProblemLabels = useCallback(async () => {
    if (!editingProblemId) return
    setSavingLabels(true)
    try {
      const keys = Array.from(editingLabelKeys)
      await setProblemBankProblemLabels(editingProblemId, keys)
      setBankProblems((prev) =>
        prev.map((p) => (p.id === editingProblemId ? { ...p, labelKeys: keys } : p))
      )
      setEditingProblemId(null)
      setMessage({ type: 'success', text: '라벨을 저장했습니다.' })
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : '라벨 저장 실패' })
    } finally {
      setSavingLabels(false)
    }
  }, [editingLabelKeys, editingProblemId])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()

      if (!title.trim()) {
        setMessage({ type: 'error', text: '제목을 입력하세요.' })
        return
      }

      if (problemSource === 'bank') {
        if (bankSelectedProblemIds.size === 0) {
          setMessage({ type: 'error', text: '문제은행에서 출제할 문제를 선택하세요.' })
          return
        }
      } else {
        if (problems.length === 0) {
          setMessage({ type: 'error', text: '문제를 하나 이상 추가하세요.' })
          return
        }

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
      }

      if (selectedStudentIds.size === 0) {
        setMessage({ type: 'error', text: '학생을 선택하세요.' })
        return
      }

      const parsedStickerRewardCount = Number.parseInt(stickerRewardCount, 10)
      if (!Number.isFinite(parsedStickerRewardCount) || parsedStickerRewardCount < 0) {
        setMessage({ type: 'error', text: '스티커 개수는 0 이상의 정수여야 합니다.' })
        return
      }

      setSubmitting(true)
      setMessage(null)

      try {
        const now = new Date()
        const base = {
          title: title.trim(),
          description: description.trim() || undefined,
          stickerRewardCount: parsedStickerRewardCount,
          targetStudentIds: Array.from(selectedStudentIds)
        }

        if (problemSource === 'bank') {
          const selectedIds = Array.from(bankSelectedProblemIds)

          const buckets = new Map<HomeworkDayKey | null, string[]>()
          for (const problemId of selectedIds) {
            const problem = bankKnownProblemsById[problemId]
            const key = resolveHomeworkDayKey(problem?.dayKey)
            const list = buckets.get(key) ?? []
            list.push(problemId)
            buckets.set(key, list)
          }

          const entries = Array.from(buckets.entries()).filter(([, list]) => list.length > 0)
          const shouldSuffixTitle = entries.length > 1
          let createdCount = 0

          for (const [bucketDayKey, problemIds] of entries) {
            const defaults = computeDefaultScheduleAndDue({ now, dayKey: bucketDayKey, fallbackDayKey: 'fri' })
            const effectiveScheduledAt = scheduledAt || defaults.scheduledAt
            const effectiveDueAt = dueAt || defaults.dueAt
            const displayDayKey: HomeworkDayKey = bucketDayKey ?? 'fri'
            const assignmentTitle = shouldSuffixTitle
              ? `${base.title} (${formatHomeworkTitleDaySuffix(displayDayKey)})`
              : base.title

            await createAssignment({
              ...base,
              title: assignmentTitle,
              dueAt: effectiveDueAt,
              scheduledAt: effectiveScheduledAt,
              problemIds
            })
            createdCount += 1
          }

          setMessage({
            type: 'success',
            text:
              createdCount > 1
                ? `숙제 ${createdCount}개가 예약되었습니다.`
                : '숙제가 예약되었습니다.'
          })
        } else {
          const defaults = computeDefaultScheduleAndDue({ now, dayKey: null, fallbackDayKey: 'fri' })
          const effectiveScheduledAt = scheduledAt || defaults.scheduledAt
          const effectiveDueAt = dueAt || defaults.dueAt
          await createAssignment({
            ...base,
            dueAt: effectiveDueAt,
            scheduledAt: effectiveScheduledAt,
            problems: problems.map((p) => ({
              ...p,
              question: p.question.trim(),
              options: p.options?.map((o) => o.trim()),
              answer: p.answer?.trim() || undefined
            }))
          })

          setMessage({ type: 'success', text: '숙제가 예약되었습니다.' })
        }

        setTitle('')
        setDescription('')
        setDueAt('')
        setScheduledAt('')
        setBankSelectedProblemIds(new Set())
        setStickerRewardCount('2')
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
    [
      description,
      dueAt,
      scheduledAt,
      stickerRewardCount,
      problems,
      selectedStudentIds,
      title,
      problemSource,
      bankSelectedProblemIds,
      bankKnownProblemsById,
    ]
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

      {problemSource === 'manual' && (
        <div className="homework-import-section">
          <button
            type="button"
            className="button button-ghost"
            onClick={() => setShowJsonImport(!showJsonImport)}
          >
            {showJsonImport ? 'JSON 가져오기 닫기' : 'JSON으로 가져오기'}
          </button>

          {showJsonImport && (
            <div className="json-import-panel">
              <div className="json-import-header">
                <h3>JSON 가져오기</h3>
                <button
                  type="button"
                  className="button button-ghost button-small"
                  onClick={handleCopyTemplate}
                >
                  템플릿 복사
                </button>
              </div>
              <textarea
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                placeholder={JSON_TEMPLATE}
                rows={12}
                className="json-input"
              />
              {jsonError && <p className="error">{jsonError}</p>}
              <div className="json-import-actions">
                <button
                  type="button"
                  className="button button-primary"
                  onClick={handleJsonImport}
                  disabled={!jsonInput.trim()}
                >
                  가져오기
                </button>
                <button
                  type="button"
                  className="button button-ghost"
                  onClick={() => {
                    setShowJsonImport(false)
                    setJsonInput('')
                    setJsonError(null)
                  }}
                >
                  취소
                </button>
              </div>
            </div>
          )}
        </div>
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
                    <span className="student-profile">
                      {student.profile ? (
                        <>
                          <span className="badge badge-ok">{student.profile.estimatedLevel ?? '레벨'}</span>
                          {student.profile.weakTagsTop3.slice(0, 2).map((tag) => (
                            <span key={tag} className="tag-chip">
                              {formatTagKo(tag)}
                            </span>
                          ))}
                        </>
                      ) : (
                        <span className="badge badge-warn">진단 필요</span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            </>
          )}

          {selectedSingleStudent ? (
            <div className="recommended-panel">
              <div className="recommended-panel-title">
                선택된 학생: <strong>{selectedSingleStudent.name}</strong>
                {selectedSingleStudent.profile?.estimatedLevel ? (
                  <span className="badge badge-ok" style={{ marginLeft: 8 }}>
                    {selectedSingleStudent.profile.estimatedLevel}
                  </span>
                ) : (
                  <span className="badge badge-warn" style={{ marginLeft: 8 }}>
                    진단 필요
                  </span>
                )}
              </div>
              <p className="muted" style={{ margin: '6px 0 0' }}>
                약점: {selectedSingleStudent.profile?.weakTagsTop3?.length ? selectedSingleStudent.profile.weakTagsTop3.map(formatTagKo).join(', ') : '아직 없어요'}
              </p>
              <div className="node-actions" style={{ marginTop: 10 }}>
                <button
                  type="button"
                  className="button button-primary"
                  onClick={handleLoadRecommended}
                  disabled={!selectedSingleStudent.profile}
                >
                  추천 숙제 만들기
                </button>
                <span className="muted">학생 1명을 선택했을 때만 추천을 만들 수 있어요.</span>
              </div>
            </div>
          ) : null}

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

          <div className="form-row">
            <label className="form-field">
              마감 일시 (선택)
              <input
                type="datetime-local"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
              />
            </label>

            <label className="form-field">
              예약 출제 일시 (선택)
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
              <span className="muted">설정 시 해당 시간 이후에 학생에게 표시됩니다.</span>
            </label>

            <label className="form-field">
              숙제 완료 스티커 개수
              <input
                type="number"
                min={0}
                step={1}
                value={stickerRewardCount}
                onChange={(e) => setStickerRewardCount(e.target.value)}
              />
              <span className="muted">숙제가 승인되면 설정한 개수만큼 자동 지급됩니다.</span>
            </label>
          </div>

          <h3>문제</h3>

          <div className="node-actions" style={{ marginBottom: '1rem' }}>
            <button
              type="button"
              className={problemSource === 'manual' ? 'button button-primary' : 'button button-ghost'}
              onClick={() => setProblemSource('manual')}
              disabled={submitting}
            >
              직접 입력
            </button>
            <button
              type="button"
              className={problemSource === 'bank' ? 'button button-primary' : 'button button-ghost'}
              onClick={() => setProblemSource('bank')}
              disabled={submitting}
            >
              문제은행
            </button>
            <span className="muted">
              선택: {problemSource === 'manual' ? problems.length : bankSelectedProblemIds.size}개
            </span>
          </div>

          {problemSource === 'manual' ? (
            <>
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
            </>
          ) : (
            <>
              <div className="recommended-panel" style={{ marginTop: 12 }}>
                <div className="recommended-panel-title">문제은행</div>

                <div className="form-row" style={{ marginTop: 10 }}>
                  <label className="form-field">
                    weekKey
                    <input
                      type="text"
                      value={bankWeekKey}
                      onChange={(e) => setBankWeekKey(e.target.value)}
                      placeholder="예: 2026-W04"
                    />
                  </label>

                  <label className="form-field">
                    day
                    <select value={bankDayKey} onChange={(e) => setBankDayKey(e.target.value)}>
                      <option value="">전체</option>
                      <option value="mon">월</option>
                      <option value="tue">화</option>
                      <option value="wed">수</option>
                      <option value="thu">목</option>
                      <option value="fri">금</option>
                    </select>
                  </label>

                  <label className="form-field">
                    label
                    <select value={bankLabelKey} onChange={(e) => setBankLabelKey(e.target.value)}>
                      <option value="">전체</option>
                      {bankLabels.map((l) => (
                        <option key={l.id} value={l.key}>
                          {l.label} ({l.key})
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="node-actions" style={{ marginTop: 6, marginBottom: 10 }}>
                  <button
                    type="button"
                    className="button button-ghost"
                    onClick={handleSelectAllBankProblems}
                    disabled={submitting || bankProblems.length === 0}
                  >
                    {bankSelectedProblemIds.size === bankProblems.length ? '전체 해제' : '전체 선택'}
                  </button>
                  <span className="muted">
                    {bankLoading ? '불러오는 중...' : `목록: ${bankProblems.length}개`}
                  </span>
                </div>

                {bankProblems.length === 0 ? (
                  <p className="muted">조건에 맞는 문제가 없습니다.</p>
                ) : (
                  <div className="student-select-list">
                    {bankProblems.map((p) => (
                      <div key={p.id} className="student-select-item" style={{ alignItems: 'flex-start' }}>
                        <label style={{ display: 'flex', gap: 10, flex: 1, cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={bankSelectedProblemIds.has(p.id)}
                            onChange={() => handleToggleBankProblem(p.id)}
                          />
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                              <span className="badge badge-ok">
                                {p.dayKey ?? '-'} #{p.orderIndex}
                              </span>
                              <span className="badge badge-warn">
                                {p.type === 'objective' ? '객관식' : '주관식'}
                              </span>
                              {(p.labelKeys ?? []).map((k) => (
                                <span key={k} className="tag-chip">
                                  {labelMap.get(k)?.label ?? k}
                                </span>
                              ))}
                            </div>
                            <p style={{ margin: '8px 0 0' }}>{p.question}</p>
                          </div>
                        </label>
                        <button
                          type="button"
                          className="button button-ghost button-small"
                          onClick={() => handleOpenLabelEditor(p)}
                          disabled={submitting}
                        >
                          라벨
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="json-import-panel" style={{ marginTop: 16 }}>
                <div className="json-import-header">
                  <h3>문제은행 Import</h3>
                </div>
                <div className="form-row">
                  <label className="form-field">
                    weekKey
                    <input
                      type="text"
                      value={bankImportWeekKey}
                      onChange={(e) => setBankImportWeekKey(e.target.value)}
                      placeholder="예: 2026-W04"
                    />
                  </label>
                  <label className="form-field">
                    day
                    <select
                      value={bankImportDayKey}
                      onChange={(e) => setBankImportDayKey(e.target.value as 'mon' | 'tue' | 'wed' | 'thu' | 'fri')}
                    >
                      <option value="mon">월</option>
                      <option value="tue">화</option>
                      <option value="wed">수</option>
                      <option value="thu">목</option>
                      <option value="fri">금</option>
                    </select>
                  </label>
                </div>
                <textarea
                  value={bankImportJson}
                  onChange={(e) => setBankImportJson(e.target.value)}
                  placeholder="요일 JSON을 붙여넣으세요 (title/description/problems)"
                  rows={8}
                  className="json-input"
                />
                {bankImportError && <p className="error">{bankImportError}</p>}
                <div className="json-import-actions">
                  <button
                    type="button"
                    className="button button-primary"
                    onClick={handleBankImport}
                    disabled={submitting}
                  >
                    Import
                  </button>
                </div>
              </div>

              <div className="json-import-panel" style={{ marginTop: 16 }}>
                <div className="json-import-header">
                  <h3>라벨 추가 (custom)</h3>
                </div>
                <div className="form-row">
                  <label className="form-field">
                    key
                    <input
                      type="text"
                      value={newLabelKey}
                      onChange={(e) => setNewLabelKey(e.target.value)}
                      placeholder="예: divide_basic"
                    />
                  </label>
                  <label className="form-field">
                    이름
                    <input
                      type="text"
                      value={newLabelLabel}
                      onChange={(e) => setNewLabelLabel(e.target.value)}
                      placeholder="예: 나눗셈-기초"
                    />
                  </label>
                </div>
                <div className="json-import-actions">
                  <button
                    type="button"
                    className="button button-primary"
                    onClick={handleCreateCustomLabel}
                    disabled={submitting}
                  >
                    라벨 추가
                  </button>
                </div>
              </div>

              {editingProblemId && (
                <div className="json-import-panel" style={{ marginTop: 16 }}>
                  <div className="json-import-header">
                    <h3>라벨 편집</h3>
                    <button
                      type="button"
                      className="button button-ghost button-small"
                      onClick={() => setEditingProblemId(null)}
                      disabled={savingLabels}
                    >
                      닫기
                    </button>
                  </div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {bankLabels.map((l) => (
                      <label key={l.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input
                          type="checkbox"
                          checked={editingLabelKeys.has(l.key)}
                          onChange={() => handleToggleEditingLabel(l.key)}
                          disabled={savingLabels}
                        />
                        <span>{l.label}</span>
                        <span className="muted">({l.key})</span>
                      </label>
                    ))}
                  </div>
                  <div className="json-import-actions">
                    <button
                      type="button"
                      className="button button-primary"
                      onClick={handleSaveProblemLabels}
                      disabled={savingLabels}
                    >
                      {savingLabels ? '저장 중...' : '저장'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          <div className="node-actions" style={{ marginTop: '1.5rem' }}>
            <button
              type="submit"
              className="button button-primary"
              disabled={
                submitting ||
                selectedStudentIds.size === 0 ||
                (problemSource === 'manual'
                  ? problems.length === 0
                  : bankSelectedProblemIds.size === 0)
              }
            >
              {submitting ? '출제 중...' : scheduledAt ? '숙제 예약' : '숙제 출제'}
            </button>
          </div>
        </fieldset>
      </form>
    </section>
  )
}
