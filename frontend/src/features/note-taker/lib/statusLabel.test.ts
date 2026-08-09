import { describe, expect, it } from 'vitest'
import { statusLabel, statusTone } from './statusLabel'

describe('statusLabel', () => {
  it('maps processing to a human label', () => {
    expect(statusLabel('processing')).toBe('Drafting notes…')
    expect(statusLabel('ready')).toBe('Ready')
    expect(statusLabel('failed')).toBe('Failed')
  })

  it('falls back to Recording for a status it does not know', () => {
    expect(statusLabel('something-new')).toBe('Recording')
  })
})

describe('statusTone', () => {
  it('gives failed and ready visually distinct badges', () => {
    expect(statusTone('failed')).not.toBe(statusTone('ready'))
  })
})
