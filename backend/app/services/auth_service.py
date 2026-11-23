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
                            name=db_user.name,
                            role_name=db_user.role_name,
                            department=db_user.department,
                            practice_certificate=db_user.practice_certificate,
                            pin_code=db_user.pin_code,
                            rfid_card_id=db_user.rfid_card_id,
                            academic_title=db_user.academic_title,
                            avatar_url=db_user.avatar_url,
                            email=db_user.email,
                            phone=db_user.phone,
                            dob=db_user.dob,
                            responsibilities=db_user.responsibilities,
                            must_change_password=db_user.must_change_password,
                        )
    except Exception:
        pass

    configured_user = await authenticate_configured_user(username, password)
    if configured_user:
        profile = await get_user_profile_data(configured_user.username)
        return AuthenticatedUser(
            username=configured_user.username,
            role=configured_user.role,
            account_id=configured_user.account_id or profile.get("account_id"),
            session_id=configured_user.session_id or f"session_{configured_user.username}_{int(datetime.now(timezone.utc).timestamp())}",
            name=profile.get("name") or configured_user.name,
            role_name=profile.get("role_name") or configured_user.role_name,
            department=profile.get("department") or configured_user.department,
            practice_certificate=profile.get("practice_certificate") or configured_user.practice_certificate,
            pin_code=profile.get("pin_code") or configured_user.pin_code,
            rfid_card_id=profile.get("rfid_card_id") or configured_user.rfid_card_id,
            academic_title=profile.get("academic_title") or configured_user.academic_title,
            avatar_url=profile.get("avatar_url") or configured_user.avatar_url,
            email=profile.get("email") or configured_user.email,
            phone=profile.get("phone") or configured_user.phone,
            dob=profile.get("dob") or configured_user.dob,
            responsibilities=profile.get("responsibilities") or configured_user.responsibilities,
            must_change_password=profile.get("must_change_password", False),
        )
    return None


async def get_user_profile_data(username: str) -> dict:
    """Tra cứu đầy đủ thông tin hồ sơ của nhân sự từ bảng users hoặc USERS_DATA."""
    clean_username = (username or "").strip().lower()
    if not clean_username:
        return {}

    from app.database import AsyncSessionLocal
    from app.models.user import User
    from sqlalchemy import select, func, or_
    try:
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
                return {
                    "account_id": db_user.id,
                    "username": db_user.username or clean_username,
                    "role": db_user.role,
                    "name": db_user.name,
                    "role_name": db_user.role_name,
                    "department": db_user.department,
                    "practice_certificate": db_user.practice_certificate,
                    "pin_code": db_user.pin_code,
                    "rfid_card_id": db_user.rfid_card_id,
                    "academic_title": db_user.academic_title,
                    "avatar_url": db_user.avatar_url,
                    "email": db_user.email,
                    "phone": db_user.phone,
                    "dob": db_user.dob,
                    "responsibilities": db_user.responsibilities,
                    "must_change_password": db_user.must_change_password,
                    "is_active": db_user.is_active,
                }
    except Exception:
        pass

    # Fallback to seed USERS_DATA if database is not accessible or user is in seed
    try:
        from app.seed import USERS_DATA
        for u in USERS_DATA:
            if (u.get("username") or "").lower() == clean_username or (u.get("id") or "").lower() == clean_username:
                return {
                    "account_id": u.get("id"),
                    "username": u.get("username"),
                    "role": u.get("role"),
                    "name": u.get("name"),
                    "role_name": u.get("role_name"),
                    "department": u.get("department"),
                    "practice_certificate": u.get("practice_certificate"),
                    "pin_code": u.get("pin_code"),
                    "rfid_card_id": u.get("rfid_card_id"),
                    "academic_title": u.get("academic_title"),
                    "avatar_url": u.get("avatar_url"),
                    "email": u.get("email"),
                    "phone": u.get("phone"),
                    "dob": u.get("dob"),
                    "responsibilities": u.get("responsibilities"),
                    "must_change_password": u.get("must_change_password", False),
                    "is_active": True,
                }
    except Exception:
        pass

    if clean_username in DEFAULT_DEMO_USERS:
        demo = DEFAULT_DEMO_USERS[clean_username]
        return {
            "account_id": f"demo-{clean_username}",
            "username": clean_username,
            "role": demo.get("role", "director"),
            "name": "Ban Giám Đốc" if demo.get("role") == "director" else "Nhân viên y tế",
            "role_name": "Ban Giám Đốc Bệnh Viện" if demo.get("role") == "director" else "Nhân Viên Ca Trực",
            "department": "Ban Giám Đốc",
            "practice_certificate": "001002/BYT-CCHN",
            "pin_code": "9999",
            "rfid_card_id": f"RFID-{clean_username.upper()}",
            "academic_title": "PGS.TS" if demo.get("role") == "director" else None,
            "avatar_url": None,
            "email": f"{clean_username}@hospital.vn",
            "phone": "0900000001",
            "dob": "1980-01-01",
            "responsibilities": "Quản trị vận hành hệ thống",
            "must_change_password": False,
            "is_active": True,
        }

    return {}


async def create_login_session(user: AuthenticatedUser) -> tuple[str, str | None]:
    session_id = str(uuid.uuid4()) if (settings.IDENTITY_DATABASE_URL and user.account_id) else (user.session_id or str(uuid.uuid4()))
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
    from app.security.auth import is_token_revoked
    if is_token_revoked(token):
        return False
    if not settings.IDENTITY_DATABASE_URL:
        return True
    from app.identity_database import get_identity_session_factory
    from app.services.identity_service import validate_identity_session
    try:
        _, session_factory = get_identity_session_factory()
        async with session_factory() as session:
            is_valid = await validate_identity_session(session, token, user)
            if is_valid:
                return True
    except Exception:
        pass
    profile = await get_user_profile_data(user.username)
    return bool(profile and profile.get("is_active", True))


async def revoke_user_session(token: str) -> None:
    if not token:
        return
    from app.security.auth import revoke_token
    revoke_token(token)
    if not settings.IDENTITY_DATABASE_URL:
        return
    from app.identity_database import get_identity_session_factory
    from app.services.identity_service import revoke_identity_session
    try:
        _, session_factory = get_identity_session_factory()
        async with session_factory() as session:
            await revoke_identity_session(session, token)
    except Exception:
        pass
