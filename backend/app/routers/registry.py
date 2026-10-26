from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.registry import DavNationalDrug
from app.schemas.registry import (
    RegistryPaginatedResponse,
    RegistryStatsResponse,
    DrugItemResponse
)

router = APIRouter(prefix="/registry", tags=["Cơ Sở Dữ Liệu Dược Quốc Gia (DAV 55.000 SĐK)"])

GROUP_ALIAS_MAP = {
    "opioid": "Thuốc gây nghiện",
    "sedative": "Thuốc hướng thần",
    "emergency": "Thuốc cấp cứu",
    "antibiotic": "Kháng sinh",
    "infusion": "Dịch truyền",
    "high_alert": "Thuốc nguy cơ cao",
    "specialty": "Thuốc điều trị chuyên khoa",
}

_GROUP_STATS_CACHE: dict[str, int] | None = None

async def _get_cached_group_stats(db: AsyncSession) -> dict[str, int]:
    global _GROUP_STATS_CACHE
    if _GROUP_STATS_CACHE is None:
        stat_stmt = select(DavNationalDrug.group, func.count(DavNationalDrug.id)).group_by(DavNationalDrug.group)
        stat_res = await db.execute(stat_stmt)
        _GROUP_STATS_CACHE = dict(stat_res.all())
    return _GROUP_STATS_CACHE

@router.get("", response_model=RegistryPaginatedResponse)
async def get_national_drugs_paginated(
    search: str | None = Query(None, description="Tìm tên thuốc, hoạt chất, SĐK"),
    group: str | None = Query(None, description="Lọc theo nhóm lâm sàng"),
    page: int = Query(1, ge=1, description="Số trang (bắt đầu từ 1)"),
    page_size: int = Query(50, ge=1, le=200, description="Số lượng thuốc mỗi trang"),
    db: AsyncSession = Depends(get_db)
):
    target_group = GROUP_ALIAS_MAP.get(group.lower()) if group and group.lower() in GROUP_ALIAS_MAP else group
    if target_group and target_group.lower() == "all":
        target_group = None

    # Base filter criteria
    filters = []
    if target_group:
        filters.append(DavNationalDrug.group == target_group)
    if search and search.strip():
        q = f"%{search.strip().lower()}%"
        filters.append(
            or_(
                func.lower(DavNationalDrug.brand_name).like(q),
                func.lower(DavNationalDrug.active_ingredient).like(q),
                func.lower(DavNationalDrug.national_code).like(q),
                func.lower(DavNationalDrug.note).like(q)
            )
        )

    try:
        # 1. Total matching count
        count_stmt = select(func.count(DavNationalDrug.id))
        if filters:
            count_stmt = count_stmt.where(*filters)
        total_res = await db.execute(count_stmt)
        total_count = total_res.scalar() or 0

        # 2. Paginated data items
        data_stmt = select(DavNationalDrug)
        if filters:
            data_stmt = data_stmt.where(*filters)
        offset = (page - 1) * page_size
        data_stmt = data_stmt.order_by(DavNationalDrug.brand_name.asc()).offset(offset).limit(page_size)
        data_res = await db.execute(data_stmt)
        items = data_res.scalars().all()

        # 3. Overall group statistics (Fast in-memory cached group counts)
        group_stats = await _get_cached_group_stats(db)

        total_pages = max(1, (total_count + page_size - 1) // page_size)

        return RegistryPaginatedResponse(
            total=total_count,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
            group_stats=group_stats,
            items=items
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Registry query error: {str(e)}")

@router.get("/stats", response_model=RegistryStatsResponse)
async def get_registry_stats(db: AsyncSession = Depends(get_db)):
    stats = await _get_cached_group_stats(db)
    total = sum(stats.values())
    return RegistryStatsResponse(
        total_drugs=total,
        category_stats=stats,
        source="Cục Quản lý Dược - Bộ Y tế (dichvucong.dav.gov.vn)"
    )

@router.get("/{national_code}", response_model=DrugItemResponse)
async def get_drug_by_national_code(national_code: str, db: AsyncSession = Depends(get_db)):
    stmt = select(DavNationalDrug).where(
        or_(
            DavNationalDrug.national_code == national_code,
            DavNationalDrug.id == national_code
        )
    )
    res = await db.execute(stmt)
    drug = res.scalar_one_or_none()
    if not drug:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy thuốc có SĐK {national_code}")
    
    if not drug.hdsd_path and not drug.label_path:
        from app.services.dav_document_service import resolve_and_cache_drug_documents
        await resolve_and_cache_drug_documents(db, drug)

    if drug.clinical_monograph_id and (not drug.indications or not drug.adverse_effects):
        from app.models.registry import ClinicalDrugMonograph
        mono_res = await db.execute(select(ClinicalDrugMonograph).where(ClinicalDrugMonograph.id == drug.clinical_monograph_id))
        mono = mono_res.scalar_one_or_none()
        if mono:
            if not drug.contraindications: drug.contraindications = mono.contraindications
            if not drug.adult_dosage: drug.adult_dosage = mono.adult_dosage
            if not drug.indications: drug.indications = mono.indications
            if not drug.adverse_effects: drug.adverse_effects = mono.adverse_effects
            if not drug.precautions: drug.precautions = mono.precautions
            if not drug.pregnancy_warning: drug.pregnancy_warning = mono.pregnancy_warning
            if not drug.pediatric_dosage: drug.pediatric_dosage = mono.pediatric_dosage
            if not drug.renal_adjustment: drug.renal_adjustment = mono.renal_adjustment
            if not drug.hepatic_adjustment: drug.hepatic_adjustment = mono.hepatic_adjustment
            if not drug.drug_interactions: drug.drug_interactions = mono.drug_interactions
            if not drug.overdose_treatment: drug.overdose_treatment = mono.overdose_treatment
            if not drug.antidote: drug.antidote = mono.antidote

    return drug

@router.get("/{national_code}/documents")
async def get_drug_documents(national_code: str, db: AsyncSession = Depends(get_db)):
    stmt = select(DavNationalDrug).where(
        or_(
            DavNationalDrug.national_code == national_code,
            DavNationalDrug.id == national_code
        )
    )
    res = await db.execute(stmt)
    drug = res.scalar_one_or_none()
    if not drug:
        from app.services.dav_document_service import fetch_dav_documents_from_portal
        hdsd, label = await fetch_dav_documents_from_portal(national_code)
        return {"national_code": national_code, "hdsd_path": hdsd, "label_path": label}

    from app.services.dav_document_service import resolve_and_cache_drug_documents
    hdsd, label = await resolve_and_cache_drug_documents(db, drug)
    return {
        "national_code": drug.national_code,
        "brand_name": drug.brand_name,
        "hdsd_path": hdsd,
        "label_path": label
    }

@router.get("/monograph/{inn_or_id}")
async def get_clinical_monograph(inn_or_id: str, db: AsyncSession = Depends(get_db)):
    from app.models.registry import ClinicalDrugMonograph
    stmt = select(ClinicalDrugMonograph).where(
        or_(
            ClinicalDrugMonograph.id == inn_or_id,
            func.lower(ClinicalDrugMonograph.inn) == inn_or_id.lower(),
            func.lower(ClinicalDrugMonograph.atc_code) == inn_or_id.lower()
        )
    )
    res = await db.execute(stmt)
    mono = res.scalar_one_or_none()
    if not mono:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy chuyên luận Dược Thư cho '{inn_or_id}'")
    return mono

