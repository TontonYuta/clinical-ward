from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, Integer, Float, Text, func
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base

class BhytDrugCatalog(Base):
    __tablename__ = "bhyt_drug_catalog"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    stt_thong_tu_20: Mapped[int | None] = mapped_column(Integer, nullable=True, default=None)
    atc_code: Mapped[str] = mapped_column(String, nullable=False, index=True)
    active_ingredient: Mapped[str] = mapped_column(String, nullable=False, index=True)
    active_ingredient_normalized: Mapped[str] = mapped_column(String, nullable=False, index=True)
    brand_names_json: Mapped[str] = mapped_column(Text, default="[]")
    route: Mapped[str] = mapped_column(String, default="Uống")
    allowed_ranks_json: Mapped[str] = mapped_column(Text, nullable=False)
    payment_ratio: Mapped[float] = mapped_column(Float, default=1.0)
    requires_consultation: Mapped[bool] = mapped_column(Boolean, default=False)
    max_outpatient_days: Mapped[int] = mapped_column(Integer, default=30)
    allowed_icd10_json: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)
    forbidden_icd10_json: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)
    special_conditions: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)
    pdf_page: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime | None] = mapped_column(DateTime, server_default=func.now(), nullable=True)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=True)

class BhytAuditLog(Base):
    __tablename__ = "bhyt_audit_logs"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    prescription_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    patient_name: Mapped[str] = mapped_column(String, default="")
    insurance_card_number: Mapped[str] = mapped_column(String, default="")
    hospital_rank: Mapped[str] = mapped_column(String, default="HANG_I")
    treatment_type: Mapped[str] = mapped_column(String, default="NGOAI_TRU")
    primary_icd10: Mapped[str] = mapped_column(String, default="")
    status: Mapped[str] = mapped_column(String, default="PASS", index=True)
    total_cost_vnd: Mapped[float] = mapped_column(Float, default=0.0)
    at_risk_cost_vnd: Mapped[float] = mapped_column(Float, default=0.0)
    violations_count: Mapped[int] = mapped_column(Integer, default=0)
    violations_json: Mapped[str] = mapped_column(Text, default="[]")
    created_at: Mapped[datetime | None] = mapped_column(DateTime, server_default=func.now(), nullable=True)
