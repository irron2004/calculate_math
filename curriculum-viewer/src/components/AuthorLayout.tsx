import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth/AuthProvider'
import { ROUTES } from '../routes'

export default function AuthorLayout() {
  const { user, logout, setMode } = useAuth()
  const navigate = useNavigate()

  const userLabel = user
    ? user.name && user.name !== user.username
      ? `${user.name} (${user.username})`
      : user.username
    : null

  return (
    <div className="app">
      <header className="app-header">
        <nav aria-label="Author">
          <ul className="app-nav">
            <li>
              <NavLink to={ROUTES.author} end>
                Home
              </NavLink>
            </li>
            <li>
              <NavLink to={ROUTES.authorEditor} end>
                Preview
              </NavLink>
            </li>
            <li>
              <NavLink to={ROUTES.authorResearchGraph}>Research</NavLink>
            </li>
            <li>
              <NavLink to={ROUTES.authorImport}>Import</NavLink>
            </li>
            <li>
              <NavLink to={ROUTES.authorMiniFlow}>Mini</NavLink>
            </li>
            <li>
              <NavLink to={ROUTES.authorValidate}>Validate</NavLink>
            </li>
            <li>
              <NavLink to={ROUTES.authorPublish}>Publish</NavLink>
            </li>
            <li>
              <NavLink to={ROUTES.authorHealth}>Health</NavLink>
            </li>
            <li>
              <NavLink to={ROUTES.authorStudents}>계정 현황</NavLink>
            </li>
            <li>
              <NavLink to={ROUTES.authorHomework}>숙제</NavLink>
            </li>
            <li>
              <NavLink to={ROUTES.authorHomeworkStatus}>숙제 현황</NavLink>
            </li>
          </ul>
        </nav>
        <div className="app-auth">
          {userLabel ? <span className="app-auth-user">{userLabel}</span> : null}
          <button
            type="button"
            className="button button-ghost"
            onClick={() => {
              setMode('student')
              navigate(ROUTES.dashboard, { replace: true })
            }}
          >
            Student 모드
          </button>
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
        </div>
      </header>
      <main className="app-main author-main">
        <div className="app-content">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
