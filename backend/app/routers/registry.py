import re
import hashlib
import unicodedata
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.config import settings
from app.models.registry import DavNationalDrug
from app.models.inventory import InventoryBatch
from app.schemas.registry import (
    RegistryPaginatedResponse,
    RegistryStatsResponse,
    DrugItemResponse
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

GROUP_ALIAS_MAP = {
    "opioid": "Thuốc gây nghiện", "sedative": "Thuốc hướng thần", "emergency": "Thuốc cấp cứu",
    "antibiotic": "Kháng sinh", "infusion": "Dịch truyền", "high_alert": "Thuốc nguy cơ cao", "specialty": "Thuốc điều trị chuyên khoa"
}

PHARM_MAPPING: dict[str, tuple[list[str], list[str]]] = {
    "fever_pain": (["N02B"], ["paracetamol", "acetaminophen"]),
    "cardiotonic_vasopressor": (["C01C", "A03BA"], ["adrenalin", "noradrenalin", "epinephrin", "dopamin", "dobutamin", "atropin"]),
    "diuretic": (["C03"], ["furosemid", "spironolacton", "indapamid"]),
    "antihypertensive": (["C08", "C09", "C07"], ["amlodipin", "enalapril", "losartan", "perindopril"]),
    "antiarrhythmic": (["C01B"], ["amiodaron", "lidocain"]),
    "antibiotic": (["J01"], ["ceftriaxon", "meropenem", "vancomycin", "ciprofloxacin", "cefaclor", "amoxicillin"]),
    "opioid": (["N02A", "N01A"], ["morphin", "fentanyl", "tramadol"]),
    "sedative": (["N05B"], ["diazepam", "midazolam"]),
    "bronchodilator": (["R03"], ["salbutamol", "ipratropium"]),
    "antiulcer_ppi": (["A02B"], ["omeprazol", "esomeprazol", "pantoprazol"]),
    "antidiabetic": (["A10"], ["insulin", "metformin"]),
    "lipid_lowering": (["C10"], ["atorvastatin", "rosuvastatin"]),
    "iv_fluids_electrolytes": (["B05B"], ["natri clorid", "glucose", "ringer", "kali clorid"]),
    "vaccine": (["J07"], ["vaccine", "vắc xin", "vaxigrip"]),
}

_GROUP_STATS_CACHE: dict[str, int] | None = None

def _normalize_code(value: str | None) -> str:
    # SĐK is opaque; preserve meaningful punctuation and prefixes.
    return unicodedata.normalize("NFKC", value or "").strip().casefold()

def _revision(rows: list[tuple]) -> str:
    digest = hashlib.sha256()
    for row in rows:
        digest.update(repr(tuple(row)).encode("utf-8"))
        digest.update(b"\n")
    return digest.hexdigest()

async def _get_registry_revision(db: AsyncSession) -> str:
    rows = (await db.execute(select(
        DavNationalDrug.id, DavNationalDrug.national_code, DavNationalDrug.brand_name,
        DavNationalDrug.active_ingredient, DavNationalDrug.group, DavNationalDrug.atc_code
    ).order_by(DavNationalDrug.id))).all()
    return _revision(rows)

async def _get_inventory_revision(db: AsyncSession) -> str:
    rows = (await db.execute(select(
        InventoryBatch.id, InventoryBatch.registration_number,
        InventoryBatch.current_stock, InventoryBatch.unit
    ).order_by(InventoryBatch.id))).all()
    return _revision(rows)

async def _hospital_stock(db: AsyncSession) -> dict[str, list[dict[str, int | str]]]:
    rows = (await db.execute(select(
        InventoryBatch.registration_number,
        InventoryBatch.current_stock, InventoryBatch.unit
    ))).all()
    grouped: dict[str, dict[str, list[int]]] = {}
    for registration_number, quantity, unit in rows:
        # Inventory is matched only by its registration number. national_code may
        # be an unrelated internal/legacy identifier and is not a safe fallback.
        code = _normalize_code(registration_number)
        if not code or quantity <= 0:
            continue
        unit_name = (unit or "").strip() or "Không rõ đơn vị"
        totals = grouped.setdefault(code, {}).setdefault(unit_name, [0, 0])
        totals[0] += quantity
        totals[1] += 1
    return {code: [{"unit": unit, "quantity": totals[0], "batch_count": totals[1]} for unit, totals in sorted(units.items())] for code, units in grouped.items()}

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
    pharm_group: str | None = Query(None, description="Lọc theo tác dụng dược lý"),
    page: int = Query(1, ge=1, description="Số trang (bắt đầu từ 1)"),
    page_size: int = Query(50, ge=1, le=200, description="Số lượng thuốc mỗi trang"),
    only_in_warehouse: bool = Query(False, description="Chỉ hiện thuốc đang có tồn kho bệnh viện"),
    db: AsyncSession = Depends(get_db)
):
    target_group = GROUP_ALIAS_MAP.get(group.lower()) if group and group.lower() in GROUP_ALIAS_MAP else group
    if target_group and target_group.lower() == "all": target_group = None

    filters = []
    if target_group: filters.append(DavNationalDrug.group == target_group)
    if pharm_group and pharm_group != "all" and pharm_group in PHARM_MAPPING:
        atcs, kws = PHARM_MAPPING[pharm_group]
        p_conds = [DavNationalDrug.atc_code.like(f"{p}%") for p in atcs] + [func.lower(DavNationalDrug.active_ingredient).like(f"%{kw}%") for kw in kws]
        if pharm_group == "antibiotic": p_conds.append(DavNationalDrug.group == "Kháng sinh")
        filters.append(or_(*p_conds))
    if search and search.strip():
        q = f"%{search.strip().lower()}%"
        filters.append(or_(func.lower(DavNationalDrug.brand_name).like(q), func.lower(DavNationalDrug.active_ingredient).like(q), func.lower(DavNationalDrug.national_code).like(q), func.lower(DavNationalDrug.note).like(q)))

    stock_by_code = await _hospital_stock(db)
    hospital_codes = {code for code, units in stock_by_code.items() if any(int(unit["quantity"]) > 0 for unit in units)}
    if only_in_warehouse:
        # Keep the filter in SQL so a warehouse request does not hydrate the
        # entire registry into Python before pagination.
        stock_codes = [code for code in hospital_codes if code]
        if stock_codes:
            filters.append(func.lower(func.trim(DavNationalDrug.national_code)).in_(stock_codes))
        else:
            filters.append(DavNationalDrug.id == "__no_hospital_stock__")

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
        data_stmt = data_stmt.order_by(
            (DavNationalDrug.national_code == "893100110026").desc(),
            DavNationalDrug.brand_name.asc(),
            DavNationalDrug.national_code.asc()
        ).offset(offset).limit(page_size)
        data_res = await db.execute(data_stmt)
        items = data_res.scalars().all()

        hospital_stock_drug_count = (await db.execute(
            select(func.count(DavNationalDrug.id)).where(
                func.lower(func.trim(DavNationalDrug.national_code)).in_(list(hospital_codes))
            )
        )).scalar() or 0
        for drug in items:
            drug.hospital_stock_by_unit = stock_by_code.get(_normalize_code(drug.national_code), [])

        # 3. Overall group statistics (Fast in-memory cached group counts)
        group_stats = await _get_cached_group_stats(db)

        total_pages = max(1, (total_count + page_size - 1) // page_size)

        return RegistryPaginatedResponse(
            total=total_count,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
            group_stats=group_stats,
            items=items,
            registry_revision=await _get_registry_revision(db),
            inventory_revision=await _get_inventory_revision(db),
            hospital_stock_drug_count=hospital_stock_drug_count
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
async def get_drug_by_national_code(national_code: str, refresh: bool = Query(False), db: AsyncSession = Depends(get_db)):
    stmt = select(DavNationalDrug).where(or_(DavNationalDrug.national_code == national_code, DavNationalDrug.id == national_code))
    res = await db.execute(stmt)
    drug = res.scalar_one_or_none()
    if not drug: raise HTTPException(status_code=404, detail=f"Không tìm thấy thuốc có SĐK {national_code}")
    
    if refresh or (not drug.hdsd_path and not drug.label_path):
        import asyncio
        from app.services.dav_document_service import resolve_and_cache_drug_documents
        try: await asyncio.wait_for(resolve_and_cache_drug_documents(db, drug), timeout=0.8)
        except Exception: pass

    need_enrich = (
        refresh or not drug.indications or not drug.adverse_effects
        or not drug.clinical_source or "Trang" not in drug.clinical_source
        or "Duoc_Thu_Quoc_Gia_Viet_Nam.pdf" not in drug.clinical_source
    )
    if need_enrich:
        from app.models.registry import ClinicalDrugMonograph
        mono = None
        if drug.clinical_monograph_id:
            m_res = await db.execute(select(ClinicalDrugMonograph).where(ClinicalDrugMonograph.id == drug.clinical_monograph_id))
            mono = m_res.scalar_one_or_none()
        # Chỉ tự liên kết hoạt chất đơn khi INN khớp toàn bộ sau chuẩn hóa.
        # Tìm theo từ con gây gán nhầm thuốc phối hợp/muối (vd. Potassium).
        if not mono and drug.active_ingredient:
            normalize = lambda value: re.sub(r"[^a-z0-9]+", "", value.casefold())
            active_key = normalize(drug.active_ingredient)
            mono_res = await db.execute(select(ClinicalDrugMonograph))
            exact_matches = [candidate for candidate in mono_res.scalars() if normalize(candidate.inn) == active_key]
            if len(exact_matches) == 1:
                mono = exact_matches[0]
        if mono:
            fields = ("contraindications", "adult_dosage", "indications", "adverse_effects", "precautions", "pregnancy_warning", "pediatric_dosage", "renal_adjustment", "hepatic_adjustment", "drug_interactions", "overdose_treatment", "antidote")
            for fld in fields:
                if refresh or not getattr(drug, fld, None): setattr(drug, fld, getattr(mono, fld, None))
            if not drug.clinical_monograph_id: drug.clinical_monograph_id = mono.id
            if not drug.atc_code and mono.atc_code: drug.atc_code = mono.atc_code
            if not drug.drug_class and mono.drug_class: drug.drug_class = mono.drug_class
            if refresh or not drug.clinical_source or "Trang" not in drug.clinical_source or "Duoc_Thu_Quoc_Gia_Viet_Nam.pdf" not in drug.clinical_source:
                drug.clinical_source = mono.source or "Dược thư Quốc gia Việt Nam (Lần xuất bản II - 2015) • Tệp: Duoc_Thu_Quoc_Gia_Viet_Nam.pdf"

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
    ).order_by(ClinicalDrugMonograph.id.desc()).limit(1)
    res = await db.execute(stmt)
    mono = res.scalars().first()
    if not mono:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy chuyên luận Dược Thư cho '{inn_or_id}'")
    return mono

