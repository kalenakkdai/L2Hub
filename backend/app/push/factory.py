"""Build the configured PushSender implementation."""

from __future__ import annotations

from app.core.config import Settings, settings
from app.push.log import LoggingPushSender
from app.push.protocol import PushSender
from app.push.webpush import WebPushSender

_singleton: PushSender | None = None


class UnsupportedPushBackend(RuntimeError):
    """Raised when PUSH_BACKEND names a backend that cannot be built."""


def build_push_sender(config: Settings | None = None) -> PushSender:
    cfg = config or settings
    backend = (cfg.push_backend or "log").strip().lower()

    if backend in {"log", "logging", "none"}:
        return LoggingPushSender()

    if backend in {"webpush", "vapid"}:
        # Checked at construction rather than at first send. A missing key
        # should stop the service at startup; surfacing it as a notification
        # that silently never arrived is the failure mode worth avoiding.
        missing = [
            name
            for name, value in (
                ("PUSH_VAPID_PUBLIC_KEY", cfg.push_vapid_public_key),
                ("PUSH_VAPID_PRIVATE_KEY", cfg.push_vapid_private_key),
                ("PUSH_VAPID_SUBJECT", cfg.push_vapid_subject),
            )
            if not value.strip()
        ]
        if missing:
            raise UnsupportedPushBackend(
                f"PUSH_BACKEND={backend!r} needs {', '.join(missing)} set."
            )
        return WebPushSender(
            public_key=cfg.push_vapid_public_key,
            private_key=cfg.push_vapid_private_key,
            subject=cfg.push_vapid_subject,
        )

    raise UnsupportedPushBackend(
        f"Unknown PUSH_BACKEND={backend!r}. Supported today: log, webpush."
    )


def get_push_sender_singleton() -> PushSender:
    global _singleton
    if _singleton is None:
        _singleton = build_push_sender()
    return _singleton


def reset_push_sender_singleton() -> None:
    """Clear the cached instance so the next call rebuilds from settings."""
    global _singleton
    _singleton = None
