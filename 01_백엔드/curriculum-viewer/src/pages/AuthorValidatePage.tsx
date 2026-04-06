import { useEffect, useMemo, useState } from 'react'
import SkillGraphPreview from '../components/SkillGraphPreview'
import { useAuth } from '../lib/auth/AuthProvider'
import { useRepositories } from '../lib/repository/RepositoryProvider'
import { SKILL_GRAPH_DRAFT_UPDATED_EVENT } from '../lib/repository/graphRepository'
import { getAuthorActiveGraphId } from '../lib/skillGraph/authorState'
import { validateSkillGraphV1Rules } from '../lib/skillGraph/validate'

export default function AuthorValidatePage() {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const { graphRepository } = useRepositories()

  const [focusNodeId, setFocusNodeId] = useState<string | null>(null)

  const [draftRevision, setDraftRevision] = useState(0)

  const graphId = getAuthorActiveGraphId()
  const draft = useMemo(() => {
    if (!userId || !graphId) return null
    return graphRepository.loadDraft({ userId, graphId })?.draft ?? null
  }, [draftRevision, graphId, graphRepository, userId])

  useEffect(() => {
    if (!userId || !graphId) return

    const handler = (event: Event) => {
      if (!(event instanceof CustomEvent)) return
      const detail = event.detail
      if (!detail || typeof detail !== 'object') return
      const nextUserId = (detail as { userId?: unknown }).userId
      const nextGraphId = (detail as { graphId?: unknown }).graphId
      if (nextUserId !== userId) return
      if (nextGraphId !== graphId) return
      setDraftRevision((prev) => prev + 1)
    }

    window.addEventListener(SKILL_GRAPH_DRAFT_UPDATED_EVENT, handler)
    return () => window.removeEventListener(SKILL_GRAPH_DRAFT_UPDATED_EVENT, handler)
  }, [graphId, userId])

  const issues = useMemo(() => (draft ? validateSkillGraphV1Rules(draft) : []), [draft])
  const errorCount = issues.filter((issue) => issue.level === 'error').length
  const warnCount = issues.filter((issue) => issue.level === 'warn').length

  return (
    <section>
      <h1>Author Validate</h1>
      <p className="muted">Draft를 대상으로 Validation v1 규칙을 실행하고 리포트를 표시합니다.</p>

      {!userId ? <p className="error">로그인이 필요합니다.</p> : null}
      {userId && !graphId ? (
        <p className="muted">먼저 Import에서 그래프를 로드하세요.</p>
      ) : null}
      {userId && graphId && !draft ? (
        <p className="muted">Draft를 찾을 수 없습니다. Import에서 다시 로드하세요.</p>
      ) : null}

      {draft ? (
        <>
          <div className="node-actions">
            <span className="badge badge-ok">errors: {errorCount}</span>
            <span className="badge badge-warn">warns: {warnCount}</span>
          </div>

          <h2>Issues</h2>
          {issues.length === 0 ? (
            <p className="muted">No issues found.</p>
          ) : (
            <ul>
              {issues.map((issue, index) => (
                <li key={`${issue.code}:${issue.nodeId ?? 'na'}:${index}`}>
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => {
                      if (issue.nodeId) setFocusNodeId(issue.nodeId)
                    }}
                  >
                    [{issue.level}] {issue.code}
                    {issue.nodeId ? ` (${issue.nodeId})` : ''} — {issue.message}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <h2>Preview</h2>
          <SkillGraphPreview graph={draft} focusNodeId={focusNodeId} />
        </>
      ) : null}
    </section>
  )
}
