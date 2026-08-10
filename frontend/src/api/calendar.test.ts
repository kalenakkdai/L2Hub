import { describe, expect, it } from 'vitest'
import { subscribeUrl, webcalUrl } from './calendar'

const TOKEN = 'a'.repeat(64)

describe('subscribeUrl', () => {
  it('is absolute, because Google fetches it, not this browser', () => {
    expect(subscribeUrl(TOKEN)).toMatch(/^https?:\/\//)
  })

  it('points at the whole-Campsite feed when no Crew is given', () => {
    expect(subscribeUrl(TOKEN)).toContain('/calendar.ics?token=')
    expect(subscribeUrl(TOKEN)).not.toContain('/committees/')
  })

  it('scopes to a Crew when one is given', () => {
    const url = subscribeUrl(TOKEN, 'crew-123')
    expect(url).toContain('/committees/crew-123/calendar.ics')
    expect(url).toContain(`token=${TOKEN}`)
  })

  it('encodes the token rather than pasting it raw into the query', () => {
    // Tokens are hex today, so nothing needs escaping. The encoding is what
    // keeps that true if the token format ever changes.
    expect(subscribeUrl('a+b/c')).toContain('token=a%2Bb%2Fc')
  })
})

describe('webcalUrl', () => {
  it('swaps the scheme so a click opens the calendar app', () => {
    expect(webcalUrl(TOKEN)).toMatch(/^webcal:\/\//)
  })

  it('keeps the path and token identical to the https form', () => {
    const https = subscribeUrl(TOKEN, 'crew-123')
    expect(webcalUrl(TOKEN, 'crew-123')).toBe(
      https.replace(/^https?:\/\//, 'webcal://'),
    )
  })
})
