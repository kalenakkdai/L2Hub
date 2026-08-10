/**
 * Canonical Leadership 2 roster from the class spreadsheet (Aug 2026).
 *
 * Spreadsheet columns map to slugs as:
 *   A-Team → activities, Fund → fundraising, Campus → gtac,
 *   Vid → videography_photography. ASBOS is a platform role, not a committee.
 */

export type RosterPosition = 'head' | 'member' | 'baby' | 'ta'

export type RosterPerson = {
  name: string
  email: string
  committeeId: string | null
  position: RosterPosition
  isAsbo?: boolean
  grade?: number
  /** Spreadsheet Position extras, e.g. "SCO President" / "JCO Treasurer". */
  notes?: string
}

export type RosterCommittee = {
  id: string
  name: string
  email: string
  headNames: string[]
  members: string[]
  babyNames: string[]
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

export const L2_ROSTER_PEOPLE: RosterPerson[] = [
  { name: 'Jadon Li', email: 'jadonli2020@gmail.com', committeeId: 'videography_photography', position: 'member', isAsbo: true, grade: 12 },
  { name: 'Ariel Duong', email: '1010cookiegram@gmail.com', committeeId: 'community', position: 'member', isAsbo: true, grade: 12 },
  { name: 'Kaiwei Parks', email: 'kaiweiparks@gmail.com', committeeId: 'activities', position: 'head', isAsbo: true, grade: 12 },
  { name: 'Melody Gao', email: 'melodygao2002@gmail.com', committeeId: 'student_store', position: 'head', isAsbo: true, grade: 12 },
  { name: 'Hanna Rahmanian', email: 'rosiebloom16@gmail.com', committeeId: 'activities', position: 'head', isAsbo: true, grade: 12 },
  { name: 'Aarit Patnaik', email: 'aarit.patnaik@gmail.com', committeeId: 'activities', position: 'member', grade: 12, notes: 'SCO Secretary' },
  { name: 'Santhosh Arunkumar', email: 'santhoshh.arunkumar@gmail.com', committeeId: 'activities', position: 'member', grade: 11, notes: 'JCO President' },
  { name: 'Chasen Lam', email: 'chasenlam@gmail.com', committeeId: 'activities', position: 'baby', grade: 11 },
  { name: 'Ruirui Liu', email: 'liuruirui688@gmail.com', committeeId: 'community', position: 'head', grade: 12 },
  { name: 'Dylan Mandal', email: 'dylanmandal@gmail.com', committeeId: 'community', position: 'member', grade: 12 },
  { name: 'Megan Ng', email: 'meganng24@gmail.com', committeeId: 'community', position: 'baby', grade: 11 },
  { name: 'Emma Cai', email: 'emmacai2016@gmail.com', committeeId: 'community', position: 'baby', grade: 11 },
  { name: 'Megan Chu', email: 'meignm3gan@gmail.com', committeeId: 'elections', position: 'head', grade: 12 },
  { name: 'Hanna (Yuanting) Cai', email: 'hannacai888@gmail.com', committeeId: 'elections', position: 'member', grade: 12 },
  { name: 'Alanice Tam', email: 'alanicetam@gmail.com', committeeId: 'elections', position: 'member', grade: 12 },
  { name: 'Aarohi Verma', email: 'eliminacourt@gmail.com', committeeId: 'elections', position: 'baby', grade: 11 },
  { name: 'Sahil Jain', email: 'sahiljain8512@gmail.com', committeeId: 'fundraising', position: 'head', grade: 12, notes: 'SCO Treasurer' },
  { name: 'Anchith Arji', email: 'anchitharji02@gmail.com', committeeId: 'fundraising', position: 'member', grade: 12 },
  { name: 'Pradyun Kanuparthi', email: 'kvpradyun@gmail.com', committeeId: 'fundraising', position: 'member', grade: 12, notes: 'SCO President' },
  { name: 'Sofie Pan', email: 'sofie.pan@gmail.com', committeeId: 'fundraising', position: 'member', grade: 11, notes: 'JCO Vice President' },
  { name: 'Riya Ramadass', email: 'riyapappa@gmail.com', committeeId: 'fundraising', position: 'baby', grade: 11 },
  { name: 'Ashish Swaminathan', email: 'ashtdm11@gmail.com', committeeId: 'gtac', position: 'head', grade: 12 },
  { name: 'Anirudh Chakraborty', email: 'anirudhc141@gmail.com', committeeId: 'gtac', position: 'head', grade: 12 },
  { name: 'Adrit Das', email: 'dasadrit22@gmail.com', committeeId: 'gtac', position: 'member', grade: 12 },
  { name: 'Matthew Wang', email: 'mat4wan@gmail.com', committeeId: 'gtac', position: 'member', grade: 12 },
  { name: 'Deborah Wang', email: 'deborah.wang8810@gmail.com', committeeId: 'gtac', position: 'baby', grade: 11 },
  { name: 'Abirami Palaniappan', email: 'Abipal828@gmail.com', committeeId: 'hcmc', position: 'head', grade: 12 },
  { name: 'Avina Wong', email: 'awong2534@gmail.com', committeeId: 'hcmc', position: 'head', grade: 12 },
  { name: 'Caitlin Tran', email: 'cait.tran6@gmail.com', committeeId: 'hcmc', position: 'baby', grade: 11 },
  { name: 'Yili Feng', email: 'yilif2010@gmail.com', committeeId: 'hcmc', position: 'baby', grade: 11 },
  { name: 'Devon Mandal', email: 'devonmandal@gmail.com', committeeId: 'publicity', position: 'head', grade: 12 },
  { name: 'Iris Hsiung', email: 'irishsiung@gmail.com', committeeId: 'publicity', position: 'head', grade: 12 },
  { name: 'Janelle Chen', email: 'janchen984@gmail.com', committeeId: 'publicity', position: 'member', grade: 12 },
  { name: 'Anna Dai', email: 'annadai008@gmail.com', committeeId: 'publicity', position: 'baby', grade: 11 },
  { name: 'Ethan Chen', email: 'mr.ethanchen315@gmail.com', committeeId: 'sports', position: 'head', grade: 12, notes: 'SCO Vice President' },
  { name: 'Zerek Kao', email: 'zerekao2@gmail.com', committeeId: 'sports', position: 'member', grade: 12 },
  { name: 'Xinyan (Grace) Zeng', email: 'xinyanzeng88@gmail.com', committeeId: 'sports', position: 'member', grade: 12 },
  { name: 'Kylie Hsu', email: 'kylhsu23@gmail.com', committeeId: 'sports', position: 'baby', grade: 11 },
  { name: 'Nakshatra Rajeshkanna', email: 'nakshatrarajeshkanna@gmail.com', committeeId: 'star', position: 'head', grade: 12 },
  { name: 'Samantha Liang', email: 'samliang0223@gmail.com', committeeId: 'star', position: 'member', grade: 12 },
  { name: 'Lionel Lu', email: 'lionel.lu5536@gmail.com', committeeId: 'star', position: 'member', grade: 12 },
  { name: 'Shriya Iyengar', email: 'shriya.aarushi@gmail.com', committeeId: 'star', position: 'baby', grade: 11 },
  { name: 'Armaan Singh', email: 'jaswsingh510@gmail.com', committeeId: 'student_store', position: 'member', grade: 12 },
  { name: 'Abhay Shankar', email: 'abhay.shankar4321@gmail.com', committeeId: 'student_store', position: 'member', grade: 12 },
  { name: 'Sophia Doan', email: 'sophiaqdoan@outlook.com', committeeId: 'student_store', position: 'baby', grade: 11, notes: 'JCO Treasurer' },
  { name: 'Samay Jain', email: 'samayj14@gmail.com', committeeId: 'tech', position: 'head', grade: 12 },
  { name: 'Rishabh Rajanikanth', email: 'rishabh.rajanikanth08@gmail.com', committeeId: 'tech', position: 'member', grade: 12 },
  { name: 'Yashika Hegde', email: 'yashikahegde080@gmail.com', committeeId: 'tech', position: 'member', grade: 12 },
  { name: 'Caden Yang', email: 'caden12.yang@gmail.com', committeeId: 'tech', position: 'baby', grade: 11 },
  { name: 'Danny Lou', email: 'fdannyl1219@gmail.com', committeeId: 'videography_photography', position: 'head', grade: 12 },
  { name: 'Michael Hung', email: 'micmicansonhung@gmail.com', committeeId: 'videography_photography', position: 'member', grade: 12 },
  { name: 'Kevin Wang', email: 'kevinkunzhong@gmail.com', committeeId: 'videography_photography', position: 'member', grade: 11, notes: 'JCO Secretary' },
  { name: 'Melina Chin', email: 'melinalchin@gmail.com', committeeId: 'videography_photography', position: 'baby', grade: 11 },
  { name: 'Lavena Soedomo', email: 'lavena.thea@gmail.com', committeeId: null, position: 'ta', grade: 12 },
]

const COMMITTEE_META: Record<string, { name: string; email: string }> = {
  activities: { name: 'Activities', email: 'msjateam@gmail.com' },
  community: { name: 'Community', email: 'msjcommunity21.22@gmail.com' },
  elections: { name: 'Elections', email: 'msjelections@gmail.com' },
  fundraising: { name: 'Fundraising', email: 'msjfund@gmail.com' },
  gtac: { name: 'Campus', email: 'msjgreenteam@gmail.com' },
  hcmc: { name: 'HCMC', email: 'msjhs.hcmc@gmail.com' },
  publicity: { name: 'Publicity', email: 'msjpublicity@gmail.com' },
  student_store: { name: 'Student Store', email: 'msjstudentstore@gmail.com' },
  star: { name: 'STAR', email: 'msjhs.star@gmail.com' },
  sports: { name: 'Sports', email: 'l2sportscommittee@gmail.com' },
  tech: { name: 'Tech', email: 'msjhtechteam@gmail.com' },
  videography_photography: {
    name: 'Videography/Photography',
    email: 'msjvideography@gmail.com',
  },
}

function buildCommittees(): RosterCommittee[] {
  return Object.entries(COMMITTEE_META).map(([id, meta]) => {
    const people = L2_ROSTER_PEOPLE.filter((p) => p.committeeId === id)
    return {
      id,
      name: meta.name,
      email: meta.email,
      headNames: people.filter((p) => p.position === 'head').map((p) => p.name),
      members: people.map((p) => p.name),
      babyNames: people.filter((p) => p.position === 'baby').map((p) => p.name),
      isMine: id === 'tech',
    }
  })
}

export const L2_ROSTER_COMMITTEES: RosterCommittee[] = buildCommittees()

export function primaryHead(committee: RosterCommittee): string | null {
  return committee.headNames[0] ?? committee.members[0] ?? null
}

export function allRosterPeople(): {
  name: string
  committeeId: string
  committeeName: string
  isHead: boolean
  isBaby: boolean
}[] {
  return L2_ROSTER_COMMITTEES.flatMap((committee) =>
    committee.members.map((name) => ({
      name,
      committeeId: committee.id,
      committeeName: committee.name,
      isHead: committee.headNames.includes(name),
      isBaby: committee.babyNames.includes(name),
    })),
  )
}
