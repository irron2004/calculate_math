import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import type { DetailPanelContext } from '../components/AppLayout'
import { useCurriculum } from '../lib/curriculum/CurriculumProvider'
import { useFocusNodeId } from '../lib/routing/useFocusNodeId'
import { validateCurriculum, type CurriculumIssue } from '../lib/curriculum/validate'

export default function HealthPage() {
  const { setDetail } = useOutletContext<DetailPanelContext>()
  const navigate = useNavigate()
  const { data, loading, error } = useCurriculum()
  const { focusNodeId } = useFocusNodeId()

  const [searchQuery, setSearchQuery] = useState('')
  const [codeFilter, setCodeFilter] = useState<string>('all')

  useEffect(() => {
    setDetail(
      <div>
        <h2>리포트</h2>
        <p>데이터 검증 결과를 표시합니다. 행을 클릭하면 트리로 이동합니다.</p>
        {focusNodeId ? <p className="muted">focus: {focusNodeId}</p> : null}
      </div>
    )
  }, [focusNodeId, setDetail])

  const issues = useMemo((): CurriculumIssue[] => {
    return data ? validateCurriculum(data.nodes) : []
  }, [data])

  const availableCodes = useMemo(() => {
    const codes = new Set<string>()
    for (const issue of issues) {
      codes.add(issue.code)
    }
    return Array.from(codes.values()).sort()
  }, [issues])

  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    return issues.filter((issue) => {
      if (codeFilter !== 'all' && issue.code !== codeFilter) {
        return false
      }

      if (query.length === 0) {
        return true
      }

      const haystack = `${issue.code} ${issue.nodeId ?? ''} ${issue.relatedId ?? ''} ${issue.message}`.toLowerCase()
      return haystack.includes(query)
    })
  }, [codeFilter, issues, searchQuery])

  return (
    <section>
      <h1>리포트</h1>

      <div className="health-toolbar">
        <label className="form-field">
          검색
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="nodeId / message"
          />
        </label>

        <label className="form-field">
          코드
          <select
            value={codeFilter}
            onChange={(event) => setCodeFilter(event.target.value)}
          >
            <option value="all">전체</option>
            {availableCodes.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </label>

        <div className="health-meta">
          <span>
            issues: {filtered.length} / {issues.length}
          </span>
        </div>
      </div>

      {loading ? <p>Loading…</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {issues.length === 0 && !loading && !error ? (
        <p className="muted">No issues.</p>
      ) : null}

      {filtered.length > 0 ? (
        <div className="health-table-wrap">
          <table className="health-table">
            <thead>
              <tr>
                <th>Severity</th>
                <th>Code</th>
                <th>Node</th>
                <th>Message</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((issue, index) => {
                const clickable = typeof issue.nodeId === 'string'

                return (
                  <tr
                    key={`${issue.code}:${issue.nodeId ?? ''}:${issue.relatedId ?? ''}:${index}`}
                    className={clickable ? 'health-row clickable' : 'health-row'}
                    onClick={() => {
                      if (!issue.nodeId) return
                      navigate(`/tree?focus=${encodeURIComponent(issue.nodeId)}`)
                    }}
                  >
                    <td>{issue.severity}</td>
                    <td>{issue.code}</td>
                    <td className="mono">{issue.nodeId ?? '-'}</td>
                    <td>{issue.message}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  )
}
