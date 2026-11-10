from contextlib import asynccontextmanager
import json
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware
from sqlalchemy import select
from app.config import settings
from app.security.http_headers import SecurityHeadersMiddleware
from app.security.auth import AuthenticationMiddleware, issue_token, verify_password
from fastapi import HTTPException, Request, Response
from pydantic import BaseModel, Field
from app.database import engine, Base, AsyncSessionLocal
from app.models.user import User
from app.models.cpoe import CpoePrescription
from app.seed import seed
from app.seed_registry import seed_dav_registry_if_needed
from app.routers import (
    debts,
    equipment,
    inventory,
    coldchain,
    assets,
    audit,
    copilot,
    cpoe,
    registry,
    prescription_advice,
    patients,
    sms,
    clinical_ddi,
    mcp,
    prescription_audit,
    bhyt,
    admin_monitoring,
    admin_integrations
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure tables exist
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        from sqlalchemy import inspect, text
        columns = await conn.run_sync(lambda sync_conn: {col["name"] for col in inspect(sync_conn).get_columns("cpoe_prescriptions")})
        cpoe_extra_cols = [
            ("patient_insurance_id", "VARCHAR"),
            ("patient_weight", "FLOAT"),
            ("patient_address", "VARCHAR"),
            ("guardian_name", "VARCHAR"),
            ("department", "VARCHAR"),
            ("patient_dob", "VARCHAR"),
            ("patient_gender", "VARCHAR"),
            ("patient_phone", "VARCHAR"),
            ("patient_email", "VARCHAR"),
            ("tt26_form_type", "VARCHAR"),
            ("receiver_cccd", "VARCHAR"),
            ("receiver_name", "VARCHAR"),
            ("treatment_batch_1", "VARCHAR"),
            ("treatment_batch_2", "VARCHAR"),
            ("treatment_batch_3", "VARCHAR"),
            ("facility_name", "VARCHAR"),
            ("facility_address", "VARCHAR"),
            ("facility_phone", "VARCHAR"),
        ]
        for col_name, col_type in cpoe_extra_cols:
            if col_name not in columns:
                await conn.execute(text(f"ALTER TABLE cpoe_prescriptions ADD COLUMN {col_name} {col_type}"))

        chat_log_cols = await conn.run_sync(lambda sync_conn: {col["name"] for col in inspect(sync_conn).get_columns("copilot_chat_logs")})
        copilot_extra_cols = [
            ("utility_score", "FLOAT DEFAULT 0.5"),
            ("is_useful", "BOOLEAN DEFAULT 1"),
            ("quality_category", "VARCHAR(64) DEFAULT 'high_value_clinical'"),
            ("grounded_source", "VARCHAR(256)"),
            ("prompt_tokens", "INTEGER DEFAULT 0"),
            ("completion_tokens", "INTEGER DEFAULT 0"),
            ("total_tokens", "INTEGER DEFAULT 0"),
            ("model_name", "VARCHAR(64) DEFAULT 'gemini-2.5-flash'"),
            ("provider", "VARCHAR(64) DEFAULT 'gemini'"),
            ("has_image", "BOOLEAN DEFAULT 0"),
            ("image_tokens", "INTEGER DEFAULT 0"),
            ("latency_ms", "FLOAT DEFAULT 85.0"),
        ]
        for col_name, col_type in copilot_extra_cols:
            if col_name not in chat_log_cols:
                await conn.execute(text(f"ALTER TABLE copilot_chat_logs ADD COLUMN {col_name} {col_type}"))

        sms_log_cols = await conn.run_sync(lambda sync_conn: {col["name"] for col in inspect(sync_conn).get_columns("sms_delivery_logs")})
        sms_extra_cols = [
            ("dispatch_mode", "VARCHAR(32) DEFAULT 'immediate'"),
            ("scheduled_at", "DATETIME"),
            ("timing_rule", "VARCHAR(256)"),
        ]
        for col_name, col_type in sms_extra_cols:
            if col_name not in sms_log_cols:
                await conn.execute(text(f"ALTER TABLE sms_delivery_logs ADD COLUMN {col_name} {col_type}"))

        monograph_cols = await conn.run_sync(lambda sync_conn: {col["name"] for col in inspect(sync_conn).get_columns("clinical_drug_monographs")})
        if "section_pages" not in monograph_cols:
            await conn.execute(text("ALTER TABLE clinical_drug_monographs ADD COLUMN section_pages TEXT"))

    # Check if DB has data, if not seed it automatically
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(User).limit(1))
        user = result.scalar_one_or_none()
        if not user:
            print("Database is empty. Automatically running seed...")
            await seed()

    # Seed 55k DAV drugs if table is empty
    seed_dav_registry_if_needed()

    # Seed BHYT drug catalog & therapeutic classes if table is empty
    try:
        from app.seed_bhyt_catalog import seed_bhyt_catalog_if_needed
        seed_bhyt_catalog_if_needed()
    except Exception as e:
        print(f"Warning: Không thể seed BHYT catalog: {e}")

    # Khởi tạo chỉ mục FTS5 tìm kiếm siêu tốc cho 55.000 thuốc DAV
    try:
        from app.services.registry_service import warm_up_registry_cache_and_fts
        warm_up_registry_cache_and_fts()
    except Exception as e:
        print(f"Warning: Không thể warm up FTS: {e}")

    # Khởi động trước bộ khớp Lexical Trie để triệt tiêu độ trễ cold-start cho Chatbot (<1ms)
    try:
        from app.services.chatbot.lexical_trie_matcher import get_drug_lexical_matcher
        get_drug_lexical_matcher()
    except Exception as e:
        print(f"Warning: Không thể warm up lexical matcher: {e}")

    # Khởi tạo bộ nhớ đệm lâm sàng đa tầng (Clinical LRU Cache - GPTCache pattern)
    try:
        from app.services.cache.clinical_cache import get_clinical_cache
        get_clinical_cache()
    except Exception as e:
        print(f"Warning: Không thể khởi tạo clinical cache: {e}")

    yield

app = FastAPI(
    title=settings.APP_NAME,
    description="Backend API quản lý kho dược, tủ trực cấp cứu, trang thiết bị y tế và chuỗi lạnh vắc xin theo đúng quy phạm pháp luật Y tế Việt Nam.",
    version="2.0.0",
    lifespan=lifespan
)

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(
    AuthenticationMiddleware,
    enabled=settings.AUTH_REQUIRED,
    secret_key=settings.SECRET_KEY,
    users_json=settings.AUTH_USERS_JSON,
    trusted_origins=settings.CORS_ORIGINS,
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-DDI-Admin-Token"],
)

# GZip Response Compression (Tiết kiệm 70-80% băng thông mạng cho payload lớn)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Register Domain Routers
# Tạm thời comment router TBYT & Sổ nợ vỏ theo yêu cầu người dùng
# app.include_router(debts.router, prefix=settings.API_V1_STR)
# app.include_router(equipment.router, prefix=settings.API_V1_STR)
app.include_router(inventory.router, prefix=settings.API_V1_STR)
app.include_router(coldchain.router, prefix=settings.API_V1_STR)
# app.include_router(assets.router, prefix=settings.API_V1_STR)
app.include_router(audit.router, prefix=settings.API_V1_STR)
app.include_router(copilot.router, prefix=settings.API_V1_STR)
app.include_router(cpoe.router, prefix=settings.API_V1_STR)
app.include_router(registry.router, prefix=settings.API_V1_STR)
app.include_router(prescription_advice.router, prefix=settings.API_V1_STR)
app.include_router(patients.router, prefix=settings.API_V1_STR)
app.include_router(sms.router, prefix=settings.API_V1_STR)
app.include_router(clinical_ddi.router, prefix=settings.API_V1_STR)
app.include_router(prescription_audit.router, prefix=settings.API_V1_STR)
app.include_router(bhyt.router, prefix=settings.API_V1_STR)
app.include_router(mcp.router, prefix=settings.API_V1_STR)
app.include_router(admin_monitoring.router, prefix=settings.API_V1_STR)
app.include_router(admin_integrations.router, prefix=settings.API_V1_STR)

class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=1, max_length=256)

@app.post(f"{settings.API_V1_STR}/auth/login")
async def login(payload: LoginRequest, request: Request, response: Response):
    if not settings.AUTH_REQUIRED:
        raise HTTPException(status_code=404, detail="Authentication is not enabled")
    origin = request.headers.get("origin")
    if origin and origin.rstrip("/") not in {item.rstrip("/") for item in settings.CORS_ORIGINS} | {str(request.base_url).rstrip("/")}:
        raise HTTPException(status_code=403, detail="Cross-origin request rejected")
    try:
        users = json.loads(settings.AUTH_USERS_JSON)
    except (ValueError, TypeError):
        users = {}
    user = users.get(payload.username) if isinstance(users, dict) else None
    encoded = user.get("password_hash", "") if isinstance(user, dict) else ""
    if not isinstance(user, dict) or not verify_password(payload.password, encoded):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    role = user.get("role")
    if role not in {"nurse", "doctor", "pharmacist", "biomedical_engineer", "director"}:
        raise HTTPException(status_code=403, detail="Account role is invalid")
    token = issue_token(payload.username, role, settings.SECRET_KEY, settings.AUTH_TOKEN_TTL_SECONDS)
    response.set_cookie(
        key="clinical_session", value=token, httponly=True, secure=settings.APP_ENV.lower() in {"production", "prod"},
        samesite="strict", max_age=settings.AUTH_TOKEN_TTL_SECONDS, path="/",
    )
    return {"username": payload.username, "role": role, "expires_in": settings.AUTH_TOKEN_TTL_SECONDS}

@app.get(f"{settings.API_V1_STR}/auth/me")
async def auth_me(request: Request):
    if not settings.AUTH_REQUIRED:
        return {"enabled": False, "authenticated": True, "username": "local", "role": "nurse"}
    token = request.cookies.get("clinical_session")
    authorization = request.headers.get("authorization", "")
    if authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
    from app.security.auth import verify_token
    user = verify_token(token or "", settings.SECRET_KEY)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    return {"enabled": True, "authenticated": True, "username": user.username, "role": user.role}

@app.post(f"{settings.API_V1_STR}/auth/logout")
async def logout(response: Response):
    response.delete_cookie("clinical_session", path="/", httponly=True, secure=settings.APP_ENV.lower() in {"production", "prod"}, samesite="strict")
    return {"status": "logged_out"}

import os
from fastapi.staticfiles import StaticFiles
_pdf_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "public", "pdf"))
if os.path.exists(_pdf_dir):
    app.mount("/api/v1/pdf", StaticFiles(directory=_pdf_dir), name="clinical_source_pdf")

@app.get("/", tags=["Health Check"])
@app.get("/health", tags=["Health Check"])
@app.get(f"{settings.API_V1_STR}/health", tags=["Health Check"])
async def root():
    return {
        "status": "healthy",
        "commit": os.getenv("RENDER_GIT_COMMIT", os.getenv("GIT_COMMIT", "HEAD")),
        "system": settings.APP_NAME,
        "docs_url": "/docs",
        "legal_compliance": [
            "Thông tư 22/2011/TT-BYT (Tủ trực cấp cứu & Cơ số thuốc)",
            "Thông tư 20/2017/TT-BYT (Thuốc gây nghiện & Vỏ ống Morphin)",
            "Thông tư 36/2018/TT-BYT (Thực hành tốt bảo quản thuốc GSP & FEFO)",
            "Nghị định 98/2021/NĐ-CP (Sự cố & Kiểm định thiết bị y tế)",
            "Nghị định 151/2017/NĐ-CP (Kiểm kê 31/12 & Quản lý tài sản công)",
            "Nghị định 130/2018/NĐ-CP (Ký số & Sổ nhật ký kiểm toán bất biến)"
        ]
    }
