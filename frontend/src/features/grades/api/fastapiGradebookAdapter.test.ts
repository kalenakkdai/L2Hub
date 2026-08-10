import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FastApiGradebookDataProvider } from './fastapiGradebookAdapter'

vi.mock('../../../api/client', () => ({
  apiFetch: vi.fn(),
}))

vi.mock('../../../api/auth', () => ({
  fetchCurrentUser: vi.fn(),
}))

const { apiFetch } = await import('../../../api/client')

describe('FastApiGradebookDataProvider', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset()
  })

  it('maps /grades/me into a GradebookOverview and applies query filters', async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      entries: [
        {
          id: 'e1',
          assignmentId: 'a1',
          assignmentTitle: 'Maze Day Debrief',
          assignmentType: 'event_debrief',
          status: 'graded',
          score: 18,
          pointsPossible: 20,
          categoryId: 'cat-debriefs',
        },
        {
          id: 'e2',
          assignmentId: 'a2',
          assignmentTitle: 'Reflection',
          assignmentType: 'reflection',
          status: 'graded',
          score: 10,
          pointsPossible: 10,
          categoryId: 'cat-reflections',
        },
      ],
      summary: { weightedPercent: 92, earnedPoints: 28, possiblePoints: 30 },
      categories: [{ id: 'cat-debriefs', name: 'Event debriefs', weightPercent: 35 }],
      student: { id: 'u1', name: 'Ada', committee: null },
    })

    const provider = new FastApiGradebookDataProvider()
    const overview = await provider.getMyGradebook({ query: 'maze' })

    expect(apiFetch).toHaveBeenCalledWith('/grades/me')
    expect(overview.entries).toHaveLength(1)
    expect(overview.entries[0].assignmentTitle).toBe('Maze Day Debrief')
    expect(overview.summary.weightedPercent).toBe(92)
    expect(overview.student?.name).toBe('Ada')
  })

  it('loads assignment detail and roster endpoints', async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce({
        entry: { id: 'e1', assignmentId: 'a1', assignmentTitle: 'Maze' },
        submission: null,
        feedback: null,
        rubric: { criteria: [] },
        rubricEvaluation: null,
        student: { id: 'u1', name: 'Ada' },
      })
      .mockResolvedValueOnce({
        event: { id: 'a1', name: 'Maze' },
        assignmentTitle: 'Maze',
        assignmentId: 'a1',
        completionCompleted: 0,
        completionTotal: 2,
        rows: [],
      })

    const provider = new FastApiGradebookDataProvider()
    const detail = await provider.getAssignment('a1')
    const roster = await provider.getEventGradebook?.('a1')

    expect(apiFetch).toHaveBeenCalledWith('/grades/assignments/a1')
    expect(apiFetch).toHaveBeenCalledWith('/grades/assignments/a1/roster')
    expect(detail.entry.assignmentId).toBe('a1')
    expect(roster?.assignmentId).toBe('a1')
  })
})
