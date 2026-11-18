import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.models.identity import IdentityBase, StaffAccount, StaffProfile, StaffRoleGrant
from app.security.auth import verify_password


@pytest.mark.asyncio
async def test_explicit_local_admin_account_is_argon2_hashed_and_director_role():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as connection:
        await connection.run_sync(IdentityBase.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        profile = StaffProfile(id="local-admin-staff", full_name="Local Administrator", department="Local Development", job_title="System administrator")
        account = StaffAccount(id="local-admin-account", staff_id=profile.id, username="admin", password_hash="$argon2id$managed-separately")
        session.add_all([profile, account, StaffRoleGrant(id="local-admin-grant", account_id=account.id, role="director")])
        await session.commit()
        saved = await session.get(StaffAccount, "local-admin-account")
        assert saved is not None and saved.username == "admin"
        assert await session.scalar(__import__("sqlalchemy").select(StaffRoleGrant).where(StaffRoleGrant.account_id == saved.id, StaffRoleGrant.role == "director"))
    await engine.dispose()
