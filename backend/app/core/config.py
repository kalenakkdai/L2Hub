from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables or .env."""

    app_name: str = "L2 Hub"
    environment: str = "development"
    host: str = "127.0.0.1"
    port: int = 8000
    database_url: str = "sqlite:///./l2hub.db"
    cors_origins: str = "http://localhost:5173"

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
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_origin_list(self) -> list[str]:
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
