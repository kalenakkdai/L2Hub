"""Canonical Leadership 2 roster (class spreadsheet, Aug 2026).

Used by local seed helpers and docs. Does not create auth.users — students
must sign up (or be provisioned) before membership rows can attach.

Column aliases from the sheet:
  A-Team → activities
  Fund → fundraising
  Vid → videography_photography
  ASBOS → asbo role (not a committee)
"""

from __future__ import annotations

from typing import Final

# Spreadsheet ASBOS column — assign `asbo` role when provisioning accounts.
L2_ASBOS: Final[tuple[str, ...]] = (
    "Jadon Li",
    "Ariel Duong",
    "Kaiwei Parks",
    "Melody Gao",
    "Hanna Rahmanian",
)

# (slug, display_name, committee_email, head_names, member_names)
L2_ROSTER_COMMITTEES: Final[
    tuple[tuple[str, str, str, tuple[str, ...], tuple[str, ...]], ...]
] = (
    (
        "activities",
        "Activities",
        "msjateam@gmail.com",
        ("Hanna Rahmanian", "Kaiwei Parks"),
        (
            "Hanna Rahmanian",
            "Kaiwei Parks",
            "Aarit Patnaik",
            "Santhosh Arunkumar",
            "Chasen Lam",
        ),
    ),
    (
        "community",
        "Community",
        "msjcommunity21.22@gmail.com",
        ("Ariel Duong",),
        (
            "Ariel Duong",
            "Ruirui Liu",
            "Dylan Mandal",
            "Megan Ng",
            "Emma Cai",
        ),
    ),
    (
        "elections",
        "Elections",
        "msjelections@gmail.com",
        ("Megan Chu",),
        (
            "Megan Chu",
            "Hanna (Yuanting) Cai",
            "Alanice Tam",
            "Aarohi Verma",
        ),
    ),
    (
        "fundraising",
        "Fundraising",
        "msjfund@gmail.com",
        ("Sahil Jain",),
        (
            "Sahil Jain",
            "Anchith Arji",
            "Pradyun Kanuparthi",
            "Sofie Pan",
            "Riya Ramadass",
        ),
    ),
    (
        "gtac",
        "GTAC",
        "msjgreenteam@gmail.com",
        ("Ashish Swaminathan",),
        (
            "Ashish Swaminathan",
            "Anirudh Chakraborty",
            "Adrit Das",
            "Matthew Wang",
            "Lavena Thea",
            "Deborah Wang",
        ),
    ),
    (
        "hcmc",
        "HCMC",
        "msjhs.hcmc@gmail.com",
        ("Abirami Palaniappan",),
        (
            "Abirami Palaniappan",
            "Avina Wong",
            "Caitlin Tran",
            "Yili Feng",
        ),
    ),
    (
        "publicity",
        "Publicity",
        "msjpublicity@gmail.com",
        ("Devon Mandal",),
        ("Devon Mandal", "Iris Hsiung", "Janelle Chen", "Anna Dai"),
    ),
    (
        "student_store",
        "Student Store",
        "msjstudentstore@gmail.com",
        ("Melody Gao",),
        (
            "Melody Gao",
            "Armaan Singh",
            "Abhay Shankar",
            "Sophia Doan",
        ),
    ),
    (
        "star",
        "STAR",
        "msjhs.star@gmail.com",
        ("Nakshatra Rajeshkanna",),
        (
            "Nakshatra Rajeshkanna",
            "Vardaan Iyer",
            "Samantha Liang",
            "Lionel Lu",
            "Shriya Iyengar",
        ),
    ),
    (
        "sports",
        "Sports",
        "l2sportscommittee@gmail.com",
        ("Ethan Chen",),
        (
            "Ethan Chen",
            "Zerek Kao",
            "Xinyan (Grace) Zeng",
            "Kylie Hsu",
        ),
    ),
    (
        "tech",
        "Tech",
        "msjhtechteam@gmail.com",
        ("Samay Jain",),
        (
            "Samay Jain",
            "Rishabh Rajanikanth",
            "Yashika Hegde",
            "Caden Yang",
        ),
    ),
    (
        "videography_photography",
        "Videography/Photography",
        "msjvideography@gmail.com",
        ("Jadon Li",),
        (
            "Jadon Li",
            "Danny Lou",
            "Michael Hung",
            "Kevin Wang",
            "Melina Chin",
        ),
    ),
)
