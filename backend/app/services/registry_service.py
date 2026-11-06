import re
import hashlib
import unicodedata
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.registry import DavNationalDrug, ClinicalDrugMonograph
from app.models.inventory import InventoryBatch

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
_REGISTRY_REVISION_CACHE: str | None = None

def invalidate_hospital_stock_cache() -> None:
    pass

def escape_fts5_query(q: str) -> str:
    if not q or not q.strip():
        return ""
    tokens = re.findall(r'[\w]+', q.strip(), re.UNICODE)
    if not tokens:
        return ""
    return " ".join(f'"{t}"*' for t in tokens)

def warm_up_registry_cache_and_fts() -> None:
    try:
        import sqlite3
        from pathlib import Path
        from app.config import settings
        db_path = settings.DATABASE_URL.replace("sqlite+aiosqlite:///", "").replace("sqlite:///", "")
        if db_path and Path(db_path).is_file():
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            tables = [r[0] for r in cursor.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
            if "dav_national_drugs_fts" not in tables and "dav_national_drugs" in tables:
                cursor.execute("""
                    CREATE VIRTUAL TABLE dav_national_drugs_fts USING fts5(
                        national_code, brand_name, active_ingredient,
                        content=dav_national_drugs, content_rowid=rowid,
                        tokenize='unicode61 remove_diacritics 2'
                    );
                """)
                cursor.execute('INSERT INTO dav_national_drugs_fts(dav_national_drugs_fts) VALUES("rebuild");')
                conn.commit()
            conn.close()
    except Exception as e:
        print(f"Warning: Không thể warm up FTS: {e}")

def normalize_code(value: str | None) -> str:
    return unicodedata.normalize("NFKC", value or "").strip().casefold()

def calculate_revision(rows: list[tuple]) -> str:
    digest = hashlib.sha256()
    for row in rows:
        digest.update(repr(tuple(row)).encode("utf-8"))
        digest.update(b"\n")
    return digest.hexdigest()

async def get_registry_revision(db: AsyncSession) -> str:
    global _REGISTRY_REVISION_CACHE
    if _REGISTRY_REVISION_CACHE is None:
        rows = (await db.execute(select(
            DavNationalDrug.id, DavNationalDrug.national_code, DavNationalDrug.brand_name,
            DavNationalDrug.active_ingredient, DavNationalDrug.group, DavNationalDrug.atc_code
        ).order_by(DavNationalDrug.id))).all()
        _REGISTRY_REVISION_CACHE = calculate_revision(rows)
    return _REGISTRY_REVISION_CACHE

async def get_inventory_revision(db: AsyncSession) -> str:
    rows = (await db.execute(select(
        InventoryBatch.id, InventoryBatch.registration_number,
        InventoryBatch.current_stock, InventoryBatch.unit
    ).order_by(InventoryBatch.id))).all()
    return calculate_revision(rows)

async def get_hospital_stock(db: AsyncSession) -> dict[str, list[dict[str, int | str]]]:
    rows = (await db.execute(select(
        InventoryBatch.registration_number,
        InventoryBatch.current_stock, InventoryBatch.unit
    ))).all()
    grouped: dict[str, dict[str, list[int]]] = {}
    for registration_number, quantity, unit in rows:
        code = normalize_code(registration_number)
        if not code or quantity <= 0:
            continue
        unit_name = (unit or "").strip() or "Không rõ đơn vị"
        totals = grouped.setdefault(code, {}).setdefault(unit_name, [0, 0])
        totals[0] += quantity
        totals[1] += 1
    return {
        code: [{"unit": unit, "quantity": totals[0], "batch_count": totals[1]} for unit, totals in sorted(units.items())]
        for code, units in grouped.items()
    }

async def get_cached_group_stats(db: AsyncSession) -> dict[str, int]:
    global _GROUP_STATS_CACHE
    if _GROUP_STATS_CACHE is None:
        stat_stmt = select(DavNationalDrug.group, func.count(DavNationalDrug.id)).group_by(DavNationalDrug.group)
        stat_res = await db.execute(stat_stmt)
        _GROUP_STATS_CACHE = dict(stat_res.all())
    return _GROUP_STATS_CACHE

async def enrich_monograph_for_drug(drug: DavNationalDrug, db: AsyncSession, refresh: bool) -> None:
    need_enrich = (
        refresh or not drug.indications or not drug.adverse_effects
        or not drug.pharmacodynamics or not drug.pharmacokinetics
        or not drug.clinical_source or "Trang" not in drug.clinical_source
        or "Duoc_Thu_Quoc_Gia_Viet_Nam.pdf" not in drug.clinical_source
    )
    if not need_enrich:
        return

    mono = None
    if drug.clinical_monograph_id:
        m_res = await db.execute(select(ClinicalDrugMonograph).where(ClinicalDrugMonograph.id == drug.clinical_monograph_id))
        mono = m_res.scalar_one_or_none()

    if not mono and drug.active_ingredient:
        clean_ing = drug.active_ingredient.strip().lower()
        m_res = await db.execute(select(ClinicalDrugMonograph).where(func.lower(ClinicalDrugMonograph.inn) == clean_ing).limit(1))
        mono = m_res.scalar_one_or_none()
        if not mono:
            normalize = lambda value: re.sub(r"[^a-z0-9]+", "", value.casefold())
            active_key = normalize(drug.active_ingredient)
            mono_res = await db.execute(select(ClinicalDrugMonograph).limit(100))
            exact_matches = [candidate for candidate in mono_res.scalars() if normalize(candidate.inn) == active_key]
            if len(exact_matches) == 1:
                mono = exact_matches[0]

    if mono:
        fields = (
            "contraindications", "adult_dosage", "indications", "adverse_effects",
            "precautions", "pregnancy_warning", "lactation_warning", "pediatric_dosage", "renal_adjustment",
            "hepatic_adjustment", "drug_interactions", "overdose_treatment", "antidote",
            "pharmacodynamics", "pharmacokinetics", "adr_management", "incompatibilities", "storage_stability"
        )
        for fld in fields:
            if refresh or not getattr(drug, fld, None):
                setattr(drug, fld, getattr(mono, fld, None))
        if not drug.clinical_monograph_id:
            drug.clinical_monograph_id = mono.id
        if not drug.atc_code and mono.atc_code:
            drug.atc_code = mono.atc_code
        if not drug.drug_class and mono.drug_class:
            drug.drug_class = mono.drug_class
        if refresh or not drug.clinical_source or "Trang" not in drug.clinical_source or "Duoc_Thu_Quoc_Gia_Viet_Nam.pdf" not in drug.clinical_source:
            drug.clinical_source = mono.source or "Dược thư Quốc gia Việt Nam (Lần xuất bản II - 2015) • Tệp: Duoc_Thu_Quoc_Gia_Viet_Nam.pdf"
