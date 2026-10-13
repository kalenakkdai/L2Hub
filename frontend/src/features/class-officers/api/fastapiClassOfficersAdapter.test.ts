import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FastApiClassOfficersDataProvider } from './fastapiClassOfficersAdapter'

vi.mock('../../../api/client', () => ({
  apiFetch: vi.fn(),
}))

const { apiFetch } = await import('../../../api/client')

describe('FastApiClassOfficersDataProvider', () => {
  const provider = new FastApiClassOfficersDataProvider()

  beforeEach(() => {
    vi.mocked(apiFetch).mockReset()
  })

  it('loads a cohort workspace from the API', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ cohort: 'senior' })

    await provider.getSnapshot('senior')

    expect(apiFetch).toHaveBeenCalledWith('/class-officers/senior')
  })

  it('patches the fundraiser and the homecoming plan on their own routes', async () => {
    vi.mocked(apiFetch).mockResolvedValue({})

    await provider.updateFundraiser('junior', { raisedCents: 5000 })
    await provider.updateHomecoming('junior', { skitTheme: 'Neon Arcade' })

    expect(apiFetch).toHaveBeenNthCalledWith(1, '/class-officers/junior/fundraiser', {
      method: 'PATCH',
      body: JSON.stringify({ raisedCents: 5000 }),
    })
    expect(apiFetch).toHaveBeenNthCalledWith(2, '/class-officers/junior/homecoming', {
      method: 'PATCH',
      body: JSON.stringify({ skitTheme: 'Neon Arcade' }),
    })
  })
})
