from datetime import datetime
from sqlalchemy import String, Integer, Float, DateTime, Text, func
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base

class PatientProfile(Base):
    __tablename__ = "patient_profiles"

    id: Mapped[str] = mapped_column(String, primary_key=True)  # BN-8820
    full_name: Mapped[str] = mapped_column(String, nullable=False, index=True)
    dob: Mapped[str] = mapped_column(String, nullable=True)
    age: Mapped[int] = mapped_column(Integer, nullable=True)
    gender: Mapped[str] = mapped_column(String, default="Nam")
    cccd: Mapped[str] = mapped_column(String, nullable=True)
    phone: Mapped[str] = mapped_column(String, nullable=True)
    email: Mapped[str] = mapped_column(String, nullable=False, index=True)
    room: Mapped[str] = mapped_column(String, default="Khoa Khám Bệnh")
    allergies: Mapped[str] = mapped_column(String, default="Không ghi nhận dị ứng")
    chronic_conditions: Mapped[str] = mapped_column(String, default="")
    egfr: Mapped[float] = mapped_column(Float, default=90.0)
    creatinine: Mapped[float] = mapped_column(Float, default=80.0)
    weight_kg: Mapped[float] = mapped_column(Float, default=65.0)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

class PrescriptionAdviceRecord(Base):
    __tablename__ = "prescription_advice_records"

    id: Mapped[str] = mapped_column(String, primary_key=True)  # ADV-2026-xxxx
    prescription_id: Mapped[str] = mapped_column(String, nullable=True)
    patient_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    patient_name: Mapped[str] = mapped_column(String, nullable=False)
    patient_email: Mapped[str] = mapped_column(String, nullable=False)
    patient_phone: Mapped[str] = mapped_column(String, nullable=True)
    diagnosis: Mapped[str] = mapped_column(String, default="Điều trị ngoại trú")
    doctor_name: Mapped[str] = mapped_column(String, default="BS.CKII Trần Văn Hùng")
    doctor_hospital: Mapped[str] = mapped_column(String, default="Bệnh Viện Đa Khoa Lâm Sàng")
    department: Mapped[str] = mapped_column(String, default="Khoa Khám Bệnh")
    start_date: Mapped[str] = mapped_column(String, nullable=True)
    end_date: Mapped[str] = mapped_column(String, nullable=True)
    general_doctor_advice: Mapped[str] = mapped_column(Text, nullable=False)
    medications_json: Mapped[str] = mapped_column(Text, nullable=False)
    notification_status: Mapped[str] = mapped_column(String, default="idle")
    gas_webhook_url: Mapped[str] = mapped_column(String, nullable=True)
    email_sent_at: Mapped[str] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
