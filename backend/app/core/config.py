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

    # Object storage (files, screenshots, meeting recordings).
    # `local`    — files under STORAGE_LOCAL_ROOT on this machine. Development
    #              only: a container filesystem is wiped on every deploy.
    # `supabase` — objects in a private Supabase Storage bucket. Use this
    #              anywhere the uploads are meant to outlive the process.
    storage_backend: str = "local"
    # Empty → backend/.local-storage. Absolute or ~ paths are fine.
    storage_local_root: str = ""

    # Secret key (dashboard -> Project Settings -> API keys). Server-side only
    # and RLS-bypassing, so it must never reach the browser. Required when
    # STORAGE_BACKEND=supabase; unused otherwise.
    supabase_service_key: str = ""
    supabase_storage_bucket: str = "attachments"
    supabase_storage_signed_url_ttl: int = 3600

    # Outbound email (deadline reminders).
    # `log`    — write the message to the application log and send nothing.
    #            The default, and what development and the tests run on: a
    #            reminder must never reach a real student from a laptop.
    # `resend` — POST to Resend. Needs RESEND_API_KEY and EMAIL_FROM.
    email_backend: str = "log"
    resend_api_key: str = ""
    # Must be a verified sender on the provider, e.g. "L2 Hub <hub@example.edu>".
    email_from: str = ""
    email_reply_to: str = ""
    # Origin of the frontend, used to deep-link from an email back into the
    # board. Empty means the email simply carries no link.
    app_base_url: str = ""

    # Web push.
    # `log`     — write the notification to the application log and send
    #             nothing. The default, and what the tests run on.
    # `webpush` — encrypt and POST to the browser's push service via
    #             pywebpush. Needs all three VAPID values below.
    push_backend: str = "log"
    # The public half is not a secret: it is handed to every browser that
    # subscribes, and the subscription is bound to it. Rotating this keypair
    # invalidates every existing subscription, because a push signed by a new
    # key is refused for a subscription created under the old one.
    push_vapid_public_key: str = ""
    # NEVER commit this, and never expose it under a VITE_ name. Holding it
    # plus a stored endpoint is enough to push to that browser.
    push_vapid_private_key: str = ""
    # RFC 8292: a mailto: or https: contact the push service can reach if our
    # traffic causes them a problem. Not optional in practice — several push
    # services reject a VAPID token without it.
    push_vapid_subject: str = ""

    # Shared secret for the pg_cron/pg_net job trigger. Empty means scheduled
    # jobs are refused outright rather than run unauthenticated.
    job_trigger_secret: str = ""
    # How far back the deadline sweep looks for tasks that already slipped.
    # Without this floor the first run after a deploy would raise an overdue
    # notice for every task that has ever been late, all at once.
    deadline_backfill_days: int = 14

    # Optional Whisper fallback when an upload has no browser transcript.
    whisper_model: str = "base"
    whisper_device: str = "cpu"

    # Daily Leadership attendance. All timing and penalties are computed on the
    # server in this timezone; browser clocks are display-only.
    attendance_timezone: str = "America/Los_Angeles"
    attendance_class_start: str = "08:00"
    attendance_class_end: str = "08:50"
    attendance_id_pepper: str = "local-development-only-change-me"
    webauthn_rp_id: str = "localhost"
    webauthn_origin: str = "http://localhost:5173"

    # Optional SMTP delivery for under-80% parent alerts. When unset, alerts
    # remain in the durable outbox instead of being falsely marked sent.
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from_email: str = ""
    smtp_use_tls: bool = True

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
