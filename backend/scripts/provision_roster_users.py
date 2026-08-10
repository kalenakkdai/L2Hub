#!/usr/bin/env python3
"""Provision Supabase auth users for every Leadership 2 roster camper.

Login email = spreadsheet email
Password   = student ID# from backend/data/roster_credentials.json (gitignored)

Requires:
  SUPABASE_URL
  SUPABASE_SERVICE_KEY

Optional:
  --dry-run   print actions without creating users
  --sync-only skip auth create; only print reminder to call Sync roster

After accounts exist, an AC should click Sync roster on Campers (or call
POST /admin/users/sync-roster) so committees / baby / head / asbo attach.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.db.l2_roster import L2_ROSTER_PEOPLE  # noqa: E402


def load_credentials() -> dict[str, str]:
    path = ROOT / "data" / "roster_credentials.json"
    if not path.exists():
        example = ROOT / "data" / "roster_credentials.example.json"
        raise SystemExit(
            f"Missing {path}. Copy {example} and fill student ID passwords."
        )
    data = json.loads(path.read_text())
    return {
        str(email).strip(): str(password).strip()
        for email, password in data.items()
        if not str(email).startswith("_") and password
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    creds = load_credentials()
    url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_KEY", "")
    if not args.dry_run and (not url or not key):
        raise SystemExit(
            "Set SUPABASE_URL and SUPABASE_SERVICE_KEY in the environment."
        )

    try:
        from supabase import create_client
    except ImportError as exc:
        raise SystemExit(
            "Install supabase: pip install supabase"
        ) from exc

    client = None if args.dry_run else create_client(url, key)

    created = 0
    updated = 0
    skipped = 0
    errors: list[str] = []

    for person in L2_ROSTER_PEOPLE:
        password = creds.get(person.email) or creds.get(person.email.lower())
        if not password:
            skipped += 1
            print(f"SKIP  {person.email}  (no student ID in credentials file)")
            continue

        payload = {
            "email": person.email,
            "password": password,
            "email_confirm": True,
            "user_metadata": {"full_name": person.name},
        }
        if args.dry_run:
            print(f"DRY   create {person.email} ({person.name})")
            created += 1
            continue

        assert client is not None
        try:
            client.auth.admin.create_user(payload)
            created += 1
            print(f"OK    created {person.email}")
        except Exception as exc:  # noqa: BLE001 — surface per-user failures
            message = str(exc).lower()
            if "already" in message or "registered" in message or "exists" in message:
                try:
                    # Look up and reset password so roster IDs stay the login.
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
                    client.auth.admin.update_user_by_id(
                        match.id,
                        {
                            "password": password,
                            "user_metadata": {"full_name": person.name},
                        },
                    )
                    updated += 1
                    print(f"OK    updated {person.email}")
                except Exception as update_exc:  # noqa: BLE001
                    errors.append(f"{person.email}: {update_exc}")
                    print(f"ERR   {person.email}: {update_exc}")
            else:
                errors.append(f"{person.email}: {exc}")
                print(f"ERR   {person.email}: {exc}")

    print(
        f"\nDone. created={created} updated={updated} skipped={skipped} errors={len(errors)}"
    )
    print("Next: sign in as AC → Campers → Sync roster")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
