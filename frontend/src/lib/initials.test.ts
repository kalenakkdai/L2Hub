import { describe, expect, it } from 'vitest'
import { initials } from './initials'

describe('initials', () => {
  it('takes the first letter of the first two names', () => {
    expect(initials('Ada Lovelace')).toBe('AL')
    expect(initials('Alex Rivera')).toBe('AR')
  })

  it('stops at two even for a longer name', () => {
    expect(initials('Maria del Carmen Ruiz')).toBe('MD')
  })

  it('handles a single name', () => {
    expect(initials('Prince')).toBe('P')
  })

  it('uppercases whatever it is given', () => {
    expect(initials('ada lovelace')).toBe('AL')
  })

  it('never returns an empty string, so an avatar well is never blank', () => {
    expect(initials('')).toBe('?')
    expect(initials('   ')).toBe('?')
  })
})
