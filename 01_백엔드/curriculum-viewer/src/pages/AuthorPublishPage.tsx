import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import SkillGraphPreview from '../components/SkillGraphPreview'
import { useAuth } from '../lib/auth/AuthProvider'
import { useRepositories } from '../lib/repository/RepositoryProvider'
import { getAuthorActiveGraphId } from '../lib/skillGraph/authorState'
import { ROUTES } from '../routes'

export default function AuthorPublishPage() {
  const { user, setMode } = useAuth()
  const userId = user?.id ?? null
  const { graphRepository } = useRepositories()
  const navigate = useNavigate()

  const graphId = useMemo(() => getAuthorActiveGraphId(), [])
  const draft = useMemo(() => {
    if (!userId || !graphId) return null
    return graphRepository.loadDraft({ userId, graphId })?.draft ?? null
  }, [graphId, graphRepository, userId])

  const [message, setMessage] = useState<string | null>(null)
  const published = graphRepository.loadStudentGraph()

  return (
    <section>
      <h1>Author Publish</h1>
      <p className="muted">
        Publish를 누르면 동일 런타임 세션에서 Student 화면이 최신 Published를 로드합니다.
      </p>

      {!userId ? <p className="error">로그인이 필요합니다.</p> : null}
      {userId && !graphId ? <p className="muted">먼저 Import에서 그래프를 로드하세요.</p> : null}
      {userId && graphId && !draft ? <p className="muted">Draft를 찾을 수 없습니다.</p> : null}

      <div className="node-actions">
        <button
          type="button"
          className="button button-primary"
          disabled={!userId || !graphId || !draft}
          onClick={() => {
            if (!userId || !graphId) return
            const snapshot = graphRepository.publishDraft({
              userId,
              graphId,
              now: new Date().toISOString(),
              setActive: true
            })
            setMessage(snapshot ? `Published: ${snapshot.publishedAt}` : 'Publish failed')
          }}
        >
          Publish
        </button>
        <button
          type="button"
          className="button button-ghost"
          onClick={() => {
            setMode('student')
            navigate(ROUTES.preview, { replace: true })
          }}
        >
          Student Preview
        </button>
      </div>

      {message ? <p className="muted">{message}</p> : null}

      {published ? (
        <>
          <h2>Active Published</h2>
          <p className="muted">
            <span className="mono">{published.graphId}</span> · {published.graph.title}
          </p>
          <SkillGraphPreview graph={published.graph} />
        </>
      ) : (
        <p className="muted">No published snapshot yet.</p>
      )}
    </section>
  )
}
