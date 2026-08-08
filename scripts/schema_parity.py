#!/usr/bin/env python3
"""Compare the local Supabase schema against the shared cloud project.

Applying the same migrations to two databases is not proof they ended up the
same. The shared project has taken twelve migrations over several days, and a
dashboard edit or a partially-applied push would not show up in
`supabase migration list` — that only compares version numbers.

This reads the parts that actually decide behaviour and diffs them:

  * columns, with type, nullability and default
  * table privileges granted to `authenticated`, per column
  * RLS policies, and whether RLS is enabled
  * check constraints
  * triggers

Anything present in one and not the other is reported. Read-only: it opens
both databases, runs selects, and writes nothing.

Usage:
    python3 scripts/schema_parity.py
"""

from __future__ import annotations

import sys
from pathlib import Path

import psycopg

ROOT = Path(__file__).resolve().parents[1]


def env_value(path: Path, key: str) -> str | None:
    if not path.exists():
        return None
    for line in path.read_text().splitlines():
        line = line.strip()
        if line.startswith(f"{key}=") and not line.startswith("#"):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    return None


QUERIES: dict[str, str] = {
    "columns": """
        select table_name, column_name, data_type, is_nullable, column_default
        from information_schema.columns
        where table_schema = 'public'
        order by table_name, column_name
    """,
    "grants_to_authenticated": """
        select table_name, privilege_type, coalesce(column_name, '*') as col
        from (
            select table_name, privilege_type, null::text as column_name
            from information_schema.role_table_grants
            where table_schema = 'public' and grantee = 'authenticated'
            union all
            select table_name, privilege_type, column_name
            from information_schema.column_privileges
            where table_schema = 'public' and grantee = 'authenticated'
        ) g
        order by table_name, privilege_type, col
    """,
    "rls_enabled": """
        select relname, relrowsecurity::text
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r'
        order by relname
    """,
    "policies": """
        select tablename, policyname, cmd, coalesce(qual, ''), coalesce(with_check, '')
        from pg_policies
        where schemaname = 'public'
        order by tablename, policyname
    """,
    "check_constraints": """
        select rel.relname, con.conname, pg_get_constraintdef(con.oid)
        from pg_constraint con
        join pg_class rel on rel.oid = con.conrelid
        join pg_namespace n on n.oid = rel.relnamespace
        where n.nspname = 'public' and con.contype = 'c'
        order by rel.relname, con.conname
    """,
    "triggers": """
        select c.relname, t.tgname
        from pg_trigger t
        join pg_class c on c.oid = t.tgrelid
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and not t.tgisinternal
        order by c.relname, t.tgname
    """,
    # Bodies, not just names. A trigger keeps its name while the function it
    # calls is replaced, so comparing triggers alone says nothing about what
    # they now do — 20260814000000 changed two function bodies and nothing
    # else, and every other check here would have reported IDENTICAL whether
    # or not it had reached the other database.
    #
    # Hashed to keep a difference readable: the name tells you which function
    # to look at, without printing two copies of the source.
    "function_bodies": """
        select p.proname, md5(pg_get_functiondef(p.oid))
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.prokind = 'f'
        order by p.proname
    """,
}


def fetch(dsn: str, sql: str) -> set[tuple]:
    with psycopg.connect(dsn, connect_timeout=20) as conn, conn.cursor() as cur:
        cur.execute(sql)
        return {tuple("" if v is None else str(v) for v in row) for row in cur.fetchall()}


def server_version(dsn: str) -> str:
    with psycopg.connect(dsn, connect_timeout=20) as conn, conn.cursor() as cur:
        cur.execute("show server_version")
        return cur.fetchone()[0]


def main() -> int:
    # `.env.local.off` is the parked copy left behind when switching back to
    # the shared project. The local stack is still running and still worth
    # comparing against, so read it rather than refusing.
    local = env_value(ROOT / "backend" / ".env.local", "SUPABASE_DB_URL") or env_value(
        ROOT / "backend" / ".env.local.off", "SUPABASE_DB_URL"
    )
    shared = env_value(ROOT / "backend" / ".env", "SUPABASE_DB_URL")

    if not local:
        print("backend/.env.local has no SUPABASE_DB_URL — is the local stack configured?")
        return 1
    if not shared:
        print("backend/.env has no SUPABASE_DB_URL — nothing to compare against.")
        return 1

    print(f"local  postgres {server_version(local)}")
    print(f"shared postgres {server_version(shared)}")

    differences = 0
    for name, sql in QUERIES.items():
        local_rows = fetch(local, sql)
        shared_rows = fetch(shared, sql)

        only_local = local_rows - shared_rows
        only_shared = shared_rows - local_rows

        if not only_local and not only_shared:
            print(f"\n[same] {name}  ({len(local_rows)} rows)")
            continue

        differences += len(only_local) + len(only_shared)
        print(f"\n[DIFF] {name}")
        for row in sorted(only_shared):
            print(f"   shared only : {row}")
        for row in sorted(only_local):
            print(f"   local  only : {row}")

    print(
        f"\n{'IDENTICAL' if differences == 0 else f'{differences} DIFFERENCE(S)'}"
    )
    return 0 if differences == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
