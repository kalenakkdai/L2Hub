import { describe, expect, it } from 'vitest'
import { mapBackendGradePermissions } from '../types'

describe('mapBackendGradePermissions', () => {
  it('gives Jan and Jadon assign, publish, and individual score entry', () => {
    expect(
      mapBackendGradePermissions([
        'grades.view_own',
        'grades.view_all',
        'grades.assign',
        'grades.publish',
        'grades.grade_committee',
        'grades.request_assignment',
      ]),
    ).toEqual([
      'gradebook.view_own',
      'gradebook.view_event',
      'gradebook.view_student',
      'gradebook.assign',
      'gradebook.request_assignment',
      'gradebook.grade_committee',
      'gradebook.grade',
      'gradebook.mark_excused',
      'gradebook.publish',
    ])
  })

  it('gives heads committee grades + draft requests, not individual grading', () => {
    expect(
      mapBackendGradePermissions([
        'grades.view_own',
        'grades.view_committee',
        'grades.grade_committee',
        'grades.request_assignment',
      ]),
    ).toEqual([
      'gradebook.view_own',
      'gradebook.view_event',
      'gradebook.view_student',
      'gradebook.request_assignment',
      'gradebook.grade_committee',
    ])
  })

  it('does not map legacy grades.edit to score entry', () => {
    expect(mapBackendGradePermissions(['grades.edit'])).toEqual([])
  })
})
