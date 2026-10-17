from datetime import datetime
from sqlalchemy import String, Integer, Boolean, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base

class AssetRecord(Base):
    __tablename__ = "asset_records"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    code: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    device_name: Mapped[str] = mapped_column(String, nullable=False)
    model: Mapped[str] = mapped_column(String, nullable=False)
    serial_number: Mapped[str] = mapped_column(String, nullable=False, index=True)
    risk_class: Mapped[str] = mapped_column(String, nullable=False)
    registered_department: Mapped[str] = mapped_column(String, nullable=False)
    actual_department: Mapped[str] = mapped_column(String, nullable=False)
    is_misallocated: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    depreciation_rate_percent: Mapped[int] = mapped_column(Integer, nullable=False)
    operating_years: Mapped[int] = mapped_column(Integer, nullable=False)
    pending_liquidation: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    last_scanned_at: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
