import { type ReactNode, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth/AuthProvider'
import { useFocusNodeId } from '../lib/routing/useFocusNodeId'
import { ROUTES } from '../routes'

export type DetailPanelContext = {
  setDetail: (detail: ReactNode) => void
}

export default function AppLayout() {
  const { isAuthenticated, isAdmin, user, logout, setMode } = useAuth()
  const navigate = useNavigate()
  const { focusNodeId } = useFocusNodeId()

  const focusQuery = focusNodeId ? `?focus=${encodeURIComponent(focusNodeId)}` : ''

  const userLabel = user
    ? user.name && user.name !== user.id
      ? `${user.name} (${user.id})`
      : user.id
    : null

  const [detail, setDetail] = useState<ReactNode>(
    <p>노드를 선택하면 상세가 표시됩니다.</p>
  )

  const outletContext: DetailPanelContext = { setDetail }

  return (
    <div className="app">
      <header className="app-header">
        <nav aria-label="Primary">
          <ul className="app-nav">
            <li>
              <NavLink to={ROUTES.dashboard} end>
                대시보드
              </NavLink>
            </li>
            <li>
              <NavLink to={`${ROUTES.map}${focusQuery}`}>지도</NavLink>
            </li>
            <li>
              <NavLink to={ROUTES.report}>리포트</NavLink>
            </li>
            <li>
              <NavLink to={ROUTES.preview}>프리뷰</NavLink>
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
      <main className="app-main">
        <div className="app-content">
          <Outlet context={outletContext} />
        </div>
        <aside className="app-detail" aria-label="Detail panel">
          {detail}
        </aside>
      </main>
    </div>
  )
}
