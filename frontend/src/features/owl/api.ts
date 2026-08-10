import { apiFetch } from '../../api/client'

export type OwlCatalogItem = {
  id: string
  label: string
  cost: number
  fill?: string
  fillDeep?: string
  near?: string
  far?: string
}

export type OwlCosmetics = {
  bellyColor: string
  wingColor: string
  accessory: string
  trail: string
  unlocked: string[]
  palette: {
    belly: { fill: string; fillDeep: string; label: string; cost: number }
    wing: { near: string; far: string; label: string; cost: number }
  }
}

export type OwlProfile = {
  points: number
  eligible: boolean
  accessActive: boolean
  weightedPercent: number | null
  letterGrade: string | null
  cosmetics: OwlCosmetics
  catalog: {
    bellyColors: OwlCatalogItem[]
    wingColors: OwlCatalogItem[]
    accessories: OwlCatalogItem[]
    trails: OwlCatalogItem[]
    aPlusMinPercent: number
    welcomePoints: number
  }
  accessRevokedAt: string | null
  change?: {
    unlocked: boolean
    revoked: boolean
    letter: string | null
    percent: number | null
  }
}

export function fetchOwlProfile() {
  return apiFetch<OwlProfile>('/owl/me')
}

export function syncOwlEligibility(weightedPercent: number | null) {
  return apiFetch<OwlProfile>('/owl/eligibility/sync', {
    method: 'POST',
    body: JSON.stringify({ weightedPercent }),
  })
}

export function updateOwlCosmetics(input: {
  bellyColor?: string
  wingColor?: string
  accessory?: string
  trail?: string
}) {
  return apiFetch<OwlProfile>('/owl/cosmetics', {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}
