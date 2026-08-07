import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { HomePage } from './pages/HomePage'
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

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route
          element={
            <GradebookProvider
              dataProvider={gradebookDataProvider}
              commandProvider={gradebookCommandProvider}
              authProvider={gradebookAuthProvider}
            >
              <GradesLayout />
            </GradebookProvider>
          }
        >
          <Route path="/grades" element={<GradesPage />} />
          <Route
            path="/grades/events/:eventId"
            element={<EventGradebookPage />}
          />
          <Route
            path="/grades/students/:studentId"
            element={<StudentGradebookPage />}
          />
          <Route
            path="/grades/:assignmentId"
            element={<GradeAssignmentPage />}
          />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
