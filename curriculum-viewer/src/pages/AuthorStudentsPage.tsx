import { useCallback, useEffect, useState } from 'react'
import { grantStudentSticker, listStudents, updateStudentFeatures } from '../lib/auth/api'
import type { StudentInfo } from '../lib/auth/types'

type PageMessage = { type: 'success' | 'error'; text: string }

export default function AuthorStudentsPage() {
  const [students, setStudents] = useState<StudentInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<PageMessage | null>(null)
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set())
  const [grantingIds, setGrantingIds] = useState<Set<string>>(new Set())
  const [grantForms, setGrantForms] = useState<Record<string, { count: string; reason: string }>>({})

  const loadStudents = useCallback(async (signal: AbortSignal) => {
    setLoading(true)
    setError(null)
    setMessage(null)

    try {
      const data = await listStudents(signal)
      if (!signal.aborted) {
        setStudents(data)
      }
    } catch (err) {
      if (signal.aborted) return
      setError(err instanceof Error ? err.message : '학생 목록을 불러올 수 없습니다.')
    } finally {
      if (!signal.aborted) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    loadStudents(controller.signal)
    return () => controller.abort()
  }, [loadStudents])

  const handleToggleSticker = useCallback(async (student: StudentInfo) => {
    const nextEnabled = !Boolean(student.praiseStickerEnabled)
    setMessage(null)
    setSavingIds((prev) => new Set(prev).add(student.id))
    setStudents((prev) =>
      prev.map((item) =>
        item.id === student.id ? { ...item, praiseStickerEnabled: nextEnabled } : item
      )
    )

    try {
      const updated = await updateStudentFeatures(student.id, { praiseStickerEnabled: nextEnabled })
      setStudents((prev) =>
        prev.map((item) =>
          item.id === student.id
            ? { ...item, praiseStickerEnabled: updated.praiseStickerEnabled }
            : item
        )
      )
      setMessage({
        type: 'success',
        text: `${student.name} (${student.id}) 칭찬 스티커: ${updated.praiseStickerEnabled ? 'ON' : 'OFF'}`
      })
    } catch (err) {
      setStudents((prev) =>
        prev.map((item) =>
          item.id === student.id ? { ...item, praiseStickerEnabled: !nextEnabled } : item
        )
      )
      setMessage({ type: 'error', text: err instanceof Error ? err.message : '설정 변경에 실패했습니다.' })
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev)
        next.delete(student.id)
        return next
      })
    }
  }, [])

  const handleGrantInputChange = useCallback(
    (studentId: string, patch: Partial<{ count: string; reason: string }>) => {
      setGrantForms((prev) => {
        const current = prev[studentId] ?? { count: '1', reason: '' }
        return {
          ...prev,
          [studentId]: {
            ...current,
            ...patch
          }
        }
      })
    },
    []
  )

  const handleGrantSticker = useCallback(
    async (student: StudentInfo) => {
      const form = grantForms[student.id] ?? { count: '1', reason: '' }
      const parsedCount = Number.parseInt(form.count, 10)
      const reason = form.reason.trim()

      if (!Number.isFinite(parsedCount) || parsedCount <= 0) {
        setMessage({ type: 'error', text: '지급 개수는 1 이상이어야 합니다.' })
        return
      }

      if (!reason) {
        setMessage({ type: 'error', text: '지급 사유를 입력하세요.' })
        return
      }

      setMessage(null)
      setGrantingIds((prev) => new Set(prev).add(student.id))

      try {
        await grantStudentSticker(student.id, { count: parsedCount, reason })
        setGrantForms((prev) => ({
          ...prev,
          [student.id]: { count: '1', reason: '' }
        }))
        setMessage({
          type: 'success',
          text: `${student.name} (${student.id})에게 칭찬 스티커 ${parsedCount}개를 지급했습니다.`
        })
      } catch (err) {
        setMessage({
          type: 'error',
          text: err instanceof Error ? err.message : '칭찬 스티커 지급에 실패했습니다.'
        })
      } finally {
        setGrantingIds((prev) => {
          const next = new Set(prev)
          next.delete(student.id)
          return next
        })
      }
    },
    [grantForms]
  )

  return (
    <section>
      <h1>계정 현황</h1>
      <p className="muted">학생 계정별로 칭찬 스티커 기능을 켜고 끌 수 있어요.</p>

      {message ? (
        <p className={message.type === 'success' ? 'success' : 'error'}>{message.text}</p>
      ) : null}

      {loading ? <p className="muted">학생 목록을 불러오는 중...</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {!loading && !error ? (
        <div className="admin-students-table-wrap">
          <table className="admin-students-table">
            <thead>
              <tr>
                <th>학생</th>
                <th>학년</th>
                <th>이메일</th>
                <th>칭찬 스티커</th>
                <th>보너스 지급</th>
              </tr>
            </thead>
            <tbody>
              {students.length === 0 ? (
                <tr>
                  <td colSpan={5} className="muted">
                    등록된 학생이 없습니다.
                  </td>
                </tr>
              ) : (
                students.map((student) => (
                  <tr key={student.id}>
                    <td>
                      <span className="student-name">{student.name}</span>
                      <span className="student-id muted">({student.id})</span>
                    </td>
                    <td>{student.grade}</td>
                    <td className="mono">{student.email}</td>
                    <td>
                      <button
                        type="button"
                        className="button button-ghost button-small"
                        onClick={() => handleToggleSticker(student)}
                        disabled={savingIds.has(student.id)}
                      >
                        {student.praiseStickerEnabled ? 'ON' : 'OFF'}
                      </button>
                    </td>
                    <td>
                      <div className="admin-sticker-grant-form">
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={grantForms[student.id]?.count ?? '1'}
                          onChange={(event) =>
                            handleGrantInputChange(student.id, { count: event.target.value })
                          }
                          disabled={!student.praiseStickerEnabled || grantingIds.has(student.id)}
                          className="admin-sticker-count-input"
                          aria-label={`${student.name} 스티커 개수`}
                        />
                        <input
                          type="text"
                          value={grantForms[student.id]?.reason ?? ''}
                          onChange={(event) =>
                            handleGrantInputChange(student.id, { reason: event.target.value })
                          }
                          placeholder="지급 사유"
                          disabled={!student.praiseStickerEnabled || grantingIds.has(student.id)}
                          className="admin-sticker-reason-input"
                          aria-label={`${student.name} 스티커 사유`}
                        />
                        <button
                          type="button"
                          className="button button-primary button-small"
                          onClick={() => void handleGrantSticker(student)}
                          disabled={!student.praiseStickerEnabled || grantingIds.has(student.id)}
                        >
                          {grantingIds.has(student.id) ? '지급 중...' : '지급'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  )
}
