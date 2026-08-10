"""Web push subscription endpoints."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.api.deps import CurrentProfile, DbSession
from app.core.config import settings
from app.services import push as push_service

router = APIRouter(prefix="/push", tags=["push"])


class SubscriptionKeys(BaseModel):
    #: Shape matches `PushSubscription.toJSON().keys` in the browser, so the
    #: frontend can post what the Push API handed it without reshaping.
    p256dh: str = Field(min_length=1, max_length=255)
    auth: str = Field(min_length=1, max_length=255)


class SubscribeBody(BaseModel):
    endpoint: str = Field(min_length=1, max_length=2048)
    keys: SubscriptionKeys
    userAgent: str | None = Field(default=None, max_length=500)


class UnsubscribeBody(BaseModel):
    endpoint: str = Field(min_length=1, max_length=2048)


@router.get("/config")
def push_config() -> dict:
    """The VAPID public key the browser needs in order to subscribe.

    Served rather than baked into the frontend as a VITE_ variable so there is
    exactly one source of truth. The two halves of a VAPID keypair have to
    match: a subscription created under one public key cannot be pushed to
    with a different private key, and the failure is silent — the browser
    simply never shows anything. A frontend env var that drifts from the
    backend's would produce precisely that.

    The public key is not a secret. It is handed to every browser that
    subscribes, so this endpoint needs no authentication.
    """
    return {
        "vapidPublicKey": settings.push_vapid_public_key or None,
        # Lets the settings UI say "push is not configured for this Campsite"
        # instead of offering a switch that cannot work.
        "enabled": bool(
            settings.push_vapid_public_key
            and (settings.push_backend or "log").lower() not in {"log", "logging", "none"}
        ),
    }


@router.post("/subscribe", status_code=status.HTTP_201_CREATED)
def subscribe(body: SubscribeBody, profile: CurrentProfile, db: DbSession) -> dict:
    """Registers this browser for push.

    Idempotent: the same browser calling twice refreshes one row rather than
    creating a second. See `save_subscription`.
    """
    subscription = push_service.save_subscription(
        db,
        profile_id=profile.id,
        endpoint=body.endpoint,
        p256dh=body.keys.p256dh,
        auth=body.keys.auth,
        user_agent=body.userAgent,
    )
    db.commit()
    return {"id": str(subscription.id), "subscribed": True}


@router.post("/unsubscribe")
def unsubscribe(body: UnsubscribeBody, profile: CurrentProfile, db: DbSession) -> dict:
    """Removes this browser's subscription.

    A missing row is not an error. The browser may have already dropped the
    subscription on its side, and reporting 404 would leave the settings UI
    showing a failure for a state that is exactly what was asked for.
    """
    removed = push_service.delete_subscription(
        db, profile_id=profile.id, endpoint=body.endpoint
    )
    db.commit()
    return {"removed": removed}


@router.get("/subscriptions")
def list_subscriptions(profile: CurrentProfile, db: DbSession) -> dict:
    """This camper's registered devices, so they can see and revoke them."""
    subscriptions = push_service.list_for_profile(db, profile.id)
    return {
        "devices": [
            {
                "id": str(item.id),
                # The endpoint is never returned in full: it is the sensitive
                # half of a subscription. A suffix is enough for the UI to
                # tell two devices apart.
                "endpointSuffix": item.endpoint[-12:],
                "userAgent": item.user_agent,
                "createdAt": item.created_at.isoformat() if item.created_at else None,
                "lastUsedAt": item.last_used_at.isoformat()
                if item.last_used_at
                else None,
            }
            for item in subscriptions
        ]
    }


@router.post("/test")
def send_test(profile: CurrentProfile, db: DbSession) -> dict:
    """Pushes a notification to the caller's own devices.

    Exists because there is no other way for a camper to find out that push is
    broken on their phone. Scoped to the caller — this cannot be used to
    notify anyone else.
    """
    from app.push.factory import build_push_sender
    from app.push.protocol import OutgoingPush

    sender = build_push_sender()
    result = push_service.send_to_profiles(
        db,
        sender,
        [profile.id],
        OutgoingPush(
            title="The Quad",
            body="Push notifications are working on this device.",
            url="/settings",
            tag="push-test",
        ),
    )
    db.commit()

    if result.sent == 0 and result.pruned == 0 and result.failed == 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This device is not registered for push notifications.",
        )

    return {"sent": result.sent, "failed": result.failed, "pruned": result.pruned}
