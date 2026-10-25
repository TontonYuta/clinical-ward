import os
from pydantic import BaseModel

# Automatically discover and load .env.local if present
for cand in [".env.local", "../.env.local", "../../.env.local"]:
    cand_path = os.path.abspath(os.path.join(os.path.dirname(__file__), cand))
    if os.path.exists(cand_path):
        with open(cand_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip().strip("'\""))
        break

class Settings(BaseModel):
    APP_NAME: str = "Hệ Thống Quản Lý Kho Dược, Vật Tư & Thiết Bị Y Tế Lâm Sàng"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "bme_pharmacy_audit_secret_key_2026")
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./clinical_hospital.db")
    GEMINI_API_KEY: str | None = os.getenv("GEMINI_API_KEY") or os.getenv("VITE_GEMINI_API_KEY")
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
    ]

settings = Settings()
