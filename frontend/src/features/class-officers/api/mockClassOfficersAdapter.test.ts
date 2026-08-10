import { describe, expect, it } from 'vitest'
import { MockClassOfficersDataProvider } from './mockClassOfficersAdapter'

describe('MockClassOfficersDataProvider', () => {
  it('returns independent snapshot clones so callers cannot mutate state', async () => {
    const provider = new MockClassOfficersDataProvider()
    const first = await provider.getSnapshot('senior')
    first.fundraiser.raisedCents = 1
    const second = await provider.getSnapshot('senior')
    expect(second.fundraiser.raisedCents).not.toBe(1)
  })

  it('keeps junior and senior fundraiser totals isolated', async () => {
    const provider = new MockClassOfficersDataProvider()
    await provider.updateFundraiser('senior', { raisedCents: 500_000 })
    await provider.updateFundraiser('junior', { raisedCents: 111_000 })
    const senior = await provider.getSnapshot('senior')
    const junior = await provider.getSnapshot('junior')
    expect(senior.fundraiser.raisedCents).toBe(500_000)
    expect(junior.fundraiser.raisedCents).toBe(111_000)
    expect(senior.cohort).toBe('senior')
    expect(junior.cohort).toBe('junior')
    expect(senior.officers.some((o) => /SCO/i.test(o.title ?? ''))).toBe(true)
    expect(junior.officers.some((o) => /JCO/i.test(o.title ?? ''))).toBe(true)
    expect(senior.officers.every((o) => o.cohort === 'senior')).toBe(true)
    expect(junior.officers.every((o) => o.cohort === 'junior')).toBe(true)
  })

  it('rejects a non-positive target', async () => {
    const provider = new MockClassOfficersDataProvider()
    await expect(
      provider.updateFundraiser('senior', { targetCents: 0 }),
    ).rejects.toThrow(/positive/i)
  })

  it('rejects a negative raised amount', async () => {
    const provider = new MockClassOfficersDataProvider()
    await expect(
      provider.updateFundraiser('junior', { raisedCents: -1 }),
    ).rejects.toThrow(/negative/i)
  })

  it('replaces homecoming crew lists on update for one cohort only', async () => {
    const provider = new MockClassOfficersDataProvider()
    await provider.updateHomecoming('junior', {
      stageCrew: [{ id: 's-1', name: 'New Crew' }],
    })
    const junior = await provider.getSnapshot('junior')
    const senior = await provider.getSnapshot('senior')
    expect(junior.homecoming.stageCrew).toEqual([{ id: 's-1', name: 'New Crew' }])
    expect(senior.homecoming.stageCrew[0]?.name).not.toBe('New Crew')
  })
})
