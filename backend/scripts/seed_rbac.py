"""Seed RBAC catalog and development users into the configured database."""

import app.models  # noqa: F401
from app.db.seed import seed_development_users
from app.db.session import SessionLocal
from app.services.authorization import build_auth_context, primary_role_slug


def main() -> None:
    db = SessionLocal()
    try:
        users = seed_development_users(db)
        print("Seeded users:")
        for key, user in users.items():
            role = primary_role_slug(build_auth_context(db, user))
            print(f"  {key}: {user.email} ({role})")
    finally:
        db.close()


if __name__ == "__main__":
    main()
