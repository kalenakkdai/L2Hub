/**
 * Class Officers platform domain types.
 * Fundraiser + Homecoming live in a mock adapter for MVP; permissions are real.
 */

export type ClassCohort = 'senior' | 'junior'

export type CheckpointStatus = 'upcoming' | 'done' | 'missed'

export type FundraiserGoal = {
  id: string
  label: string
  notes: string
  targetCents: number
  raisedCents: number
  /** Display milestones in dollars (e.g. 1000 … 8000). */
  milestones: number[]
  updatedAt: string
}

export type NamedPerson = {
  id: string
  name: string
  note?: string | null
}

export type Airband = {
  id: string
  groupName: string
  song: string
  members: string[]
}

export type HomecomingCheckpoint = {
  id: string
  date: string
  title: string
  detail: string
  status: CheckpointStatus
}

export type HomecomingPlan = {
  id: string
  year: number
  skitTheme: string
  skitScript: string
  skitScriptUrl: string | null
  skitActors: NamedPerson[]
  airbands: Airband[]
  actors: NamedPerson[]
  stageCrew: NamedPerson[]
  cleanupCrew: NamedPerson[]
  checkpoints: HomecomingCheckpoint[]
  updatedAt: string
}

export type ClassOfficersSnapshot = {
  cohort: ClassCohort
  fundraiser: FundraiserGoal
  homecoming: HomecomingPlan
  advisors: Array<{ id: string; name: string; cohort: ClassCohort }>
  officers: Array<{
    id: string
    name: string
    cohort: ClassCohort
    title?: string
  }>
}

export type UpdateFundraiserInput = {
  label?: string
  notes?: string
  targetCents?: number
  raisedCents?: number
}

export type UpdateHomecomingInput = Partial<
  Pick<
    HomecomingPlan,
    | 'skitTheme'
    | 'skitScript'
    | 'skitScriptUrl'
    | 'skitActors'
    | 'airbands'
    | 'actors'
    | 'stageCrew'
    | 'cleanupCrew'
    | 'checkpoints'
  >
>
