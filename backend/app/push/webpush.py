"""pywebpush-backed sender.

Everything provider-specific lives here: the VAPID claims, the JSON envelope
the service worker expects, and the mapping from an HTTP status onto
`PushResult.gone`.
"""

from __future__ import annotations

import json
import logging

from app.push.protocol import OutgoingPush, PushResult, PushSender, PushTarget

logger = logging.getLogger(__name__)

#: Statuses that mean "this subscription will never work again".
#:
#: 410 Gone is the specified answer when a browser unsubscribes or clears site
#: data. 404 is what several push services return instead for an endpoint they
#: no longer recognise. Both are permanent; everything else — 429, 500, 502,
#: a timeout — is transient and must NOT delete the row, or a five-minute
#: outage at a vendor would silently unsubscribe every camper using it.
DEAD_STATUSES = frozenset({404, 410})

#: How long the push service should hold a message for a device that is
#: offline. A day: a notification about an event is worth delivering to a
#: phone that was off overnight, and worthless a week later.
TTL_SECONDS = 86_400


class WebPushSender(PushSender):
    def __init__(self, *, public_key: str, private_key: str, subject: str) -> None:
        self._public_key = public_key
        self._private_key = private_key
        # RFC 8292 requires a contact the push service can reach if our
        # traffic causes them a problem — a mailto: or an https: URL.
        self._subject = subject

    def send(self, target: PushTarget, message: OutgoingPush) -> PushResult:
        # Imported lazily so the module can be imported — and the logging
        # backend used — on a machine with no pywebpush installed.
        from pywebpush import WebPushException, webpush

        payload = json.dumps(
            {
                "title": message.title,
                "body": message.body,
                "url": message.url,
                "tag": message.tag,
            }
        )

        try:
            webpush(
                subscription_info={
                    "endpoint": target.endpoint,
                    "keys": {"p256dh": target.p256dh, "auth": target.auth},
                },
                data=payload,
                vapid_private_key=self._private_key,
                vapid_claims={"sub": self._subject},
                ttl=TTL_SECONDS,
            )
            return PushResult(accepted=True)

        except WebPushException as exc:
            status = getattr(exc.response, "status_code", None)
            gone = status in DEAD_STATUSES
            if not gone:
                # Logged, not raised: the caller is usually mid-broadcast.
                logger.warning(
                    "push delivery failed (status=%s) for %s…",
                    status,
                    target.endpoint[:40],
                )
            return PushResult(
                accepted=False, gone=gone, status_code=status, detail=str(exc)
            )
