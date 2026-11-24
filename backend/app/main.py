from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware
from sqlalchemy import select
from app.config import settings
from app.security.http_headers import SecurityHeadersMiddleware
from app.security.auth import AuthenticationMiddleware, DEV_LAN_ORIGIN_REGEX
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
    admin_integrations,
    availability,
    admin_knowledge,
    auth,
    admin_staff,
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    from pathlib import Path
    from app.services.chatbot.workflow_policy import load_workflow_policy, validate_policy_route_coverage
    from app.schemas.clinical_nlu import ClinicalNluExtraction
    workflow_policy = load_workflow_policy(
        settings.WORKFLOW_POLICY_PATH,
        registered_executors={
            "conversation", "drug_lookup", "portal_guidance", "ddi",
            "clinical_reasoning", "sandwich", "specialty", "clarification", "multi_intent",
        },
    )
    validate_policy_route_coverage(
        workflow_policy, required_intents=set(ClinicalNluExtraction.model_fields["intent"].annotation.__args__)
    )
    app.state.workflow_policy = workflow_policy
    if settings.IDENTITY_DATABASE_URL:
        from sqlalchemy import inspect, text
        from app.identity_database import get_identity_session_factory
        identity_engine, _ = get_identity_session_factory()
        try:
            async with identity_engine.connect() as identity_connection:
                await identity_connection.execute(text("SELECT 1"))
                existing_identity_tables = await identity_connection.run_sync(
                    lambda sync_connection: set(inspect(sync_connection).get_table_names())
                )
                from app.models.identity import IdentityBase
                required_identity_tables = set(IdentityBase.metadata.tables)
            missing_identity_tables = required_identity_tables - existing_identity_tables
            if missing_identity_tables:
                raise RuntimeError(
                    "Identity database schema is incomplete; apply the identity migration before starting the service."
                )
        except Exception:
            await identity_engine.dispose()
            raise
        app.state.identity_engine = identity_engine
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
            ("usage_source", "VARCHAR(32) DEFAULT 'estimated'"),
            ("model_call_count", "INTEGER DEFAULT 0"),
            ("usage_call_count", "INTEGER DEFAULT 0"),
            ("cache_hit_count", "INTEGER DEFAULT 0"),
            ("model_name", "VARCHAR(64) DEFAULT 'gemini-2.5-flash'"),
            ("provider", "VARCHAR(64) DEFAULT 'gemini'"),
            ("has_image", "BOOLEAN DEFAULT 0"),
            ("image_tokens", "INTEGER DEFAULT 0"),
            ("latency_ms", "FLOAT DEFAULT 85.0"),
            ("availability_mode", "VARCHAR(32)"),
            ("rag_grounded", "BOOLEAN DEFAULT 0"),
            ("evidence_count", "INTEGER DEFAULT 0"),
            ("status_reason", "VARCHAR(128)"),
            ("telemetry_version", "VARCHAR(16)"),
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
        for col_name in ("section_pages", "source_id", "source_version"):
            if col_name not in monograph_cols:
                await conn.execute(text(f"ALTER TABLE clinical_drug_monographs ADD COLUMN {col_name} TEXT"))
        dav_cols = await conn.run_sync(lambda sync_conn: {col["name"] for col in inspect(sync_conn).get_columns("dav_national_drugs")})
        for col_name in ("source_id", "source_version"):
            if col_name not in dav_cols:
                await conn.execute(text(f"ALTER TABLE dav_national_drugs ADD COLUMN {col_name} TEXT"))

        user_cols = await conn.run_sync(lambda sync_conn: {col["name"] for col in inspect(sync_conn).get_columns("users")})
        user_extra_cols = [
            ("email", "VARCHAR"),
            ("phone", "VARCHAR"),
            ("dob", "VARCHAR"),
            ("academic_title", "VARCHAR"),
            ("username", "VARCHAR(100)"),
            ("hashed_password", "VARCHAR(255)"),
            ("must_change_password", "BOOLEAN DEFAULT 0"),
            ("is_active", "BOOLEAN DEFAULT 1"),
            ("avatar_url", "VARCHAR"),
            ("updated_at", "DATETIME"),
        ]
        for col_name, col_type in user_extra_cols:
            if col_name not in user_cols:
                await conn.execute(text(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}"))

    # Check if DB has data, if not seed it automatically
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(User).limit(1))
        user = result.scalar_one_or_none()
        if not user:
            print("Database is empty. Automatically running seed...")
            await seed()
        else:
            # Đồng bộ username và password mã hóa cho các tài khoản mẫu ban đầu nếu chưa có
            default_seed_credentials = {
                "u-1": ("dieu_duong_test", "$argon2id$v=19$m=65536,t=3,p=4$7+r9w6b6RcRrYWuBMNhAOQ$z1hYuBoo4cFF5LmETfpF6B9MGHn5j1GiyUrz4HX7drQ"),
                "u-2": ("ky_su_test", "$argon2id$v=19$m=65536,t=3,p=4$dJg7GQ+a3Xltq4bAcwF87w$D5SP4Pin+UYpyPuj37nCQbAPCooaxc1wIy0sCwD8X8w"),
                "u-3": ("duoc_si_test", "$argon2id$v=19$m=65536,t=3,p=4$Oz9YAegDQmRT5JincRBH7A$rZzZsXh++h4esywOsYDy/bjA7Ox8+HrdyeetDFG/QIs"),
                "u-4": ("bac_si_test", "$argon2id$v=19$m=65536,t=3,p=4$sNu3Zh2CciyrxlC0KlK0OA$qlmNJiw+sN+WywQOt+ybYWEPHIxeKtXL5LK+POsw/PQ"),
                "u-5": ("director", "$argon2id$v=19$m=65536,t=3,p=4$GF3Hc+mjNdKugpBguR6tww$KDPSqJ29VEb1mS9e+lsdl2zUEFxlGq0j1c6JRUg9qwU"),
            }
            changed = False
            for uid, (uname, phash) in default_seed_credentials.items():
                u_row = await session.get(User, uid)
                if u_row and not u_row.username:
                    u_row.username = uname
                    u_row.hashed_password = phash
                    changed = True
            if changed:
                await session.commit()

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
    identity_engine = getattr(app.state, "identity_engine", None)
    if identity_engine is not None:
        from app.identity_database import dispose_identity_engine
        await dispose_identity_engine()

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
    identity_store_enabled=bool(settings.IDENTITY_DATABASE_URL),
    trusted_origins=settings.CORS_ORIGINS,
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=DEV_LAN_ORIGIN_REGEX if settings.APP_ENV.lower() not in {"production", "prod"} else None,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
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
app.include_router(availability.router, prefix=settings.API_V1_STR)
app.include_router(admin_knowledge.router, prefix=settings.API_V1_STR)
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(admin_staff.router, prefix=settings.API_V1_STR)

import os
from fastapi.staticfiles import StaticFiles
_pdf_candidates = (
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "public", "pdf")),
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "public", "pdf")),
    "/app/public/pdf",
)
_pdf_dir = next((path for path in _pdf_candidates if os.path.isdir(path)), _pdf_candidates[0])
if os.path.isdir(_pdf_dir):
    app.mount("/api/v1/pdf", StaticFiles(directory=_pdf_dir), name="clinical_source_pdf")
    app.mount("/pdf", StaticFiles(directory=_pdf_dir), name="clinical_source_pdf_root")

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
