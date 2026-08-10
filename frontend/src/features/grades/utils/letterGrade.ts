/** Letter-grade bands — keep in sync with backend/app/services/letter_grade.py */

export const A_PLUS_MIN = 97

export const GRADE_BANDS = [
  { label: 'A+', min: 97, max: 100 },
  { label: 'A', min: 93, max: 97 },
  { label: 'A−', min: 90, max: 93 },
  { label: 'B', min: 80, max: 90 },
  { label: 'C', min: 70, max: 80 },
  { label: 'D', min: 60, max: 70 },
  { label: 'F', min: 0, max: 60 },
] as const

export function letterGrade(percent: number | null | undefined): string | null {
  if (percent == null || Number.isNaN(percent)) return null
  const p = Math.min(100, Math.max(0, percent))
  for (const band of GRADE_BANDS) {
    if (p >= band.min) return band.label
  }
  return 'F'
}

export function isAPlus(percent: number | null | undefined): boolean {
  return percent != null && !Number.isNaN(percent) && percent >= A_PLUS_MIN
}
