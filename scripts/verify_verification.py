#!/usr/bin/env python3
"""The contact-verification flows, end to end against a real Supabase.

Makes exactly the calls frontend/src/lib/verification.ts makes, then reads
auth.users and public.profiles to see what actually happened. Component tests
mock both wrappers, so they prove the modal's state machine and nothing about
whether a verification can complete.

Phone uses [auth.sms.test_otp], so a fixed code is accepted and no SMS is
sent. Email is delivered to Mailpit, the local stack's SMTP catcher, and the
message is read back over its API — so the assertion is that a real message
arrived carrying a real code, not that the call returned 200.

LOCAL ONLY: it rewrites contact details on seeded accounts and empties the
mailbox. Run `supabase start` first.

Usage:
    python3 scripts/verify_verification.py
"""

from __future__ import annotations

import json
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

import psycopg

ROOT = Path(__file__).resolve().parents[1]

URL = "http://127.0.0.1:54321"
MAILPIT = "http://127.0.0.1:54324"
DSN = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"

EMAIL = "community.member@l2hub.local"
PASSWORD = "l2hubdev"
PHONE = "+15555550100"
PHONE_CODE = "123456"
OTHER_PHONE = "+15555550101"
OTHER_CODE = "654321"


def publishable_key() -> str:
    for name in (".env.local", ".env.local.off"):
        path = ROOT / "frontend" / name
        if not path.exists():
            continue
        for line in path.read_text().splitlines():
            if line.startswith("VITE_SUPABASE_PUBLISHABLE_KEY="):
                return line.split("=", 1)[1].strip()
    raise SystemExit("no local publishable key found; run `supabase status -o env`")


KEY = publishable_key()


class Report:
    def __init__(self) -> None:
        self.failures = 0

    def check(self, label: str, ok: bool, detail: str = "") -> None:
        if not ok:
            self.failures += 1
        suffix = f"  — {detail}" if detail else ""
        print(f"  [{'ok  ' if ok else 'FAIL'}] {label}{suffix}")


def call(path, body=None, token=None, method="POST"):
    req = urllib.request.Request(URL + path, method=method)
    req.add_header("apikey", KEY)
    req.add_header("Authorization", f"Bearer {token or KEY}")
    data = None
    if body is not None:
        req.add_header("Content-Type", "application/json")
        data = json.dumps(body).encode()
    try:
        with urllib.request.urlopen(req, data) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, json.loads(raw or b"{}")
        except Exception:
            return e.code, {"raw": raw.decode(errors="replace")}


def mailpit(path, method="GET"):
    """Mailpit's DELETE replies with a bare 'ok', so JSON is best-effort."""
    req = urllib.request.Request(MAILPIT + path, method=method)
    try:
        with urllib.request.urlopen(req) as r:
            body = r.read()
            try:
                return r.status, (json.loads(body) if body else {})
            except json.JSONDecodeError:
                return r.status, {}
    except urllib.error.HTTPError as e:
        return e.code, {}


def sql(query, *args, fetch=True):
    with psycopg.connect(DSN, autocommit=True) as c, c.cursor() as cur:
        cur.execute(query, args)
        return cur.fetchall() if (fetch and cur.description) else []


def state():
    rows = sql(
        "select u.phone, u.phone_confirmed_at is not null, p.phone, p.phone_verified,"
        " (select count(*) from auth.users), (select count(*) from public.profiles)"
        " from auth.users u join public.profiles p on p.id = u.id where u.email = %s",
        EMAIL,
    )
    return rows[0]


def reset():
    sql("delete from auth.users where email is null or email = ''", fetch=False)
    sql(
        "update auth.users set phone = null, phone_confirmed_at = null,"
        " phone_change = '', phone_change_token = '' where email = %s",
        EMAIL, fetch=False,
    )
    sql(
        "update public.profiles set phone = null, phone_verified = false where email = %s",
        EMAIL, fetch=False,
    )
    mailpit("/api/v1/messages", method="DELETE")


def sign_in() -> tuple[str, str]:
    status, session = call(
        "/auth/v1/token?grant_type=password", {"email": EMAIL, "password": PASSWORD}
    )
    if status != 200:
        raise SystemExit(f"could not sign in as {EMAIL}: {session}")
    return session["access_token"], session["user"]["id"]


# ---------------------------------------------------------------------------


def check_phone(report: Report) -> None:
    print("\nPhone verification, as the settings page performs it")
    reset()
    time.sleep(6)  # GoTrue's sms max_frequency

    before_users, before_profiles = state()[4], state()[5]
    token, user_id = sign_in()

    # sendPhoneCode
    status, _ = call("/auth/v1/user", {"phone": PHONE}, token=token, method="PUT")
    report.check("sending a code is accepted", status == 200, f"HTTP {status}")

    # A wrong code must not verify anything.
    status, _ = call(
        "/auth/v1/verify", {"type": "phone_change", "phone": PHONE, "token": "000000"}
    )
    report.check("a wrong code is rejected", status != 200, f"HTTP {status}")
    report.check("a wrong code verifies nothing", state()[3] is False)

    # verifyPhoneCode
    status, verified = call(
        "/auth/v1/verify", {"type": "phone_change", "phone": PHONE, "token": PHONE_CODE}
    )
    report.check("the right code is accepted", status == 200, f"HTTP {status}")

    auth_phone, auth_confirmed, profile_phone, profile_verified, users, profiles = state()

    report.check("the session still belongs to the same camper",
                 verified.get("user", {}).get("id") == user_id)
    report.check("no phantom auth user was created", users == before_users,
                 f"{before_users} -> {users}")
    report.check("no phantom profile was created", profiles == before_profiles,
                 f"{before_profiles} -> {profiles}")
    report.check("the number landed on the camper", auth_phone == PHONE.lstrip("+"))
    report.check("auth marked it confirmed", auth_confirmed is True)
    report.check("the profile shows the number", profile_phone == PHONE.lstrip("+"))
    report.check("the profile shows it VERIFIED", profile_verified is True,
                 "this is what the two triggers used to cancel")

    # Changing the number afterwards must drop verification — the guard the
    # migration had to keep working.
    sql("update public.profiles set phone = %s where email = %s",
        OTHER_PHONE.lstrip("+"), EMAIL, fetch=False)
    report.check("changing the number drops verification again", state()[3] is False)

    reset()
    print("  (reset)")


def check_phone_resend_and_expiry(report: Report) -> None:
    print("\nResend, rate limiting, and a stale code")
    reset()
    time.sleep(6)

    token, _ = sign_in()

    status, _ = call("/auth/v1/user", {"phone": PHONE}, token=token, method="PUT")
    report.check("first send accepted", status == 200, f"HTTP {status}")

    # Immediately again: GoTrue enforces sms max_frequency (5s in config.toml).
    status, body = call("/auth/v1/user", {"phone": PHONE}, token=token, method="PUT")
    limited = status != 200 and "security purposes" in json.dumps(body).lower()
    report.check("an immediate resend is rate limited", limited or status != 200,
                 f"HTTP {status}")

    # Mirrors classifyError in frontend/src/lib/verification.ts exactly. An
    # earlier version of this check also accepted "security purposes", which
    # classifyError did not match at the time — so it passed while the UI was
    # telling campers their code was wrong before they had typed one.
    code = str(body.get("error_code", ""))
    text = str(body.get("msg", "")).lower()
    classified_rate_limited = (
        "rate_limit" in code
        or "rate limit" in text
        or "too many" in text
        or "security purposes" in text
    )
    report.check("classifyError sees this as rate_limited", classified_rate_limited,
                 f"{code} / {text[:60]}")

    time.sleep(6)
    status, _ = call("/auth/v1/user", {"phone": PHONE}, token=token, method="PUT")
    report.check("a resend after the cooldown is accepted", status == 200, f"HTTP {status}")

    # Superseded code: request a different number, then try the first code.
    time.sleep(6)
    call("/auth/v1/user", {"phone": OTHER_PHONE}, token=token, method="PUT")
    status, _ = call(
        "/auth/v1/verify",
        {"type": "phone_change", "phone": PHONE, "token": PHONE_CODE},
    )
    report.check("a code for a superseded number is refused", status != 200, f"HTTP {status}")

    status, _ = call(
        "/auth/v1/verify",
        {"type": "phone_change", "phone": OTHER_PHONE, "token": OTHER_CODE},
    )
    report.check("the current number's code still works", status == 200, f"HTTP {status}")

    reset()
    print("  (reset)")


def check_email(report: Report) -> None:
    print("\nEmail verification, and the message that actually arrives")
    reset()

    token, _ = sign_in()
    target = "verify.bot@l2hub.local"

    status, _ = call("/auth/v1/user", {"email": target}, token=token, method="PUT")
    report.check("sending a code is accepted", status == 200, f"HTTP {status}")

    # Give Mailpit a moment to receive it, and take the message addressed to
    # the NEW address specifically. With double_confirm_changes on, GoTrue
    # sends a second mail to the old address carrying a different code, and
    # picking whichever arrived first made this check pass or fail at random.
    message = {}
    delivered: list[str] = []
    for _ in range(20):
        status, box = mailpit("/api/v1/messages")
        for candidate in box.get("messages", []):
            delivered = [to.get("Address") for to in candidate.get("To", [])]
            if target in delivered:
                message = candidate
                break
        if message:
            break
        time.sleep(0.5)

    report.check("a real email was delivered to the new address", bool(message),
                 "read back from Mailpit, not assumed from a 200")

    # One code, one mail: the modal has one set of six boxes to fill.
    _, box = mailpit("/api/v1/messages")
    report.check("exactly one confirmation email is sent",
                 box.get("messages_count") == 1,
                 f"{box.get('messages_count')} delivered — the six-box modal can only collect one code")
    if not message:
        reset()
        return

    status, full = mailpit(f"/api/v1/message/{message['ID']}")
    body = (full.get("Text") or "") + (full.get("HTML") or "")
    codes = re.findall(r"\b\d{6}\b", body)

    report.check("the email carries a six-digit code", bool(codes),
                 "the built-in template sends only a link, which the six boxes cannot accept")

    if codes:
        status, _ = call(
            "/auth/v1/verify",
            {"type": "email_change", "email": target, "token": "000000"},
        )
        report.check("a wrong code is rejected", status != 200, f"HTTP {status}")

        status, _ = call(
            "/auth/v1/verify",
            {"type": "email_change", "email": target, "token": codes[0]},
        )
        report.check("the emailed code verifies the address", status == 200, f"HTTP {status}")

    # Put the address back.
    sql("update auth.users set email = %s, email_change = '' where email = %s",
        EMAIL, target, fetch=False)
    sql("update public.profiles set email = %s where email = %s", EMAIL, target, fetch=False)
    reset()
    print("  (reset)")


CHECKS = {
    "phone": check_phone,
    "resend": check_phone_resend_and_expiry,
    "email": check_email,
}


def main() -> int:
    which = sys.argv[1] if len(sys.argv) > 1 else "all"
    report = Report()

    for name, fn in (CHECKS if which == "all" else {which: CHECKS[which]}).items():
        fn(report)

    print(f"\n{'PASS' if report.failures == 0 else f'{report.failures} FAILURE(S)'}")
    return 1 if report.failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
