from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolved from this file rather than left relative, so `.env` is found the
# same way whether uvicorn is started from backend/ or from the repo root.
# A relative "*.env*" is looked up against the working directory, which meant
# starting the server one directory up silently loaded no settings at all.
ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


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

    model_config = SettingsConfigDict(
        env_file=ENV_FILE,
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
