from datetime import datetime
from sqlalchemy import String, Integer, Boolean, DateTime, func, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base

class DebtRecord(Base):
    __tablename__ = "debt_records"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    code: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    item_name: Mapped[str] = mapped_column(String, nullable=False)
    item_type: Mapped[str] = mapped_column(String, nullable=False, index=True) # Thuốc gây nghiện, Thuốc cấp cứu, Vật tư tiêu hao
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    patient_name: Mapped[str] = mapped_column(String, nullable=False)
    patient_room: Mapped[str] = mapped_column(String, nullable=False)
    borrow_time: Mapped[str] = mapped_column(String, nullable=False)
    borrower: Mapped[str] = mapped_column(String, nullable=False)
    clinical_reason: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String, default="debt", index=True) # debt, settled
    ampoule_returned: Mapped[bool] = mapped_column(Boolean, default=False)
    ampoule_destroyed: Mapped[bool] = mapped_column(Boolean, default=False)
    settled_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    settler: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
