import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import ErrorBoundary from './components/ErrorBoundary'
import RequireAuth from './components/RequireAuth'
import RequireAuthor from './components/RequireAuthor'
import AuthorLayout from './components/AuthorLayout'
import { ToastProvider } from './components/Toast'
import { AuthProvider } from './lib/auth/AuthProvider'
import { CurriculumProvider } from './lib/curriculum/CurriculumProvider'
import { RepositoryProvider } from './lib/repository/RepositoryProvider'
import DashboardPage from './pages/DashboardPage'
import EvalPage from './pages/EvalPage'
import ExplorerPage from './pages/ExplorerPage'
import GraphPage from './pages/GraphPage'
import HealthPage from './pages/HealthPage'
import HomeworkSubmitPage from './pages/HomeworkSubmitPage'
import LearnPage from './pages/LearnPage'
import LoginPage from './pages/LoginPage'
import MyPage from './pages/MyPage'
import StudentReportPage from './pages/StudentReportPage'
import AuthorHomePage from './pages/AuthorHomePage'
import AuthorEditorPage from './pages/AuthorEditorPage'
import AuthorHomeworkPage from './pages/AuthorHomeworkPage'
import AuthorMiniFlowPage from './pages/AuthorMiniFlowPage'
import AuthorPublishPage from './pages/AuthorPublishPage'
import AuthorResearchGraphPage from './pages/AuthorResearchGraphPage'
import AuthorValidatePage from './pages/AuthorValidatePage'
import SkillGraphImportPage from './pages/SkillGraphImportPage'
import SignupPage from './pages/SignupPage'
import StudentPreviewPage from './pages/StudentPreviewPage'
import { ROUTE_SEGMENTS, ROUTES } from './routes'

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <BrowserRouter>
          <AuthProvider>
            <RepositoryProvider>
              <CurriculumProvider>
                <Routes>
              <Route path={ROUTES.login} element={<LoginPage />} />
              <Route path={ROUTES.signup} element={<SignupPage />} />
              <Route
                path={ROUTES.author}
                element={
                  <RequireAuthor>
                    <AuthorLayout />
                  </RequireAuthor>
                }
              >
                <Route index element={<AuthorHomePage />} />
                <Route path={ROUTE_SEGMENTS.authorEditor} element={<AuthorEditorPage />} />
                <Route path={ROUTE_SEGMENTS.authorResearchGraph} element={<AuthorResearchGraphPage />} />
                <Route path={ROUTE_SEGMENTS.authorValidate} element={<AuthorValidatePage />} />
                <Route path={ROUTE_SEGMENTS.authorImport} element={<SkillGraphImportPage />} />
                <Route path={ROUTE_SEGMENTS.authorMiniFlow} element={<AuthorMiniFlowPage />} />
                <Route path={ROUTE_SEGMENTS.authorPublish} element={<AuthorPublishPage />} />
                <Route path={ROUTE_SEGMENTS.authorHealth} element={<HealthPage />} />
                <Route path={ROUTE_SEGMENTS.authorHomework} element={<AuthorHomeworkPage />} />
                <Route path="*" element={<Navigate to={ROUTES.authorEditor} replace />} />
              </Route>
              <Route path={ROUTES.root} element={<AppLayout />}>
                <Route index element={<Navigate to={ROUTES.dashboard} replace />} />
                <Route
                  path={ROUTE_SEGMENTS.dashboard}
                  element={
                    <RequireAuth>
                      <DashboardPage />
                    </RequireAuth>
                  }
                />
                <Route
                  path={ROUTE_SEGMENTS.graph}
                  element={
                    <RequireAuth>
                      <GraphPage />
                    </RequireAuth>
                  }
                />
                <Route
                  path={ROUTE_SEGMENTS.map}
                  element={
                    <RequireAuth>
                      <GraphPage />
                    </RequireAuth>
                  }
                />
                <Route
                  path={ROUTE_SEGMENTS.tree}
                  element={
                    <RequireAuth>
                      <ExplorerPage />
                    </RequireAuth>
                  }
                />
                <Route
                  path={ROUTE_SEGMENTS.report}
                  element={
                    <RequireAuth>
                      <StudentReportPage />
                    </RequireAuth>
                  }
                />
                <Route
                  path={ROUTE_SEGMENTS.preview}
                  element={
                    <RequireAuth>
                      <StudentPreviewPage />
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
                <Route
                  path={`${ROUTE_SEGMENTS.eval}/:sessionId`}
                  element={
                    <RequireAuth>
                      <EvalPage />
                    </RequireAuth>
                  }
                />
                <Route
                  path={ROUTE_SEGMENTS.health}
                  element={
                    <RequireAuth>
                      <HealthPage />
                    </RequireAuth>
                  }
                />
                <Route
                  path={ROUTE_SEGMENTS.mypage}
                  element={
                    <RequireAuth>
                      <MyPage />
                    </RequireAuth>
                  }
                />
                <Route
                  path={`${ROUTE_SEGMENTS.mypage}/${ROUTE_SEGMENTS.homework}/:id`}
                  element={
                    <RequireAuth>
                      <HomeworkSubmitPage />
                    </RequireAuth>
                  }
                />
                <Route path="*" element={<Navigate to={ROUTES.dashboard} replace />} />
              </Route>
                </Routes>
              </CurriculumProvider>
            </RepositoryProvider>
          </AuthProvider>
        </BrowserRouter>
      </ToastProvider>
    </ErrorBoundary>
  )
}
