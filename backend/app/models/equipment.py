from datetime import datetime
from sqlalchemy import String, DateTime, func, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base

class EquipmentTicket(Base):
    __tablename__ = "equipment_tickets"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    code: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    device_name: Mapped[str] = mapped_column(String, nullable=False)
    device_model: Mapped[str] = mapped_column(String, nullable=False)
    serial_number: Mapped[str] = mapped_column(String, nullable=False, index=True)
    risk_class: Mapped[str] = mapped_column(String, nullable=False) # A, B, C, D
    location: Mapped[str] = mapped_column(String, nullable=False)
    accessory_issue: Mapped[str] = mapped_column(Text, nullable=False)
    urgency: Mapped[str] = mapped_column(String, default="urgent", index=True) # urgent, routine
    status: Mapped[str] = mapped_column(String, default="reported", index=True) # reported, in_repair, resolved
    assigned_engineer: Mapped[str] = mapped_column(String, nullable=False)
    next_inspection_due: Mapped[str] = mapped_column(String, nullable=False)
    inspection_unit: Mapped[str] = mapped_column(String, nullable=False)
    legal_basis: Mapped[str] = mapped_column(String, nullable=False)
    action_log: Mapped[list[str]] = mapped_column(JSON, default=list)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    handover_engineer: Mapped[str | None] = mapped_column(String, nullable=True)
    handover_receiver: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
