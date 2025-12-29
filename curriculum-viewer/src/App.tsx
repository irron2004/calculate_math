import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import ExplorerPage from './pages/ExplorerPage'
import GraphPage from './pages/GraphPage'
import HealthPage from './pages/HealthPage'
import { ROUTE_SEGMENTS, ROUTES } from './routes'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path={ROUTES.root} element={<AppLayout />}>
          <Route index element={<Navigate to={ROUTES.tree} replace />} />
          <Route path={ROUTE_SEGMENTS.tree} element={<ExplorerPage />} />
          <Route path={ROUTE_SEGMENTS.graph} element={<GraphPage />} />
          <Route path={ROUTE_SEGMENTS.health} element={<HealthPage />} />
          <Route path="*" element={<Navigate to={ROUTES.tree} replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
