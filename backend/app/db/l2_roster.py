"""Canonical Leadership 2 roster (class spreadsheet, Aug 2026).

People are the source of truth. Committee tuples are derived for seed helpers
and Campers merge.

Column aliases from the sheet:
  A-Team → activities
  Fund → fundraising
  Campus → gtac (Green Team / Campus ops)
  Vid → videography_photography
  ASBOS → asbo role (not a committee)

Student ID numbers for attendance live in `backend/data/roster_student_ids.json`
(gitignored). Initial Auth passwords live in a *separate* file,
`backend/data/roster_credentials.json`. Campers can change passwords without
affecting their attendance ID.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Final, Literal

RosterPosition = Literal["head", "member", "baby", "ta"]


@dataclass(frozen=True, slots=True)
class RosterPerson:
    name: str
    email: str
    committee_slug: str | None
    position: RosterPosition
    is_asbo: bool = False
    grade: int | None = None
    notes: str = ""


# Spreadsheet ASBOS column — assign `asbo` role when provisioning accounts.
L2_ASBOS: Final[tuple[str, ...]] = (
    "Jadon Li",
    "Ariel Duong",
    "Kaiwei Parks",
    "Melody Gao",
    "Hanna Rahmanian",
)

# Full class roster from Leadership II 2026-2027 spreadsheet.
# Baby = member role + shadow request UI. Head = committee_head membership.
L2_ROSTER_PEOPLE: Final[tuple[RosterPerson, ...]] = (
    RosterPerson(
        "Jadon Li",
        "jadonli2020@gmail.com",
        "videography_photography",
        "member",
        is_asbo=True,
        grade=12,
        notes="ASB President",
    ),
    RosterPerson(
        "Ariel Duong",
        "1010cookiegram@gmail.com",
        "community",
        "member",
        is_asbo=True,
        grade=12,
        notes="ASB Vice President",
    ),
    RosterPerson(
        "Kaiwei Parks",
        "kaiweiparks@gmail.com",
        "activities",
        "head",
        is_asbo=True,
        grade=12,
        notes="ASB Secretary",
    ),
    RosterPerson(
        "Melody Gao",
        "melodygao2002@gmail.com",
        "student_store",
        "head",
        is_asbo=True,
        grade=12,
        notes="ASB Treasurer",
    ),
    RosterPerson(
        "Hanna Rahmanian",
        "rosiebloom16@gmail.com",
        "activities",
        "head",
        is_asbo=True,
        grade=12,
        notes="ASB Activities Coordinator",
    ),
    RosterPerson(
        "Aarit Patnaik",
        "aarit.patnaik@gmail.com",
        "activities",
        "member",
        grade=12,
        notes="SCO Secretary",
    ),
    RosterPerson(
        "Santhosh Arunkumar",
        "santhoshh.arunkumar@gmail.com",
        "activities",
        "member",
        grade=11,
        notes="JCO President",
    ),
    RosterPerson("Chasen Lam", "chasenlam@gmail.com", "activities", "baby", grade=11),
    RosterPerson(
        "Ruirui Liu", "liuruirui688@gmail.com", "community", "head", grade=12
    ),
    RosterPerson(
        "Dylan Mandal", "dylanmandal@gmail.com", "community", "member", grade=12
    ),
    RosterPerson("Megan Ng", "meganng24@gmail.com", "community", "baby", grade=11),
    RosterPerson("Emma Cai", "emmacai2016@gmail.com", "community", "baby", grade=11),
    RosterPerson("Megan Chu", "meignm3gan@gmail.com", "elections", "head", grade=12),
    RosterPerson(
        "Hanna (Yuanting) Cai",
        "hannacai888@gmail.com",
        "elections",
        "member",
        grade=12,
    ),
    RosterPerson(
        "Alanice Tam", "alanicetam@gmail.com", "elections", "member", grade=12
    ),
    RosterPerson(
        "Aarohi Verma", "eliminacourt@gmail.com", "elections", "baby", grade=11
    ),
    RosterPerson(
        "Sahil Jain",
        "sahiljain8512@gmail.com",
        "fundraising",
        "head",
        grade=12,
        notes="SCO Treasurer",
    ),
    RosterPerson(
        "Anchith Arji", "anchitharji02@gmail.com", "fundraising", "member", grade=12
    ),
    RosterPerson(
        "Pradyun Kanuparthi",
        "kvpradyun@gmail.com",
        "fundraising",
        "member",
        grade=12,
        notes="SCO President",
    ),
    RosterPerson(
        "Sofie Pan",
        "sofie.pan@gmail.com",
        "fundraising",
        "member",
        grade=11,
        notes="JCO Vice President",
    ),
    RosterPerson(
        "Riya Ramadass", "riyapappa@gmail.com", "fundraising", "baby", grade=11
    ),
    RosterPerson(
        "Ashish Swaminathan", "ashtdm11@gmail.com", "gtac", "head", grade=12
    ),
    RosterPerson(
        "Anirudh Chakraborty", "anirudhc141@gmail.com", "gtac", "head", grade=12
    ),
    RosterPerson("Adrit Das", "dasadrit22@gmail.com", "gtac", "member", grade=12),
    RosterPerson("Matthew Wang", "mat4wan@gmail.com", "gtac", "member", grade=12),
    RosterPerson(
        "Deborah Wang", "deborah.wang8810@gmail.com", "gtac", "baby", grade=11
    ),
    RosterPerson(
        "Abirami Palaniappan", "Abipal828@gmail.com", "hcmc", "head", grade=12
    ),
    RosterPerson("Avina Wong", "awong2534@gmail.com", "hcmc", "head", grade=12),
    RosterPerson("Caitlin Tran", "cait.tran6@gmail.com", "hcmc", "baby", grade=11),
    RosterPerson("Yili Feng", "yilif2010@gmail.com", "hcmc", "baby", grade=11),
    RosterPerson(
        "Devon Mandal", "devonmandal@gmail.com", "publicity", "head", grade=12
    ),
    RosterPerson("Iris Hsiung", "irishsiung@gmail.com", "publicity", "head", grade=12),
    RosterPerson(
        "Janelle Chen", "janchen984@gmail.com", "publicity", "member", grade=12
    ),
    RosterPerson("Anna Dai", "annadai008@gmail.com", "publicity", "baby", grade=11),
    RosterPerson(
        "Ethan Chen",
        "mr.ethanchen315@gmail.com",
        "sports",
        "head",
        grade=12,
        notes="SCO Vice President",
    ),
    RosterPerson("Zerek Kao", "zerekao2@gmail.com", "sports", "member", grade=12),
    RosterPerson(
        "Xinyan (Grace) Zeng",
        "xinyanzeng88@gmail.com",
        "sports",
        "member",
        grade=12,
    ),
    RosterPerson("Kylie Hsu", "kylhsu23@gmail.com", "sports", "baby", grade=11),
    RosterPerson(
        "Nakshatra Rajeshkanna",
        "nakshatrarajeshkanna@gmail.com",
        "star",
        "head",
        grade=12,
    ),
    RosterPerson(
        "Samantha Liang", "samliang0223@gmail.com", "star", "member", grade=12
    ),
    RosterPerson("Lionel Lu", "lionel.lu5536@gmail.com", "star", "member", grade=12),
    RosterPerson(
        "Shriya Iyengar", "shriya.aarushi@gmail.com", "star", "baby", grade=11
    ),
    RosterPerson(
        "Armaan Singh", "jaswsingh510@gmail.com", "student_store", "member", grade=12
    ),
    RosterPerson(
        "Abhay Shankar",
        "abhay.shankar4321@gmail.com",
        "student_store",
        "member",
        grade=12,
    ),
    RosterPerson(
        "Sophia Doan",
        "sophiaqdoan@outlook.com",
        "student_store",
        "baby",
        grade=11,
        notes="JCO Treasurer",
    ),
    RosterPerson("Samay Jain", "samayj14@gmail.com", "tech", "head", grade=12),
    RosterPerson(
        "Rishabh Rajanikanth",
        "rishabh.rajanikanth08@gmail.com",
        "tech",
        "member",
        grade=12,
    ),
    RosterPerson(
        "Yashika Hegde", "yashikahegde080@gmail.com", "tech", "member", grade=12
    ),
    RosterPerson("Caden Yang", "caden12.yang@gmail.com", "tech", "baby", grade=11),
    RosterPerson(
        "Danny Lou",
        "fdannyl1219@gmail.com",
        "videography_photography",
        "head",
        grade=12,
    ),
    RosterPerson(
        "Michael Hung",
        "micmicansonhung@gmail.com",
        "videography_photography",
        "member",
        grade=12,
    ),
    RosterPerson(
        "Kevin Wang",
        "kevinkunzhong@gmail.com",
        "videography_photography",
        "member",
        grade=11,
        notes="JCO Secretary",
    ),
    RosterPerson(
        "Melina Chin",
        "melinalchin@gmail.com",
        "videography_photography",
        "baby",
        grade=11,
    ),
    RosterPerson(
        "Lavena Soedomo",
        "lavena.thea@gmail.com",
        None,
        "ta",
        grade=12,
        notes="Teacher's Assistant",
    ),
)

_COMMITTEE_META: Final[dict[str, tuple[str, str]]] = {
    "activities": ("Activities", "msjateam@gmail.com"),
    "community": ("Community", "msjcommunity21.22@gmail.com"),
    "elections": ("Elections", "msjelections@gmail.com"),
    "fundraising": ("Fundraising", "msjfund@gmail.com"),
    "gtac": ("Campus", "msjgreenteam@gmail.com"),
    "hcmc": ("HCMC", "msjhs.hcmc@gmail.com"),
    "publicity": ("Publicity", "msjpublicity@gmail.com"),
    "student_store": ("Student Store", "msjstudentstore@gmail.com"),
    "star": ("STAR", "msjhs.star@gmail.com"),
    "sports": ("Sports", "l2sportscommittee@gmail.com"),
    "tech": ("Tech", "msjhtechteam@gmail.com"),
    "videography_photography": ("Videography/Photography", "msjvideography@gmail.com"),
}


def _build_committee_tuples() -> tuple[
    tuple[str, str, str, tuple[str, ...], tuple[str, ...]], ...
]:
    by_slug: dict[str, list[RosterPerson]] = {slug: [] for slug in _COMMITTEE_META}
    for person in L2_ROSTER_PEOPLE:
        if person.committee_slug and person.committee_slug in by_slug:
            by_slug[person.committee_slug].append(person)

    rows: list[tuple[str, str, str, tuple[str, ...], tuple[str, ...]]] = []
    for slug, (display, email) in _COMMITTEE_META.items():
        people = by_slug[slug]
        heads = tuple(p.name for p in people if p.position == "head")
        members = tuple(p.name for p in people)
        rows.append((slug, display, email, heads, members))
    return tuple(rows)


L2_ROSTER_COMMITTEES: Final[
    tuple[tuple[str, str, str, tuple[str, ...], tuple[str, ...]], ...]
] = _build_committee_tuples()


def roster_babies() -> tuple[RosterPerson, ...]:
    return tuple(p for p in L2_ROSTER_PEOPLE if p.position == "baby")


def person_by_email(email: str) -> RosterPerson | None:
    needle = email.strip().lower()
    for person in L2_ROSTER_PEOPLE:
        if person.email.lower() == needle:
            return person
    return None
