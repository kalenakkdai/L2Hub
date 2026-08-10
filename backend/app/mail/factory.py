"""Build the configured EmailSender implementation."""

from __future__ import annotations

from app.core.config import Settings, settings
from app.mail.log import LoggingEmailSender
from app.mail.protocol import EmailSender
from app.mail.resend import ResendEmailSender

_singleton: EmailSender | None = None


class UnsupportedEmailBackend(RuntimeError):
    """Raised when EMAIL_BACKEND names a backend that cannot be built."""


def build_email_sender(config: Settings | None = None) -> EmailSender:
    """Construct an email sender from settings.

    Call sites should prefer the FastAPI `get_email_sender` dependency so tests
    can override the implementation. Use this factory directly in scripts.
    """
    cfg = config or settings
    backend = (cfg.email_backend or "log").strip().lower()

    if backend in {"log", "logging", "none"}:
        return LoggingEmailSender()

    if backend == "resend":
        # Checked here rather than at first send: a missing key should stop the
        # service at startup, not surface as a deadline reminder that silently
        # never went out.
        missing = [
            name
            for name, value in (
                ("RESEND_API_KEY", cfg.resend_api_key),
                ("EMAIL_FROM", cfg.email_from),
            )
            if not value.strip()
        ]
        if missing:
            raise UnsupportedEmailBackend(
                f"EMAIL_BACKEND={backend!r} needs {', '.join(missing)} set."
            )
        return ResendEmailSender(
            api_key=cfg.resend_api_key,
            from_email=cfg.email_from,
            reply_to=cfg.email_reply_to,
        )

    if backend in {"ses", "smtp", "sendgrid", "postmark"}:
        raise UnsupportedEmailBackend(
            f"EMAIL_BACKEND={backend!r} is reserved for a later provider. "
            "Use EMAIL_BACKEND=resend to send mail today."
        )

    raise UnsupportedEmailBackend(
        f"Unknown EMAIL_BACKEND={backend!r}. Supported today: log, resend."
    )


def get_email_sender_singleton() -> EmailSender:
    """Process-wide sender used by the FastAPI dependency."""
    global _singleton
    if _singleton is None:
        _singleton = build_email_sender()
    return _singleton


def reset_email_sender_singleton() -> None:
    """Clear the cached instance so the next call rebuilds from settings."""
    global _singleton
    _singleton = None
