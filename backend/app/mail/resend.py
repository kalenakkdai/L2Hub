"""Resend implementation of the EmailSender protocol.

Resend was chosen over SES because it needs a domain and an API key rather
than a domain, a production-access review, and a sandbox period — and the
volume here is a few dozen deadline reminders a morning, far inside the free
tier either way.

The whole API surface used is one POST, so this talks to it with httpx (already
a dependency) rather than pulling in an SDK for a single endpoint.
"""

from __future__ import annotations

import httpx

from app.mail.protocol import OutgoingEmail, SentEmail

_ENDPOINT = "https://api.resend.com/emails"

# A total timeout, not just a connect timeout. The deadline sweep sends inside
# a request that pg_net also times out on, so one hung connection must not be
# able to stall the whole run behind it.
_TIMEOUT = httpx.Timeout(connect=5.0, read=10.0, write=10.0, pool=5.0)


class ResendEmailError(RuntimeError):
    """Resend returned something other than success."""


class ResendEmailSender:
    """Send one message per call through Resend's REST API."""

    backend_name = "resend"

    def __init__(
        self,
        *,
        api_key: str,
        from_email: str,
        reply_to: str = "",
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        if not api_key:
            raise ValueError("Resend email needs RESEND_API_KEY")
        if not from_email:
            raise ValueError("Resend email needs EMAIL_FROM")
        self._api_key = api_key
        self._from = from_email
        self._reply_to = reply_to
        self._transport = transport

    def send(self, message: OutgoingEmail) -> SentEmail:
        payload: dict[str, object] = {
            "from": self._from,
            "to": [message.to],
            "subject": message.subject,
            "text": message.text,
        }
        if message.html:
            payload["html"] = message.html
        if self._reply_to:
            payload["reply_to"] = self._reply_to

        with httpx.Client(timeout=_TIMEOUT, transport=self._transport) as client:
            response = client.post(
                _ENDPOINT,
                headers={"Authorization": f"Bearer {self._api_key}"},
                json=payload,
            )

        if response.status_code >= 400:
            # Truncated: a provider error body can be long, and this ends up in
            # the application log, not in front of a camper.
            raise ResendEmailError(
                f"Resend refused the message ({response.status_code}): {response.text[:300]}"
            )

        provider_id = None
        try:
            provider_id = response.json().get("id")
        except ValueError:
            # Accepted but unparseable. The message is gone either way, so this
            # is not worth failing over — we just lose the tracing id.
            pass

        return SentEmail(provider_id=provider_id, accepted=True)
