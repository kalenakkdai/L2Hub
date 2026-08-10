import { Route, Routes } from 'react-router-dom'
import { HomeRedirect } from './components/HomeRedirect'
import { RequireAuth } from './components/RequireAuth'
import { UsersPage } from './features/admin/users/UsersPage'
import {
  AttendancePage,
  WhereaboutsMapPage,
} from './features/attendance'
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
import {
  ClassOfficersGate,
  ClassOfficersHomeRedirect,
  ClassOfficersLayout,
  ClassOfficersLegacyRedirect,
  ClassOfficersOverviewPage,
  FundraiserPage,
  HomecomingPage,
  MockClassOfficersDataProvider,
} from './features/class-officers'
import {
  NoteTakerLayout,
  NoteTakerListPage,
  NoteTakerNewPage,
  NoteTakerSessionPage,
} from './features/note-taker'
import {
  MessengerAgendaLayout,
  MessengerAgendaListPage,
  MessengerAgendaSessionPage,
} from './features/messenger-agenda'
import { InboxPage } from './features/work/InboxPage'
import { L2BoardPage } from './features/work/L2BoardPage'
import { OwlRewardsPage } from './features/owl/OwlRewardsPage'
import { RequestsPage } from './features/work/RequestsPage'
import { DashboardPage } from './pages/DashboardPage'
import { CommitteeDetailPage } from './features/committees/CommitteeDetailPage'
import { CommitteesPage } from './features/committees/CommitteesPage'
import { DevHealthPage } from './pages/DevHealthPage'
import { LoginPage } from './pages/LoginPage'
import { SignUpPage } from './pages/SignUpPage'
import { ToolsPage } from './pages/ToolsPage'
import { PhotographerUploadPage } from './features/photographer/PhotographerUploadPage'
import { MySettings } from './pages/settings/MySettings'
import { CampsiteSettings } from './pages/settings/CampsiteSettings'
import {
  AssignmentRequestsPage,
  CommitteeGradeEntryPage,
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
  // Dev default: Jan/Jadon operator — full control.
  'gradebook.assign',
  'gradebook.grade',
  'gradebook.grade_committee',
  'gradebook.request_assignment',
  'gradebook.publish',
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

const classOfficersDataProvider = new MockClassOfficersDataProvider()

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
      <Route path="/photographer" element={<PhotographerUploadPage />} />
      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <DashboardPage />
          </RequireAuth>
        }
      />
      <Route
        path="/board"
        element={
          <RequireAuth>
            <L2BoardPage />
          </RequireAuth>
        }
      />
      <Route
        path="/owl"
        element={
          <RequireAuth>
            <GradebookProvider
              dataProvider={gradebookDataProvider}
              commandProvider={gradebookCommandProvider}
              authProvider={gradebookAuthProvider}
            >
              <OwlRewardsPage />
            </GradebookProvider>
          </RequireAuth>
        }
      />
      <Route
        path="/requests"
        element={
          <RequireAuth>
            <RequestsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/inbox"
        element={
          <RequireAuth>
            <InboxPage />
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
        path="/attendance"
        element={
          <RequireAuth>
            <AttendancePage />
          </RequireAuth>
        }
      />
      <Route
        path="/whereabouts"
        element={
          <RequireAuth>
            <WhereaboutsMapPage />
          </RequireAuth>
        }
      />
      <Route
        path="/settings"
        element={
          <RequireAuth>
            <MySettings />
          </RequireAuth>
        }
      />
      <Route
        path="/settings/campsite"
        element={
          <RequireAuth>
            <CampsiteSettings />
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
        path="/class-officers"
        element={
          <RequireAuth>
            <ClassOfficersGate dataProvider={classOfficersDataProvider} />
          </RequireAuth>
        }
      >
        <Route index element={<ClassOfficersHomeRedirect />} />
        <Route
          path="fundraiser"
          element={<ClassOfficersLegacyRedirect section="fundraiser" />}
        />
        <Route
          path="homecoming"
          element={<ClassOfficersLegacyRedirect section="homecoming" />}
        />
        <Route path=":cohort" element={<ClassOfficersLayout />}>
          <Route index element={<ClassOfficersOverviewPage />} />
          <Route path="fundraiser" element={<FundraiserPage />} />
          <Route path="homecoming" element={<HomecomingPage />} />
        </Route>
      </Route>
      <Route
        path="/tools"
        element={
          <RequireAuth>
            <ToolsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/note-taker"
        element={
          <RequireAuth>
            <NoteTakerLayout />
          </RequireAuth>
        }
      >
        <Route index element={<NoteTakerListPage />} />
        <Route path="new" element={<NoteTakerNewPage />} />
        <Route path=":sessionId" element={<NoteTakerSessionPage />} />
      </Route>
      <Route
        path="/messenger-agenda"
        element={
          <RequireAuth>
            <MessengerAgendaLayout />
          </RequireAuth>
        }
      >
        <Route index element={<MessengerAgendaListPage />} />
        <Route path=":sessionId" element={<MessengerAgendaSessionPage />} />
      </Route>
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
        <Route path="/grades/requests" element={<AssignmentRequestsPage />} />
        <Route path="/grades/committee" element={<CommitteeGradeEntryPage />} />
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
