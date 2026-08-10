"""Outbound push contract shared by the logging and pywebpush backends.

Deliberately shaped like app/mail/protocol.py. The two channels have the same
problem — a provider that can fail per-recipient, and call sites that should
not know the provider's HTTP shape — so they get the same seam.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True, slots=True)
class PushTarget:
    """Where one message goes: a single browser's subscription."""

    endpoint: str
    p256dh: str
    auth: str


@dataclass(frozen=True, slots=True)
class OutgoingPush:
    """One notification, before it is addressed to any particular device.

    `url` is what the service worker opens when the notification is clicked.
    `tag` collapses notifications in the OS tray: two messages with the same
    tag replace each other rather than stacking, which is what stops a camper
    waking up to nine copies of the same reminder.
    """

    title: str
    body: str
    url: str | None = None
    tag: str | None = None


@dataclass(frozen=True, slots=True)
class PushResult:
    """What the push service said.

    `gone` is the one outcome callers must act on: a 404 or 410 means the
    subscription is permanently dead and the row should be deleted. Every
    other failure is transient and the row is left alone.
    """

    accepted: bool
    gone: bool = False
    status_code: int | None = None
    detail: str | None = None


class PushSender(Protocol):
    """Call sites depend on this, not on pywebpush."""

    def send(self, target: PushTarget, message: OutgoingPush) -> PushResult:
        """Deliver `message` to one browser. Returns a result rather than raising
        for ordinary per-device failures — one dead phone must not abort a
        broadcast to thirty others."""
