import { Link, useLocation } from 'react-router-dom'
import { ROUTES } from '../routes'

export default function V2UnavailablePage() {
  const location = useLocation()

  return (
    <section>
      <h1>안내</h1>
      <p className="muted mono">{location.pathname}</p>
      <p>이 페이지는 v1에서 제공하지 않습니다. (v2 범위)</p>
      <div className="node-actions">
        <Link to={ROUTES.dashboard} className="button button-ghost">
          트리로 이동
        </Link>
        <Link to={ROUTES.map} className="button button-ghost">
          그래프로 이동
        </Link>
        <Link to={ROUTES.report} className="button button-ghost">
          리포트로 이동
        </Link>
      </div>
    </section>
  )
}

