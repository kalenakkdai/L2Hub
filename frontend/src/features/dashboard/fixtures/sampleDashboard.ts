/* ===========================================================================
 * SAMPLE DATA — FOR VISUAL DEVELOPMENT ONLY
 * ===========================================================================
 *
 * None of this is real. It exists so the dashboard can be designed and
 * reviewed before the endpoint behind it is built, and it will be deleted
 * once that endpoint returns the same shape (see ../types.ts).
 *
 * Three things to keep in mind while this file exists:
 *
 * 1. `committee` is NOT in the database. The profiles table has no committee
 *    column and /auth/me does not return one. Adding it is a schema decision,
 *    not something this fixture should be taken to have settled.
 *
 * 2. Points, levels, streaks, and prep checklists have no backing tables at
 *    all. They are design concepts at this stage, nothing more.
 *
 * 3. Nothing here is filtered by role. The server decides what a camper may
 *    see; the UI renders whatever it is handed.
 * ======================================================================== */

import type { DashboardData } from '../types'

/** Offsets from "now" keep the sample looking fresh whenever it is viewed. */
function hoursFromNow(hours: number): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
}

function daysFromNow(days: number, hour = 9): string {
  const date = new Date(Date.now() + days * 86_400_000)
  date.setHours(hour, 0, 0, 0)
  return date.toISOString()
}

export const SAMPLE_DASHBOARD: DashboardData = {
  committee: 'Activities crew',
  campsiteCount: 9,

  stats: { points: 1240, level: 8, openCount: 3 },

  nextEvent: {
    id: 'maze-day',
    title: 'Maze Day 2026',
    startsAt: hoursFromNow(18.7),
    window: '8:00 AM – 1:30 PM',
    location: 'Main Quad & Gym',
    assignment: {
      title: 'Booth lead — Check-in table B',
      detail: 'Report 7:15 AM, Gym entrance',
    },
    prep: [
      { id: 'supplies', label: 'Pick up supplies from room 402', done: true },
      { id: 'budget', label: 'Submit booth budget form', done: false },
      { id: 'roster', label: 'Confirm table B roster', done: true },
      { id: 'signage', label: 'Print check-in signage', done: false },
    ],
    to: '/events',
  },

  calendar: [
    { date: daysFromNow(0), isToday: true },
    { date: daysFromNow(1, 8), title: 'Maze Day 2026', detail: 'Debrief · 2:00 PM' },
    { date: daysFromNow(4) },
    {
      date: daysFromNow(5, 15),
      title: 'Activities crew sync',
      detail: '3:30 PM · Room 402',
    },
    { date: daysFromNow(6) },
    { date: daysFromNow(9, 10), title: 'Fall rally planning', detail: '10:00 AM' },
    { date: daysFromNow(11, 15), title: 'Officer check-in', detail: '3:30 PM' },
  ],

  attention: [
    {
      id: 'maze-debrief',
      title: 'Maze Day 2026 — Debrief Submission',
      meta: 'Event debrief · due today 4:30 PM — 3 of 6 questions · 20 pts possible',
      status: { label: 'Draft', tone: 'warning' },
      urgency: 'high',
      progress: { value: 3, max: 6 },
      action: { label: 'Continue', to: '/grades', emphasis: 'primary' },
    },
    {
      id: 'spring-rally',
      title: 'Spring Rally — Material Checklist',
      meta: 'Closed 2 days ago · 0 / 15 pts — ask an adviser to reopen',
      status: { label: 'Missing', tone: 'danger' },
      urgency: 'overdue',
      action: { label: 'Request reopen', to: '/grades', emphasis: 'secondary' },
    },
    {
      id: 'booth-budget',
      title: 'Booth Budget — Crew Deliverable',
      meta: 'Due tomorrow 11:59 PM · late accepted until Aug 10 — 10 pts possible',
      status: { label: 'Not started', tone: 'neutral' },
      urgency: 'normal',
      action: { label: 'Open', to: '/grades', emphasis: 'secondary' },
    },
  ],

  grades: {
    completed: 14,
    missing: 1,
    open: 2,
    pointsEarned: 268,
    pointsPossible: 310,
    rows: [
      {
        id: 'g1',
        assignment: 'Maze Day 2026 — Debrief Submission',
        event: 'Maze Day 2026',
        status: { label: 'Draft', tone: 'warning' },
        earned: null,
        possible: 20,
        band: null,
      },
      {
        id: 'g2',
        assignment: 'Winter Drive — Debrief Submission',
        event: 'Winter Drive',
        status: { label: 'Graded', tone: 'accent' },
        earned: 20,
        possible: 20,
        band: 'a-plus',
      },
      {
        id: 'g3',
        assignment: 'Crew Sync — Meeting Response',
        event: null,
        status: { label: 'Submitted', tone: 'accent' },
        earned: 8,
        possible: 10,
        band: 'bc',
      },
      {
        id: 'g4',
        assignment: 'Spring Rally — Material Checklist',
        event: 'Spring Rally',
        status: { label: 'Missing', tone: 'danger' },
        earned: 0,
        possible: 15,
        band: 'below-c',
      },
    ],
  },

  progress: {
    level: 8,
    levelTitle: 'Section Lead',
    points: 1240,
    pointsToNextLevel: 1400,
    streakWeeks: 10,
    tasksDone: 27,
    participationRate: 96,
    note: 'Ten weeks in a row. That is a whole quarter without missing a beat.',
  },

  activity: [
    {
      id: 'a1',
      kind: 'points',
      description: 'Submitted Maze Day feedback',
      points: 20,
      occurredAt: hoursFromNow(-2),
    },
    {
      id: 'a2',
      kind: 'submission',
      description: 'Activities crew notes published',
      occurredAt: hoursFromNow(-27),
    },
    {
      id: 'a3',
      kind: 'committee',
      description: 'Added to the Tech crew as crew head',
      occurredAt: hoursFromNow(-30),
    },
    {
      id: 'a4',
      kind: 'event',
      description: 'Maze Day moved to review',
      occurredAt: hoursFromNow(-74),
    },
  ],

  committeeSnapshot: {
    name: 'Activities',
    status: 'Maze Day 2026 · in review',
    readinessPct: 68,
    actionItemCount: 2,
    to: '/committees/activities',
  },

  liveDebrief: {
    title: 'Maze Day 2026',
    session: '4:30 PM session',
    submitted: 31,
    writing: 9,
    notStarted: 6,
    absent: 2,
    to: '/debriefs',
  },

  upcoming: [
    { id: 'u1', startsAt: daysFromNow(1, 8), title: 'Maze Day 2026' },
    { id: 'u2', startsAt: daysFromNow(1, 14), title: 'Maze Day debrief' },
    { id: 'u3', startsAt: daysFromNow(5, 15), title: 'Activities crew sync' },
    { id: 'u4', startsAt: daysFromNow(9, 10), title: 'Fall rally planning' },
  ],
}

/** Variants used to review the states the real endpoint can produce. */
export const SAMPLE_DASHBOARD_EMPTY: DashboardData = {
  ...SAMPLE_DASHBOARD,
  nextEvent: null,
  calendar: [],
  attention: [],
  grades: { ...SAMPLE_DASHBOARD.grades, rows: [] },
  activity: [],
  committeeSnapshot: null,
  liveDebrief: null,
  upcoming: [],
}
