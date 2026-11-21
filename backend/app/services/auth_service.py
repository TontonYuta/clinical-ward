"""Credential verification and identity session use cases."""
import json
from datetime import datetime, timedelta, timezone
import uuid

from app.config import settings
from app.security.auth import AuthenticatedUser, issue_token, verify_password

VALID_ROLES = {"nurse", "doctor", "pharmacist", "biomedical_engineer", "director"}

DEFAULT_DEMO_USERS = {
    "admin": {
        "role": "director",
        "password_hash": "$argon2id$v=19$m=65536,t=3,p=4$dJg7GQ+a3Xltq4bAcwF87w$D5SP4Pin+UYpyPuj37nCQbAPCooaxc1wIy0sCwD8X8w"
    },
    "director": {
        "role": "director",
        "password_hash": "$argon2id$v=19$m=65536,t=3,p=4$GF3Hc+mjNdKugpBguR6tww$KDPSqJ29VEb1mS9e+lsdl2zUEFxlGq0j1c6JRUg9qwU"
    },
    "bac_si_test": {
        "role": "doctor",
        "password_hash": "$argon2id$v=19$m=65536,t=3,p=4$sNu3Zh2CciyrxlC0KlK0OA$qlmNJiw+sN+WywQOt+ybYWEPHIxeKtXL5LK+POsw/PQ"
    },
    "duoc_si_test": {
        "role": "pharmacist",
        "password_hash": "$argon2id$v=19$m=65536,t=3,p=4$Oz9YAegDQmRT5JincRBH7A$rZzZsXh++h4esywOsYDy/bjA7Ox8+HrdyeetDFG/QIs"
    },
    "dieu_duong_test": {
        "role": "nurse",
        "password_hash": "$argon2id$v=19$m=65536,t=3,p=4$7+r9w6b6RcRrYWuBMNhAOQ$z1hYuBoo4cFF5LmETfpF6B9MGHn5j1GiyUrz4HX7drQ"
    }
}


async def authenticate_configured_user(username: str, password: str) -> AuthenticatedUser | None:
    """Verify credentials from explicitly configured AUTH_USERS_JSON or built-in demo accounts."""
    users = {}
    try:
        users = json.loads(settings.AUTH_USERS_JSON)
    except (ValueError, TypeError):
        pass
    if not isinstance(users, dict) or not users:
        users = DEFAULT_DEMO_USERS
    clean_username = (username or "").strip()
    user = users.get(clean_username) or DEFAULT_DEMO_USERS.get(clean_username)
    if not isinstance(user, dict) or not verify_password(password or "", str(user.get("password_hash", ""))):
        return None
    role = user.get("role")
    if role not in VALID_ROLES:
        return None
    return AuthenticatedUser(username=clean_username, role=role, session_id="demo_session_" + clean_username)


async def authenticate_user(username: str, password: str) -> AuthenticatedUser | None:
    if settings.IDENTITY_DATABASE_URL:
        from app.identity_database import get_identity_session_factory
        from app.services.identity_service import authenticate_staff
        try:
            _, session_factory = get_identity_session_factory()
            async with session_factory() as session:
                user = await authenticate_staff(session, username, password)
                if user is not None:
                    return user
        except Exception:
            pass

    # Kiểm tra trực tiếp bảng users trong cơ sở dữ liệu bệnh viện
    from app.database import AsyncSessionLocal
    from app.models.user import User
    from sqlalchemy import select, func, or_
    try:
        clean_username = (username or "").strip().lower()
        if clean_username:
            async with AsyncSessionLocal() as db_session:
                stmt = select(User).where(
                    or_(
                        func.lower(User.username) == clean_username,
                        func.lower(User.id) == clean_username,
                    )
                )
                res = await db_session.execute(stmt)
                db_user = res.scalar_one_or_none()
                if db_user:
                    if not db_user.is_active:
                        return None  # Tài khoản tạm ngưng công tác
                    if db_user.hashed_password and verify_password(password or "", db_user.hashed_password):
                        effective_role = db_user.role if db_user.role in VALID_ROLES else "nurse"
                        return AuthenticatedUser(
                            username=db_user.username or clean_username,
                            role=effective_role,
                            account_id=db_user.id,
                            session_id=f"session_{db_user.id}_{int(datetime.now(timezone.utc).timestamp())}",
                        )
    except Exception:
        pass

    return await authenticate_configured_user(username, password)


async def create_login_session(user: AuthenticatedUser) -> tuple[str, str | None]:
    session_id = str(uuid.uuid4()) if (settings.IDENTITY_DATABASE_URL and user.account_id) else None
    token = issue_token(
        user.username, user.role, settings.SECRET_KEY, settings.AUTH_TOKEN_TTL_SECONDS,
        session_id=session_id,
    )
    if settings.IDENTITY_DATABASE_URL and user.account_id:
        from app.identity_database import get_identity_session_factory
        from app.services.identity_service import create_identity_session
        try:
            _, session_factory = get_identity_session_factory()
            async with session_factory() as session:
                await create_identity_session(
                    session, user.account_id, token,
                    datetime.now(timezone.utc) + timedelta(seconds=settings.AUTH_TOKEN_TTL_SECONDS),
                    session_id=session_id or "",
                )
        except Exception:
            pass
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
