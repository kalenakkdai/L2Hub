"""Outbound email contract shared by the logging and Resend backends."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True, slots=True)
class OutgoingEmail:
    """One message to one person.

    `text` is required and `html` is not: a deadline reminder is three
    sentences, and a plain-text part is what reaches every client. Callers
    build the copy — a sender only knows how to put bytes on the wire.
    """

    to: str
    subject: str
    text: str
    html: str | None = None


@dataclass(frozen=True, slots=True)
class SentEmail:
    """What the provider said. `provider_id` is for tracing a complaint back."""

    provider_id: str | None
    accepted: bool


class EmailSender(Protocol):
    """Call sites depend on this, not on a provider's HTTP shape."""

    def send(self, message: OutgoingEmail) -> SentEmail:
        """Hand `message` to the provider, or raise."""
