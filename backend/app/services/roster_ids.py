"""Roster student IDs — separate from login passwords.

Student IDs are used only for attendance barcode/keypad enrollment. They must
never be treated as the account password: campers change passwords in Auth
without losing their ID mapping.

Source file (gitignored): `backend/data/roster_student_ids.json`

  {
    "camper@gmail.com": "123456",
    "by-name:Jadon Li": "123456"
  }

Keys are emails (preferred) or `by-name:<Full Name>` when an email is missing.
Passwords live in a different file: `roster_credentials.json`.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).resolve().parents[2] / "data"
STUDENT_IDS_PATH = DATA_DIR / "roster_student_ids.json"
CREDENTIALS_PATH = DATA_DIR / "roster_credentials.json"


def load_student_ids(path: Path | None = None) -> dict[str, str]:
    """email-or-by-name key → raw student ID string."""
    target = path or STUDENT_IDS_PATH
    if not target.exists():
        return {}
    data = json.loads(target.read_text())
    out: dict[str, str] = {}
    for key, value in data.items():
        if str(key).startswith("_"):
            continue
        sid = str(value).strip()
        if not sid:
            continue
        out[str(key).strip()] = sid
    return out


def load_initial_passwords(path: Path | None = None) -> dict[str, str]:
    """email → initial Auth password (bootstrap only; never the attendance ID)."""
    target = path or CREDENTIALS_PATH
    if not target.exists():
        return {}
    data = json.loads(target.read_text())
    out: dict[str, str] = {}
    for key, value in data.items():
        if str(key).startswith("_"):
            continue
        # New shape: { "student_id": "...", "initial_password": "..." }
        if isinstance(value, dict):
            password = value.get("initial_password") or value.get("password")
            if password:
                out[str(key).strip().lower()] = str(password).strip()
            continue
        password = str(value).strip()
        if password:
            out[str(key).strip().lower()] = password
    return out


def student_id_for_person(
    *,
    email: str,
    name: str,
    ids: dict[str, str] | None = None,
) -> str | None:
    mapping = ids if ids is not None else load_student_ids()
    email_key = email.strip().lower()
    if email_key in mapping:
        return mapping[email_key]
    # Case-preserving email keys from the JSON file.
    for key, value in mapping.items():
        if key.lower() == email_key:
            return value
    from app.services.campers import normalize_person_name

    name_key = f"by-name:{name.strip()}"
    if name_key in mapping:
        return mapping[name_key]
    normalized = normalize_person_name(name)
    for key, value in mapping.items():
        if not key.lower().startswith("by-name:"):
            continue
        label = key.split(":", 1)[1]
        if normalize_person_name(label) == normalized:
            return value
    return None
