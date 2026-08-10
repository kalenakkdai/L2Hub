"""Push sender that logs instead of sending.

The default backend, and the only one that works with no VAPID keypair
configured. Local development gets a log line per notification rather than a
stack trace, which matters because push is the kind of feature that is wired
into other code paths — an event promotion should not start failing because
nobody generated keys.
"""

from __future__ import annotations

import logging

from app.push.protocol import OutgoingPush, PushResult, PushSender, PushTarget

logger = logging.getLogger(__name__)


class LoggingPushSender(PushSender):
    def send(self, target: PushTarget, message: OutgoingPush) -> PushResult:
        # The endpoint is truncated: it is a credential of sorts, and a log
        # aggregator is not where it belongs in full.
        logger.info(
            "push (not sent): %r -> %s… | %s",
            message.title,
            target.endpoint[:40],
            message.body,
        )
        return PushResult(accepted=True)
