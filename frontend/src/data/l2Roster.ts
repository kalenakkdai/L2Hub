/**
 * Canonical Leadership 2 roster from the class spreadsheet (Aug 2026).
 *
 * Spreadsheet columns map to slugs as:
 *   A-Team → activities, Fund → fundraising, Vid → videography_photography
 *   ASBOS is a platform role, not a committee.
 *
 * `headNames` are committee heads (light blue on the sheet). The first entry
 * is the primary head shown in list UIs until the backend exposes elections.
 */

export type RosterCommittee = {
  id: string
  name: string
  email: string
  /** Primary head first; additional co-heads follow. */
  headNames: string[]
  members: string[]
  isMine?: boolean
}

/** ASBO officers (spreadsheet column ASBOS). */
export const L2_ASBOS: string[] = [
  'Jadon Li',
  'Ariel Duong',
  'Kaiwei Parks',
  'Melody Gao',
  'Hanna Rahmanian',
]

export const L2_ROSTER_COMMITTEES: RosterCommittee[] = [
  {
    id: 'activities',
    name: 'Activities',
    email: 'msjateam@gmail.com',
    headNames: ['Hanna Rahmanian', 'Kaiwei Parks'],
    members: [
      'Hanna Rahmanian',
      'Kaiwei Parks',
      'Aarit Patnaik',
      'Santhosh Arunkumar',
      'Chasen Lam',
    ],
  },
  {
    id: 'community',
    name: 'Community',
    email: 'msjcommunity21.22@gmail.com',
    headNames: ['Ariel Duong'],
    members: [
      'Ariel Duong',
      'Ruirui Liu',
      'Dylan Mandal',
      'Megan Ng',
      'Emma Cai',
    ],
  },
  {
    id: 'elections',
    name: 'Elections',
    email: 'msjelections@gmail.com',
    headNames: ['Megan Chu'],
    members: [
      'Megan Chu',
      'Hanna (Yuanting) Cai',
      'Alanice Tam',
      'Aarohi Verma',
    ],
  },
  {
    id: 'fundraising',
    name: 'Fundraising',
    email: 'msjfund@gmail.com',
    headNames: ['Sahil Jain'],
    members: [
      'Sahil Jain',
      'Anchith Arji',
      'Pradyun Kanuparthi',
      'Sofie Pan',
      'Riya Ramadass',
    ],
  },
  {
    id: 'gtac',
    name: 'GTAC',
    email: 'msjgreenteam@gmail.com',
    headNames: ['Ashish Swaminathan'],
    members: [
      'Ashish Swaminathan',
      'Anirudh Chakraborty',
      'Adrit Das',
      'Matthew Wang',
      'Lavena Thea',
      'Deborah Wang',
    ],
  },
  {
    id: 'hcmc',
    name: 'HCMC',
    email: 'msjhs.hcmc@gmail.com',
    headNames: ['Abirami Palaniappan'],
    members: [
      'Abirami Palaniappan',
      'Avina Wong',
      'Caitlin Tran',
      'Yili Feng',
    ],
  },
  {
    id: 'publicity',
    name: 'Publicity',
    email: 'msjpublicity@gmail.com',
    headNames: ['Devon Mandal'],
    members: ['Devon Mandal', 'Iris Hsiung', 'Janelle Chen', 'Anna Dai'],
  },
  {
    id: 'student_store',
    name: 'Student Store',
    email: 'msjstudentstore@gmail.com',
    headNames: ['Melody Gao'],
    members: [
      'Melody Gao',
      'Armaan Singh',
      'Abhay Shankar',
      'Sophia Doan',
    ],
  },
  {
    id: 'star',
    name: 'STAR',
    email: 'msjhs.star@gmail.com',
    headNames: ['Nakshatra Rajeshkanna'],
    members: [
      'Nakshatra Rajeshkanna',
      'Vardaan Iyer',
      'Samantha Liang',
      'Lionel Lu',
      'Shriya Iyengar',
    ],
  },
  {
    id: 'sports',
    name: 'Sports',
    email: 'l2sportscommittee@gmail.com',
    headNames: ['Ethan Chen'],
    members: [
      'Ethan Chen',
      'Zerek Kao',
      'Xinyan (Grace) Zeng',
      'Kylie Hsu',
    ],
  },
  {
    id: 'tech',
    name: 'Tech',
    email: 'msjhtechteam@gmail.com',
    headNames: ['Samay Jain'],
    members: [
      'Samay Jain',
      'Rishabh Rajanikanth',
      'Yashika Hegde',
      'Caden Yang',
    ],
    isMine: true,
  },
  {
    id: 'videography_photography',
    name: 'Videography/Photography',
    email: 'msjvideography@gmail.com',
    headNames: ['Jadon Li'],
    members: [
      'Jadon Li',
      'Danny Lou',
      'Michael Hung',
      'Kevin Wang',
      'Melina Chin',
    ],
  },
]

export function primaryHead(committee: RosterCommittee): string | null {
  return committee.headNames[0] ?? committee.members[0] ?? null
}

export function allRosterPeople(): { name: string; committeeId: string; committeeName: string; isHead: boolean }[] {
  const people: {
    name: string
    committeeId: string
    committeeName: string
    isHead: boolean
  }[] = []
  for (const committee of L2_ROSTER_COMMITTEES) {
    for (const name of committee.members) {
      people.push({
        name,
        committeeId: committee.id,
        committeeName: committee.name,
        isHead: committee.headNames.includes(name),
      })
    }
  }
  return people
}
