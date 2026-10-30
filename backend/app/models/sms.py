from datetime import datetime
from sqlalchemy import String, Integer, DateTime, Text, func
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base

class SmsDeliveryLog(Base):
    __tablename__ = "sms_delivery_logs"

    id: Mapped[str] = mapped_column(String, primary_key=True)  # SMS-2026-xxxx
    patient_id: Mapped[str] = mapped_column(String, nullable=False, index=True)  # BN-8817
    patient_name: Mapped[str] = mapped_column(String, nullable=False)
    recipient_phone: Mapped[str] = mapped_column(String, nullable=False, index=True)
    message_type: Mapped[str] = mapped_column(String, default="cpoe_prescription")
    content: Mapped[str] = mapped_column(Text, nullable=False)
    characters_count: Mapped[int] = mapped_column(Integer, default=0)
    sms_segments: Mapped[int] = mapped_column(Integer, default=1)
    provider: Mapped[str] = mapped_column(String, default="sandbox")  # sandbox, esms, speedsms, twilio
    status: Mapped[str] = mapped_column(String, default="delivered")  # queued, sent, delivered, failed
    reference_id: Mapped[str] = mapped_column(String, nullable=True)  # RX-2026-xxx
    delivery_receipt: Mapped[str] = mapped_column(String, nullable=True)  # DLR-xxxx
    error_detail: Mapped[str] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
