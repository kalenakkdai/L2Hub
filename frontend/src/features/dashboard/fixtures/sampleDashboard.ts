/* ===========================================================================
 * SAMPLE DATA — FOR VISUAL DEVELOPMENT ONLY
 * ===========================================================================
 *
 * None of this is real. It exists so the dashboard can be designed and
 * reviewed before `GET /dashboard/modules` is built, and it will be deleted
 * once that endpoint returns the same shape (see ../types.ts).
 *
 * Two things to keep in mind while this file exists:
 *
 * 1. `committee` is NOT in the database. The profiles table has no committee
 *    column and /auth/me does not return one. Adding it is a Phase 3 schema
 *    decision, not something this fixture should be taken to have settled.
 *
 * 2. The module list is deliberately flat and unfiltered. The server decides
 *    which modules a member can see; the UI renders whatever it is handed and
 *    makes no authorization decisions of its own.
 * ======================================================================== */

import type { DashboardData } from '../types'

/** Offsets from "now" keep the sample looking fresh whenever it is viewed. */
function hoursFromNow(hours: number): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
}

export const SAMPLE_DASHBOARD: DashboardData = {
  committee: 'Events Committee',

  featured: {
    kind: 'event',
    title: 'Spring Formal — Final Planning Session',
    summary:
      'Last run-through before ticket sales open. Bring your committee’s vendor confirmations and the updated budget sheet.',
    startsAt: hoursFromNow(28),
    location: 'Room 214 · Student Center',
    status: { label: 'Response needed', tone: 'warning' },
    actionLabel: 'RSVP',
    to: '/events',
  },

  progress: {
    level: 4,
    levelTitle: 'Contributor',
    points: 1240,
    pointsToNextLevel: 1500,
    eventsAttended: 17,
    eventsPossible: 21,
    participationRate: 81,
  },

  modules: [
    {
      id: 'tasks',
      group: 'my_work',
      title: 'My tasks',
      description: 'Assignments across every committee you belong to.',
      icon: 'ClipboardList',
      to: '/tasks',
      count: 3,
      badge: { label: '1 overdue', tone: 'danger' },
    },
    {
      id: 'submissions',
      group: 'my_work',
      title: 'Submissions',
      description: 'Forms, reflections, and debrief responses you owe.',
      icon: 'FileText',
      to: '/submissions',
      count: 2,
    },
    {
      id: 'points',
      group: 'my_work',
      title: 'Points ledger',
      description: 'Every point you have earned and where it came from.',
      icon: 'Sparkles',
      to: '/points',
    },

    {
      id: 'roster',
      group: 'committee',
      title: 'Committee roster',
      description: 'Who is on Events Committee and how to reach them.',
      icon: 'Users',
      to: '/committee',
      count: 12,
    },
    {
      id: 'agenda',
      group: 'committee',
      title: 'Agendas',
      description: 'Meeting agendas and the notes that came out of them.',
      icon: 'ListChecks',
      to: '/committee/agendas',
    },
    {
      id: 'concerns',
      group: 'committee',
      title: 'Anonymous concerns',
      description: 'Raise something privately with your adviser.',
      icon: 'ShieldQuestion',
      to: '/concerns',
    },

    {
      id: 'upcoming',
      group: 'events',
      title: 'Upcoming events',
      description: 'What is scheduled and who has committed to attending.',
      icon: 'CalendarDays',
      to: '/events',
      count: 5,
    },
    {
      id: 'debriefs',
      group: 'events',
      title: 'Debriefs',
      description: 'Post-event reflections while the details are still fresh.',
      icon: 'MessagesSquare',
      to: '/debriefs',
      badge: { label: '2 open', tone: 'info' },
    },
    {
      id: 'attendance',
      group: 'events',
      title: 'Attendance',
      description: 'Check in, check out, and see your lateness record.',
      icon: 'UserCheck',
      to: '/attendance',
    },

    {
      id: 'gradebook',
      group: 'leadership',
      title: 'Gradebook',
      description: 'Participation grades built from attendance and points.',
      icon: 'GraduationCap',
      to: '/tools/gradebook',
    },
    {
      id: 'sessions',
      group: 'leadership',
      title: 'Session control',
      description: 'Start, time, and close a live session.',
      icon: 'Timer',
      to: '/tools/sessions',
      badge: { label: 'Live', tone: 'accent' },
    },
    {
      id: 'wrapped',
      group: 'leadership',
      title: 'Wrapped',
      description: 'End-of-year recaps for the whole organization.',
      icon: 'BarChart3',
      to: '/tools/wrapped',
    },
  ],

  activity: [
    {
      id: 'a1',
      kind: 'points',
      description: 'Earned 25 points for running the Spring Formal vendor call.',
      occurredAt: hoursFromNow(-3),
    },
    {
      id: 'a2',
      kind: 'submission',
      description: 'Submitted the Winter Drive debrief.',
      occurredAt: hoursFromNow(-27),
    },
    {
      id: 'a3',
      kind: 'event',
      description: 'Checked in to Committee Sync — 4 minutes early.',
      occurredAt: hoursFromNow(-52),
    },
    {
      id: 'a4',
      kind: 'level',
      description: 'Reached Level 4 — Contributor.',
      occurredAt: hoursFromNow(-96),
    },
    {
      id: 'a5',
      kind: 'committee',
      description: 'Added to the Events Committee logistics group.',
      occurredAt: hoursFromNow(-150),
    },
  ],
}

/** Variants used to review the states the real endpoint can produce. */
export const SAMPLE_DASHBOARD_EMPTY: DashboardData = {
  ...SAMPLE_DASHBOARD,
  featured: null,
  modules: [],
  activity: [],
}
