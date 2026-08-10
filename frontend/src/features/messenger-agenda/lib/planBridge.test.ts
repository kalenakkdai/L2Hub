import { describe, expect, it } from 'vitest'
import { agendaToPlanDocument } from '../lib/planBridge'
import type { MessengerAgendaSession } from '../types'

describe('agendaToPlanDocument', () => {
  it('maps messenger agenda sections into an event-planning document', () => {
    const session: MessengerAgendaSession = {
      id: 's1',
      title: 'Cabinet chat',
      status: 'finalized',
      source: 'paste',
      threadId: null,
      threadLabel: null,
      startKeyword: 'agenda start',
      endKeyword: 'agenda end',
      rawText: '',
      capturedText: 'Publicity will post the flyer.',
      agenda: {
        title: 'Winter Ball planning',
        summary: 'Lock venue and publicity.',
        goals: ['Lock venue'],
        sections: [
          { title: 'Action items', bullets: ['Publicity will post the flyer.'] },
        ],
      },
      assignments: [],
      planId: null,
      capturingStartedAt: null,
      finalizedAt: null,
      createdAt: null,
      updatedAt: null,
    }

    const doc = agendaToPlanDocument(session)
    expect(doc.title).toBe('Winter Ball planning')
    expect(doc.goals).toEqual(['Lock venue'])
    expect(doc.sections[0]?.title).toBe('Action items')
    expect(doc.templateSource).toBe('Messenger Agenda capture')
    expect(doc.generatedAt).toBeTruthy()
  })
})
