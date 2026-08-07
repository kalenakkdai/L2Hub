"""Verification of access tokens issued by Supabase Auth.

Supabase signs access tokens one of two ways depending on project age:

* Asymmetric (ES256 / RS256) using JWT signing keys. The public keys are
  published at `<project>/auth/v1/.well-known/jwks.json`.
* Legacy symmetric HS256 using the project's shared JWT secret.

We support both and pick based on the `alg` in the token header, so the same
build works before and after a project migrates to signing keys.
"""

import jwt
from jwt import PyJWKClient

from app.core.config import settings

ASYMMETRIC_ALGORITHMS = ("ES256", "RS256")
SYMMETRIC_ALGORITHMS = ("HS256",)

# Public keys change rarely; cache them rather than fetching per request.
_JWKS_CACHE_LIFESPAN_SECONDS = 600

_jwk_client: PyJWKClient | None = None


class AuthError(Exception):
    """The presented token is missing, malformed, expired, or not ours."""


class AuthConfigurationError(Exception):
    """The server cannot verify tokens because it is missing configuration."""


def get_jwk_client() -> PyJWKClient:
    """Return the process-wide JWKS client, building it on first use."""
    global _jwk_client

    if not settings.jwks_url:
        raise AuthConfigurationError(
            "SUPABASE_URL is not set, so asymmetric tokens cannot be verified."
        )

    if _jwk_client is None:
        _jwk_client = PyJWKClient(
            settings.jwks_url,
            cache_keys=True,
            lifespan=_JWKS_CACHE_LIFESPAN_SECONDS,
        )

    return _jwk_client


def reset_jwk_client() -> None:
    """Drop the cached JWKS client. Used by tests and after config changes."""
    global _jwk_client
    _jwk_client = None


def _decode_options() -> dict[str, object]:
    # Supabase always sets exp and sub. Require them explicitly rather than
    # trusting a token that happens to omit one.
    return {"require": ["exp", "sub"], "verify_aud": bool(settings.supabase_jwt_audience)}


def verify_token(token: str) -> dict:
    """Verify a Supabase access token and return its claims.

    Raises:
        AuthError: the token is not valid for this project.
        AuthConfigurationError: this server lacks the keys to check it.
    """
    if not token:
        raise AuthError("No access token supplied.")

    try:
        header = jwt.get_unverified_header(token)
    except jwt.PyJWTError as exc:
        raise AuthError(f"Malformed token header: {exc}") from exc

    algorithm = header.get("alg")

    if algorithm in ASYMMETRIC_ALGORITHMS:
        try:
            key = get_jwk_client().get_signing_key_from_jwt(token).key
        except AuthConfigurationError:
            raise
        except Exception as exc:  # PyJWKClient raises several unrelated types
            raise AuthError(f"No usable signing key for this token: {exc}") from exc
        algorithms = list(ASYMMETRIC_ALGORITHMS)

    elif algorithm in SYMMETRIC_ALGORITHMS:
        if not settings.supabase_jwt_secret:
            raise AuthConfigurationError(
                "Token is HS256-signed but SUPABASE_JWT_SECRET is not set."
            )
        key = settings.supabase_jwt_secret
        algorithms = list(SYMMETRIC_ALGORITHMS)

    else:
        # Never fall through to alg=none or anything else unexpected.
        raise AuthError(f"Unsupported token algorithm: {algorithm!r}")

    try:
        return jwt.decode(
            token,
            key,
            algorithms=algorithms,
            audience=settings.supabase_jwt_audience or None,
            issuer=settings.jwt_issuer or None,
            options=_decode_options(),
        )
    except jwt.PyJWTError as exc:
        raise AuthError(f"Token rejected: {exc}") from exc
