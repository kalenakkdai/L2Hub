import { describe, expect, it } from 'vitest'
import { mapBackendGradePermissions } from '../types'

describe('mapBackendGradePermissions', () => {
  it('gives Jan assign + publish without score entry', () => {
    expect(
      mapBackendGradePermissions([
        'grades.view_own',
        'grades.view_all',
        'grades.assign',
        'grades.publish',
      ]),
    ).toEqual([
      'gradebook.view_own',
      'gradebook.view_event',
      'gradebook.view_student',
      'gradebook.assign',
      'gradebook.publish',
    ])
  })

  it('gives heads grade + excuse for their committee', () => {
    expect(
      mapBackendGradePermissions([
        'grades.view_own',
        'grades.view_committee',
        'grades.grade_committee',
      ]),
    ).toEqual([
      'gradebook.view_own',
      'gradebook.view_event',
      'gradebook.view_student',
      'gradebook.grade',
      'gradebook.mark_excused',
    ])
  })

  it('does not map legacy grades.edit to score entry', () => {
    expect(mapBackendGradePermissions(['grades.edit'])).toEqual([])
  })
})
