"""A+-gated owl cosmetics and reward-point spending."""

from __future__ import annotations

import json
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime

from fastapi import HTTPException
from fastapi import status as http_status
from sqlalchemy.orm import Session

from app.models.owl import OwlProfile
from app.models.profile import Profile
from app.services import notifications
from app.services.letter_grade import is_a_plus, letter_grade

BELLY_COLORS: dict[str, dict] = {
    "snow": {
        "label": "Snow white",
        "cost": 0,
        "fill": "#ffffff",
        "fillDeep": "#dfe6f2",
    },
    "gold": {
        "label": "Gold feather",
        "cost": 40,
        "fill": "#fff7d6",
        "fillDeep": "#f0d78c",
    },
    "midnight": {
        "label": "Midnight",
        "cost": 60,
        "fill": "#dbe4f5",
        "fillDeep": "#8fa3c7",
    },
    "rose": {
        "label": "Rose dusk",
        "cost": 50,
        "fill": "#ffe4e8",
        "fillDeep": "#f0b8c0",
    },
}

WING_COLORS: dict[str, dict] = {
    "mist": {"label": "Mist", "cost": 0, "near": "#dbe4f2", "far": "#c2cee2"},
    "slate": {"label": "Slate", "cost": 35, "near": "#c5d0e0", "far": "#9aabbf"},
    "amber": {"label": "Amber tip", "cost": 45, "near": "#f5e6c8", "far": "#d4b483"},
    "pine": {"label": "Pine", "cost": 45, "near": "#cfe0d4", "far": "#9bb5a3"},
}

ACCESSORIES: dict[str, dict] = {
    "none": {"label": "None", "cost": 0},
    "scarf": {"label": "ASB scarf", "cost": 30},
    "glasses": {"label": "Round glasses", "cost": 25},
    "laurels": {"label": "A+ laurels", "cost": 80},
}

TRAILS: dict[str, dict] = {
    "none": {"label": "None", "cost": 0},
    "sparkles": {"label": "Sparkle trail", "cost": 55},
    "leaves": {"label": "Leaf trail", "cost": 40},
}

A_PLUS_WELCOME_POINTS = 100
A_PLUS_MIN_PERCENT = 97.0


@dataclass(frozen=True, slots=True)
class AccessChange:
    unlocked: bool
    revoked: bool
    percent: float | None
    letter: str | None


def _now() -> datetime:
    return datetime.now(UTC)


def _catalog_payload() -> dict:
    return {
        "bellyColors": [{"id": key, **meta} for key, meta in BELLY_COLORS.items()],
        "wingColors": [{"id": key, **meta} for key, meta in WING_COLORS.items()],
        "accessories": [{"id": key, **meta} for key, meta in ACCESSORIES.items()],
        "trails": [{"id": key, **meta} for key, meta in TRAILS.items()],
        "aPlusMinPercent": A_PLUS_MIN_PERCENT,
        "welcomePoints": A_PLUS_WELCOME_POINTS,
    }


def _unlocked_set(row: OwlProfile) -> set[str]:
    try:
        raw = json.loads(row.unlocked_json or "[]")
    except json.JSONDecodeError:
        return set()
    if not isinstance(raw, list):
        return set()
    return {str(item) for item in raw}


def _save_unlocked(row: OwlProfile, unlocked: set[str]) -> None:
    row.unlocked_json = json.dumps(sorted(unlocked))


def ensure_owl_profile(db: Session, profile_id: uuid.UUID) -> OwlProfile:
    row = db.get(OwlProfile, profile_id)
    if row is None:
        row = OwlProfile(profile_id=profile_id)
        db.add(row)
        db.flush()
    return row


def cosmetics_payload(row: OwlProfile) -> dict:
    belly = BELLY_COLORS.get(row.belly_color, BELLY_COLORS["snow"])
    wing = WING_COLORS.get(row.wing_color, WING_COLORS["mist"])
    return {
        "bellyColor": row.belly_color,
        "wingColor": row.wing_color,
        "accessory": row.accessory,
        "trail": row.trail,
        "palette": {"belly": belly, "wing": wing},
        "unlocked": sorted(_unlocked_set(row)),
    }


def profile_payload(row: OwlProfile, *, eligible: bool) -> dict:
    return {
        "points": row.points,
        "eligible": eligible,
        "accessActive": row.access_active,
        "weightedPercent": row.weighted_percent,
        "letterGrade": letter_grade(row.weighted_percent),
        "cosmetics": cosmetics_payload(row),
        "catalog": _catalog_payload(),
        "accessRevokedAt": (
            row.access_revoked_at.isoformat() if row.access_revoked_at else None
        ),
    }


def sync_access(
    db: Session,
    profile: Profile,
    *,
    weighted_percent: float | None,
    notify: bool = True,
) -> tuple[OwlProfile, AccessChange]:
    """Recompute A+ owl access from a server-provided weighted percent."""
    row = ensure_owl_profile(db, profile.id)
    was_active = row.access_active
    eligible = is_a_plus(weighted_percent)
    row.weighted_percent = (
        float(weighted_percent) if weighted_percent is not None else None
    )

    unlocked = False
    revoked = False

    if eligible and not was_active:
        row.access_active = True
        row.access_revoked_at = None
        row.points += A_PLUS_WELCOME_POINTS
        unlocked = True
    elif not eligible and was_active:
        row.access_active = False
        row.access_revoked_at = _now()
        revoked = True
        if notify:
            letter = letter_grade(weighted_percent) or "below A+"
            pct = (
                f"{weighted_percent:.1f}%"
                if weighted_percent is not None
                else "your current average"
            )
            notifications.deliver(
                db,
                recipient_ids=[profile.id],
                type="owl.access_revoked",
                title="Owl customization paused",
                body=(
                    f"Your grade is now {letter} ({pct}). Customizing the campsite "
                    "owl is for A+ (97%+) students — earn it back to unlock again."
                ),
                payload={
                    "href": "/owl",
                    "weightedPercent": weighted_percent,
                },
                dedupe_key=(
                    f"owl.access_revoked:{profile.id}:"
                    f"{row.access_revoked_at.isoformat()}"
                ),
            )

    row.updated_at = _now()
    db.commit()
    db.refresh(row)
    return row, AccessChange(
        unlocked=unlocked,
        revoked=revoked,
        percent=row.weighted_percent,
        letter=letter_grade(row.weighted_percent),
    )


def require_customize_access(row: OwlProfile) -> None:
    if not row.access_active or not is_a_plus(row.weighted_percent):
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail={
                "code": "owl_access_denied",
                "message": (
                    "Owl customization is only available while you hold an A+ "
                    "(97% or higher)."
                ),
            },
        )


def _item_key(field: str, value: str) -> str:
    return f"{field}:{value}"


def unlock_cost(row: OwlProfile, *, field: str, value: str) -> int:
    catalogs = {
        "bellyColor": BELLY_COLORS,
        "wingColor": WING_COLORS,
        "accessory": ACCESSORIES,
        "trail": TRAILS,
    }
    catalog = catalogs.get(field)
    if catalog is None or value not in catalog:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown {field} option.",
        )
    current = {
        "bellyColor": row.belly_color,
        "wingColor": row.wing_color,
        "accessory": row.accessory,
        "trail": row.trail,
    }[field]
    if current == value:
        return 0
    if _item_key(field, value) in _unlocked_set(row):
        return 0
    return int(catalog[value]["cost"])


def apply_cosmetics(
    db: Session,
    profile: Profile,
    *,
    belly_color: str | None = None,
    wing_color: str | None = None,
    accessory: str | None = None,
    trail: str | None = None,
) -> OwlProfile:
    row = ensure_owl_profile(db, profile.id)
    require_customize_access(row)

    total_cost = 0
    updates: list[tuple[str, str, str]] = []
    if belly_color is not None:
        total_cost += unlock_cost(row, field="bellyColor", value=belly_color)
        updates.append(("belly_color", belly_color, "bellyColor"))
    if wing_color is not None:
        total_cost += unlock_cost(row, field="wingColor", value=wing_color)
        updates.append(("wing_color", wing_color, "wingColor"))
    if accessory is not None:
        total_cost += unlock_cost(row, field="accessory", value=accessory)
        updates.append(("accessory", accessory, "accessory"))
    if trail is not None:
        total_cost += unlock_cost(row, field="trail", value=trail)
        updates.append(("trail", trail, "trail"))

    if total_cost > row.points:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail=f"Not enough owl points (need {total_cost}, have {row.points}).",
        )

    unlocked = _unlocked_set(row)
    row.points -= total_cost
    for attr, value, field in updates:
        setattr(row, attr, value)
        unlocked.add(_item_key(field, value))
    _save_unlocked(row, unlocked)
    row.updated_at = _now()
    db.commit()
    db.refresh(row)
    return row
