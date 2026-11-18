"""Credential verification and identity session use cases."""
import json
from datetime import datetime, timedelta, timezone
import uuid

from app.config import settings
from app.security.auth import AuthenticatedUser, issue_token, verify_password

VALID_ROLES = {"nurse", "doctor", "pharmacist", "biomedical_engineer", "director"}


async def authenticate_configured_user(username: str, password: str) -> AuthenticatedUser | None:
    """Verify credentials from explicitly configured AUTH_USERS_JSON."""
    try:
        users = json.loads(settings.AUTH_USERS_JSON)
    except (ValueError, TypeError):
        return None
    if not isinstance(users, dict):
        return None
    user = users.get((username or "").strip())
    if not isinstance(user, dict) or not verify_password(password or "", str(user.get("password_hash", ""))):
        return None
    role = user.get("role")
    if role not in VALID_ROLES:
        return None
    return AuthenticatedUser(username=(username or "").strip(), role=role)


async def authenticate_user(username: str, password: str) -> AuthenticatedUser | None:
    if settings.IDENTITY_DATABASE_URL:
        from app.identity_database import get_identity_session_factory
        from app.services.identity_service import authenticate_staff
        _, session_factory = get_identity_session_factory()
        async with session_factory() as session:
            return await authenticate_staff(session, username, password)
    return await authenticate_configured_user(username, password)


async def create_login_session(user: AuthenticatedUser) -> tuple[str, str | None]:
    session_id = str(uuid.uuid4()) if settings.IDENTITY_DATABASE_URL else None
    token = issue_token(
        user.username, user.role, settings.SECRET_KEY, settings.AUTH_TOKEN_TTL_SECONDS,
        session_id=session_id,
    )
    if settings.IDENTITY_DATABASE_URL:
        from app.identity_database import get_identity_session_factory
        from app.services.identity_service import create_identity_session
        _, session_factory = get_identity_session_factory()
        async with session_factory() as session:
            await create_identity_session(
                session, user.account_id or "", token,
                datetime.now(timezone.utc) + timedelta(seconds=settings.AUTH_TOKEN_TTL_SECONDS),
                session_id=session_id or "",
            )
    return token, session_id


async def refresh_login_session(user: AuthenticatedUser, token: str) -> str:
    """Rotate an authenticated cookie and refresh its configured lifetime.

    Rotation is safe for configured accounts (their tokens are stateless).
    Identity-backed accounts also replace the persisted token hash atomically
    so an old copied cookie cannot remain valid after refresh.
    """
    refreshed = issue_token(
        user.username, user.role, settings.SECRET_KEY, settings.AUTH_TOKEN_TTL_SECONDS,
        session_id=user.session_id,
    )
    if settings.IDENTITY_DATABASE_URL:
        from app.identity_database import get_identity_session_factory
        from app.services.identity_service import rotate_identity_session
        _, session_factory = get_identity_session_factory()
        async with session_factory() as session:
            await rotate_identity_session(session, token, refreshed)
    return refreshed


async def validate_user_session(user: AuthenticatedUser, token: str) -> bool:
    if not settings.IDENTITY_DATABASE_URL:
        return True
    from app.identity_database import get_identity_session_factory
    from app.services.identity_service import validate_identity_session
    _, session_factory = get_identity_session_factory()
    async with session_factory() as session:
        return await validate_identity_session(session, token, user)


async def revoke_user_session(token: str) -> None:
    if not token or not settings.IDENTITY_DATABASE_URL:
        return
    from app.identity_database import get_identity_session_factory
    from app.services.identity_service import revoke_identity_session
    _, session_factory = get_identity_session_factory()
    async with session_factory() as session:
        await revoke_identity_session(session, token)
