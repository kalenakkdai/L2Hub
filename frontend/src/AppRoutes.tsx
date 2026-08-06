import { Route, Routes } from 'react-router-dom'
import { HomeRedirect } from './components/HomeRedirect'
import { RequireAuth } from './components/RequireAuth'
import { DashboardPage } from './pages/DashboardPage'
import { DevHealthPage } from './pages/DevHealthPage'
import { LoginPage } from './pages/LoginPage'

/**
 * The route table, separated from App so tests can mount it inside a
 * MemoryRouter and exercise real navigation.
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <DashboardPage />
          </RequireAuth>
        }
      />
      {/* Unauthenticated on purpose — diagnostics must work when auth does not. */}
      <Route path="/dev/health" element={<DevHealthPage />} />
    </Routes>
  )
}
