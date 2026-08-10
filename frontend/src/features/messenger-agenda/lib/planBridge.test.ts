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
        goals: [{ text: 'Lock venue', speaker: 'Jordan' }],
        sections: [
          {
            title: 'Action items',
            bullets: [
              { text: 'Publicity will post the flyer.', speaker: 'Avery' },
              { text: 'Confirm owners before adjourning.' },
            ],
          },
        ],
      },
      assignments: [],
      contributors: [
        {
          name: 'Avery',
          color: '#1d4ed8',
          highlight: '#dbeafe',
          initials: 'AV',
          lineCount: 1,
        },
      ],
      transcript: [
        { text: 'Publicity will post the flyer.', speaker: 'Avery' },
      ],
      planId: null,
      capturingStartedAt: null,
      finalizedAt: null,
      createdAt: null,
      updatedAt: null,
    }

    const doc = agendaToPlanDocument(session)
    expect(doc.title).toBe('Winter Ball planning')
    expect(doc.goals).toEqual(['Lock venue — Jordan'])
    expect(doc.sections[0]?.title).toBe('Action items')
    // Attribution rides along as text, since the plan doc has no color layer.
    expect(doc.sections[0]?.items).toEqual([
      { text: 'Publicity will post the flyer. — Avery' },
      { text: 'Confirm owners before adjourning.' },
    ])
    expect(doc.templateSource).toBe('Messenger Agenda capture')
    expect(doc.generatedAt).toBeTruthy()
  })
})
