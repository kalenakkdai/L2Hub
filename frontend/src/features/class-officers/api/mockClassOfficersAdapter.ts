import type {
  ClassOfficersSnapshot,
  FundraiserGoal,
  HomecomingPlan,
  UpdateFundraiserInput,
  UpdateHomecomingInput,
} from '../types'

export interface ClassOfficersDataProvider {
  getSnapshot(): Promise<ClassOfficersSnapshot>
  updateFundraiser(input: UpdateFundraiserInput): Promise<FundraiserGoal>
  updateHomecoming(input: UpdateHomecomingInput): Promise<HomecomingPlan>
}

function seedFundraiser(): FundraiserGoal {
  return {
    id: 'fund-winter-prom',
    label: 'Winter Ball / Prom fundraising',
    notes: 'Aim for at least $8,000 revenue. Progressive ticket sales start Feb 9.',
    targetCents: 800_000,
    raisedCents: 320_000,
    milestones: [1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000],
    updatedAt: '2026-08-01T17:00:00.000Z',
  }
}

function seedHomecoming(): HomecomingPlan {
  return {
    id: 'hoco-2026',
    year: 2026,
    skitTheme: 'Enchanted Forest — lantern light and fairy-tale mashups',
    skitScript:
      'Cold open: lanterns rise. SCO/JCO duo introduce the week. Short skits between airbands. Closing: whole cast reprise + spirit chant.',
    skitScriptUrl: null,
    skitActors: [
      { id: 'sa-1', name: 'Alex Kim', note: 'Lead narrator' },
      { id: 'sa-2', name: 'Jamie Park', note: 'Co-host' },
      { id: 'sa-3', name: 'Riley Park', note: 'Comic beat' },
    ],
    airbands: [
      {
        id: 'ab-1',
        groupName: 'Senior Airband',
        song: 'This Is Me',
        members: ['Alex Kim', 'Devon Ray', 'Emery Fox'],
      },
      {
        id: 'ab-2',
        groupName: 'Junior Airband',
        song: 'Unstoppable',
        members: ['Jamie Park', 'Quinn Ash', 'Sage Lin'],
      },
    ],
    actors: [
      { id: 'ha-1', name: 'Taylor Kim' },
      { id: 'ha-2', name: 'Jordan Lee' },
      { id: 'ha-3', name: 'Avery Chen' },
      { id: 'ha-4', name: 'Sam Ortiz' },
    ],
    stageCrew: [
      { id: 'sc-1', name: 'Morgan Liu', note: 'Lights' },
      { id: 'sc-2', name: 'Casey Wu', note: 'Mic handoff' },
      { id: 'sc-3', name: 'Rowan Vale', note: 'Props' },
    ],
    cleanupCrew: [
      { id: 'cc-1', name: 'Sam Ortiz' },
      { id: 'cc-2', name: 'Riley Park' },
      { id: 'cc-3', name: 'Emery Fox' },
    ],
    checkpoints: [
      {
        id: 'cp-1',
        date: '2026-09-08',
        title: 'Theme locked',
        detail: 'SCO/JCO + Pub finalize skit theme and airband songs.',
        status: 'done',
      },
      {
        id: 'cp-2',
        date: '2026-09-15',
        title: 'Cast lists due',
        detail: 'Skit actors, stage crew, and cleanup crew confirmed.',
        status: 'done',
      },
      {
        id: 'cp-3',
        date: '2026-09-22',
        title: 'Script draft',
        detail: 'Full skit script ready for Mr. Jan review.',
        status: 'upcoming',
      },
      {
        id: 'cp-4',
        date: '2026-09-29',
        title: 'Airband rehearsal',
        detail: 'Both airbands run once in the gym with AV.',
        status: 'upcoming',
      },
      {
        id: 'cp-5',
        date: '2026-10-06',
        title: 'Dress rehearsal',
        detail: 'Full run-of-show with stage and cleanup crews.',
        status: 'upcoming',
      },
      {
        id: 'cp-6',
        date: '2026-10-10',
        title: 'Homecoming night',
        detail: 'Show day — radio checks at T−60.',
        status: 'upcoming',
      },
    ],
    updatedAt: '2026-08-01T17:00:00.000Z',
  }
}

export class MockClassOfficersDataProvider implements ClassOfficersDataProvider {
  private fundraiser: FundraiserGoal
  private homecoming: HomecomingPlan

  constructor(options?: {
    fundraiser?: FundraiserGoal
    homecoming?: HomecomingPlan
  }) {
    this.fundraiser = structuredClone(options?.fundraiser ?? seedFundraiser())
    this.homecoming = structuredClone(options?.homecoming ?? seedHomecoming())
  }

  async getSnapshot(): Promise<ClassOfficersSnapshot> {
    return {
      fundraiser: structuredClone(this.fundraiser),
      homecoming: structuredClone(this.homecoming),
      advisors: [
        { id: 'adv-s1', name: 'Pat Rivera', cohort: 'senior' },
        { id: 'adv-s2', name: 'Casey Ng', cohort: 'senior' },
        { id: 'adv-j1', name: 'Morgan Ellis', cohort: 'junior' },
        { id: 'adv-j2', name: 'Jamie Soto', cohort: 'junior' },
      ],
      officers: [
        { id: 'off-s', name: 'Alex Kim', cohort: 'senior' },
        { id: 'off-j', name: 'Jamie Park', cohort: 'junior' },
      ],
    }
  }

  async updateFundraiser(input: UpdateFundraiserInput): Promise<FundraiserGoal> {
    if (input.label !== undefined) this.fundraiser.label = input.label.trim()
    if (input.notes !== undefined) this.fundraiser.notes = input.notes.trim()
    if (input.targetCents !== undefined) {
      if (input.targetCents <= 0) throw new Error('Target must be positive')
      this.fundraiser.targetCents = Math.round(input.targetCents)
    }
    if (input.raisedCents !== undefined) {
      if (input.raisedCents < 0) throw new Error('Raised amount cannot be negative')
      this.fundraiser.raisedCents = Math.round(input.raisedCents)
    }
    this.fundraiser.updatedAt = new Date().toISOString()
    return structuredClone(this.fundraiser)
  }

  async updateHomecoming(input: UpdateHomecomingInput): Promise<HomecomingPlan> {
    if (input.skitTheme !== undefined) this.homecoming.skitTheme = input.skitTheme.trim()
    if (input.skitScript !== undefined) this.homecoming.skitScript = input.skitScript
    if (input.skitScriptUrl !== undefined) {
      this.homecoming.skitScriptUrl = input.skitScriptUrl?.trim() || null
    }
    if (input.skitActors !== undefined) this.homecoming.skitActors = structuredClone(input.skitActors)
    if (input.airbands !== undefined) this.homecoming.airbands = structuredClone(input.airbands)
    if (input.actors !== undefined) this.homecoming.actors = structuredClone(input.actors)
    if (input.stageCrew !== undefined) this.homecoming.stageCrew = structuredClone(input.stageCrew)
    if (input.cleanupCrew !== undefined) {
      this.homecoming.cleanupCrew = structuredClone(input.cleanupCrew)
    }
    if (input.checkpoints !== undefined) {
      this.homecoming.checkpoints = structuredClone(input.checkpoints)
    }
    this.homecoming.updatedAt = new Date().toISOString()
    return structuredClone(this.homecoming)
  }
}
