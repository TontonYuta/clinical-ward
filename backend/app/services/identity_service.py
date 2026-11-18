"""Identity database operations used by staff authentication."""
from datetime import datetime, timezone
import hashlib

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.identity import StaffAccount, StaffProfile, StaffRoleGrant
from app.security.auth import AuthenticatedUser, verify_password
from app.config import settings
from app.models.identity import ProviderApiKey
from app.security.secret_encryption import encrypt_secret, decrypt_secret
import uuid
import time


def _masked_provider_key(key: str) -> str:
    cleaned = (key or "").strip()
    return cleaned[:8] + "..." + cleaned[-4:] if len(cleaned) > 10 else ("AIzaSy..." + cleaned[-4:] if len(cleaned) >= 4 else "****")


async def list_provider_keys(session: AsyncSession) -> list[dict]:
    rows = (await session.scalars(select(ProviderApiKey).order_by(ProviderApiKey.created_at))).all()
    result = []
    for row in rows:
        raw_key = decrypt_secret(row.encrypted_key, settings.KEY_ENCRYPTION_KEY)
        result.append({
            "key_id": row.key_id, "name": row.name, "masked_key": _masked_provider_key(raw_key),
            "provider": row.provider, "status": row.status, "quota_status": row.quota_status,
            "is_active": row.is_active, "created_at": row.created_at.timestamp() if row.created_at else time.time(),
            "tokens_used_today": row.tokens_used_today, "requests_count": row.requests_count,
            "error_429_count": row.error_429_count, "latency_ms": row.latency_ms, "last_used_at": row.last_used_at,
        })
    return result


async def add_provider_key(session: AsyncSession, name: str, raw_key: str, provider: str) -> dict:
    key_id = f"key-{int(time.time())}-{uuid.uuid4().hex[:4]}"
    row = ProviderApiKey(
        key_id=key_id, name=name, provider=provider,
        encrypted_key=encrypt_secret(raw_key.strip(), settings.KEY_ENCRYPTION_KEY),
        status="active", quota_status="15 RPM / Normal", is_active=True,
        tokens_used_today=0, requests_count=0, error_429_count=0,
    )
    session.add(row)
    await session.commit()
    return {
        "key_id": key_id, "name": name, "masked_key": _masked_provider_key(raw_key),
        "provider": provider, "status": row.status, "quota_status": row.quota_status,
        "is_active": True, "created_at": time.time(), "tokens_used_today": 0,
        "requests_count": 0, "error_429_count": 0, "latency_ms": None, "last_used_at": None,
    }


async def delete_provider_key(session: AsyncSession, key_id: str) -> bool:
    row = await session.get(ProviderApiKey, key_id)
    if row is None:
        return False
    await session.delete(row)
    await session.commit()
    return True


async def get_active_provider_key(session: AsyncSession, provider: str = "gemini") -> str | None:
    rows = (await session.scalars(select(ProviderApiKey).where(
        ProviderApiKey.provider == provider, ProviderApiKey.is_active.is_(True), ProviderApiKey.status == "active"
    ).order_by(ProviderApiKey.created_at))).all()
    for row in rows:
        raw = decrypt_secret(row.encrypted_key, settings.KEY_ENCRYPTION_KEY)
        if len(raw.strip()) >= 10:
            return raw.strip()
    return None


async def authenticate_staff(session: AsyncSession, username: str, password: str) -> AuthenticatedUser | None:
    """Authenticate an active staff account and return its effective role.

    The account must have an active profile and at least one active role grant.
    No seeded clinical user, PIN or RFID value participates in this flow.
    """
    normalized = (username or "").strip()
    if not normalized or not password:
        return None
    result = await session.execute(
        select(StaffAccount, StaffProfile)
        .join(StaffProfile, StaffProfile.id == StaffAccount.staff_id)
        .where(func.lower(StaffAccount.username) == normalized.lower())
    )
    row = result.first()
    if row is None:
        return None
    account, profile = row
    now = datetime.now(timezone.utc)
    locked_until = account.locked_until
    if not account.is_active or profile.employment_status != "active":
        return None
    if locked_until is not None and locked_until.replace(tzinfo=timezone.utc) > now:
        return None
    if not verify_password(password, account.password_hash):
        account.failed_login_count += 1
        if account.failed_login_count >= max(1, settings.AUTH_MAX_FAILED_ATTEMPTS):
            from datetime import timedelta
            account.locked_until = now + timedelta(seconds=max(1, settings.AUTH_LOCKOUT_SECONDS))
            account.failed_login_count = 0
        await session.commit()
        return None
    grants = await session.scalars(
        select(StaffRoleGrant.role).where(StaffRoleGrant.account_id == account.id)
    )
    roles = {str(role) for role in grants if str(role).strip()}
    supported_roles = roles & {"nurse", "doctor", "pharmacist", "biomedical_engineer", "director"}
    if not supported_roles:
        return None
    role = "director" if "director" in supported_roles else sorted(supported_roles)[0]
    account.failed_login_count = 0
    account.last_login_at = now
    await session.commit()
    return AuthenticatedUser(username=account.username, role=role, account_id=account.id)


async def create_identity_session(session: AsyncSession, account_id: str, token: str, expires_at: datetime, session_id: str) -> str:
    from app.models.identity import IdentitySession
    session.add(IdentitySession(
        id=session_id, account_id=account_id,
        token_digest=hashlib.sha256(token.encode("utf-8")).hexdigest(),
        expires_at=expires_at,
    ))
    await session.commit()
    return session_id


async def validate_identity_session(session: AsyncSession, token: str, user: AuthenticatedUser) -> bool:
    from app.models.identity import IdentitySession, StaffAccount, StaffProfile, StaffRoleGrant
    digest = hashlib.sha256(token.encode("utf-8")).hexdigest()
    result = await session.execute(
        select(IdentitySession, StaffAccount, StaffProfile)
        .join(StaffAccount, StaffAccount.id == IdentitySession.account_id)
        .join(StaffProfile, StaffProfile.id == StaffAccount.staff_id)
        .where(IdentitySession.token_digest == digest)
    )
    row = result.first()
    if row is None:
        return False
    identity_session, account, profile = row
    now = datetime.now(timezone.utc)
    expires_at = identity_session.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if identity_session.id != user.session_id or identity_session.revoked_at is not None or expires_at <= now:
        return False
    if not account.is_active or profile.employment_status != "active" or account.username != user.username:
        return False
    role_exists = await session.scalar(select(StaffRoleGrant.id).where(StaffRoleGrant.account_id == account.id, StaffRoleGrant.role == user.role))
    return role_exists is not None


async def revoke_identity_session(session: AsyncSession, token: str) -> bool:
    from app.models.identity import IdentitySession
    digest = hashlib.sha256(token.encode("utf-8")).hexdigest()
    result = await session.scalar(select(IdentitySession).where(IdentitySession.token_digest == digest))
    if result is None:
        return False
    if result.revoked_at is None:
        result.revoked_at = datetime.now(timezone.utc)
        await session.commit()
    return True


async def rotate_identity_session(session: AsyncSession, old_token: str, new_token: str) -> bool:
    from app.models.identity import IdentitySession
    old_digest = hashlib.sha256(old_token.encode("utf-8")).hexdigest()
    row = await session.scalar(select(IdentitySession).where(IdentitySession.token_digest == old_digest))
    if row is None or row.revoked_at is not None:
        return False
    row.token_digest = hashlib.sha256(new_token.encode("utf-8")).hexdigest()
    from datetime import timedelta
    row.expires_at = datetime.now(timezone.utc) + timedelta(seconds=settings.AUTH_TOKEN_TTL_SECONDS)
    await session.commit()
    return True
