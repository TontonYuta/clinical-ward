from datetime import datetime
from sqlalchemy import String, Integer, Boolean, DateTime, Text, func
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base

class CpoePrescription(Base):
    __tablename__ = "cpoe_prescriptions"

    id: Mapped[str] = mapped_column(String, primary_key=True) # RX-2026-xxxx
    prescription_type: Mapped[str] = mapped_column(String, nullable=False, index=True) # outpatient / inpatient_daily
    patient_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    patient_name: Mapped[str] = mapped_column(String, nullable=False)
    patient_cccd: Mapped[str] = mapped_column(String, nullable=False)
    patient_phone: Mapped[str] = mapped_column(String, nullable=True)
    patient_email: Mapped[str] = mapped_column(String, nullable=True)
    department: Mapped[str] = mapped_column(String, nullable=True)
    patient_dob: Mapped[str] = mapped_column(String, nullable=True)
    patient_gender: Mapped[str] = mapped_column(String, nullable=True)
    diagnosis_icd10: Mapped[str] = mapped_column(String, nullable=False, index=True)
    diagnosis_text: Mapped[str] = mapped_column(String, nullable=False)
    is_chronic_disease: Mapped[bool] = mapped_column(Boolean, default=False)
    days_prescribed: Mapped[int] = mapped_column(Integer, default=30)
    doctor_name: Mapped[str] = mapped_column(String, nullable=False)
    doctor_certificate: Mapped[str] = mapped_column(String, nullable=False)
    prescribed_at: Mapped[str] = mapped_column(String, nullable=False)
    digital_signature: Mapped[str] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, default="signed", index=True) # draft, signed, dispensed
    items_json: Mapped[str] = mapped_column(Text, nullable=False) # JSON array of items
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
