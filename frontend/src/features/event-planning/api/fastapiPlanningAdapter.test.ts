import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  FastApiEventPlanningAuthProvider,
  FastApiEventPlanningDataProvider,
} from './fastapiPlanningAdapter'

vi.mock('../../../api/client', () => ({
  apiFetch: vi.fn(),
}))

vi.mock('../../../api/auth', () => ({
  fetchCurrentUser: vi.fn(),
}))

const { apiFetch } = await import('../../../api/client')
const { fetchCurrentUser } = await import('../../../api/auth')

describe('FastApiEventPlanningDataProvider', () => {
  const provider = new FastApiEventPlanningDataProvider()

  beforeEach(() => {
    vi.mocked(apiFetch).mockReset()
    vi.mocked(apiFetch).mockResolvedValue([])
  })

  it('loads and creates plans on the event-plans API', async () => {
    await provider.listPlans()
    await provider.createPlan({
      title: 'Winter Formal',
      summary: 'Gym dance',
      eventDate: '2026-12-12',
    })

    expect(apiFetch).toHaveBeenNthCalledWith(1, '/event-plans')
    const createCall = vi.mocked(apiFetch).mock.calls[1]
    expect(createCall).toBeDefined()
    const init = createCall?.[1] as RequestInit | undefined
    expect(init?.body).toEqual(expect.any(String))
    const body = JSON.parse(String(init?.body))
    expect(body.title).toBe('Winter Formal')
    expect(body.agenda.title).toContain('Winter Formal')
    expect(body.agenda.schoolName).toBe('MISSION SAN JOSE HIGH SCHOOL')
  })

  it('keeps knowledge search on the local corpus', async () => {
    const result = await provider.searchKnowledge('winter ball tickets')

    expect(apiFetch).not.toHaveBeenCalled()
    expect(result.query).toBe('winter ball tickets')
    expect(result.hits.length).toBeGreaterThan(0)
  })
})

describe('FastApiEventPlanningAuthProvider', () => {
  beforeEach(() => {
    vi.mocked(fetchCurrentUser).mockReset()
  })

  it('uses the signed-in permissions instead of a blanket grant', async () => {
    vi.mocked(fetchCurrentUser).mockResolvedValue({
      id: 'user-1',
      email: 'avery@l2hub.local',
      full_name: 'Avery Chen',
      role: 'member',
      created_at: '2026-10-01T00:00:00Z',
      permissions: ['planning.view', 'planning.create'],
      committees: [{ id: 'com-1', name: 'Community', is_head: false }],
    })
    const auth = new FastApiEventPlanningAuthProvider()

    expect(auth.hasPermission('planning.enable')).toBe(false)
    const me = await auth.getCurrentUser()

    expect(me?.name).toBe('Avery Chen')
    expect(me?.committeeName).toBe('Community')
    expect(auth.hasPermission('planning.create')).toBe(true)
    expect(auth.hasPermission('planning.enable')).toBe(false)
    expect(auth.hasPermission('feedback.view_anonymous')).toBe(false)
  })
})
