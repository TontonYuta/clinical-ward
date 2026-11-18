import pytest
from datetime import datetime, timedelta, timezone
from app.models.identity import IdentitySession
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.models.identity import IdentityBase, StaffAccount, StaffProfile, StaffRoleGrant
from app.security.auth import hash_password_argon2
from app.services.identity_service import (
    authenticate_staff, create_identity_session, revoke_identity_session, rotate_identity_session, validate_identity_session,
)
from app.security.auth import issue_token, verify_token


@pytest.mark.asyncio
async def test_identity_auth_requires_active_profile_role_and_argon2_password():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(IdentityBase.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        session.add(StaffProfile(id="staff-1", full_name="A", department="D", job_title="Nurse"))
        session.add(StaffAccount(id="account-1", staff_id="staff-1", username="nurse.one", password_hash=hash_password_argon2("correct")))
        session.add(StaffRoleGrant(id="grant-1", account_id="account-1", role="nurse"))
        await session.commit()
        assert (await authenticate_staff(session, "nurse.one", "wrong")) is None
        user = await authenticate_staff(session, "nurse.one", "correct")
        assert user is not None and user.username == "nurse.one" and user.role == "nurse"
    await engine.dispose()


@pytest.mark.asyncio
async def test_identity_auth_rejects_inactive_profile_and_missing_role():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(IdentityBase.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        session.add(StaffProfile(id="staff-2", full_name="B", department="D", job_title="Nurse", employment_status="inactive"))
        session.add(StaffAccount(id="account-2", staff_id="staff-2", username="nurse.two", password_hash=hash_password_argon2("correct")))
        await session.commit()
        assert await authenticate_staff(session, "nurse.two", "correct") is None
    await engine.dispose()


@pytest.mark.asyncio
async def test_identity_session_is_persisted_revocable_and_role_bound():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(IdentityBase.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        session.add(StaffProfile(id="staff-3", full_name="C", department="D", job_title="Director"))
        session.add(StaffAccount(id="account-3", staff_id="staff-3", username="director.one", password_hash=hash_password_argon2("correct")))
        session.add(StaffRoleGrant(id="grant-3", account_id="account-3", role="director"))
        await session.commit()
        user = await authenticate_staff(session, "director.one", "correct")
        assert user is not None and user.account_id == "account-3"
        token = issue_token(user.username, user.role, "s" * 32, session_id="session-3")
        await create_identity_session(session, user.account_id, token, datetime.now(timezone.utc) + timedelta(minutes=10), session_id="session-3")
        session_user = verify_token(token, "s" * 32)
        assert await validate_identity_session(session, token, session_user)
        replacement = issue_token(user.username, user.role, "s" * 32, session_id="session-3")
        assert await rotate_identity_session(session, token, replacement)
        assert not await validate_identity_session(session, token, session_user)
        session_user = verify_token(replacement, "s" * 32)
        assert await validate_identity_session(session, replacement, session_user)
        token = replacement
        assert not await validate_identity_session(session, token, user.__class__(user.username, "nurse", user.account_id, "session-3"))
        assert not await validate_identity_session(session, token, user.__class__(user.username, user.role, user.account_id, "different-session"))
        assert await revoke_identity_session(session, token)
        assert not await validate_identity_session(session, token, session_user)
    await engine.dispose()


@pytest.mark.asyncio
async def test_repeated_bad_password_locks_account_until_configured_time():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(IdentityBase.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        session.add(StaffProfile(id="staff-4", full_name="D", department="D", job_title="Doctor"))
        account = StaffAccount(id="account-4", staff_id="staff-4", username="doctor.one", password_hash=hash_password_argon2("correct"))
        session.add(account)
        session.add(StaffRoleGrant(id="grant-4", account_id="account-4", role="doctor"))
        await session.commit()
        for _ in range(5):
            assert await authenticate_staff(session, "doctor.one", "wrong") is None
        assert account.locked_until is not None
        assert await authenticate_staff(session, "doctor.one", "correct") is None
    await engine.dispose()
