import { useDeferredValue, useMemo, useState } from 'react'
import CurriculumGraphView from '../components/CurriculumGraphView'
import { useCurriculum } from '../lib/curriculum/CurriculumProvider'
import { sortCurriculumIssues } from '../lib/curriculum/validateCore.js'
import { useFocusNodeId } from '../lib/routing/useFocusNodeId'

function resolveIssueFocusId(issue: { nodeId?: string; relatedId?: string }): string | null {
  if (typeof issue.nodeId === 'string' && issue.nodeId.trim().length > 0) {
    return issue.nodeId
  }
  if (typeof issue.relatedId === 'string' && issue.relatedId.trim().length > 0) {
    return issue.relatedId
  }
  return null
}

export default function HealthPage() {
  const { data, loading, error, issues } = useCurriculum()
  const { focusNodeId, setFocusNodeId } = useFocusNodeId()

  const [searchQuery, setSearchQuery] = useState('')
  const [codeFilter, setCodeFilter] = useState<string>('all')
  const deferredSearchQuery = useDeferredValue(searchQuery)

  const sortedIssues = useMemo(() => sortCurriculumIssues(issues), [issues])
  const errorCount = useMemo(() => sortedIssues.filter((issue) => issue.severity === 'error').length, [sortedIssues])
  const warningCount = useMemo(() => sortedIssues.filter((issue) => issue.severity === 'warning').length, [sortedIssues])

  const availableCodes = useMemo(() => {
    const codes = new Set<string>()
    for (const issue of sortedIssues) {
      codes.add(issue.code)
    }
    return Array.from(codes.values()).sort()
  }, [sortedIssues])

  const filtered = useMemo(() => {
    const query = deferredSearchQuery.trim().toLowerCase()

    return sortedIssues.filter((issue) => {
      if (codeFilter !== 'all' && issue.code !== codeFilter) {
        return false
      }

      if (query.length === 0) {
        return true
      }

      const haystack = `${issue.code} ${issue.nodeId ?? ''} ${issue.relatedId ?? ''} ${issue.message}`.toLowerCase()
      return haystack.includes(query)
    })
  }, [codeFilter, deferredSearchQuery, sortedIssues])

  return (
    <section>
      <h1>데이터 검증</h1>
      <p className="muted" style={{ marginBottom: 16 }}>
        커리큘럼 데이터의 구조 이슈를 확인합니다. 이슈를 클릭하면 그래프가 해당 노드를 포커스합니다.
      </p>

      {loading ? <p>Loading…</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {!loading && !error && errorCount > 0 ? (
        <p className="error">
          데이터 수정 필요: error {errorCount}개가 발견되었습니다. 수정 후 다시 확인하세요.
        </p>
      ) : null}

      <div className="health-grid">
        <div className="health-graph">
          <h2>그래프</h2>
          <div className="graph-canvas">
            <CurriculumGraphView
              nodes={data?.nodes ?? null}
              focusNodeId={focusNodeId}
              onNodeClick={(nodeId) => setFocusNodeId(nodeId)}
            />
          </div>
        </div>

        <div className="health-report">
          <h2>리포트</h2>
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
                errors: {errorCount} · warnings: {warningCount} · issues: {filtered.length} / {sortedIssues.length}
              </span>
            </div>
          </div>

          {sortedIssues.length === 0 && !loading && !error ? (
            <p className="health-success">모든 검증을 통과했습니다.</p>
          ) : null}

          {filtered.length > 0 ? (
            <div className="health-table-wrap">
              <table className="health-table">
                <thead>
                  <tr>
                    <th>Severity</th>
                    <th>Code</th>
                    <th>Node</th>
                    <th>Related</th>
                    <th>Message</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((issue, index) => {
                    const focusId = resolveIssueFocusId(issue)
                    const clickable = Boolean(focusId)
                    const isFocused = focusId !== null && focusId === focusNodeId

                    return (
                      <tr
                        key={`${issue.code}:${issue.nodeId ?? ''}:${issue.relatedId ?? ''}:${index}`}
                        className={[
                          'health-row',
                          clickable ? 'clickable' : '',
                          isFocused ? 'focused' : ''
                        ].join(' ')}
                        onClick={() => {
                          if (!focusId) return
                          setFocusNodeId(focusId)
                        }}
                      >
                        <td>{issue.severity}</td>
                        <td>{issue.code}</td>
                        <td className="mono">{issue.nodeId ?? '-'}</td>
                        <td className="mono">{issue.relatedId ?? '-'}</td>
                        <td>{issue.message}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}
