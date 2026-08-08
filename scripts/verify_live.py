#!/usr/bin/env python3
"""Verify behaviour against the real Supabase project, as a real signed-in user.

Mocked tests cannot see RLS, GRANTs, storage policies, or bucket rules — the
settings page shipped once with every write returning "permission denied for
table profiles" while its component tests were green. This script exercises the
same HTTP calls the browser makes, signed in as a seeded development account.

Usage:
    python3 scripts/verify_live.py escalation     # can a member exceed their role?
    python3 scripts/verify_live.py settings       # profile + preference writes
    python3 scripts/verify_live.py avatars        # storage bucket rules
    python3 scripts/verify_live.py notifications  # notifications read path
    python3 scripts/verify_live.py all

`notifications` needs the FastAPI backend running; the rest talk to Supabase
directly.

Everything it writes, it removes. The project is shared with another
developer, so leaving test rows behind is not acceptable.

Reads credentials from frontend/.env and never prints them.
"""

from __future__ import annotations

import base64
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEV_PASSWORD = "l2hubdev"

# 1x1 transparent PNG.
TINY_PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
)


def load_env() -> tuple[str, str]:
    """Reads `.env`, then `.env.local` over the top of it if it exists.

    Same rule as Vite and as app/core/config.py, so this script follows
    whichever database the app is currently pointed at rather than needing to
    be told separately.
    """
    env: dict[str, str] = {}
    for name in (".env", ".env.local"):
        path = ROOT / "frontend" / name
        if not path.exists():
            continue
        for line in path.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                env[key.strip()] = value.strip().strip('"').strip("'")

    missing = [
        k for k in ("VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY") if not env.get(k)
    ]
    if missing:
        raise SystemExit(f"frontend/.env is missing {', '.join(missing)}")

    return env["VITE_SUPABASE_URL"], env["VITE_SUPABASE_PUBLISHABLE_KEY"]


URL, KEY = load_env()

#: Whether we are pointed at a throwaway database. The local stack is safe to
#: write to freely; the shared project is another developer's data.
IS_LOCAL = "127.0.0.1" in URL or "localhost" in URL


def call(
    path: str,
    method: str = "GET",
    body: bytes | dict | None = None,
    *,
    token: str | None = None,
    content_type: str | None = "application/json",
    headers: dict[str, str] | None = None,
) -> tuple[int, bytes]:
    request = urllib.request.Request(f"{URL}{path}", method=method)
    request.add_header("apikey", KEY)
    request.add_header("Authorization", f"Bearer {token or KEY}")

    data: bytes | None
    if isinstance(body, dict):
        data = json.dumps(body).encode()
    else:
        data = body

    if data is not None and content_type:
        request.add_header("Content-Type", content_type)
    for key, value in (headers or {}).items():
        request.add_header(key, value)

    try:
        with urllib.request.urlopen(request, data) as response:
            return response.status, response.read()
    except urllib.error.HTTPError as error:
        return error.code, error.read()


def sign_in(email: str) -> tuple[str, str]:
    status, raw = call(
        "/auth/v1/token?grant_type=password",
        "POST",
        {"email": email, "password": DEV_PASSWORD},
    )
    if status != 200:
        raise SystemExit(f"Could not sign in as {email}: {status} {raw[:200]!r}")
    session = json.loads(raw)
    return session["access_token"], session["user"]["id"]


class Report:
    def __init__(self) -> None:
        self.failures = 0

    def check(self, label: str, passed: bool, detail: str = "") -> None:
        mark = "ok  " if passed else "FAIL"
        if not passed:
            self.failures += 1
        print(f"  [{mark}] {label}{('  — ' + detail) if detail else ''}")


def rows_changed(status: int, raw: bytes) -> int:
    """How many rows a write actually touched.

    PostgREST answers 204 whether a write matched every row or none, because
    RLS filters silently rather than erroring. Only `return=representation`
    distinguishes "denied" from "matched nothing", which is why every write
    check here asks for it.
    """
    if status in (401, 403):
        return 0
    try:
        parsed = json.loads(raw or b"[]")
    except json.JSONDecodeError:
        return 0
    return len(parsed) if isinstance(parsed, list) else 0


def write(path: str, method: str, body: dict | None, token: str) -> int:
    status, raw = call(
        path, method, body, token=token, headers={"Prefer": "return=representation"}
    )
    return rows_changed(status, raw)


# ---------------------------------------------------------------------------
# Checks
# ---------------------------------------------------------------------------


def check_escalation(report: Report) -> None:
    print("\nPrivilege escalation, as the lowest-privilege camper")
    member_token, member_id = sign_in("community.member@l2hub.local")
    admin_token, admin_id = sign_in("ac@l2hub.local")

    roles = json.loads(call("/rest/v1/roles?slug=eq.ac&select=id", token=admin_token)[1])
    attempts = [
        ("grant self the AC role", "/rest/v1/user_roles", "POST",
         {"user_id": member_id, "role_id": roles[0]["id"]}),
        ("delete the admin's role", f"/rest/v1/user_roles?user_id=eq.{admin_id}", "DELETE", None),
        ("rename every committee", "/rest/v1/committees?slug=neq.zzz", "PATCH", {"name": "Owned"}),
        ("rename the Campsite", "/rest/v1/campsite_settings?name=neq.zzz", "PATCH", {"name": "Owned"}),
        ("edit the admin's profile", f"/rest/v1/profiles?id=eq.{admin_id}", "PATCH",
         {"display_name": "Owned"}),
        ("set own status", f"/rest/v1/profiles?id=eq.{member_id}", "PATCH", {"status": "ac"}),
        ("read another camper's preferences",
         f"/rest/v1/notification_preferences?profile_id=eq.{admin_id}&select=enabled", "GET", None),
    ]

    for label, path, method, body in attempts:
        if method == "GET":
            status, raw = call(path, token=member_token)
            blocked = status in (401, 403) or json.loads(raw or b"[]") == []
        else:
            blocked = write(path, method, body, member_token) == 0
        report.check(f"blocked: {label}", blocked)


def check_settings(report: Report) -> None:
    print("\nSettings writes a camper must be able to make")
    token, user_id = sign_in("community.member@l2hub.local")

    before = json.loads(
        call(f"/rest/v1/profiles?id=eq.{user_id}&select=theme,pronouns", token=token)[1]
    )[0]

    for column, value in [
        ("theme", "dark"),
        ("reduce_motion", True),
        ("compact_density", True),
        ("pronouns", "they/them"),
        ("display_name", "Verify Bot"),
        ("grade_year", 11),
        ("notifications_paused", True),
        ("quiet_hours_start", "22:00"),
        ("quiet_hours_end", "07:00"),
    ]:
        report.check(f"write {column}", write(
            f"/rest/v1/profiles?id=eq.{user_id}", "PATCH", {column: value}, token) == 1)

    print("\nColumns a camper must not be able to write")
    for column, value in [("email_verified", True), ("phone_verified", True), ("status", "ac")]:
        report.check(f"blocked: {column}", write(
            f"/rest/v1/profiles?id=eq.{user_id}", "PATCH", {column: value}, token) == 0)

    print("\nNotification preferences")
    # wrapped_activity is the only event type the grid offers, so it is the
    # one a real toggle writes. It exists only after 20260813000000.
    status, _ = call(
        "/rest/v1/notification_preferences", "POST",
        {"profile_id": user_id, "event_type": "wrapped_activity", "channel": "in_app",
         "enabled": False},
        token=token, headers={"Prefer": "resolution=merge-duplicates"},
    )
    report.check("write own preference (wrapped_activity)", status in (200, 201, 204))

    # The check constraint is the last line of defence against a typo in an
    # event type reaching the table and silently never matching anything.
    status, _ = call(
        "/rest/v1/notification_preferences", "POST",
        {"profile_id": user_id, "event_type": "not_a_real_event", "channel": "in_app",
         "enabled": False},
        token=token, headers={"Prefer": "resolution=merge-duplicates"},
    )
    report.check("rejected: unknown event type", status not in (200, 201, 204))

    # Restore.
    call(f"/rest/v1/notification_preferences?profile_id=eq.{user_id}", "DELETE", token=token)
    call(f"/rest/v1/profiles?id=eq.{user_id}", "PATCH", {
        "theme": before["theme"], "pronouns": before["pronouns"], "reduce_motion": False,
        "compact_density": False, "display_name": None, "grade_year": None,
        "notifications_paused": False, "quiet_hours_start": None, "quiet_hours_end": None,
    }, token=token)
    print("  (restored)")


def check_avatars(report: Report) -> None:
    print("\nAvatar bucket")
    member_token, member_id = sign_in("community.member@l2hub.local")
    _, admin_id = sign_in("ac@l2hub.local")

    def upload(path: str, data: bytes, ctype: str) -> int:
        return call(f"/storage/v1/object/avatars/{path}", "POST", data,
                    token=member_token, content_type=ctype,
                    headers={"x-upsert": "true"})[0]

    report.check("upload to own folder", upload(f"{member_id}/avatar.png", TINY_PNG, "image/png") in (200, 201))
    report.check("public read back",
                 call(f"/storage/v1/object/public/avatars/{member_id}/avatar.png")[0] == 200)
    report.check("blocked: write to another camper's folder",
                 upload(f"{admin_id}/hijack.png", TINY_PNG, "image/png") in (400, 403))
    report.check("blocked: non-image upload",
                 upload(f"{member_id}/notes.txt", b"x" * 20, "text/plain") in (400, 415))
    report.check("blocked: over the size limit",
                 upload(f"{member_id}/big.png", b"\x89PNG" + b"0" * (3 * 1024 * 1024),
                        "image/png") in (400, 413))

    call(f"/storage/v1/object/avatars/{member_id}/avatar.png", "DELETE",
         None, token=member_token, content_type=None)
    print("  (cleaned up)")


def check_notifications(report: Report) -> None:
    """The notifications read path, against the real backend and database.

    Covers listing, the unread count, mark-all-read, and that an id belonging
    to nobody changes nothing.

    NOT covered: that a preference actually suppresses a row. Proving that
    needs a real emitter to fire — requesting a Wrapped as the seeded ASBO
    account — with the preference off and then on, and the resulting rows
    cleaned out of a database shared with another developer. Until that exists,
    the gating rules are only proven by the unit tests in
    backend/tests/test_notifications.py, which is not the same claim.

    Drives the real backend, so the FastAPI server must be running on
    VITE_API_BASE_URL.
    """
    import urllib.parse

    api = ""
    for line in (ROOT / "frontend" / ".env").read_text().splitlines():
        if line.startswith("VITE_API_BASE_URL="):
            api = line.split("=", 1)[1].strip()
    if not api:
        report.check("backend base URL configured", False, "VITE_API_BASE_URL missing")
        return

    admin_token, admin_id = sign_in("ac@l2hub.local")

    def backend(path: str, method: str = "GET", body: dict | None = None, token: str | None = None):
        request = urllib.request.Request(urllib.parse.urljoin(api, path), method=method)
        request.add_header("Authorization", f"Bearer {token}")
        data = json.dumps(body).encode() if body is not None else None
        if data is not None:
            request.add_header("Content-Type", "application/json")
        try:
            with urllib.request.urlopen(request, data) as response:
                return response.status, json.loads(response.read() or b"{}")
        except urllib.error.HTTPError as error:
            return error.code, {}
        except urllib.error.URLError:
            return 0, {}

    status, payload = backend("/notifications", token=admin_token)
    if status == 0:
        report.check("backend reachable", False, "start uvicorn on " + api)
        return
    report.check("list own notifications", status == 200)
    report.check("unread count is served by the API", "unread" in payload)

    status, payload = backend("/notifications/read", "POST", token=admin_token)
    report.check("mark all read", status == 200 and payload.get("unread") == 0)

    # A notification id belonging to nobody must change nothing.
    status, payload = backend(
        "/notifications/00000000-0000-4000-8000-000000000000/read", "POST", token=admin_token)
    report.check("marking an unknown id changes nothing",
                 status == 200 and payload.get("markedRead") == 0)


CHECKS = {
    "escalation": check_escalation,
    "settings": check_settings,
    "avatars": check_avatars,
    "notifications": check_notifications,
}


def main() -> int:
    which = sys.argv[1] if len(sys.argv) > 1 else "all"
    report = Report()

    selected = CHECKS if which == "all" else {which: CHECKS[which]}
    for name, fn in selected.items():
        fn(report)

    print(f"\n{'PASS' if report.failures == 0 else f'{report.failures} FAILURE(S)'}")
    return 1 if report.failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
