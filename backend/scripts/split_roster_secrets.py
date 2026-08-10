#!/usr/bin/env python3
"""Split a legacy combined credentials file into passwords + student IDs.

Older setups used `roster_credentials.json` as email → student ID, and that
same value was also the Auth password. This script copies those values into
`roster_student_ids.json` (attendance) and leaves `roster_credentials.json` as
the initial-password file (Auth), so the two concerns stay independent going
forward.

Safe to re-run: does not overwrite an existing student-ids file unless
`--force` is passed.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CREDENTIALS = ROOT / "data" / "roster_credentials.json"
STUDENT_IDS = ROOT / "data" / "roster_student_ids.json"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--force",
        action="store_true",
        help="Overwrite roster_student_ids.json even if it already exists.",
    )
    args = parser.parse_args()

    if not CREDENTIALS.exists():
        raise SystemExit(f"Missing {CREDENTIALS}")

    raw = json.loads(CREDENTIALS.read_text())
    ids: dict[str, str] = {"_comment": "Attendance student IDs — not Auth passwords."}
    passwords: dict[str, str] = {
        "_comment": "Initial Auth passwords only — campers may change these later."
    }

    for key, value in raw.items():
        if str(key).startswith("_"):
            continue
        if isinstance(value, dict):
            sid = value.get("student_id")
            pwd = value.get("initial_password") or value.get("password")
            if sid:
                ids[str(key)] = str(sid).strip()
            if pwd:
                passwords[str(key)] = str(pwd).strip()
            continue
        text = str(value).strip()
        if not text:
            continue
        # Legacy: one string was both the student ID and the bootstrap password.
        ids[str(key)] = text
        passwords[str(key)] = text

    if STUDENT_IDS.exists() and not args.force:
        print(f"Keep existing {STUDENT_IDS} (pass --force to overwrite)")
    else:
        STUDENT_IDS.write_text(json.dumps(ids, indent=2) + "\n")
        print(f"Wrote {STUDENT_IDS} ({len(ids) - 1} student IDs)")

    CREDENTIALS.write_text(json.dumps(passwords, indent=2) + "\n")
    print(
        f"Updated {CREDENTIALS} ({len(passwords) - 1} initial passwords). "
        "Passwords and student IDs are now separate variables."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
