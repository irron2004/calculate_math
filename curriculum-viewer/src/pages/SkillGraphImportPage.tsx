import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { parseSkillGraphV1, type SkillGraphIssue } from '../lib/skillGraph/schema'
import { normalizeSkillGraphSchemaError } from '../lib/skillGraph/normalize'
import { useAuth } from '../lib/auth/AuthProvider'
import { useRepositories } from '../lib/repository/RepositoryProvider'
import { setAuthorActiveGraphId } from '../lib/skillGraph/authorState'
import SkillGraphPreview from '../components/SkillGraphPreview'
import validFixture from '../lib/skillGraph/fixtures/skill_graph_valid.v1.json'
import { ROUTES } from '../routes'

type ImportResult =
  | { status: 'idle' }
  | { status: 'success'; graphId: string; title: string }
  | { status: 'error'; message: string; issues?: SkillGraphIssue[] }

function formatIssues(issues: SkillGraphIssue[]): string {
  const top = issues.slice(0, 20).map((issue) => `- [${issue.code}] ${issue.path} — ${issue.message}`)
  const more = issues.length > top.length ? `\n... and ${issues.length - top.length} more` : ''
  return `${top.join('\n')}${more}`
}

export default function SkillGraphImportPage() {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const { graphRepository } = useRepositories()

  const [raw, setRaw] = useState('')
  const [result, setResult] = useState<ImportResult>({ status: 'idle' })
  const [previewGraphId, setPreviewGraphId] = useState<string | null>(null)

  const canImport = useMemo(() => raw.trim().length > 0, [raw])
  const draftStore = useMemo(() => {
    if (!userId || !previewGraphId) return null
    return graphRepository.loadDraft({ userId, graphId: previewGraphId })
  }, [graphRepository, previewGraphId, userId])

  return (
    <section>
      <h1>Skill-Graph Import</h1>
      <p className="muted">
        JSON을 붙여넣고 Import를 누르면 스키마 검증 후 Draft로 저장됩니다. 성공 시 Preview/Validation/Publish로 이어집니다.
      </p>

      <label className="form-field">
        Graph JSON
        <textarea
          value={raw}
          onChange={(event) => setRaw(event.target.value)}
          placeholder='{"schemaVersion":"skill-graph-v1", ...}'
          rows={12}
          style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}
        />
      </label>

      <div className="node-actions">
        <button
          type="button"
          className="button button-ghost"
          onClick={() => {
            setRaw(JSON.stringify(validFixture, null, 2))
          }}
        >
          Load sample
        </button>
        <button
          type="button"
          className="button button-primary"
          disabled={!canImport}
          onClick={() => {
            setResult({ status: 'idle' })

            let parsedJson: unknown
            try {
              parsedJson = JSON.parse(raw)
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error)
              setResult({ status: 'error', message: `JSON parse error: ${message}` })
              return
            }

            try {
              const graph = parseSkillGraphV1(parsedJson)
              if (!userId) {
                setResult({ status: 'error', message: '로그인이 필요합니다.' })
                return
              }

              graphRepository.importGraph({ userId, graph, now: new Date().toISOString() })
              setAuthorActiveGraphId(graph.graphId)
              setPreviewGraphId(graph.graphId)
              setResult({ status: 'success', graphId: graph.graphId, title: graph.title })
            } catch (error) {
              const normalized = normalizeSkillGraphSchemaError(error)
              if (normalized) {
                setResult({
                  status: 'error',
                  message: normalized.message,
                  issues: normalized.issues
                })
                return
              }

              setResult({ status: 'error', message: error instanceof Error ? error.message : String(error) })
            }
          }}
        >
          Import
        </button>
      </div>

      {result.status === 'success' ? (
        <div>
          <p>
            <strong>Import OK</strong>
          </p>
          <dl className="detail-dl">
            <dt>graphId</dt>
            <dd className="mono">{result.graphId}</dd>
            <dt>title</dt>
            <dd>{result.title}</dd>
          </dl>

          <div className="node-actions">
            <Link to={ROUTES.authorEditor} className="button button-ghost">
              Preview
            </Link>
            <Link to={ROUTES.authorValidate} className="button button-ghost">
              Validation
            </Link>
            <Link to={ROUTES.authorPublish} className="button button-primary">
              Publish
            </Link>
          </div>
        </div>
      ) : null}

      {draftStore ? (
        <>
          <hr />
          <h2>Preview</h2>
          <p className="muted">현재 Draft를 기준으로 미리보기를 렌더합니다.</p>
          <SkillGraphPreview graph={draftStore.draft} />
        </>
      ) : null}

      {result.status === 'error' ? (
        <div>
          <p className="error">{result.message}</p>
          {result.issues && result.issues.length > 0 ? (
            <>
              <p className="muted">Issues (top 20):</p>
              <pre className="mono" style={{ whiteSpace: 'pre-wrap' }}>
                {formatIssues(result.issues)}
              </pre>
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
