import type {
  ClassCohort,
  ClassOfficersSnapshot,
  FundraiserGoal,
  HomecomingPlan,
  UpdateFundraiserInput,
  UpdateHomecomingInput,
} from '../types'
import { L2_ROSTER_PEOPLE } from '../../../data/l2Roster'

export interface ClassOfficersDataProvider {
  getSnapshot(cohort: ClassCohort): Promise<ClassOfficersSnapshot>
  updateFundraiser(
    cohort: ClassCohort,
    input: UpdateFundraiserInput,
  ): Promise<FundraiserGoal>
  updateHomecoming(
    cohort: ClassCohort,
    input: UpdateHomecomingInput,
  ): Promise<HomecomingPlan>
}

function seedFundraiser(cohort: ClassCohort): FundraiserGoal {
  const label =
    cohort === 'senior'
      ? 'Senior class Winter Ball / Prom fundraising'
      : 'Junior class Winter Ball / Prom fundraising'
  return {
    id: `fund-${cohort}-winter-prom`,
    label,
    notes:
      cohort === 'senior'
        ? 'Senior Class Officers only. Aim for at least $8,000 revenue.'
        : 'Junior Class Officers only. Aim for at least $6,000 revenue.',
    targetCents: cohort === 'senior' ? 800_000 : 600_000,
    raisedCents: cohort === 'senior' ? 320_000 : 180_000,
    milestones:
      cohort === 'senior'
        ? [1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000]
        : [1000, 2000, 3000, 4000, 5000, 6000],
    updatedAt: '2026-08-01T17:00:00.000Z',
  }
}

function seedHomecoming(cohort: ClassCohort): HomecomingPlan {
  const title = cohort === 'senior' ? 'Senior' : 'Junior'
  return {
    id: `hoco-${cohort}-2026`,
    year: 2026,
    skitTheme:
      cohort === 'senior'
        ? 'Enchanted Forest — senior lantern light mashups'
        : 'Neon Arcade — junior pixel-power mashups',
    skitScript:
      cohort === 'senior'
        ? 'Cold open: lanterns rise. Senior Class Officers introduce the week. Closing: senior cast reprise.'
        : 'Cold open: arcade lights. Junior Class Officers introduce the week. Closing: junior cast reprise.',
    skitScriptUrl: null,
    skitActors: [
      {
        id: `${cohort}-sa-1`,
        name: cohort === 'senior' ? 'Pradyun Kanuparthi' : 'Santhosh Arunkumar',
        note: 'Lead narrator',
      },
      {
        id: `${cohort}-sa-2`,
        name: cohort === 'senior' ? 'Ethan Chen' : 'Sofie Pan',
        note: 'Co-host',
      },
    ],
    airbands: [
      {
        id: `${cohort}-ab-1`,
        groupName: `${title} Airband`,
        song: cohort === 'senior' ? 'This Is Me' : 'Unstoppable',
        members:
          cohort === 'senior'
            ? ['Pradyun Kanuparthi', 'Aarit Patnaik', 'Sahil Jain']
            : ['Santhosh Arunkumar', 'Sofie Pan', 'Sophia Doan'],
      },
    ],
    actors: [
      {
        id: `${cohort}-ha-1`,
        name: cohort === 'senior' ? 'Aarit Patnaik' : 'Kevin Wang',
      },
    ],
    stageCrew: [
      {
        id: `${cohort}-sc-1`,
        name: cohort === 'senior' ? 'Sahil Jain' : 'Sophia Doan',
        note: 'Lights',
      },
    ],
    cleanupCrew: [
      {
        id: `${cohort}-cc-1`,
        name: cohort === 'senior' ? 'Ethan Chen' : 'Kevin Wang',
      },
    ],
    checkpoints: [
      {
        id: `${cohort}-cp-1`,
        date: '2026-09-08',
        title: 'Theme locked',
        detail: `${title} Class Officers + Pub finalize skit theme and airband songs.`,
        status: 'done',
      },
      {
        id: `${cohort}-cp-2`,
        date: '2026-09-15',
        title: 'Cast lists due',
        detail: 'Skit actors, stage crew, and cleanup crew confirmed.',
        status: 'done',
      },
      {
        id: `${cohort}-cp-3`,
        date: '2026-09-22',
        title: 'Script draft',
        detail: 'Full skit script ready for advisor review.',
        status: 'upcoming',
      },
      {
        id: `${cohort}-cp-4`,
        date: '2026-09-29',
        title: 'Airband rehearsal',
        detail: `${title} airband runs once in the gym with AV.`,
        status: 'upcoming',
      },
      {
        id: `${cohort}-cp-5`,
        date: '2026-10-06',
        title: 'Dress rehearsal',
        detail: 'Full run-of-show with stage and cleanup crews.',
        status: 'upcoming',
      },
      {
        id: `${cohort}-cp-6`,
        date: '2026-10-10',
        title: 'Homecoming night',
        detail: 'Show day — radio checks at T−60.',
        status: 'upcoming',
      },
    ],
    updatedAt: '2026-08-01T17:00:00.000Z',
  }
}

function rosterPeopleForCohort(cohort: ClassCohort) {
  return L2_ROSTER_PEOPLE.filter((person) => {
    const notes = (person.notes ?? '').toUpperCase()
    if (cohort === 'senior') return /\bSCO\b/.test(notes)
    return /\bJCO\b/.test(notes)
  })
}

type CohortStore = {
  fundraiser: FundraiserGoal
  homecoming: HomecomingPlan
}

/**
 * Two completely isolated Class Officers workspaces (senior vs junior).
 * Mutations never cross cohorts.
 */
export class MockClassOfficersDataProvider implements ClassOfficersDataProvider {
  private stores: Record<ClassCohort, CohortStore>

  constructor(options?: {
    senior?: Partial<CohortStore>
    junior?: Partial<CohortStore>
  }) {
    this.stores = {
      senior: {
        fundraiser: structuredClone(
          options?.senior?.fundraiser ?? seedFundraiser('senior'),
        ),
        homecoming: structuredClone(
          options?.senior?.homecoming ?? seedHomecoming('senior'),
        ),
      },
      junior: {
        fundraiser: structuredClone(
          options?.junior?.fundraiser ?? seedFundraiser('junior'),
        ),
        homecoming: structuredClone(
          options?.junior?.homecoming ?? seedHomecoming('junior'),
        ),
      },
    }
  }

  async getSnapshot(cohort: ClassCohort): Promise<ClassOfficersSnapshot> {
    const store = this.stores[cohort]
    const officers = rosterPeopleForCohort(cohort).map((person) => ({
      id: person.email,
      name: person.name,
      cohort,
      title: person.notes ?? undefined,
    }))
    const advisors =
      cohort === 'senior'
        ? [
            { id: 'adv-s1', name: 'Pat Rivera', cohort: 'senior' as const },
            { id: 'adv-s2', name: 'Casey Ng', cohort: 'senior' as const },
          ]
        : [
            { id: 'adv-j1', name: 'Morgan Ellis', cohort: 'junior' as const },
            { id: 'adv-j2', name: 'Jamie Soto', cohort: 'junior' as const },
          ]
    return {
      cohort,
      fundraiser: structuredClone(store.fundraiser),
      homecoming: structuredClone(store.homecoming),
      advisors,
      officers,
    }
  }

  async updateFundraiser(
    cohort: ClassCohort,
    input: UpdateFundraiserInput,
  ): Promise<FundraiserGoal> {
    const fundraiser = this.stores[cohort].fundraiser
    if (input.label !== undefined) fundraiser.label = input.label.trim()
    if (input.notes !== undefined) fundraiser.notes = input.notes.trim()
    if (input.targetCents !== undefined) {
      if (input.targetCents <= 0) throw new Error('Target must be positive')
      fundraiser.targetCents = Math.round(input.targetCents)
    }
    if (input.raisedCents !== undefined) {
      if (input.raisedCents < 0) throw new Error('Raised amount cannot be negative')
      fundraiser.raisedCents = Math.round(input.raisedCents)
    }
    fundraiser.updatedAt = new Date().toISOString()
    return structuredClone(fundraiser)
  }

  async updateHomecoming(
    cohort: ClassCohort,
    input: UpdateHomecomingInput,
  ): Promise<HomecomingPlan> {
    const homecoming = this.stores[cohort].homecoming
    if (input.skitTheme !== undefined) homecoming.skitTheme = input.skitTheme.trim()
    if (input.skitScript !== undefined) homecoming.skitScript = input.skitScript
    if (input.skitScriptUrl !== undefined) {
      homecoming.skitScriptUrl = input.skitScriptUrl?.trim() || null
    }
    if (input.skitActors !== undefined) {
      homecoming.skitActors = structuredClone(input.skitActors)
    }
    if (input.airbands !== undefined) homecoming.airbands = structuredClone(input.airbands)
    if (input.actors !== undefined) homecoming.actors = structuredClone(input.actors)
    if (input.stageCrew !== undefined) {
      homecoming.stageCrew = structuredClone(input.stageCrew)
    }
    if (input.cleanupCrew !== undefined) {
      homecoming.cleanupCrew = structuredClone(input.cleanupCrew)
    }
    if (input.checkpoints !== undefined) {
      homecoming.checkpoints = structuredClone(input.checkpoints)
    }
    homecoming.updatedAt = new Date().toISOString()
    return structuredClone(homecoming)
  }
}
