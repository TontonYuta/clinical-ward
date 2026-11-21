from datetime import datetime
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
    email: Mapped[str | None] = mapped_column(String, nullable=True)
    phone: Mapped[str | None] = mapped_column(String, nullable=True)
    dob: Mapped[str | None] = mapped_column(String, nullable=True) # Ngày sinh (YYYY-MM-DD hoặc DD/MM/YYYY)
    academic_title: Mapped[str | None] = mapped_column(String, nullable=True) # Học hàm / Học vị: BSCKI, BSCKII, ThS, TS, PGS, GS...
    username: Mapped[str | None] = mapped_column(String(100), unique=True, index=True, nullable=True) # Tên đăng nhập Web
    hashed_password: Mapped[str | None] = mapped_column(String(255), nullable=True) # Mật khẩu mã hóa Argon2id / PBKDF2
    must_change_password: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False) # Bắt buộc đổi MK ở lần đăng nhập đầu
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime | None] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=True)
