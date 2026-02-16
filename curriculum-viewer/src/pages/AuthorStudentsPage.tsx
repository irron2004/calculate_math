import { useCallback, useEffect, useState } from 'react'
import { listStudents, updateStudentFeatures } from '../lib/auth/api'
import type { StudentInfo } from '../lib/auth/types'

type PageMessage = { type: 'success' | 'error'; text: string }

export default function AuthorStudentsPage() {
  const [students, setStudents] = useState<StudentInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<PageMessage | null>(null)
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set())

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
              </tr>
            </thead>
            <tbody>
              {students.length === 0 ? (
                <tr>
                  <td colSpan={4} className="muted">
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

