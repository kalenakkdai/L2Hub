# Grades feature (L2 Hub)

This folder is a self-contained **Grades / Gradebook** experience inspired by Gradescope’s dense assignment UX — not a clone of Gradescope branding.

It tracks Leadership 2 work such as:

- event debrief submissions (for example `Maze Day - Debrief Submission`)
- reflections, attendance, tasks, and committee deliverables

The UI displays authoritative scores and statuses. It does **not** invent grading policy.

## Why dependency injection?

A collaborator may use Supabase (or FastAPI later). Table names, auth, and RLS may change.

So Grades pages **never** call:

```ts
supabase.from("grades")
supabase.auth.getUser()
```

They talk only to a stable interface: `GradebookDataProvider`.

That is dependency injection: the page depends on an interface; the host app injects the implementation.

## What `GradebookDataProvider` is

```ts
interface GradebookDataProvider {
  getMyGradebook(filters?): Promise<GradebookOverview>
  getAssignment(assignmentId): Promise<GradeAssignmentDetail>
  getSubmissionHistory(assignmentId): Promise<SubmissionHistoryItem[]>
  getMySubmission(assignmentId): Promise<GradeSubmission | null>
  getEventGradebook?(eventId): Promise<EventGradebook>
  getStudentGradebook?(studentId): Promise<StudentGradebook>
}
```

Optional writes live on `GradebookCommandProvider`.
Permissions live on `GradebookAuthProvider` (`hasPermission(...)`).

## Providers included

| Provider | Purpose |
|----------|---------|
| `MockGradebookDataProvider` | Local UI + unit tests |
| `SupabaseGradebookDataProvider` | Optional adapter — maps DB rows → domain types |
| FastAPI adapter | Not implemented yet — add later as `FastApiGradebookDataProvider` |

## Supabase adapter (optional)

The adapter **requires an injected client**. It does not create one.

```ts
import { createClient } from '@supabase/supabase-js'
// Host app owns this — for example src/lib/supabase.ts
const existingSupabaseClient = createClient(url, key)

import {
  GradebookProvider,
  GradesPage,
  MockGradebookAuthProvider,
  SupabaseGradebookDataProvider,
} from '@/features/grades'

const provider = new SupabaseGradebookDataProvider(existingSupabaseClient, {
  assignmentsTable: 'assignments',
  gradeEntriesTable: 'gradebook_entries',
  submissionsTable: 'submissions',
  historyTable: 'submission_history',
})

<GradebookProvider
  dataProvider={provider}
  authProvider={new MockGradebookAuthProvider(['gradebook.view_own'])}
>
  <GradesPage />
</GradebookProvider>
```

Important:

- `existingSupabaseClient` is injected into the adapter.
- The Grades feature did not create it.
- That is dependency injection.

Expected row fields (snake_case) are documented in `api/supabaseGradebookAdapter.ts` via `mapSupabaseGradeEntry`. Coordinate real table names with your collaborator. This feature does **not** run destructive migrations.

## How to mount pages

Export page components and let the host router choose paths:

```tsx
<Route element={<GradesLayout />}>
  <Route path="/grades" element={<GradesPage />} />
  <Route path="/grades/:assignmentId" element={<GradeAssignmentPage />} />
  <Route path="/grades/events/:eventId" element={<EventGradebookPage />} />
  <Route path="/grades/students/:studentId" element={<StudentGradebookPage />} />
</Route>
```

In this repository, `App.tsx` wires mock providers for local development.

## Permissions (UX only)

| Permission | Typical use |
|------------|-------------|
| `gradebook.view_own` | Student Grades page |
| `gradebook.view_event` | Event roster gradebook |
| `gradebook.view_student` | Admin student view |
| `gradebook.grade` | Show score-entry controls (committee heads) |
| `gradebook.assign` | Configure assignments (Jan) |
| `gradebook.publish` | Release head-entered scores to students (Jan) |
| `gradebook.edit` | Legacy — unused; prefer `gradebook.grade` |
| `gradebook.mark_excused` | Mark excused |
| `debrief.reopen` | Reopen submission |

Frontend hiding is **not** security. Backend / RLS must enforce access.

## Assumptions still requiring coordination

1. Final Supabase table and column names
2. How debrief JSON is stored for submission content
3. Whether totals / completion percent are computed server-side
4. Anonymous-concern visibility rules per role
5. FastAPI gradebook endpoints when the backend catches up

## Local default

Until a real backend exists, L2 Hub uses `MockGradebookDataProvider` so the Grades UI is fully browsable and tested without Supabase.
