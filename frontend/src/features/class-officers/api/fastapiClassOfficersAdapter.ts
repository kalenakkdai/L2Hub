import { apiFetch } from '../../../api/client'
import type {
  ClassCohort,
  ClassOfficersSnapshot,
  FundraiserGoal,
  HomecomingPlan,
  UpdateFundraiserInput,
  UpdateHomecomingInput,
} from '../types'
import type { ClassOfficersDataProvider } from './mockClassOfficersAdapter'

/** Live Class Officers workspace. Senior and junior are separate API rows. */
export class FastApiClassOfficersDataProvider implements ClassOfficersDataProvider {
  getSnapshot(cohort: ClassCohort): Promise<ClassOfficersSnapshot> {
    return apiFetch<ClassOfficersSnapshot>(`/class-officers/${cohort}`)
  }

  updateFundraiser(
    cohort: ClassCohort,
    input: UpdateFundraiserInput,
  ): Promise<FundraiserGoal> {
    return apiFetch<FundraiserGoal>(`/class-officers/${cohort}/fundraiser`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    })
  }

  updateHomecoming(
    cohort: ClassCohort,
    input: UpdateHomecomingInput,
  ): Promise<HomecomingPlan> {
    return apiFetch<HomecomingPlan>(`/class-officers/${cohort}/homecoming`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    })
  }
}
