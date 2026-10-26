from datetime import datetime
from sqlalchemy import String, Integer, Boolean, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base

class InventoryBatch(Base):
    __tablename__ = "inventory_batches"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    item_name: Mapped[str] = mapped_column(String, nullable=False, index=True)
    batch_number: Mapped[str] = mapped_column(String, nullable=False, index=True)
    national_code: Mapped[str | None] = mapped_column(String, nullable=True, default="", index=True)
    registration_number: Mapped[str | None] = mapped_column(String, nullable=True, default="")
    active_ingredient: Mapped[str | None] = mapped_column(String, nullable=True, default="")
    concentration: Mapped[str | None] = mapped_column(String, nullable=True, default="")
    dosage_form: Mapped[str | None] = mapped_column(String, nullable=True, default="")
    manufacturer: Mapped[str | None] = mapped_column(String, nullable=True, default="")
    country: Mapped[str | None] = mapped_column(String, nullable=True, default="Việt Nam")
    packaging_spec: Mapped[str | None] = mapped_column(String, nullable=True, default="")
    standard_pharmacopeia: Mapped[str | None] = mapped_column(String, nullable=True, default="DĐVN V")
    route: Mapped[str | None] = mapped_column(String, nullable=True, default="")
    category: Mapped[str] = mapped_column(String, nullable=False)
    expiry_date: Mapped[str] = mapped_column(String, nullable=False, index=True) # YYYY-MM-DD
    days_left: Mapped[int] = mapped_column(Integer, nullable=False)
    current_stock: Mapped[int] = mapped_column(Integer, nullable=False)
    min_threshold: Mapped[int] = mapped_column(Integer, nullable=False)
    max_threshold: Mapped[int] = mapped_column(Integer, nullable=False)
    unit: Mapped[str] = mapped_column(String, nullable=False)
    warehouse_location: Mapped[str] = mapped_column(String, nullable=False)
    is_near_expiry: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    is_low_stock: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    is_quarantined: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
