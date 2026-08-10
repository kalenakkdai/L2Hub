import type { ClassCohort } from '../types'

export function isClassCohort(value: string | undefined): value is ClassCohort {
  return value === 'senior' || value === 'junior'
}

export function classOfficersBase(cohort: ClassCohort): string {
  return `/class-officers/${cohort}`
}

export function classOfficersPath(
  cohort: ClassCohort,
  section: 'overview' | 'fundraiser' | 'homecoming' = 'overview',
): string {
  const base = classOfficersBase(cohort)
  if (section === 'overview') return base
  return `${base}/${section}`
}
