import { describe, expect, it } from 'vitest'
import {
  MockEventPlanningAuthProvider,
  MockEventPlanningDataProvider,
  createAcPlanningAuthProvider,
} from './mockPlanningAdapter'

describe('MockEventPlanningDataProvider', () => {
  it('blocks accepting assignments before Mr. Jan enables the plan', async () => {
    const data = new MockEventPlanningDataProvider()
    const plan = (await data.listPlans()).find(
      (item) => item.status === 'pending_enablement',
    )
    expect(plan).toBeTruthy()
    const invited = plan!.assignments.find((item) => item.status === 'invited')
    await expect(
      data.acceptAssignment(plan!.id, invited!.id),
    ).rejects.toThrow(/enable/i)
  })

  it('allows accepting after enablement', async () => {
    const data = new MockEventPlanningDataProvider({
      currentUserId: 'mem-kalena',
    })
    const plan = (await data.listPlans()).find((item) => item.id === 'plan-rally')
    expect(plan?.status).toBe('enabled')
    const invited = plan!.assignments.find(
      (item) => item.memberId === 'mem-kalena',
    )
    const updated = await data.acceptAssignment(plan!.id, invited!.id)
    expect(
      updated.assignments.find((item) => item.id === invited!.id)?.status,
    ).toBe('accepted')
    expect(updated.status).toBe('active')
  })

  it('assigns by committee or individual', async () => {
    const data = new MockEventPlanningDataProvider()
    const created = await data.createPlan({
      title: 'Spirit lunch games',
      summary: 'Midweek spirit games',
    })
    expect(created.agenda.templateSource).toBe('Winter Ball planning agenda')
    expect(created.agenda.sections.map((s) => s.title)).toEqual([
      'Attendees',
      'To-do before meeting',
      'Agenda / Meeting Notes',
    ])
    const withCommittee = await data.assign(created.id, {
      targetType: 'committee',
      committeeId: 'com-sports',
      roleLabel: 'Game leads',
    })
    expect(withCommittee.assignments[0]?.committeeName).toBe('Sports')
    const withPerson = await data.assign(created.id, {
      targetType: 'individual',
      memberId: 'mem-taylor',
      roleLabel: 'Scorekeeper',
    })
    expect(withPerson.assignments.at(-1)?.memberName).toBe('Stephanie Leung')
  })

  it('auto-generates a Winter Ball–style agenda every time a plan is created', async () => {
    const data = new MockEventPlanningDataProvider()
    const created = await data.createPlan({
      title: 'Winter Ball',
      summary: 'Enchanted Forest formal with progressive tickets',
      eventDate: '2026-02-20',
    })

    expect(created.agenda.schoolName).toBe('MISSION SAN JOSE HIGH SCHOOL')
    expect(created.agenda.title).toMatch(/Winter Ball Meeting Agenda for /)
    expect(created.agenda.sections).toHaveLength(3)
    expect(created.agenda.goals.some((g) => /Winter Ball/.test(g))).toBe(true)

    const listed = await data.listPlans()
    expect(listed.every((plan) => plan.agenda?.sections?.length === 3)).toBe(true)
  })

  it('never returns author identity on anonymous reports', async () => {
    const data = new MockEventPlanningDataProvider({
      currentUserId: 'mem-jordan',
    })
    await data.submitAnonymousReport('plan-rally', {
      subjectMemberId: 'mem-avery',
      category: 'not_doing_work',
      details: 'Missed the last two setup shifts.',
      attachments: [
        {
          id: 'att-1',
          displayName: 'screenshot-1.png',
          mimeType: 'image/png',
          sizeBytes: 12,
          dataUrl: 'data:image/png;base64,aaa',
        },
      ],
    })
    const reports = await data.listAnonymousReports('plan-rally')
    expect(reports).toHaveLength(1)
    expect(reports[0]).toMatchObject({
      subjectMemberName: 'Jennifer Li',
      category: 'not_doing_work',
    })
    expect(reports[0].attachments).toHaveLength(1)
    expect(reports[0].attachments[0].displayName).toBe('screenshot-1.png')
    expect(reports[0]).not.toHaveProperty('authorId')
    expect(JSON.stringify(reports[0])).not.toContain('mem-jordan')
  })

  it('stores screenshot attachments without original filenames', async () => {
    const data = new MockEventPlanningDataProvider({
      currentUserId: 'mem-jordan',
    })
    await data.submitAnonymousReport('plan-rally', {
      subjectMemberId: 'mem-avery',
      category: 'disruptive',
      details: 'Chat screenshot of missed deadlines.',
      attachments: [
        {
          id: 'att-leak',
          displayName: 'jordan-phone-chat.png',
          mimeType: 'image/png',
          sizeBytes: 40,
          dataUrl: 'data:image/png;base64,bbb',
        },
      ],
    })
    const reports = await data.listAnonymousReports('plan-rally')
    const payload = JSON.stringify(reports[0])
    expect(payload).not.toContain('jordan-phone')
    expect(reports[0].attachments[0].displayName).toBe('screenshot-1.png')
  })

  it('returns RAG outline from local knowledge', async () => {
    const data = new MockEventPlanningDataProvider()
    const result = await data.searchKnowledge('formal tickets vendor')
    expect(result.hits[0]?.name).toBe('Spring Formal')
    expect(result.outline?.sections.length).toBeGreaterThan(0)
  })
})

describe('MockEventPlanningAuthProvider', () => {
  it('gives AC enable + anonymous review permissions', () => {
    const ac = createAcPlanningAuthProvider()
    expect(ac.hasPermission('planning.enable')).toBe(true)
    expect(ac.hasPermission('feedback.view_anonymous')).toBe(true)
  })

  it('keeps members from enabling plans', () => {
    const member = new MockEventPlanningAuthProvider()
    expect(member.hasPermission('planning.enable')).toBe(false)
  })
})
