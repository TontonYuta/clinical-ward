from sqlalchemy import String, Boolean, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    role: Mapped[str] = mapped_column(String, nullable=False, index=True) # nurse, biomedical_engineer, pharmacist, doctor, director
    name: Mapped[str] = mapped_column(String, nullable=False)
    role_name: Mapped[str] = mapped_column(String, nullable=False)
    department: Mapped[str] = mapped_column(String, nullable=False)
    practice_certificate: Mapped[str] = mapped_column(String, nullable=False)
    pin_code: Mapped[str] = mapped_column(String, nullable=False)
    rfid_card_id: Mapped[str] = mapped_column(String, nullable=False)
    responsibilities: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())
