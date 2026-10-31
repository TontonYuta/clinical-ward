import os
import secrets
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

_BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
_DEFAULT_DB_PATH = os.path.join(_BACKEND_DIR, "clinical_hospital.db")

class Settings(BaseModel):
    APP_NAME: str = "Hệ Thống Quản Lý Kho Dược, Vật Tư & Thiết Bị Y Tế Lâm Sàng"
    API_V1_STR: str = "/api/v1"
    # Preserve the stable local-development key for existing local HMAC ledgers.
    # Production must provide a high-entropy SECRET_KEY via the deployment env.
    SECRET_KEY: str = os.getenv("SECRET_KEY", "bme_pharmacy_audit_secret_key_2026")
    APP_ENV: str = os.getenv("APP_ENV", "development")
    DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite+aiosqlite:///{_DEFAULT_DB_PATH}")
    GEMINI_API_KEY: str | None = os.getenv("GEMINI_API_KEY") or os.getenv("VITE_GEMINI_API_KEY")
    CORS_ORIGINS: list[str] = [
        origin.strip() for origin in os.getenv(
            "CORS_ORIGINS",
            "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173",
        ).split(",") if origin.strip()
    ]
    # Required to mutate the clinical DDI catalog. Keep unset in deployments
    # where catalog updates are not enabled.
    DDI_ADMIN_TOKEN: str = os.getenv("DDI_ADMIN_TOKEN", "")
    DAV_CATALOG_DB_PATH: str = os.getenv("DAV_CATALOG_DB_PATH", "")
    DAV_CATALOG_RUN_ID: str = os.getenv("DAV_CATALOG_RUN_ID", "dav-canonical-20261030-v12")

settings = Settings()
if settings.APP_ENV.strip().lower() in {"production", "prod"} and (
    not os.getenv("SECRET_KEY") or len(settings.SECRET_KEY) < 32
):
    raise RuntimeError("Production requires SECRET_KEY with at least 32 characters.")
