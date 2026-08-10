"""Outbound email with dependency injection.

Swap providers via `EMAIL_BACKEND` without changing call sites:

- `log`    — write the message to the application log (development, tests)
- `resend` — POST to Resend (needs RESEND_API_KEY and EMAIL_FROM)

Named `mail` rather than `email` on purpose: the standard library owns
`email`, and a sibling package by that name shadows it for every module that
does `from email.message import EmailMessage` — which the attendance service
does.
"""

from app.mail.factory import (
    UnsupportedEmailBackend,
    build_email_sender,
    get_email_sender_singleton,
    reset_email_sender_singleton,
)
from app.mail.log import LoggingEmailSender
from app.mail.protocol import EmailSender, OutgoingEmail, SentEmail
from app.mail.resend import ResendEmailError, ResendEmailSender

__all__ = [
    "EmailSender",
    "LoggingEmailSender",
    "OutgoingEmail",
    "ResendEmailError",
    "ResendEmailSender",
    "SentEmail",
    "UnsupportedEmailBackend",
    "build_email_sender",
    "get_email_sender_singleton",
    "reset_email_sender_singleton",
]
