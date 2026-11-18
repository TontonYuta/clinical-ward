import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.models.identity import IdentityBase, StaffAccount, StaffProfile, StaffRoleGrant
from app.services.identity_bootstrap import create_staff_account


@pytest.mark.asyncio
async def test_bootstrap_creates_explicit_profile_account_and_admin_role():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as connection:
        await connection.run_sync(IdentityBase.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        result = await create_staff_account(
            session, employee_number="EMP-7", full_name="Nguyễn A", department="Dược",
            job_title="Dược sĩ", username="admin.user", password="a-secure-long-password",
            role="director",
        )
        assert result.username == "admin.user"
        assert result.role == "director"
        assert await session.get(StaffProfile, result.staff_id)
        assert await session.get(StaffAccount, result.account_id)
        assert await session.scalar(__import__("sqlalchemy").select(StaffRoleGrant).where(StaffRoleGrant.account_id == result.account_id))
        assert "a-secure-long-password" not in result.password_hash
    await engine.dispose()


@pytest.mark.asyncio
async def test_bootstrap_rejects_weak_password_invalid_role_and_duplicate_username():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as connection:
        await connection.run_sync(IdentityBase.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        base = dict(employee_number=None, full_name="Nguyễn A", department="Dược", job_title="Dược sĩ", username="admin.user")
        with pytest.raises(ValueError, match="password"):
            await create_staff_account(session, **base, password="weak", role="director")
        with pytest.raises(ValueError, match="role"):
            await create_staff_account(session, **base, password="a-secure-long-password", role="root")
        await create_staff_account(session, **base, password="a-secure-long-password", role="director")
        with pytest.raises(ValueError, match="username"):
            await create_staff_account(session, **base, password="another-secure-password", role="director")
    await engine.dispose()
