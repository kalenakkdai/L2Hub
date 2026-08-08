"""Which Supabase the backend talks to is decided by a file, not a flag.

`.env` holds the shared cloud project and `.env.local` holds the local stack.
The presence of `.env.local` is what switches targets, matching the rule Vite
already applies on the frontend so both halves of the app move together.

These tests exercise the precedence directly rather than importing the app
settings, because the real files are gitignored and differ per machine.
"""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict

from app.core.config import ENV_FILE, ENV_FILE_LOCAL


def _settings_class(shared, local):
    class _Settings(BaseSettings):
        supabase_url: str = ""
        cors_origins: str = ""

        model_config = SettingsConfigDict(
            env_file=(shared, local), env_file_encoding="utf-8", extra="ignore"
        )

    return _Settings


def test_local_env_overrides_shared(tmp_path):
    shared = tmp_path / ".env"
    local = tmp_path / ".env.local"
    shared.write_text("supabase_url=https://shared.supabase.co\ncors_origins=keep\n")
    local.write_text("supabase_url=http://127.0.0.1:54321\n")

    settings = _settings_class(shared, local)()

    assert settings.supabase_url == "http://127.0.0.1:54321"
    # A key the local file does not mention must survive rather than reset to
    # the field default — otherwise .env.local would have to duplicate .env.
    assert settings.cors_origins == "keep"


def test_missing_local_env_falls_back_to_shared(tmp_path):
    shared = tmp_path / ".env"
    shared.write_text("supabase_url=https://shared.supabase.co\ncors_origins=keep\n")

    settings = _settings_class(shared, tmp_path / ".env.local")()

    assert settings.supabase_url == "https://shared.supabase.co"


def test_app_reads_local_after_shared():
    """Order is the whole mechanism, so assert it rather than assume it."""
    from app.core.config import Settings

    env_files = Settings.model_config["env_file"]

    assert list(env_files) == [ENV_FILE, ENV_FILE_LOCAL], (
        "`.env.local` must come last, or the shared project would win"
    )
    assert ENV_FILE.name == ".env"
    assert ENV_FILE_LOCAL.name == ".env.local"
    assert ENV_FILE.parent == ENV_FILE_LOCAL.parent
