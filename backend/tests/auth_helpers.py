"""Shared authentication helpers for backend HTTP tests running under AUTH_REQUIRED=true."""
from app.config import settings
from app.security.auth import issue_token


def make_auth_headers(role: str = "director", username: str = "test_director") -> dict[str, str]:
    """Build a valid Bearer authorization header using the server's token issuer."""
    token = issue_token(
        username=username,
        role=role,
        secret_key=settings.SECRET_KEY,
        session_id="sandbox_session",
    )
    return {"Authorization": f"Bearer {token}"}
