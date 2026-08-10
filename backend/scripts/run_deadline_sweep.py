"""Run the deadline sweep by hand.

    python -m scripts.run_deadline_sweep [--send] [--date YYYY-MM-DD]

Use this to see what the schedule would do before letting it loose — the
first production run raises an overdue notice for every task that has
already slipped, and reading the counters once with the log backend is
cheaper than apologising to a class.

No job secret is involved: this needs database credentials, which is a
different and much higher bar than a header value.
"""

from __future__ import annotations

import argparse
import logging
from datetime import date

from app.core.config import settings
from app.db.session import SessionLocal
from app.mail.factory import build_email_sender
from app.mail.log import LoggingEmailSender
from app.services import deadlines


def main() -> int:
    parser = argparse.ArgumentParser(description="Raise today's deadline notices.")
    parser.add_argument(
        "--send",
        action="store_true",
        help="Use the configured EMAIL_BACKEND. Without this, email is only logged.",
    )
    parser.add_argument(
        "--date",
        type=date.fromisoformat,
        default=None,
        help="Treat this ISO date as today. For backfilling a missed run.",
    )
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")

    sender = build_email_sender() if args.send else LoggingEmailSender()
    if args.send and settings.email_backend.strip().lower() not in {"log", "logging", "none"}:
        print(f"Sending real email via {settings.email_backend!r}.")

    with SessionLocal() as db:
        result = deadlines.sweep_deadlines(db, today=args.date, sender=sender)

    print(
        f"{result.today}: considered={result.considered} "
        f"due_soon={result.due_soon_sent} overdue={result.overdue_sent} "
        f"duplicates={result.duplicates} "
        f"emails_sent={result.emails_sent} emails_failed={result.emails_failed}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
