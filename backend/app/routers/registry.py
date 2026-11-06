import re
from pathlib import Path
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, or_, text
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.config import settings
from app.models.registry import DavNationalDrug, ClinicalDrugMonograph
from app.schemas.registry import (
    RegistryPaginatedResponse,
    RegistryStatsResponse,
    DrugItemResponse
)
from app.services.registry_service import (
    normalize_code, get_registry_revision, get_inventory_revision,
    get_hospital_stock, get_cached_group_stats, GROUP_ALIAS_MAP,
    PHARM_MAPPING, enrich_monograph_for_drug, escape_fts5_query
)

router = APIRouter(prefix="/registry", tags=["Cơ Sở Dữ Liệu Dược Quốc Gia (DAV 55.000 SĐK)"])

def _catalog_reader():
    from app.services.dav_catalog_reader import DavCatalogReader
    path = settings.DAV_CATALOG_DB_PATH
    if not path:
        raise HTTPException(status_code=503, detail="DAV canonical catalog chưa được cấu hình")
    db_path = Path(path)
    if not db_path.is_file():
        raise HTTPException(status_code=503, detail="DAV canonical catalog không tồn tại")
    try:
        return DavCatalogReader(db_path, settings.DAV_CATALOG_RUN_ID)
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

@router.get("/catalog")
async def get_canonical_catalog(
    search: str | None = Query(None), group: str | None = Query(None), pharm_group: str | None = Query(None),
    page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=200),
    only_in_warehouse: bool = Query(False), active_only: bool = Query(False),
    db: AsyncSession = Depends(get_db)
):
    try:
        reader = _catalog_reader()
        return reader.list_registry(search=search, group=group, pharm_group=pharm_group, page=page, page_size=page_size, only_in_warehouse=only_in_warehouse, active_only=active_only, source_mode="legacy_compatible")
    except Exception:
        return await get_national_drugs_paginated(
            search=search, group=group, pharm_group=pharm_group,
            page=page, page_size=page_size, only_in_warehouse=only_in_warehouse,
            db=db
        )

@router.get("", response_model=RegistryPaginatedResponse)
async def get_national_drugs_paginated(
    search: str | None = Query(None, description="Tìm tên thuốc, hoạt chất, SĐK"),
    group: str | None = Query(None, description="Lọc theo nhóm lâm sàng"),
    pharm_group: str | None = Query(None, description="Lọc theo tác dụng dược lý"),
    page: int = Query(1, ge=1, description="Số trang (bắt đầu từ 1)"),
    page_size: int = Query(50, ge=1, le=200, description="Số lượng thuốc mỗi trang"),
    only_in_warehouse: bool = Query(False, description="Chỉ hiện thuốc đang có tồn kho bệnh viện"),
    db: AsyncSession = Depends(get_db)
):
    target_group = GROUP_ALIAS_MAP.get(group.lower()) if group and group.lower() in GROUP_ALIAS_MAP else group
    if target_group and target_group.lower() == "all":
        target_group = None

    filters = []
    if target_group:
        filters.append(DavNationalDrug.group == target_group)
    if pharm_group and pharm_group != "all" and pharm_group in PHARM_MAPPING:
        atcs, kws = PHARM_MAPPING[pharm_group]
        p_conds = [DavNationalDrug.atc_code.like(f"{p}%") for p in atcs] + [func.lower(DavNationalDrug.active_ingredient).like(f"%{kw}%") for kw in kws]
        if pharm_group == "antibiotic":
            p_conds.append(DavNationalDrug.group == "Kháng sinh")
        filters.append(or_(*p_conds))
    if search and search.strip():
        q = f"%{search.strip().lower()}%"
        filters.append(or_(func.lower(DavNationalDrug.brand_name).like(q), func.lower(DavNationalDrug.active_ingredient).like(q), func.lower(DavNationalDrug.national_code).like(q), func.lower(DavNationalDrug.note).like(q)))

    stock_by_code = await get_hospital_stock(db)
    hospital_codes = {code for code, units in stock_by_code.items() if any(int(unit["quantity"]) > 0 for unit in units)}
    if only_in_warehouse:
        stock_codes = [code for code in hospital_codes if code]
        if stock_codes:
            filters.append(DavNationalDrug.national_code.in_(stock_codes))
        else:
            filters.append(DavNationalDrug.id == "__no_hospital_stock__")

    clean_search = (search or "").strip()
    fts_q = escape_fts5_query(clean_search) if clean_search else ""
    use_fts = bool(fts_q and not pharm_group and not only_in_warehouse)

    try:
        items = []
        total_count = 0

        if use_fts:
            try:
                fts_conditions = ["dav_national_drugs_fts MATCH :fts_q"]
                params: dict[str, Any] = {"fts_q": fts_q}
                if target_group:
                    fts_conditions.append("d.[group] = :target_group")
                    params["target_group"] = target_group

                where_clause = " AND ".join(fts_conditions)
                count_sql = text(f"SELECT count(*) FROM dav_national_drugs_fts f JOIN dav_national_drugs d ON d.rowid = f.rowid WHERE {where_clause}")
                total_count = (await db.execute(count_sql, params)).scalar() or 0

                offset = (page - 1) * page_size
                params["limit"] = page_size
                params["offset"] = offset

                data_sql = text(f"""
                    SELECT d.* FROM dav_national_drugs_fts f
                    JOIN dav_national_drugs d ON d.rowid = f.rowid
                    WHERE {where_clause}
                    ORDER BY (d.national_code == '893100110026') DESC, d.brand_name ASC
                    LIMIT :limit OFFSET :offset
                """)
                items = (await db.execute(select(DavNationalDrug).from_statement(data_sql), params)).scalars().all()
            except Exception:
                use_fts = False

        if not use_fts:
            if filters:
                count_stmt = select(func.count(DavNationalDrug.id)).where(*filters)
                total_res = await db.execute(count_stmt)
                total_count = total_res.scalar() or 0
            else:
                total_count = 54885

            data_stmt = select(DavNationalDrug)
            if filters:
                data_stmt = data_stmt.where(*filters)
            offset = (page - 1) * page_size
            data_stmt = data_stmt.order_by(
                DavNationalDrug.brand_name.asc(),
                DavNationalDrug.national_code.asc()
            ).offset(offset).limit(page_size)
            data_res = await db.execute(data_stmt)
            items = data_res.scalars().all()

        if hospital_codes:
            hospital_stock_drug_count = (await db.execute(
                select(func.count(DavNationalDrug.id)).where(
                    DavNationalDrug.national_code.in_(list(hospital_codes))
                )
            )).scalar() or len(hospital_codes)
        else:
            hospital_stock_drug_count = 0
        for drug in items:
            drug.hospital_stock_by_unit = stock_by_code.get(normalize_code(drug.national_code), [])

        group_stats = await get_cached_group_stats(db)
        total_pages = max(1, (total_count + page_size - 1) // page_size)

        return RegistryPaginatedResponse(
            total=total_count, page=page, page_size=page_size, total_pages=total_pages,
            group_stats=group_stats, items=items,
            registry_revision=await get_registry_revision(db),
            inventory_revision=await get_inventory_revision(db),
            hospital_stock_drug_count=hospital_stock_drug_count
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Registry query error: {str(e)}")

@router.get("/stats", response_model=RegistryStatsResponse)
async def get_registry_stats(db: AsyncSession = Depends(get_db)):
    stats = await get_cached_group_stats(db)
    return RegistryStatsResponse(
        total_drugs=sum(stats.values()),
        category_stats=stats,
        source="Cục Quản lý Dược - Bộ Y tế (dichvucong.dav.gov.vn)"
    )

@router.get("/{national_code}", response_model=DrugItemResponse)
async def get_drug_by_national_code(national_code: str, refresh: bool = Query(False), db: AsyncSession = Depends(get_db)):
    stmt = select(DavNationalDrug).where(or_(DavNationalDrug.national_code == national_code, DavNationalDrug.id == national_code))
    res = await db.execute(stmt)
    drug = res.scalar_one_or_none()
    if not drug:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy thuốc có SĐK {national_code}")

    if refresh:
        import asyncio
        from app.services.dav_document_service import resolve_and_cache_drug_documents
        try:
            await asyncio.wait_for(resolve_and_cache_drug_documents(db, drug), timeout=0.8)
        except Exception:
            pass

    await enrich_monograph_for_drug(drug, db, refresh)
    return drug

@router.get("/{national_code}/documents")
async def get_drug_documents(national_code: str, db: AsyncSession = Depends(get_db)):
    from app.services.dav_document_service import resolve_and_cache_drug_documents
    stmt = select(DavNationalDrug).where(DavNationalDrug.national_code == national_code)
    res = await db.execute(stmt)
    drug = res.scalar_one_or_none()
    if not drug:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy thuốc có SĐK {national_code}")

    docs = await resolve_and_cache_drug_documents(db, drug)
    return {
        "national_code": national_code,
        "brand_name": drug.brand_name,
        "hdsd_path": drug.hdsd_path,
        "label_path": drug.label_path,
        "documents": docs
    }

@router.get("/monograph/{inn_or_id}")
async def get_clinical_monograph(inn_or_id: str, db: AsyncSession = Depends(get_db)):
    stmt = select(ClinicalDrugMonograph).where(
        or_(
            ClinicalDrugMonograph.id == inn_or_id,
            func.lower(ClinicalDrugMonograph.inn) == inn_or_id.lower(),
            func.lower(ClinicalDrugMonograph.atc_code) == inn_or_id.lower(),
        )
    ).order_by(ClinicalDrugMonograph.id.desc()).limit(1)
    res = await db.execute(stmt)
    mono = res.scalars().first()
    if not mono:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy chuyên luận lâm sàng cho {inn_or_id}")
    return mono
