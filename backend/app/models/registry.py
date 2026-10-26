from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, func, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base

class DavNationalDrug(Base):
    __tablename__ = "dav_national_drugs"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    national_code: Mapped[str] = mapped_column(String, nullable=False, index=True)
    brand_name: Mapped[str] = mapped_column(String, nullable=False, index=True)
    active_ingredient: Mapped[str] = mapped_column(String, nullable=False, index=True)
    concentration: Mapped[str] = mapped_column(String, default="")
    dosage_form: Mapped[str] = mapped_column(String, default="")
    route: Mapped[str] = mapped_column(String, default="")
    standard_unit: Mapped[str] = mapped_column(String, default="Viên")
    group: Mapped[str] = mapped_column(String, nullable=False, index=True)
    is_controlled: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    is_high_alert: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    is_crash_cart: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    note: Mapped[str] = mapped_column(Text, default="")
    packaging_spec: Mapped[str | None] = mapped_column(String, nullable=True, default="")
    standard_pharmacopeia: Mapped[str | None] = mapped_column(String, nullable=True, default="NSX")
    shelf_life: Mapped[str | None] = mapped_column(String, nullable=True, default="36 tháng")
    manufacturer: Mapped[str | None] = mapped_column(Text, nullable=True, default="")
    country: Mapped[str | None] = mapped_column(String, nullable=True, default="Việt Nam")
    applicant_name: Mapped[str | None] = mapped_column(Text, nullable=True, default="")
    approval_decision: Mapped[str | None] = mapped_column(String, nullable=True, default="")
    created_at: Mapped[datetime | None] = mapped_column(DateTime, server_default=func.now(), nullable=True)
