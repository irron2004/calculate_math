import { type ReactNode, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ClipboardList, Home, Map as MapIcon } from 'lucide-react'
import { useAuth } from '../lib/auth/AuthProvider'
import { useFocusNodeId } from '../lib/routing/useFocusNodeId'
import { ROUTES } from '../routes'

export type DetailPanelContext = {
  setDetail: (detail: ReactNode) => void
}

export default function AppLayout() {
  const { isAuthenticated, isAdmin, user, logout, setMode } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { focusNodeId } = useFocusNodeId()

  const focusQuery = focusNodeId ? `?focus=${encodeURIComponent(focusNodeId)}` : ''

  const userLabel = user
    ? user.name && user.name !== user.username
      ? `${user.name} (${user.username})`
      : user.username
    : null

  const [detail, setDetail] = useState<ReactNode>(
    <p>노드를 선택하면 상세가 표시됩니다.</p>
  )

  const outletContext: DetailPanelContext = { setDetail }

  const showDetailPanel = useMemo(() => {
    const path = location.pathname
    return (
      path.startsWith(ROUTES.graph) ||
      path.startsWith(ROUTES.map) ||
      path.startsWith(ROUTES.tree) ||
      path.startsWith(ROUTES.learn) ||
      path.startsWith(ROUTES.report)
    )
  }, [location.pathname])

  return (
    <div className="app">
      <header className="app-header">
        <nav aria-label="Primary">
          <ul className="app-nav">
            <li>
              <NavLink to={ROUTES.dashboard} end>
                <Home aria-hidden="true" size={18} />
                <span>홈</span>
              </NavLink>
            </li>
            <li>
              <NavLink to={ROUTES.mypage}>
                <ClipboardList aria-hidden="true" size={18} />
                <span>숙제</span>
              </NavLink>
            </li>
            <li>
              <NavLink to={`${ROUTES.map}${focusQuery}`}>
                <MapIcon aria-hidden="true" size={18} />
                <span>지도</span>
                <span className="nav-badge" aria-label="Beta">
                  Beta
                </span>
              </NavLink>
            </li>
          </ul>
        </nav>

        <div className="app-auth">
          {isAuthenticated ? (
            <>
              <span className="app-auth-user">{userLabel}</span>
              {isAdmin ? (
                <button
                  type="button"
                  className="button button-ghost"
                  onClick={() => {
                    setMode('author')
                    navigate(ROUTES.authorImport)
                  }}
                >
                  관리자 모드
                </button>
              ) : null}
              <button
                type="button"
                className="button button-ghost"
                onClick={() => {
                  logout()
                  navigate(ROUTES.login, { replace: true })
                }}
              >
                로그아웃
              </button>
            </>
          ) : (
            <NavLink to={ROUTES.login} className="button button-ghost">
              로그인
            </NavLink>
          )}
        </div>
      </header>
      <main className={`app-main ${showDetailPanel ? 'app-main--with-detail' : 'app-main--single'}`}>
        <div className="app-content">
          <Outlet context={outletContext} />
        </div>
        {showDetailPanel ? (
          <aside className="app-detail" aria-label="Detail panel">
            {detail}
          </aside>
        ) : null}
      </main>
    </div>
  )
}
