import { Route, Routes } from 'react-router-dom'
import { HomeRedirect } from './components/HomeRedirect'
import { RequireAuth } from './components/RequireAuth'
import { UsersPage } from './features/admin/users/UsersPage'
import {
  AgendaPage,
  DebriefsPage,
  EventSummaryPage,
  EventsPage,
  GenerationTheaterPage,
  LiveBubblesPage,
  WrappedPage,
} from './features/event-summary'
import {
  EventPlanDetailPage,
  EventPlanningPage,
  EventPlanningProvider,
  MockEventPlanningAuthProvider,
  MockEventPlanningDataProvider,
} from './features/event-planning'
import { DashboardPage } from './pages/DashboardPage'
import { CommitteeDetailPage } from './features/committees/CommitteeDetailPage'
import { CommitteesPage } from './features/committees/CommitteesPage'
import { DevHealthPage } from './pages/DevHealthPage'
import { LoginPage } from './pages/LoginPage'
import { SignUpPage } from './pages/SignUpPage'
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

const eventPlanningDataProvider = new MockEventPlanningDataProvider()
const eventPlanningAuthProvider = new MockEventPlanningAuthProvider([
  'planning.view',
  'planning.create',
  'planning.assign',
  'planning.enable',
  'feedback.view_anonymous',
  'knowledge.view',
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
      <Route path="/signup" element={<SignUpPage />} />
      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <DashboardPage />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/users"
        element={
          <RequireAuth>
            <UsersPage />
          </RequireAuth>
        }
      />
      <Route
        path="/committees"
        element={
          <RequireAuth>
            <CommitteesPage />
          </RequireAuth>
        }
      />
      <Route
        path="/committees/:committeeId"
        element={
          <RequireAuth>
            <CommitteeDetailPage />
          </RequireAuth>
        }
      />
      <Route
        path="/events"
        element={
          <RequireAuth>
            <EventsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/debriefs"
        element={
          <RequireAuth>
            <DebriefsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/event-planning"
        element={
          <RequireAuth>
            <EventPlanningProvider
              dataProvider={eventPlanningDataProvider}
              authProvider={eventPlanningAuthProvider}
            >
              <EventPlanningPage />
            </EventPlanningProvider>
          </RequireAuth>
        }
      />
      <Route
        path="/event-planning/:planId"
        element={
          <RequireAuth>
            <EventPlanningProvider
              dataProvider={eventPlanningDataProvider}
              authProvider={eventPlanningAuthProvider}
            >
              <EventPlanDetailPage />
            </EventPlanningProvider>
          </RequireAuth>
        }
      />
      <Route
        path="/events/:eventId/summary"
        element={
          <RequireAuth>
            <EventSummaryPage />
          </RequireAuth>
        }
      />
      <Route
        path="/events/:eventId/summary/generating"
        element={
          <RequireAuth>
            <GenerationTheaterPage />
          </RequireAuth>
        }
      />
      <Route
        path="/events/:eventId/wrapped"
        element={
          <RequireAuth>
            <WrappedPage />
          </RequireAuth>
        }
      />
      <Route
        path="/events/:eventId/agenda"
        element={
          <RequireAuth>
            <AgendaPage />
          </RequireAuth>
        }
      />
      <Route
        path="/events/:eventId/live"
        element={
          <RequireAuth>
            <LiveBubblesPage />
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
