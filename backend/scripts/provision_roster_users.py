#!/usr/bin/env python3
"""Provision Supabase auth users for every Leadership 2 roster camper.

Login email     = spreadsheet email
Initial password = backend/data/roster_credentials.json  (Auth only)
Student ID       = backend/data/roster_student_ids.json   (attendance only)

These are deliberately separate files / variables. Campers may change their
Auth password later; that must not overwrite or clear their student ID digest.

Requires:
  SUPABASE_URL
  SUPABASE_SERVICE_KEY

Optional:
  --dry-run          print actions without creating users
  --reset-passwords  also reset Auth password for users that already exist
                     (default: leave existing passwords alone)

After accounts exist, an AC should click Sync roster on Campers so committees,
roles, and student-ID attendance enrollment attach.
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.db.l2_roster import L2_ROSTER_PEOPLE  # noqa: E402
from app.services.roster_ids import (  # noqa: E402
    load_initial_passwords,
    load_student_ids,
    student_id_for_person,
)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument(
        "--reset-passwords",
        action="store_true",
        help="Overwrite Auth passwords for existing users (does not touch student IDs).",
    )
    args = parser.parse_args()

    passwords = load_initial_passwords()
    student_ids = load_student_ids()
    url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_KEY", "")
    if not args.dry_run and (not url or not key):
        raise SystemExit(
            "Set SUPABASE_URL and SUPABASE_SERVICE_KEY in the environment."
        )

    try:
        from supabase import create_client
    except ImportError as exc:
        raise SystemExit("Install supabase: pip install supabase") from exc

    client = None if args.dry_run else create_client(url, key)

    created = 0
    updated = 0
    skipped = 0
    errors: list[str] = []

    for person in L2_ROSTER_PEOPLE:
        password = passwords.get(person.email.lower())
        sid = student_id_for_person(
            email=person.email, name=person.name, ids=student_ids
        )
        if not password:
            skipped += 1
            print(
                f"SKIP  {person.email}  (no initial_password in roster_credentials.json)"
            )
            continue

        payload = {
            "email": person.email,
            "password": password,
            "email_confirm": True,
            "user_metadata": {
                "full_name": person.name,
                # Metadata hint only — attendance enrollment uses the digest
                # store, not Auth. Never treat this as the login secret later.
                "roster_student_id_last4": (sid[-4:] if sid else None),
            },
        }
        if args.dry_run:
            print(
                f"DRY   create {person.email} ({person.name})"
                f"  password≠student_id={bool(sid and sid != password)}"
                f"  has_student_id={bool(sid)}"
            )
            created += 1
            continue

        assert client is not None
        try:
            client.auth.admin.create_user(payload)
            created += 1
            print(f"OK    created {person.email}")
        except Exception as exc:  # noqa: BLE001
            message = str(exc).lower()
            if "already" in message or "registered" in message or "exists" in message:
                try:
                    listed = client.auth.admin.list_users()
                    users = getattr(listed, "users", listed) or []
                    match = next(
                        (
                            u
                            for u in users
                            if getattr(u, "email", "").lower() == person.email.lower()
                        ),
                        None,
                    )
                    if match is None:
                        raise RuntimeError("user exists but could not be listed") from exc
                    update: dict = {
                        "user_metadata": {
                            "full_name": person.name,
                            "roster_student_id_last4": (sid[-4:] if sid else None),
                        }
                    }
                    if args.reset_passwords:
                        update["password"] = password
                    client.auth.admin.update_user_by_id(match.id, update)
                    updated += 1
                    print(
                        f"OK    updated {person.email}"
                        + (" (password reset)" if args.reset_passwords else "")
                    )
                except Exception as update_exc:  # noqa: BLE001
                    errors.append(f"{person.email}: {update_exc}")
                    print(f"ERR   {person.email}: {update_exc}")
            else:
                errors.append(f"{person.email}: {exc}")
                print(f"ERR   {person.email}: {exc}")

    print(
        f"\nDone. created={created} updated={updated} skipped={skipped} errors={len(errors)}"
    )
    print(
        "Next: sign in as AC → Campers → Sync roster "
        "(also enrolls student IDs from roster_student_ids.json)"
    )
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
