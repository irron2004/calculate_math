import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth/AuthProvider'
import { ROUTES } from '../routes'

export default function AuthorHomePage() {
  const { mode, setMode } = useAuth()
  const navigate = useNavigate()

  return (
    <section>
      <h1>관리자 모드</h1>
      <p className="muted">그래프 편집/검증/배포를 위한 관리자 전용 영역입니다.</p>

      <dl className="detail-dl">
        <dt>current</dt>
        <dd className="mono">{mode}</dd>
      </dl>

      <div className="node-actions">
        <button
          type="button"
          className="button button-primary"
          onClick={() => {
            setMode('author')
            navigate(ROUTES.authorEditor)
          }}
        >
          Preview로 이동
        </button>
        <Link to={ROUTES.authorValidate} className="button button-ghost">
          Validate
        </Link>
        <Link to={ROUTES.authorImport} className="button button-ghost">
          Import
        </Link>
        <Link to={ROUTES.authorMiniFlow} className="button button-ghost">
          Mini
        </Link>
        <Link to={ROUTES.authorResearchGraph} className="button button-ghost">
          Research
        </Link>
        <Link to={ROUTES.authorPublish} className="button button-ghost">
          Publish
        </Link>
      </div>
    </section>
  )
}
