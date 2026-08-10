"""Choosing and building an outbound email backend."""

from __future__ import annotations

import httpx
import pytest

from app.core.config import Settings
from app.mail import (
    LoggingEmailSender,
    OutgoingEmail,
    ResendEmailError,
    ResendEmailSender,
    UnsupportedEmailBackend,
    build_email_sender,
)


def config(**overrides) -> Settings:
    return Settings(**overrides)


def test_logging_is_the_default_backend():
    """Development and the tests must never mail a real student."""
    assert isinstance(build_email_sender(config()), LoggingEmailSender)


def test_resend_refuses_to_build_without_an_api_key():
    """Checked at construction so a misconfiguration stops the process.

    The alternative is a deadline reminder that silently never goes out,
    discovered when someone misses a deadline.
    """
    with pytest.raises(UnsupportedEmailBackend) as exc:
        build_email_sender(config(email_backend="resend", email_from="a@b.test"))
    assert "RESEND_API_KEY" in str(exc.value)


def test_resend_refuses_to_build_without_a_from_address():
    with pytest.raises(UnsupportedEmailBackend) as exc:
        build_email_sender(config(email_backend="resend", resend_api_key="re_x"))
    assert "EMAIL_FROM" in str(exc.value)


def test_an_unknown_backend_names_what_is_supported():
    with pytest.raises(UnsupportedEmailBackend) as exc:
        build_email_sender(config(email_backend="carrier-pigeon"))
    assert "log, resend" in str(exc.value)


def test_a_reserved_provider_says_so_rather_than_unknown():
    with pytest.raises(UnsupportedEmailBackend) as exc:
        build_email_sender(config(email_backend="ses"))
    assert "reserved" in str(exc.value)


def test_resend_posts_the_message_it_was_given():
    seen: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["auth"] = request.headers.get("authorization")
        seen["body"] = request.read().decode()
        return httpx.Response(200, json={"id": "re_123"})

    sender = ResendEmailSender(
        api_key="re_test",
        from_email="L2 Hub <hub@example.edu>",
        transport=httpx.MockTransport(handler),
    )

    result = sender.send(
        OutgoingEmail(to="camper@example.edu", subject="Due tomorrow", text="Body")
    )

    assert result.accepted is True
    assert result.provider_id == "re_123"
    assert seen["url"] == "https://api.resend.com/emails"
    assert seen["auth"] == "Bearer re_test"
    assert "camper@example.edu" in seen["body"]


def test_resend_raises_with_the_provider_reason(capsys):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(422, text="domain is not verified")

    sender = ResendEmailSender(
        api_key="re_test",
        from_email="hub@example.edu",
        transport=httpx.MockTransport(handler),
    )

    with pytest.raises(ResendEmailError) as exc:
        sender.send(OutgoingEmail(to="a@b.test", subject="S", text="T"))
    assert "domain is not verified" in str(exc.value)


def test_an_accepted_but_unparseable_response_is_not_a_failure():
    """The message is gone either way; only the tracing id is lost."""

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, text="OK")

    sender = ResendEmailSender(
        api_key="re_test",
        from_email="hub@example.edu",
        transport=httpx.MockTransport(handler),
    )

    result = sender.send(OutgoingEmail(to="a@b.test", subject="S", text="T"))
    assert result.accepted is True
    assert result.provider_id is None
