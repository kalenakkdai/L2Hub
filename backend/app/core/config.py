from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolved from this file rather than left relative, so `.env` is found the
# same way whether uvicorn is started from backend/ or from the repo root.
# A relative "*.env*" is looked up against the working directory, which meant
# starting the server one directory up silently loaded no settings at all.
BACKEND_ROOT = Path(__file__).resolve().parents[2]
ENV_FILE = BACKEND_ROOT / ".env"

# `.env.local` points at the local Supabase stack and `.env` at the shared
# cloud project, so which target you are on is decided by whether the file
# exists rather than by an environment variable someone has to remember to
# set. This is the same rule Vite applies on the frontend, so both halves of
# the app switch together.
#
# Order matters: pydantic-settings reads these left to right and later files
# win, so `.env.local` overrides `.env` key by key. That means `.env.local`
# only has to carry what actually differs.
ENV_FILE_LOCAL = BACKEND_ROOT / ".env.local"


class Settings(BaseSettings):
    """Application settings loaded from environment variables or .env."""

    app_name: str = "L2 Hub"
    environment: str = "development"
    host: str = "127.0.0.1"
    port: int = 8000
    database_url: str = "sqlite:///./l2hub.db"
    # Browsers match Origin by exact string, so every spelling of the Vite dev
    # server is a separate entry: `localhost`, the IPv4 loopback, and the IPv6
    # loopback literal. Vite binds to whichever stack `localhost` resolves to
    # (IPv6 on macOS), so which one the browser reports depends on the URL the
    # developer opened, not on configuration.
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173,http://[::1]:5173"

    # Supabase project URL, e.g. https://<project-ref>.supabase.co
    supabase_url: str = ""

    # Postgres connection string for the Supabase database. Prefer the session
    # pooler URI from the dashboard (Project Settings -> Database). Falls back
    # to database_url when unset so local SQLite development still works.
    supabase_db_url: str = ""

    # Legacy HS256 signing secret (dashboard -> API -> JWT Settings). Only
    # needed for projects that have not migrated to asymmetric signing keys.
    supabase_jwt_secret: str = ""

    # Access tokens issued by Supabase Auth carry aud="authenticated".
    supabase_jwt_audience: str = "authenticated"

    # Object storage (files, screenshots, future knowledge uploads).
    # `local` writes under STORAGE_LOCAL_ROOT on this machine. Later swap to
    # `s3` or `gcs` without changing call sites that depend on ObjectStorage.
    storage_backend: str = "local"
    # Empty → backend/.local-storage. Absolute or ~ paths are fine.
    storage_local_root: str = ""

    model_config = SettingsConfigDict(
        env_file=(ENV_FILE, ENV_FILE_LOCAL),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_origin_list(self) -> list[str]:
        """Exact origins allowed to call the API from a browser.

        Each entry must match the browser's `Origin` header character for
        character — scheme, host as typed, and port. A near-miss is rejected
        with `400 Disallowed CORS origin` at the preflight.
        """
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def sqlalchemy_url(self) -> str:
        """Connection string the SQLAlchemy engine should use."""
        return self.supabase_db_url or self.database_url

    @property
    def jwks_url(self) -> str:
        """Endpoint publishing the project's public JWT signing keys."""
        if not self.supabase_url:
            return ""
        return f"{self.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"

    @property
    def jwt_issuer(self) -> str:
        """Expected `iss` claim on Supabase-issued access tokens."""
        if not self.supabase_url:
            return ""
        return f"{self.supabase_url.rstrip('/')}/auth/v1"


settings = Settings()
