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
        res = (await db.execute(select(func.count(DavNationalDrug.id), func.max(DavNationalDrug.id)))).first()
        cnt = res[0] if res and res[0] is not None else 0
        max_id = res[1] if res and res[1] is not None else 0
        _REGISTRY_REVISION_CACHE = hashlib.sha256(f"dav_drugs_{cnt}_{max_id}".encode("utf-8")).hexdigest()
    return _REGISTRY_REVISION_CACHE

_INVENTORY_CACHE: dict = {"revision": None, "stock": None, "drug_count": 0, "codes": set()}
_ALL_MONOGRAPHS_CACHE: list | None = None


async def get_hospital_inventory_bundle(db: AsyncSession) -> tuple[dict[str, list[dict[str, int | str]]], str, int, set[str]]:
    """Tính toán và đồng bộ stock, revision và hospital_stock_drug_count chỉ trong 1 lần truy vấn."""
    rows = (await db.execute(select(
        InventoryBatch.id, InventoryBatch.registration_number,
        InventoryBatch.current_stock, InventoryBatch.unit
    ).order_by(InventoryBatch.id))).all()

    current_rev = calculate_revision(rows)
    if _INVENTORY_CACHE["revision"] == current_rev and _INVENTORY_CACHE["stock"] is not None:
        return _INVENTORY_CACHE["stock"], current_rev, _INVENTORY_CACHE["drug_count"], _INVENTORY_CACHE["codes"]

    grouped: dict[str, dict[str, list[int]]] = {}
    for batch_id, registration_number, quantity, unit in rows:
        code = normalize_code(registration_number)
        if not code or quantity <= 0:
            continue
        unit_name = (unit or "").strip() or "Không rõ đơn vị"
        totals = grouped.setdefault(code, {}).setdefault(unit_name, [0, 0])
        totals[0] += quantity
        totals[1] += 1

    stock_by_code = {
        code: [{"unit": unit, "quantity": totals[0], "batch_count": totals[1]} for unit, totals in sorted(units.items())]
        for code, units in grouped.items()
    }
    hospital_codes = {code for code, units in stock_by_code.items() if any(int(unit["quantity"]) > 0 for unit in units)}

    # Đếm số lượng thuốc thực tế tồn tại trong danh mục DAV
    if hospital_codes:
        count_res = (await db.execute(
            select(func.count(DavNationalDrug.id)).where(
                DavNationalDrug.national_code.in_(list(hospital_codes))
            )
        )).scalar()
        drug_count = count_res if count_res is not None else len(hospital_codes)
    else:
        drug_count = 0

    _INVENTORY_CACHE["revision"] = current_rev
    _INVENTORY_CACHE["stock"] = stock_by_code
    _INVENTORY_CACHE["codes"] = hospital_codes
    _INVENTORY_CACHE["drug_count"] = drug_count

    return stock_by_code, current_rev, drug_count, hospital_codes


async def get_inventory_revision(db: AsyncSession) -> str:
    _, rev, _, _ = await get_hospital_inventory_bundle(db)
    return rev


async def get_hospital_stock(db: AsyncSession) -> dict[str, list[dict[str, int | str]]]:
    stock, _, _, _ = await get_hospital_inventory_bundle(db)
    return stock


async def get_cached_group_stats(db: AsyncSession) -> dict[str, int]:
    global _GROUP_STATS_CACHE
    if _GROUP_STATS_CACHE is None:
        stat_stmt = select(DavNationalDrug.group, func.count(DavNationalDrug.id)).group_by(DavNationalDrug.group)
        stat_res = await db.execute(stat_stmt)
        _GROUP_STATS_CACHE = dict(stat_res.all())
    return _GROUP_STATS_CACHE


async def _get_all_monographs_cached(db: AsyncSession) -> list[ClinicalDrugMonograph]:
    global _ALL_MONOGRAPHS_CACHE
    if _ALL_MONOGRAPHS_CACHE is None:
        res = await db.execute(select(ClinicalDrugMonograph))
        _ALL_MONOGRAPHS_CACHE = list(res.scalars().all())
    return _ALL_MONOGRAPHS_CACHE


async def enrich_monograph_for_drug(drug: DavNationalDrug, db: AsyncSession, refresh: bool) -> None:
    need_enrich = (
        refresh or not drug.indications or not drug.adverse_effects
        or not drug.pharmacodynamics or not drug.pharmacokinetics
        or not drug.clinical_source or "Trang" not in drug.clinical_source
        or "Duoc_Thu_Quoc_Gia_Viet_Nam.pdf" not in drug.clinical_source
    )
    if not need_enrich:
        return

    # 1. Nhận diện chuyên biệt: Dung dịch Dinh dưỡng ngoài đường tiêu hóa (Parenteral Nutrition / TPN)
    combined_text = f"{drug.brand_name or ''} {drug.active_ingredient or ''} {drug.dosage_form or ''} {drug.group or ''}".lower()
    is_parenteral = bool(re.search(
        r"túi\s*\d+\s*ngăn|dinh dưỡng tĩnh mạch|acid amin.*glucose|nhũ tương mỡ|nhũ tương lipid|smofkabiven|aminomix|nutriflex|kabiven|olimel|clinimix|numeta",
        combined_text
    ))
    if is_parenteral:
        drug.drug_class = "Dung dịch dinh dưỡng ngoài đường tiêu hóa (Acid amin + Glucose + Lipid nhũ tương + Điện giải)"
        drug.indications = (
            "• Cung cấp dinh dưỡng hoàn toàn hoặc bổ sung qua đường tĩnh mạch (Parenteral Nutrition / TPN) "
            "cho người bệnh khi nuôi dưỡng qua đường tiêu hóa không khả thi, không đầy đủ hoặc bị chống chỉ định "
            "(hậu phẫu đường tiêu hóa lớn, suy kiệt nặng, hội chứng ruột ngắn, tắc ruột cơ học, viêm tụy hoại tử nặng)."
        )
        drug.contraindications = (
            "• Quá mẫn với protein đậu nành, protein trứng, protein đậu phộng hoặc bất kỳ thành phần nào của thuốc.\n"
            "• Tăng lipid máu nặng (triglycerid > 4 - 5 mmol/L), rối loạn chuyển hóa lipid nghiêm trọng.\n"
            "• Suy gan nặng, suy thận nặng không lọc máu.\n"
            "• Sốc cấp tính, phù phổi cấp, ứ nước nặng, suy tim mất bù, phù toàn thân nặng.\n"
            "• Tình trạng huyết động không ổn định (sau chấn thương nặng, nhồi máu cơ tim cấp, nhiễm toan chuyển hóa mất bù, hôn mê tăng áp lực thẩm thấu)."
        )
        drug.adult_dosage = (
            "• Liều dùng và tốc độ truyền phải cá thể hóa theo cân nặng thực tế/lý tưởng, tình trạng lâm sàng và nhu cầu năng lượng của người bệnh (khuyến cáo 20 - 35 kcal/kg/ngày; đạm 0.8 - 1.5 g/kg/ngày).\n"
            "• Tốc độ truyền tối đa khuyến cáo: Không vượt quá 0.25 g lipid/kg/giờ, 0.25 g glucose/kg/giờ và 0.1 g acid amin/kg/giờ.\n"
            "• Đường truyền: Đánh giá áp lực thẩm thấu (mOsm/L). Truyền ngoại vi an toàn khi < 800 - 900 mOsm/L (như Smofkabiven Peripheral). Dung dịch ưu trương cao (> 900 mOsm/L, như Smofkabiven Central) BẮT BUỘC truyền qua tĩnh mạch trung ương (CVC hoặc PICC) để tránh viêm tắc tĩnh mạch huyết khối."
        )
        drug.pediatric_dosage = (
            "• Không khuyến cáo dùng cho trẻ sơ sinh và trẻ nhỏ dưới 2 tuổi do tỷ lệ thành phần acid amin và áp lực thẩm thấu không phù hợp (nên dùng các chế phẩm dinh dưỡng chuyên biệt cho nhi khoa như Numeta/Pediven)."
        )
        drug.precautions = (
            "• Bắt buộc kiểm tra nồng độ triglycerid huyết thanh trước khi truyền và theo dõi định kỳ trong quá trình điều trị (ngưỡng an toàn < 3 - 4 mmol/L).\n"
            "• Theo dõi điện giải đồ (Na+, K+, Mg2+, PO4 3-), đường huyết mao mạch mỗi 4 - 6 giờ trong giai đoạn chỉnh liều để phòng ngừa Hội chứng nuôi ăn lại (Refeeding Syndrome).\n"
            "• Tuân thủ nghiêm ngặt kỹ thuật vô khuẩn tuyệt đối khi thiết lập và thay dây truyền (dây truyền lipid phải thay sau mỗi 24 giờ)."
        )
        drug.adverse_effects = (
            "• Tăng triglycerid máu, tăng đường huyết, rối loạn điện giải (hạ kali, hạ phosphat máu).\n"
            "• Sốt, ớn lạnh, buồn nôn, run rẩy, phản ứng phản vệ (hiếm gặp do dị ứng dầu đậu tương/trứng).\n"
            "• Viêm tĩnh mạch huyết khối tại vị trí tiêm truyền nếu áp lực thẩm thấu vượt ngưỡng đường ngoại vi.\n"
            "• Hội chứng quá tải mỡ (Fat Overload Syndrome): suy giảm chức năng gan thận, lách to, giảm tiểu cầu, rối loạn đông máu khi truyền lipid quá nhanh."
        )
        drug.adr_management = (
            "• Nếu xảy ra sốt, ớn lạnh hoặc phản ứng dị ứng: NGỪNG truyền ngay lập tức, xử trí phản vệ theo phác đồ cấp cứu.\n"
            "• Nếu triglycerid > 4.5 mmol/L hoặc có dấu hiệu quá tải mỡ: Ngừng truyền buồng lipid hoặc giảm tốc độ truyền, theo dõi độ thanh thải lipid.\n"
            "• Nếu xuất hiện tăng đường huyết: Cân nhắc phối hợp insulin tĩnh mạch điều chỉnh theo phác đồ."
        )
        drug.drug_interactions = (
            "• TƯƠNG KỴ TUYỆT ĐỐI VỚI CEFTRIAXON: Không pha chung hoặc truyền cùng đường truyền tĩnh mạch với Ceftriaxon (nguy cơ tạo tủa Calci-Ceftriaxon gây tử vong do lắng đọng vi thể tại phổi và thận).\n"
            "• TƯƠNG KỴ VỚI THUỐC TIÊM TRUYỀN KHÁC: Không tự ý pha thêm các thuốc khác vào túi dinh dưỡng TPN trừ khi có chỉ dẫn tương thích rõ ràng từ dược sĩ lâm sàng (nguy cơ phá vỡ nhũ tương lipid).\n"
            "• Heparin: Kích thích giải phóng lipase làm tăng thoái hóa triglycerid và giảm thanh thải sau đó.\n"
            "• Dẫn xuất coumarin/warfarin: Dầu đậu tương chứa Vitamin K1 tự nhiên có thể làm giảm tác dụng chống đông của thuốc đối kháng Vitamin K."
        )
        drug.incompatibilities = "Tương kỵ tuyệt đối với Ceftriaxon, dung dịch chứa Calci nồng độ cao vượt ngưỡng hòa tan của phosphat, dung môi axit làm giảm pH < 5.5 gây phá vỡ nhũ tương lipid."
        drug.storage_stability = "Bảo quản không quá 25°C trong bao bì gốc (túi bọc ngoài chống ánh sáng). Không để đông băng. Sau khi xé túi bọc và trộn 3 ngăn: dung dịch ổn định trong vòng 24 giờ ở nhiệt độ phòng (25°C)."
        drug.clinical_source = "Hướng dẫn Điều trị Dinh dưỡng Lâm sàng Ngoài đường tiêu hóa (ESPEN / ASPEN) & Dược thư Quốc gia Việt Nam • Căn cứ QĐ 2033/QĐ-BYT"
        return

    # 2. Tra cứu chuyên luận Dược Thư Quốc Gia (DTQG)
    all_monos = await _get_all_monographs_cached(db)
    mono_by_id = {m.id: m for m in all_monos}
    mono_by_inn = {m.inn.strip().lower(): m for m in all_monos if m.inn}

    matched_monos: list[ClinicalDrugMonograph] = []

    # Kiểm tra đơn chất có sẵn clinical_monograph_id
    is_multi_ingredient = bool(drug.active_ingredient and re.search(r'[;+,/]|\b(?:và|and)\b', drug.active_ingredient))
    if not is_multi_ingredient and drug.clinical_monograph_id and drug.clinical_monograph_id in mono_by_id:
        matched_monos.append(mono_by_id[drug.clinical_monograph_id])

    if not matched_monos and drug.active_ingredient:
        clean_ing = drug.active_ingredient.strip().lower()
        if clean_ing in mono_by_inn:
            matched_monos.append(mono_by_inn[clean_ing])

        if not matched_monos:
            salt_pat = re.compile(r'\b(natri|kali|calci|magnesi|hydroclorid|hydrochloride|hcl|besylat|besylate|maleat|maleate|phosphat|phosphate|acetat|acetate|succinat|succinate|tartrat|tartrate|sulfat|sulfate|nitrat|nitrate|citrat|citrate|lactat|lactate|hydrat|hydrate|trihydrat|trihydrate|bp|usp|ph\.eur|ddvn)\b', re.IGNORECASE)
            strength_pat = re.compile(r'\b\d+([.,]\d+)?\s*(mcg|microgram|µg|μg|ug|mg|g|kg|ml|iu|ui|%|don vi)\b', re.IGNORECASE)
            aliases = {
                'acetaminophen': 'paracetamol',
                'amoxicillin': 'amoxicilin',
                'ceftriaxone': 'ceftriaxon',
                'caffeine': 'cafein',
                'epinephrine': 'adrenalin',
                'norepinephrine': 'noradrenalin',
                'morphine': 'morphin',
                'clarithromycine': 'clarithromycin',
                'azithromycine': 'azithromycin',
                'clavulanate': 'amoxicillin and potassium clavulanate',
                'acid clavulanic': 'amoxicillin and potassium clavulanate',
                'clavulanic acid': 'amoxicillin and potassium clavulanate',
                'potassium clavulanate': 'amoxicillin and potassium clavulanate',
            }
            parts = re.split(r'[;+,/]|\b(?:và|and)\b', drug.active_ingredient, flags=re.IGNORECASE)
            candidates: list[str] = []
            for p in parts:
                p = re.sub(r'\(.*?\)', '', p)
                p = strength_pat.sub('', p)
                p = salt_pat.sub('', p)
                p = p.strip().lower()
                if p and p not in candidates:
                    candidates.append(p)
                if p in aliases and aliases[p] not in candidates:
                    candidates.append(aliases[p])
                first_w = p.split()[0] if p else ''
                if len(first_w) >= 4 and first_w not in candidates:
                    candidates.append(first_w)
                if first_w in aliases and aliases[first_w] not in candidates:
                    candidates.append(aliases[first_w])

            for cand in candidates:
                if cand in mono_by_inn and mono_by_inn[cand] not in matched_monos:
                    matched_monos.append(mono_by_inn[cand])

        if not matched_monos:
            normalize = lambda value: re.sub(r"[^a-z0-9]+", "", value.casefold())
            active_key = normalize(drug.active_ingredient)
            exact_matches = [m for m in all_monos if normalize(m.inn) == active_key]
            if len(exact_matches) == 1:
                matched_monos.append(exact_matches[0])

    # Kế thừa tri thức lâm sàng đơn chất hoặc đa thành phần (Composite Knowledge Inheritance)
    if matched_monos:
        primary_mono = matched_monos[0]
        fields = (
            "contraindications", "adult_dosage", "indications", "adverse_effects",
            "precautions", "pregnancy_warning", "lactation_warning", "pediatric_dosage", "renal_adjustment",
            "hepatic_adjustment", "drug_interactions", "overdose_treatment", "antidote",
            "pharmacodynamics", "pharmacokinetics", "adr_management", "incompatibilities", "storage_stability"
        )
        if len(matched_monos) == 1:
            for fld in fields:
                if refresh or not getattr(drug, fld, None):
                    setattr(drug, fld, getattr(primary_mono, fld, None))
            if not drug.clinical_monograph_id:
                drug.clinical_monograph_id = primary_mono.id
            if not drug.atc_code and primary_mono.atc_code:
                drug.atc_code = primary_mono.atc_code
            if not drug.drug_class and primary_mono.drug_class:
                drug.drug_class = primary_mono.drug_class
            if refresh or not drug.clinical_source or "Trang" not in drug.clinical_source or "Duoc_Thu_Quoc_Gia_Viet_Nam.pdf" not in drug.clinical_source:
                drug.clinical_source = primary_mono.source or "Dược thư Quốc gia Việt Nam (Lần xuất bản II - 2015) • Tệp: Duoc_Thu_Quoc_Gia_Viet_Nam.pdf"
        else:
            # Hợp nhất tri thức các thành phần với tiền tố phân biệt rõ ràng
            for fld in fields:
                vals = []
                for m in matched_monos:
                    v = getattr(m, fld, None)
                    if v and v.strip():
                        vals.append(f"[{m.inn.upper()}]:\n{v.strip()}")
                if vals and (refresh or not getattr(drug, fld, None)):
                    setattr(drug, fld, "\n\n".join(vals))

            if not drug.clinical_monograph_id:
                drug.clinical_monograph_id = primary_mono.id
            if not drug.atc_code and primary_mono.atc_code:
                drug.atc_code = primary_mono.atc_code
            if not drug.drug_class:
                classes = [m.drug_class for m in matched_monos if m.drug_class]
                drug.drug_class = " + ".join(dict.fromkeys(classes)) if classes else primary_mono.drug_class

            source_inns = ", ".join(m.inn for m in matched_monos)
            drug.clinical_source = f"Tổng hợp từ các chuyên luận: {source_inns} • Dược thư Quốc gia Việt Nam (Lần II) • Tệp: Duoc_Thu_Quoc_Gia_Viet_Nam.pdf"
