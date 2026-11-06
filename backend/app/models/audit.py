from datetime import datetime
from sqlalchemy import String, Integer, DateTime, func, JSON
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base

class AuditRecord(Base):
    __tablename__ = "audit_records"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    timestamp: Mapped[str] = mapped_column(String, nullable=False)
    action_type: Mapped[str] = mapped_column(String, nullable=False, index=True)
    action_title: Mapped[str] = mapped_column(String, nullable=False)
    target_item: Mapped[str] = mapped_column(String, nullable=False)
    legal_basis: Mapped[str] = mapped_column(String, nullable=False)
    signer_name: Mapped[str] = mapped_column(String, nullable=False)
    signer_certificate: Mapped[str] = mapped_column(String, nullable=False)
    witness_name: Mapped[str | None] = mapped_column(String, nullable=True)
    witness_certificate: Mapped[str | None] = mapped_column(String, nullable=True)
    auth_method: Mapped[str] = mapped_column(String, default="PIN") # PIN, RFID_NFC
    integrity_hash: Mapped[str] = mapped_column(String, nullable=False)
    previous_hash: Mapped[str] = mapped_column(String, nullable=False)
    payload_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class AuditAppendLock(Base):
    """Mutable singleton used to serialize ledger append transactions in the DB."""
    __tablename__ = "audit_append_lock"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
