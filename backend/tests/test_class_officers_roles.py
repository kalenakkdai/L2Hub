"""Class Officers / Class Advisor permission bundles."""

from __future__ import annotations

from app.core import permission_keys as pk
from app.core.role_catalog import ROLE_PERMISSION_BUNDLES


def test_class_advisor_may_only_view_class_officers_progress():
    bundle = ROLE_PERMISSION_BUNDLES["class_advisor"]
    assert pk.CLASS_OFFICERS_VIEW in bundle
    assert pk.CLASS_OFFICERS_MANAGE not in bundle
    # Shell companion only — no operational platform access.
    assert bundle <= {pk.CLASS_OFFICERS_VIEW, pk.NOTIFICATIONS_VIEW_OWN}


def test_class_officer_can_edit_the_platform():
    bundle = ROLE_PERMISSION_BUNDLES["class_officer"]
    assert pk.CLASS_OFFICERS_VIEW in bundle
    assert pk.CLASS_OFFICERS_MANAGE in bundle
    assert pk.EVENTS_VIEW in bundle  # member baseline retained


def test_asbo_and_ac_receive_class_officers_manage():
    assert pk.CLASS_OFFICERS_VIEW in ROLE_PERMISSION_BUNDLES["asbo"]
    assert pk.CLASS_OFFICERS_MANAGE in ROLE_PERMISSION_BUNDLES["asbo"]
    assert pk.CLASS_OFFICERS_MANAGE in ROLE_PERMISSION_BUNDLES["ac"]
    assert pk.CLASS_OFFICERS_MANAGE in ROLE_PERMISSION_BUNDLES["president"]


def test_member_does_not_see_class_officers_by_default():
    bundle = ROLE_PERMISSION_BUNDLES["member"]
    assert pk.CLASS_OFFICERS_VIEW not in bundle
    assert pk.CLASS_OFFICERS_MANAGE not in bundle
