#!/usr/bin/env python3
"""Drive the L2 Board and request policies as real authenticated users.

The backend test suite runs on in-memory SQLite, which has no row level
security at all — every policy in 20260815000000 is invisible to it. This
connects to a real Postgres, impersonates seeded campers the way Supabase does
(role `authenticated` plus a JWT claim), and checks that each policy allows and
refuses what it is supposed to.

It found two things worth keeping the script for: the policies were initially
unreachable because the new tables had no DML grants to `authenticated`, and
`requests.view_all` had been used where `requests.manage_all` was meant, which
let a committee head answer another committee's request.

Writes only to its own rows and cleans up after itself.

Usage:
    python3 scripts/verify_board_rls.py [postgres-dsn]

Defaults to the local stack on 127.0.0.1:54322.
"""

from __future__ import annotations

import json
import sys
import uuid

import psycopg

DEFAULT_DSN = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"

TEMP_EMAIL = "rls.check.publicity@l2hub.local"


def as_user(dsn: str, user_id: str, fn):
    """Run `fn(cursor)` as an authenticated Supabase user, then roll back."""
    with psycopg.connect(dsn) as conn, conn.cursor() as cur:
        cur.execute("set local role authenticated")
        cur.execute(
            "select set_config('request.jwt.claims', %s, true)",
            (json.dumps({"sub": str(user_id), "role": "authenticated"}),),
        )
        return fn(cur)


def counter(sql: str, args: tuple = ()):
    def go(cur):
        cur.execute(sql, args)
        return cur.fetchone()[0]

    return go


def attempt(sql: str, args: tuple):
    """'allowed', 'blocked' by RLS, or the check constraint that refused it."""

    def go(cur):
        try:
            cur.execute(sql, args)
            return "allowed"
        except psycopg.errors.InsufficientPrivilege:
            return "blocked"
        except psycopg.errors.CheckViolation:
            return "rejected by check"

    return go


def main(dsn: str) -> int:
    with psycopg.connect(dsn) as conn, conn.cursor() as cur:
        # Clear anything an interrupted earlier run left behind, so the counts
        # below measure this run and not its predecessor.
        cur.execute("delete from public.committee_requests where title like 'RLS check%'")
        cur.execute("delete from public.committee_requests where title = 'rls check'")
        cur.execute("delete from public.tasks where title in ('RLS check task', 'rls check')")

        cur.execute("select id from public.committees where slug = 'community'")
        community = cur.fetchone()[0]
        cur.execute("select id from public.committees where slug = 'publicity'")
        publicity = cur.fetchone()[0]
        cur.execute(
            "select id from public.profiles where email = 'community.head@l2hub.local'"
        )
        head = cur.fetchone()[0]
        cur.execute(
            "select id from public.profiles where email = 'community.member@l2hub.local'"
        )
        member = cur.fetchone()[0]
        cur.execute("select id from public.profiles where email = 'ac@l2hub.local'")
        ac = cur.fetchone()[0]

        # Publicity has no seeded camper; the checks need someone on the other
        # side of a request. Created the way signup does, auth.users first.
        # Cleared first so an interrupted run does not block the next one.
        cur.execute("delete from auth.users where email = %s", (TEMP_EMAIL,))
        pub = uuid.uuid4()
        cur.execute(
            """insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
               values (%s, '00000000-0000-0000-0000-000000000000', 'authenticated',
                       'authenticated', %s, now(), now())""",
            (pub, TEMP_EMAIL),
        )
        cur.execute("select 1 from public.profiles where id = %s", (pub,))
        if cur.fetchone() is None:
            cur.execute(
                """insert into public.profiles (id, email, full_name, status)
                   values (%s, %s, 'RLS Check', 'active')""",
                (pub, TEMP_EMAIL),
            )
        cur.execute(
            """insert into public.user_roles (user_id, role_id)
               select %s, id from public.roles where slug = 'member'
               on conflict do nothing""",
            (pub,),
        )
        cur.execute(
            """insert into public.committee_memberships (user_id, committee_id, is_head)
               values (%s, %s, false) on conflict do nothing""",
            (pub, publicity),
        )

        cur.execute(
            """insert into public.tasks (committee_id, title, created_by_user_id)
               values (%s, 'RLS check task', %s) returning id""",
            (community, head),
        )
        task_id = cur.fetchone()[0]
        cur.execute(
            """insert into public.committee_requests
               (requesting_committee_id, target_committee_id, title, source_task_id,
                created_by_user_id)
               values (%s, %s, 'RLS check request', %s, %s) returning id""",
            (community, publicity, task_id, member),
        )
        request_id = cur.fetchone()[0]
        conn.commit()

    insert_task = "insert into public.tasks (committee_id, title) values (%s, 'rls check')"
    insert_request = """insert into public.committee_requests
        (requesting_committee_id, target_committee_id, title) values (%s, %s, 'rls check')"""

    def respond(cur):
        try:
            cur.execute(
                "update public.committee_requests set status = 'done' where id = %s",
                (request_id,),
            )
            return cur.rowcount
        except psycopg.errors.InsufficientPrivilege:
            return "blocked"

    cases = [
        (
            "member reads their own committee's tasks",
            as_user(dsn, member, counter(
                "select count(*) from public.tasks where committee_id = %s"
                " and title = 'RLS check task'", (community,))),
            1,
        ),
        (
            "member reads another committee's tasks too",
            as_user(dsn, pub, counter(
                "select count(*) from public.tasks where committee_id = %s"
                " and title = 'RLS check task'", (community,))),
            1,
        ),
        (
            "leadership reads every committee's tasks",
            as_user(dsn, ac, counter(
                "select count(*) from public.tasks where title = 'RLS check task'")),
            1,
        ),
        (
            "head adds a task to their own committee",
            as_user(dsn, head, attempt(insert_task, (community,))),
            "allowed",
        ),
        (
            "head cannot add a task to another committee",
            as_user(dsn, head, attempt(insert_task, (publicity,))),
            "blocked",
        ),
        (
            "plain member cannot add a task",
            as_user(dsn, member, attempt(insert_task, (community,))),
            "blocked",
        ),
        (
            "the committee that asked sees the request",
            as_user(dsn, member, counter("select count(*) from public.committee_requests"
                                     " where title = 'RLS check request'")),
            1,
        ),
        (
            "the committee that was asked sees it",
            as_user(dsn, pub, counter("select count(*) from public.committee_requests"
                                     " where title = 'RLS check request'")),
            1,
        ),
        (
            "leadership sees it",
            as_user(dsn, ac, counter("select count(*) from public.committee_requests"
                                     " where title = 'RLS check request'")),
            1,
        ),
        ("the asked committee answers", as_user(dsn, pub, respond), 1),
        ("the asking committee cannot answer", as_user(dsn, member, respond), 0),
        (
            "member files for their own committee",
            as_user(dsn, member, attempt(insert_request, (community, publicity))),
            "allowed",
        ),
        (
            "member cannot file in another committee's name",
            as_user(dsn, member, attempt(insert_request, (publicity, community))),
            "blocked",
        ),
        (
            "a committee cannot request from itself",
            as_user(dsn, member, attempt(insert_request, (community, community))),
            "rejected by check",
        ),
        (
            "nobody can delete a request, not even the committee that filed it",
            as_user(dsn, member, attempt(
                "delete from public.committee_requests where id = %s", (request_id,))),
            "blocked",
        ),
    ]

    failures = 0
    for label, got, want in cases:
        ok = got == want
        failures += not ok
        print(f"{'PASS' if ok else 'FAIL'}  {label}: {got!r} (want {want!r})")

    with psycopg.connect(dsn) as conn, conn.cursor() as cur:
        cur.execute("delete from public.committee_requests where title like 'RLS check%'")
        cur.execute("delete from public.committee_requests where title = 'rls check'")
        cur.execute("delete from public.tasks where title in ('RLS check task', 'rls check')")
        cur.execute("delete from auth.users where email = %s", (TEMP_EMAIL,))
        conn.commit()

    print(f"\n{len(cases) - failures}/{len(cases)} passed")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else DEFAULT_DSN))
