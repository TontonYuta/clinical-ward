import os
from pydantic import BaseModel

class Settings(BaseModel):
    APP_NAME: str = "Hệ Thống Quản Lý Kho Dược, Vật Tư & Thiết Bị Y Tế Lâm Sàng"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "bme_pharmacy_audit_secret_key_2026")
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./clinical_hospital.db")
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

settings = Settings()
