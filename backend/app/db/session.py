from collections.abc import Iterator
from urllib.parse import urlparse

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.pool import NullPool

from app.core.config import settings

# Supabase's transaction-mode pooler (port 6543) multiplexes connections and
# does not support prepared statements or long-lived server-side state, so we
# do not keep our own pool on top of it. The session pooler / direct
# connection (port 5432) is a normal Postgres connection and pools fine.
TRANSACTION_POOLER_PORT = 6543


class Base(DeclarativeBase):
    """Declarative base for all ORM models."""


def _normalize_url(url: str) -> str:
    """Use the psycopg 3 driver for Postgres URLs.

    Supabase hands out `postgresql://...` strings, which SQLAlchemy would
    route to psycopg2. We install psycopg 3, so name it explicitly.
    """
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+psycopg://", 1)
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+psycopg://", 1)
    return url


def _uses_transaction_pooler(url: str) -> bool:
    try:
        return urlparse(url).port == TRANSACTION_POOLER_PORT
    except ValueError:
        return False


def create_db_engine(url: str | None = None) -> Engine:
    """Build an engine for the configured database."""
    raw_url = url or settings.sqlalchemy_url
    normalized = _normalize_url(raw_url)

    kwargs: dict[str, object] = {"pool_pre_ping": True, "future": True}

    if _uses_transaction_pooler(normalized):
        kwargs["poolclass"] = NullPool
        # psycopg 3 uses prepared statements after a few repeats of a query;
        # the transaction pooler cannot honour them across connections.
        kwargs["connect_args"] = {"prepare_threshold": None}

    return create_engine(normalized, **kwargs)


engine = create_db_engine()
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    """FastAPI dependency yielding a database session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
