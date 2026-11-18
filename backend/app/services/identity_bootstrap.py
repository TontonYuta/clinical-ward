"""Explicit first-account provisioning; never creates default credentials."""
from dataclasses import dataclass
from datetime import datetime, timezone
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.identity import StaffAccount, StaffProfile, StaffRoleGrant
from app.security.auth import hash_password_argon2

ALLOWED_ROLES = {"nurse", "doctor", "pharmacist", "biomedical_engineer", "director"}


@dataclass(frozen=True)
class ProvisionedAccount:
    account_id: str
    staff_id: str
    username: str
    role: str
    password_hash: str


async def create_staff_account(
    session: AsyncSession, *, employee_number: str | None, full_name: str,
    department: str, job_title: str, username: str, password: str, role: str,
    practice_certificate: str | None = None,
) -> ProvisionedAccount:
    clean_username = (username or "").strip()
    if len(password or "") < 12:
        raise ValueError("password must contain at least 12 characters")
    if role not in ALLOWED_ROLES:
        raise ValueError("role is not supported")
    if not clean_username:
        raise ValueError("username is required")
    if not (full_name or "").strip() or not (department or "").strip() or not (job_title or "").strip():
        raise ValueError("staff profile fields are required")
    duplicate = await session.scalar(select(StaffAccount.id).where(StaffAccount.username.ilike(clean_username)))
    if duplicate:
        raise ValueError("username already exists")
    if employee_number:
        duplicate_employee = await session.scalar(select(StaffProfile.id).where(StaffProfile.employee_number == employee_number.strip()))
        if duplicate_employee:
            raise ValueError("employee number already exists")

    staff_id, account_id, grant_id = str(uuid.uuid4()), str(uuid.uuid4()), str(uuid.uuid4())
    password_hash = hash_password_argon2(password)
    profile = StaffProfile(
        id=staff_id, employee_number=(employee_number or "").strip() or None,
        full_name=full_name.strip(), department=department.strip(), job_title=job_title.strip(),
        practice_certificate=(practice_certificate or "").strip() or None, employment_status="active",
    )
    account = StaffAccount(
        id=account_id, staff_id=staff_id, username=clean_username, password_hash=password_hash,
        is_active=True, password_changed_at=datetime.now(timezone.utc),
    )
    grant = StaffRoleGrant(id=grant_id, account_id=account_id, role=role)
    session.add(profile)
    await session.flush()
    session.add(account)
    await session.flush()
    session.add(grant)
    await session.flush()
    await session.commit()
    return ProvisionedAccount(account_id, staff_id, clean_username, role, password_hash)
