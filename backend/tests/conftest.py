import json
import uuid
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi.testclient import TestClient
from jwt import PyJWKSet
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core import security
from app.core.config import settings
from app.db.session import Base, get_db
from app.main import app
from app.models.profile import Profile

TEST_SUPABASE_URL = "https://test-project.supabase.co"
TEST_ISSUER = f"{TEST_SUPABASE_URL}/auth/v1"
TEST_AUDIENCE = "authenticated"
TEST_HS256_SECRET = "test-only-hs256-secret-not-a-real-credential"
TEST_KEY_ID = "test-key-1"


@pytest.fixture(autouse=True)
def _auth_settings(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    """Point token verification at the fake project used by these tests.

    Nothing here touches the real .env: every value is a test fixture.
    """
    monkeypatch.setattr(settings, "supabase_url", TEST_SUPABASE_URL)
    monkeypatch.setattr(settings, "supabase_jwt_secret", TEST_HS256_SECRET)
    monkeypatch.setattr(settings, "supabase_jwt_audience", TEST_AUDIENCE)
    security.reset_jwk_client()
    yield
    security.reset_jwk_client()


@pytest.fixture(scope="session")
def signing_key() -> ec.EllipticCurvePrivateKey:
    """An ES256 keypair standing in for the project's JWT signing key."""
    return ec.generate_private_key(ec.SECP256R1())


@pytest.fixture(autouse=True)
def _stub_jwks(monkeypatch: pytest.MonkeyPatch, signing_key) -> None:
    """Serve the test public key instead of reaching out to Supabase.

    The PyJWKClient *class* is replaced rather than get_jwk_client(), so the
    real client-construction logic — including its configuration checks —
    still runs under test.
    """
    public_jwk = json.loads(jwt.algorithms.ECAlgorithm.to_jwk(signing_key.public_key()))
    public_jwk.update({"kid": TEST_KEY_ID, "use": "sig", "alg": "ES256"})
    jwk_set = PyJWKSet.from_dict({"keys": [public_jwk]})

    class StubJWKClient:
        def __init__(self, uri: str, **kwargs) -> None:
            self.uri = uri

        def get_signing_key_from_jwt(self, token: str):
            kid = jwt.get_unverified_header(token).get("kid")
            for key in jwk_set.keys:
                if key.key_id == kid:
                    return key
            raise jwt.PyJWKClientError(f"Unable to find a signing key matching {kid!r}")

    monkeypatch.setattr(security, "PyJWKClient", StubJWKClient)


@pytest.fixture
def make_token(signing_key):
    """Build access tokens shaped like Supabase's."""

    def _make(
        *,
        sub: str | uuid.UUID | None = None,
        algorithm: str = "ES256",
        audience: str | None = TEST_AUDIENCE,
        issuer: str | None = TEST_ISSUER,
        expires_in: timedelta = timedelta(hours=1),
        key_id: str = TEST_KEY_ID,
        include_exp: bool = True,
        **extra_claims,
    ) -> str:
        now = datetime.now(UTC)
        claims: dict = {"sub": str(sub) if sub else str(uuid.uuid4()), "iat": now, "role": "authenticated"}
        if include_exp:
            claims["exp"] = now + expires_in
        if audience is not None:
            claims["aud"] = audience
        if issuer is not None:
            claims["iss"] = issuer
        claims.update(extra_claims)

        key = TEST_HS256_SECRET if algorithm == "HS256" else signing_key
        headers = {"kid": key_id} if algorithm != "HS256" else None
        return jwt.encode(claims, key, algorithm=algorithm, headers=headers)

    return _make


@pytest.fixture
def db_session() -> Iterator[Session]:
    """An isolated in-memory database with the profiles table created."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    session = factory()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(engine)
        engine.dispose()


@pytest.fixture
def client(db_session: Session) -> Iterator[TestClient]:
    """A test client whose requests use the in-memory database."""
    app.dependency_overrides[get_db] = lambda: db_session
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def make_profile(db_session: Session):
    """Insert a profile row, mimicking what the auth.users trigger does."""

    def _make(
        *,
        user_id: uuid.UUID | None = None,
        email: str = "student@example.edu",
        full_name: str | None = "Test Student",
        role: str = "student",
    ) -> Profile:
        profile = Profile(
            id=user_id or uuid.uuid4(),
            email=email,
            full_name=full_name,
            role=role,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
        db_session.add(profile)
        db_session.commit()
        return profile

    return _make
