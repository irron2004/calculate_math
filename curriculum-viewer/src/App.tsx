import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import RequireAuth from './components/RequireAuth'
import { AuthProvider } from './lib/auth/AuthProvider'
import { CurriculumProvider } from './lib/curriculum/CurriculumProvider'
import ExplorerPage from './pages/ExplorerPage'
import GraphPage from './pages/GraphPage'
import HealthPage from './pages/HealthPage'
import LearnPage from './pages/LearnPage'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import { ROUTE_SEGMENTS, ROUTES } from './routes'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CurriculumProvider>
          <Routes>
            <Route path={ROUTES.login} element={<LoginPage />} />
            <Route path={ROUTES.signup} element={<SignupPage />} />
            <Route path={ROUTES.root} element={<AppLayout />}>
              <Route index element={<Navigate to={ROUTES.tree} replace />} />
              <Route
                path={ROUTE_SEGMENTS.tree}
                element={
                  <RequireAuth>
                    <ExplorerPage />
                  </RequireAuth>
                }
              />
              <Route
                path={`${ROUTE_SEGMENTS.learn}/:nodeId`}
                element={
                  <RequireAuth>
                    <LearnPage />
                  </RequireAuth>
                }
              />
              <Route path={ROUTE_SEGMENTS.graph} element={<GraphPage />} />
              <Route path={ROUTE_SEGMENTS.health} element={<HealthPage />} />
              <Route path="*" element={<Navigate to={ROUTES.tree} replace />} />
            </Route>
          </Routes>
        </CurriculumProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
