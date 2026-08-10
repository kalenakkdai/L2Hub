"""Email backend that writes to the log instead of sending."""

from __future__ import annotations

import logging

from app.mail.protocol import OutgoingEmail, SentEmail

logger = logging.getLogger(__name__)


class LoggingEmailSender:
    """Records the message and sends nothing.

    The default, and what development and the test suite run on. A deadline
    reminder must never reach a real student from someone's laptop, and the
    seeded accounts are @l2hub.local addresses no provider would accept.

    The body is logged at DEBUG rather than INFO so a shared terminal does
    not spill message contents by default.
    """

    def send(self, message: OutgoingEmail) -> SentEmail:
        logger.info("email (not sent: log backend) to=%s subject=%s", message.to, message.subject)
        logger.debug("email body to=%s\n%s", message.to, message.text)
        return SentEmail(provider_id=None, accepted=True)
