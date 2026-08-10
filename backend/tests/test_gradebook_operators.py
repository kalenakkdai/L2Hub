"""Unit tests for Jan ↔ Jadon gradebook operator allowlist."""

from __future__ import annotations

from types import SimpleNamespace

from app.services import gradebook_operators as ops


def test_gradebook_operators_match_jan_and_jadon():
    assert ops.is_gradebook_operator(
        SimpleNamespace(email="ac@l2hub.local", full_name="Anyone")
    )
    assert ops.is_gradebook_operator(
        SimpleNamespace(email="jadonli2020@gmail.com", full_name="Anyone")
    )
    assert ops.is_gradebook_operator(
        SimpleNamespace(email="x@y.z", full_name="Mr. Jan")
    )
    assert ops.is_gradebook_operator(
        SimpleNamespace(email="x@y.z", full_name="Jadon Li")
    )
    assert ops.is_gradebook_operator(
        SimpleNamespace(email="president@l2hub.local", full_name="Jadon Li")
    )
    assert not ops.is_gradebook_operator(
        SimpleNamespace(email="asbo@l2hub.local", full_name="Taylor Kim")
    )


def test_peer_operator_ids_exclude_the_actor(db_session):
    from app.db.seed import seed_development_users

    users = seed_development_users(db_session)
    peers_of_jan = ops.peer_operator_ids(db_session, users["ac"].id)
    assert users["president"].id in peers_of_jan
    assert users["ac"].id not in peers_of_jan

    peers_of_jadon = ops.peer_operator_ids(db_session, users["president"].id)
    assert users["ac"].id in peers_of_jadon
    assert users["president"].id not in peers_of_jadon
