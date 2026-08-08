import { describe, expect, it } from 'vitest'
import { MockClassOfficersDataProvider } from './mockClassOfficersAdapter'

describe('MockClassOfficersDataProvider', () => {
  it('returns independent snapshot clones so callers cannot mutate state', async () => {
    const provider = new MockClassOfficersDataProvider()
    const first = await provider.getSnapshot()
    first.fundraiser.raisedCents = 1
    const second = await provider.getSnapshot()
    expect(second.fundraiser.raisedCents).not.toBe(1)
  })

  it('persists a fundraiser update across snapshots', async () => {
    const provider = new MockClassOfficersDataProvider()
    await provider.updateFundraiser({ raisedCents: 500_000 })
    const snapshot = await provider.getSnapshot()
    expect(snapshot.fundraiser.raisedCents).toBe(500_000)
  })

  it('rejects a non-positive target', async () => {
    const provider = new MockClassOfficersDataProvider()
    await expect(provider.updateFundraiser({ targetCents: 0 })).rejects.toThrow(/positive/i)
  })

  it('rejects a negative raised amount', async () => {
    const provider = new MockClassOfficersDataProvider()
    await expect(provider.updateFundraiser({ raisedCents: -1 })).rejects.toThrow(/negative/i)
  })

  it('replaces homecoming crew lists on update', async () => {
    const provider = new MockClassOfficersDataProvider()
    await provider.updateHomecoming({
      stageCrew: [{ id: 's-1', name: 'New Crew' }],
    })
    const snapshot = await provider.getSnapshot()
    expect(snapshot.homecoming.stageCrew).toEqual([{ id: 's-1', name: 'New Crew' }])
  })
})
