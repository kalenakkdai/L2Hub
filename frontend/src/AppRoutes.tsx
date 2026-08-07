import { Route, Routes } from 'react-router-dom'
import { HomeRedirect } from './components/HomeRedirect'
import { RequireAuth } from './components/RequireAuth'
import { DashboardPage } from './pages/DashboardPage'
import { DevHealthPage } from './pages/DevHealthPage'
import { LoginPage } from './pages/LoginPage'
import {
  EventGradebookPage,
  GradeAssignmentPage,
  GradebookProvider,
  GradesLayout,
  GradesPage,
  MockGradebookAuthProvider,
  MockGradebookCommandProvider,
  MockGradebookDataProvider,
  StudentGradebookPage,
} from './features/grades'

const gradebookDataProvider = new MockGradebookDataProvider()
const gradebookCommandProvider = new MockGradebookCommandProvider(
  gradebookDataProvider,
)
const gradebookAuthProvider = new MockGradebookAuthProvider([
  'gradebook.view_own',
  'gradebook.view_event',
  'gradebook.view_student',
  'gradebook.edit',
  'gradebook.mark_excused',
  'debrief.reopen',
])

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
      <Route
        element={
          <RequireAuth>
            <GradebookProvider
              dataProvider={gradebookDataProvider}
              commandProvider={gradebookCommandProvider}
              authProvider={gradebookAuthProvider}
            >
              <GradesLayout />
            </GradebookProvider>
          </RequireAuth>
        }
      >
        <Route path="/grades" element={<GradesPage />} />
        <Route path="/grades/events/:eventId" element={<EventGradebookPage />} />
        <Route
          path="/grades/students/:studentId"
          element={<StudentGradebookPage />}
        />
        <Route
          path="/grades/:assignmentId"
          element={<GradeAssignmentPage />}
        />
      </Route>
      {/* Unauthenticated on purpose — diagnostics must work when auth does not. */}
      <Route path="/dev/health" element={<DevHealthPage />} />
    </Routes>
  )
}
