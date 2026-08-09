import { describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GradesPage } from '../pages/GradesPage'
import { GradeAssignmentPage } from '../pages/GradeAssignmentPage'
import {
  MockGradebookAuthProvider,
  MockGradebookCommandProvider,
  MockGradebookDataProvider,
  createStudentOnlyAuthProvider,
} from '../api/mockGradebookAdapter'
import { mapSupabaseGradeEntry } from '../api/supabaseGradebookAdapter'
import { renderWithGradebook } from './test-utils'
import type { GradebookDataProvider } from '../api/contracts'
import type { GradebookEntry, GradebookOverview } from '../types'
import { formatScore } from '../utils/format'

async function openTab(name: 'Missing' | 'Completed' | 'Upcoming' | 'Syllabus') {
  const user = userEvent.setup()
  await user.click(await screen.findByRole('tab', { name: new RegExp(name) }))
  return user
}

describe('GradesPage', () => {
  it('renders Upcoming, Missing, Completed, and Syllabus tabs', async () => {
    renderWithGradebook(<GradesPage />)
    const upcoming = await screen.findByRole('tab', { name: /^Upcoming/ })
    expect(upcoming).toHaveAttribute('aria-selected', 'true')
    expect(upcoming).toHaveTextContent('2')
    expect(screen.getByRole('tab', { name: /^Missing/ })).toHaveTextContent(
      '1',
    )
    expect(screen.getByRole('tab', { name: /^Completed/ })).toHaveTextContent(
      '3',
    )
    expect(screen.getByRole('tab', { name: /^Syllabus$/ })).toBeInTheDocument()
  })

  it('opens the syllabus with attendance, levels, and site manual sections', async () => {
    renderWithGradebook(<GradesPage />)
    const user = await openTab('Syllabus')
    expect(
      await screen.findByRole('heading', { name: 'Leadership 2 syllabus' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('tab', { name: 'Attendance', selected: true }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Attendance policy/)).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Levels' }))
    expect(screen.getByText(/Class levels system/)).toBeInTheDocument()
    expect(screen.getByText(/get to level/i)).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Site manual' }))
    expect(screen.getByText(/L2 Hub site manual/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
      'href',
      '/dashboard',
    )
  })

  it('shows upcoming assignments on the default tab', async () => {
    renderWithGradebook(<GradesPage />)
    const panel = await screen.findByRole('tabpanel')
    expect(
      within(panel).getAllByText('Spring Formal Materials Checklist').length,
    ).toBeGreaterThan(0)
    expect(
      within(panel).getAllByText('Publicity Flyer Draft').length,
    ).toBeGreaterThan(0)
    expect(
      within(panel).queryByText('Maze Day - Debrief Submission'),
    ).not.toBeInTheDocument()
  })

  it('shows completed assignments on the Completed tab', async () => {
    renderWithGradebook(<GradesPage />)
    await openTab('Completed')
    expect(
      (await screen.findAllByText('Maze Day - Debrief Submission')).length,
    ).toBeGreaterThan(0)
    expect(
      screen.getAllByText('Leadership Reflection').length,
    ).toBeGreaterThan(0)
    expect(
      screen.getAllByText('Rally Night Attendance').length,
    ).toBeGreaterThan(0)
  })

  it('shows missing assignments on the Missing tab', async () => {
    renderWithGradebook(<GradesPage />)
    await openTab('Missing')
    expect(
      (await screen.findAllByText('Cabinet Meeting Response')).length,
    ).toBeGreaterThan(0)
  })

  it('shows Canvas-style weighted category totals', async () => {
    renderWithGradebook(<GradesPage />)
    expect(await screen.findByText('Weighted total')).toBeInTheDocument()
    expect(screen.getAllByText('71.9%').length).toBeGreaterThan(0)
    const categories = screen.getByRole('list', { name: 'Category weights' })
    expect(categories).toBeInTheDocument()
    expect(within(categories).getByText(/Event debriefs/)).toBeInTheDocument()
    expect(within(categories).getByText(/Reflections/)).toBeInTheDocument()
  })

  it('lets students enter theoretical grades and save them to the sidebar', async () => {
    window.localStorage.clear()
    const user = userEvent.setup()
    renderWithGradebook(<GradesPage />)

    expect(await screen.findByText('Theoretical grades')).toBeInTheDocument()
    expect(
      screen.getByRole('complementary', { name: 'Saved theoreticals' }),
    ).toBeInTheDocument()

    const springInput = await screen.findByTestId(
      'theoretical-score-entry-spring-materials',
    )
    await user.clear(springInput)
    await user.type(springInput, '10')

    await user.type(
      screen.getByLabelText('Save as'),
      'Full credit on Spring Formal',
    )
    await user.click(screen.getByTestId('save-theoretical'))

    expect(
      await screen.findByText('Full credit on Spring Formal'),
    ).toBeInTheDocument()
    const stored = JSON.parse(
      window.localStorage.getItem('l2hub.gradebook.theoreticals') ?? '[]',
    ) as Array<{ name: string; scores: Record<string, number> }>
    expect(stored).toHaveLength(1)
    expect(stored[0].name).toBe('Full credit on Spring Formal')
    expect(stored[0].scores['entry-spring-materials']).toBe(10)
  })

  it('renders score correctly', async () => {
    renderWithGradebook(<GradesPage />)
    await openTab('Completed')
    expect((await screen.findAllByText('10 / 10')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('7 / 10').length).toBeGreaterThan(0)
  })

  it('renders a late assignment score', async () => {
    renderWithGradebook(<GradesPage />)
    await openTab('Completed')
    expect(
      (await screen.findAllByText('Leadership Reflection')).length,
    ).toBeGreaterThan(0)
    expect(screen.getAllByText('7 / 10').length).toBeGreaterThan(0)
  })

  it('shows late due date only when present', async () => {
    renderWithGradebook(<GradesPage />)
    await openTab('Completed')
    const lateDue = await screen.findAllByText(/Late due/)
    expect(lateDue.length).toBeGreaterThan(0)
    expect(lateDue.length).toBeLessThanOrEqual(2)
  })

  it('does not show assignment status in the grade list', async () => {
    renderWithGradebook(<GradesPage />)
    await openTab('Completed')
    await screen.findAllByText('Maze Day - Debrief Submission')
    expect(screen.queryByText('Status')).not.toBeInTheDocument()
    expect(screen.queryByText('Graded')).not.toBeInTheDocument()
  })

  it('renders excused assignment without a status label', async () => {
    renderWithGradebook(<GradesPage />)
    await openTab('Completed')
    expect(
      (await screen.findAllByText('Rally Night Attendance')).length,
    ).toBeGreaterThan(0)
    expect(screen.queryByText('Excused')).not.toBeInTheDocument()
  })

  it('renders null score as dash / points possible', async () => {
    renderWithGradebook(<GradesPage />)
    expect((await screen.findAllByText('— / 10')).length).toBeGreaterThan(0)
    expect(formatScore(null, 10)).toBe('— / 10')
  })

  it('filters by search query within the active tab', async () => {
    const user = userEvent.setup()
    renderWithGradebook(<GradesPage />)
    await screen.findAllByText('Spring Formal Materials Checklist')
    const input = screen.getByLabelText('Search assignments')
    await user.clear(input)
    await user.type(input, 'Spring')
    await waitFor(() => {
      expect(
        screen.queryAllByText('Publicity Flyer Draft'),
      ).toHaveLength(0)
      expect(
        screen.getAllByText('Spring Formal Materials Checklist').length,
      ).toBeGreaterThan(0)
    })
  })

  it('renders due date', async () => {
    renderWithGradebook(<GradesPage />)
    await openTab('Completed')
    expect((await screen.findAllByText(/Aug/)).length).toBeGreaterThan(0)
  })

  it('changes ordering when sort changes', async () => {
    const user = userEvent.setup()
    renderWithGradebook(<GradesPage />)
    await openTab('Completed')
    await screen.findAllByText('Maze Day - Debrief Submission')
    await user.selectOptions(screen.getByLabelText('Sort assignments'), 'title')
    await waitFor(() => {
      const table = screen.getByRole('table')
      const links = within(table).getAllByRole('link')
      const titles = links
        .map((link) => link.textContent ?? '')
        .filter((text) => !text.includes('Open'))
      expect(titles[0]).toMatch(/Leadership Reflection/)
    })
  })

  it('assignment row navigates to detail href', async () => {
    renderWithGradebook(<GradesPage />)
    await openTab('Completed')
    const links = await screen.findAllByRole('link', {
      name: 'Maze Day - Debrief Submission',
    })
    expect(links[0]).toHaveAttribute('href', '/grades/asg-maze-debrief')
  })

  it('reveals mean, median, and a distribution bar under an assignment', async () => {
    const user = userEvent.setup()
    renderWithGradebook(<GradesPage />)
    await openTab('Completed')
    const buttons = await screen.findAllByRole('button', {
      name: 'Show grade distribution',
    })
    await user.click(buttons[0])
    expect(await screen.findByText('Mean')).toBeInTheDocument()
    expect(screen.getByText('Median')).toBeInTheDocument()
    expect(
      screen.getByLabelText(/Grade distribution for Maze Day/),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Hide grade distribution' }),
    ).toBeInTheDocument()
  })

  it('shows empty state when provider returns no entries', async () => {
    const emptyProvider: GradebookDataProvider = {
      async getMyGradebook() {
        return {
          entries: [],
          summary: {},
        } satisfies GradebookOverview
      },
      async getAssignment() {
        throw new Error('not found')
      },
      async getSubmissionHistory() {
        return []
      },
      async getMySubmission() {
        return null
      },
    }
    renderWithGradebook(<GradesPage />, { dataProvider: emptyProvider })
    expect(
      await screen.findByText('No gradebook assignments yet.'),
    ).toBeInTheDocument()
  })

  it('shows retry UI on provider error', async () => {
    const failing = new MockGradebookDataProvider({
      failOnGetMyGradebook: true,
      failMessage: 'Provider unavailable',
    })
    renderWithGradebook(<GradesPage />, { dataProvider: failing })
    expect(await screen.findByText('Provider unavailable')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('injecting a different provider changes rendered data without page-code changes', async () => {
    const customEntry: GradebookEntry = {
      id: 'custom-1',
      assignmentId: 'asg-custom',
      assignmentTitle: 'Injected Provider Assignment',
      assignmentType: 'task',
      status: 'submitted',
      score: 7,
      pointsPossible: 7,
      dueAt: '2026-09-01T00:00:00.000Z',
    }
    const customProvider = new MockGradebookDataProvider({
      entries: [customEntry],
    })
    renderWithGradebook(<GradesPage />, { dataProvider: customProvider })
    await openTab('Completed')
    expect(
      (await screen.findAllByText('Injected Provider Assignment')).length,
    ).toBeGreaterThan(0)
    expect(screen.getAllByText('7 / 7').length).toBeGreaterThan(0)
    expect(
      screen.queryByText('Maze Day - Debrief Submission'),
    ).not.toBeInTheDocument()
  })

  it('mobile layout preserves score visibility', async () => {
    renderWithGradebook(<GradesPage />)
    await openTab('Completed')
    const headings = await screen.findAllByText('Maze Day - Debrief Submission')
    const mobileHeading = headings.find((el) => el.closest('td'))
    expect(mobileHeading).toBeTruthy()
    const mobileCell = mobileHeading!.closest('td')!
    expect(within(mobileCell).getByText('10 / 10')).toBeInTheDocument()
  })

  it('renders a cumulative grade trend below the assignments', async () => {
    renderWithGradebook(<GradesPage />)
    await openTab('Completed')
    const table = await screen.findByRole('table')
    const trend = screen.getByRole('heading', { name: 'Grade trend' })
    expect(
      table.compareDocumentPosition(trend) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(screen.getByText('56.7%')).toBeInTheDocument()
    const colorKey = screen.getByRole('list', {
      name: 'Grade range color key',
    })
    expect(within(colorKey).getByText('A+')).toBeInTheDocument()
    expect(within(colorKey).getByText('A')).toBeInTheDocument()
    expect(within(colorKey).getByText('A−')).toBeInTheDocument()
    expect(within(colorKey).getByText('B–C')).toBeInTheDocument()
    expect(within(colorKey).getByText('Below C')).toBeInTheDocument()
  })
})

describe('GradeAssignmentPage', () => {
  it('loads provider assignment detail and summary rail score', async () => {
    renderWithGradebook(<GradeAssignmentPage />, {
      route: '/grades/asg-maze-debrief',
      path: '/grades/:assignmentId',
      authProvider: new MockGradebookAuthProvider([
        'gradebook.view_own',
        'gradebook.edit',
        'gradebook.mark_excused',
        'debrief.reopen',
      ]),
    })
    expect(
      await screen.findByRole('heading', {
        name: 'Maze Day - Debrief Submission',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getAllByLabelText('Assignment summary').length,
    ).toBeGreaterThan(0)
    expect(screen.getAllByText('10 / 10').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Kalena Dai').length).toBeGreaterThan(0)
  })

  it('renders submission history chronologically', async () => {
    renderWithGradebook(<GradeAssignmentPage />, {
      route: '/grades/asg-maze-debrief',
      path: '/grades/:assignmentId',
    })
    const heading = await screen.findByRole('heading', {
      name: 'Submission History',
    })
    const section = heading.closest('section')
    expect(section).toBeTruthy()
    const items = within(section!).getAllByRole('listitem')
    const labels = items.map((item) => {
      const title = item.querySelector('p.font-medium, p')
      return title?.textContent?.trim() ?? item.textContent?.trim() ?? ''
    })
    expect(labels).toEqual([
      'Draft created',
      'Draft auto-saved',
      'Submitted',
      'Grade recorded',
    ])
  })

  it('event debrief renderer shows ratings and strengths/improvements', async () => {
    renderWithGradebook(<GradeAssignmentPage />, {
      route: '/grades/asg-maze-debrief',
      path: '/grades/:assignmentId',
    })
    expect(
      await screen.findByText('Overall Event Rating'),
    ).toBeInTheDocument()
    expect(screen.getByText('Check-in lines moved quickly.')).toBeInTheDocument()
    expect(
      screen.getByText('Set up thirty minutes earlier.'),
    ).toBeInTheDocument()
    expect(screen.getByText('Community')).toBeInTheDocument()
  })

  it('shows the rubric breakdown including default On time', async () => {
    renderWithGradebook(<GradeAssignmentPage />, {
      route: '/grades/asg-maze-debrief',
      path: '/grades/:assignmentId',
    })
    expect(await screen.findByTestId('assignment-rubric')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Rubric' })).toBeInTheDocument()
    expect(screen.getAllByText('On time').length).toBeGreaterThan(0)
    expect(screen.getByTestId('rubric-on-time-score')).toHaveTextContent(
      'No deduction',
    )
    expect(
      screen.getByText(/10% of the assignment total/i),
    ).toBeInTheDocument()
  })

  it('lets assigners grade individual rubric parts', async () => {
    const user = userEvent.setup()
    const data = new MockGradebookDataProvider()
    renderWithGradebook(<GradeAssignmentPage />, {
      route: '/grades/asg-maze-debrief',
      path: '/grades/:assignmentId',
      authProvider: new MockGradebookAuthProvider([
        'gradebook.view_own',
        'gradebook.edit',
      ]),
      commandProvider: new MockGradebookCommandProvider(data),
    })
    await screen.findByTestId('assignment-rubric')
    const ratings = screen.getByTestId('rubric-score-ratings')
    await user.clear(ratings)
    await user.type(ratings, '3')
    await user.click(screen.getByTestId('save-rubric-grades'))
    await waitFor(() => {
      expect(screen.getByTestId('rubric-score-ratings')).toHaveValue(3)
    })
  })

  it('shows late on-time penalty on a late submission', async () => {
    renderWithGradebook(<GradeAssignmentPage />, {
      route: '/grades/asg-reflection',
      path: '/grades/:assignmentId',
    })
    expect(await screen.findByTestId('assignment-rubric')).toBeInTheDocument()
    expect(screen.getByTestId('rubric-on-time-score')).toHaveTextContent(
      '-1 pts',
    )
  })

  it('does not render edit controls without permission', async () => {
    const data = new MockGradebookDataProvider()
    renderWithGradebook(<GradeAssignmentPage />, {
      route: '/grades/asg-maze-debrief',
      path: '/grades/:assignmentId',
      authProvider: createStudentOnlyAuthProvider(),
      commandProvider: new MockGradebookCommandProvider(data),
    })
    await screen.findByRole('heading', {
      name: 'Maze Day - Debrief Submission',
    })
    expect(screen.queryByTestId('edit-grade-control')).not.toBeInTheDocument()
    expect(screen.queryByTestId('mark-excused-button')).not.toBeInTheDocument()
    expect(
      screen.queryByTestId('reopen-submission-button'),
    ).not.toBeInTheDocument()
  })

  it('renders authorized grade-edit controls', async () => {
    const data = new MockGradebookDataProvider()
    renderWithGradebook(<GradeAssignmentPage />, {
      route: '/grades/asg-maze-debrief',
      path: '/grades/:assignmentId',
      authProvider: new MockGradebookAuthProvider([
        'gradebook.view_own',
        'gradebook.edit',
        'gradebook.mark_excused',
        'debrief.reopen',
      ]),
      commandProvider: new MockGradebookCommandProvider(data),
    })
    await screen.findByRole('heading', {
      name: 'Maze Day - Debrief Submission',
    })
    expect(screen.getByTestId('edit-grade-control')).toBeInTheDocument()
    expect(screen.getByTestId('mark-excused-button')).toBeInTheDocument()
    expect(screen.getByTestId('reopen-submission-button')).toBeInTheDocument()
  })
})

describe('Supabase adapter mapping', () => {
  it('maps snake_case rows to camelCase GradebookEntry without requiring Supabase', () => {
    const entry = mapSupabaseGradeEntry({
      id: 'g1',
      assignment_id: 'a1',
      assignment_title: 'Mapped Assignment',
      assignment_type: 'event_debrief',
      event_id: 'e1',
      event_name: 'Maze Day',
      status: 'graded',
      score: 10,
      points_possible: 10,
      due_at: '2026-08-12T22:45:00.000Z',
      late_due_at: '2026-08-13T06:59:00.000Z',
      submitted_at: '2026-08-12T22:43:00.000Z',
      is_late: false,
      can_submit: false,
    })

    expect(entry).toMatchObject({
      id: 'g1',
      assignmentId: 'a1',
      assignmentTitle: 'Mapped Assignment',
      assignmentType: 'event_debrief',
      event: { id: 'e1', name: 'Maze Day' },
      status: 'graded',
      score: 10,
      pointsPossible: 10,
      dueAt: '2026-08-12T22:45:00.000Z',
      lateDueAt: '2026-08-13T06:59:00.000Z',
      submittedAt: '2026-08-12T22:43:00.000Z',
      isLate: false,
      canSubmit: false,
    })
  })
})

describe('Grades feature isolation', () => {
  it('does not require Supabase to render tests', async () => {
    renderWithGradebook(<GradesPage />)
    expect(await screen.findByText('Grades')).toBeInTheDocument()
  })
})
