from datetime import datetime
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, Index, func, text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class IdentityBase(DeclarativeBase):
    pass


class StaffProfile(IdentityBase):
    __tablename__ = "staff_profiles"

    id: Mapped[str] = mapped_column(String(96), primary_key=True)
    employee_number: Mapped[str | None] = mapped_column(String(96), unique=True)
    full_name: Mapped[str] = mapped_column(String(160), nullable=False)
    department: Mapped[str] = mapped_column(String(160), nullable=False)
    job_title: Mapped[str] = mapped_column(String(128), nullable=False)
    practice_certificate: Mapped[str | None] = mapped_column(String(128))
    employment_status: Mapped[str] = mapped_column(String(24), nullable=False, default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class StaffAccount(IdentityBase):
    __tablename__ = "staff_accounts"
    __table_args__ = (
        UniqueConstraint("username", name="uq_staff_accounts_username"),
        Index("uq_staff_accounts_username_ci", text("lower(username)"), unique=True),
    )

    id: Mapped[str] = mapped_column(String(96), primary_key=True)
    staff_id: Mapped[str] = mapped_column(ForeignKey("staff_profiles.id", ondelete="RESTRICT"), nullable=False, unique=True)
    username: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(512), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    failed_login_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    password_changed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class StaffRoleGrant(IdentityBase):
    __tablename__ = "staff_role_grants"
    __table_args__ = (UniqueConstraint("account_id", "role", name="uq_staff_role_grant"),)

    id: Mapped[str] = mapped_column(String(96), primary_key=True)
    account_id: Mapped[str] = mapped_column(ForeignKey("staff_accounts.id", ondelete="CASCADE"), nullable=False, index=True)
    role: Mapped[str] = mapped_column(String(64), nullable=False)
    granted_by: Mapped[str | None] = mapped_column(String(96))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class IdentitySession(IdentityBase):
    __tablename__ = "identity_sessions"

    id: Mapped[str] = mapped_column(String(96), primary_key=True)
    account_id: Mapped[str] = mapped_column(ForeignKey("staff_accounts.id", ondelete="CASCADE"), nullable=False, index=True)
    token_digest: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class ProviderApiKey(IdentityBase):
    __tablename__ = "provider_api_keys"

    key_id: Mapped[str] = mapped_column(String(96), primary_key=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    provider: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    encrypted_key: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(48), nullable=False, default="active")
    quota_status: Mapped[str] = mapped_column(String(256), nullable=False, default="Unknown")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    tokens_used_today: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    requests_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    error_429_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    latency_ms: Mapped[int | None] = mapped_column(Integer)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_by: Mapped[str | None] = mapped_column(ForeignKey("staff_accounts.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
