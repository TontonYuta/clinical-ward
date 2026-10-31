from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from app.config import settings
from app.database import engine, Base, AsyncSessionLocal
from app.models.user import User
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
    clinical_ddi
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure tables exist
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Check if DB has data, if not seed it automatically
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(User).limit(1))
        user = result.scalar_one_or_none()
        if not user:
            print("Database is empty. Automatically running seed...")
            await seed()

    # Seed 55k DAV drugs if table is empty
    seed_dav_registry_if_needed()

    yield

app = FastAPI(
    title=settings.APP_NAME,
    description="Backend API quản lý kho dược, tủ trực cấp cứu, trang thiết bị y tế và chuỗi lạnh vắc xin theo đúng quy phạm pháp luật Y tế Việt Nam.",
    version="2.0.0",
    lifespan=lifespan
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Cho phép client cục bộ và production kết nối
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register Domain Routers
app.include_router(debts.router, prefix=settings.API_V1_STR)
app.include_router(equipment.router, prefix=settings.API_V1_STR)
app.include_router(inventory.router, prefix=settings.API_V1_STR)
app.include_router(coldchain.router, prefix=settings.API_V1_STR)
app.include_router(assets.router, prefix=settings.API_V1_STR)
app.include_router(audit.router, prefix=settings.API_V1_STR)
app.include_router(copilot.router, prefix=settings.API_V1_STR)
app.include_router(cpoe.router, prefix=settings.API_V1_STR)
app.include_router(registry.router, prefix=settings.API_V1_STR)
app.include_router(prescription_advice.router, prefix=settings.API_V1_STR)
app.include_router(patients.router, prefix=settings.API_V1_STR)
app.include_router(sms.router, prefix=settings.API_V1_STR)
app.include_router(clinical_ddi.router, prefix=settings.API_V1_STR)

import os
from fastapi.staticfiles import StaticFiles
_kb_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "knowledge_base"))
if os.path.exists(_kb_dir):
    app.mount("/api/v1/pdf", StaticFiles(directory=_kb_dir), name="knowledge_base_pdf")

@app.get("/", tags=["Health Check"])
async def root():
    return {
        "status": "healthy",
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
