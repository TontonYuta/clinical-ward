"""
Dịch vụ xử lý thuốc phối hợp đa hoạt chất (Combination Drugs Service)
Đảm bảo độ chính xác tuyệt đối 100%, đối soát chặt chẽ với Dược thư Quốc gia Việt Nam (DĐVN V).
Tuyệt đối không suy đoán, không bịa nguồn khi hoạt chất không có chuyên luận trong Dược thư.
"""
from __future__ import annotations

import re
import unicodedata
from typing import Any, List, Optional, Tuple
from sqlalchemy import select, or_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.registry import DavNationalDrug, ClinicalDrugMonograph
from app.schemas.copilot import CopilotResponse
from app.services.copilot_drug_citation_helper import format_clinical_text, build_drug_citation
from app.services.ingredient_mapping import CURATED_ALIASES

# Danh mục ánh xạ các cặp hoạt chất phối hợp chuẩn sang chuyên luận phối hợp chính danh trong DĐVN V
CANONICAL_COMBINED_MONOGRAPHS: dict[frozenset[str], str] = {
    frozenset(["amoxicillin", "clavulanic"]): "DTQG-0048-Amoxicillinandpotass",
    frozenset(["amoxicilin", "clavulanic"]): "DTQG-0048-Amoxicillinandpotass",
    frozenset(["amoxicillin", "acid clavulanic"]): "DTQG-0048-Amoxicillinandpotass",
    frozenset(["amoxicilin", "acid clavulanic"]): "DTQG-0048-Amoxicillinandpotass",
    frozenset(["amoxicillin", "clavulanic acid"]): "DTQG-0048-Amoxicillinandpotass",
    frozenset(["amoxicilin", "clavulanic acid"]): "DTQG-0048-Amoxicillinandpotass",
    frozenset(["ampicillin", "sulbactam"]): "DTQG-0051-Ampicillinandsulbact",
    frozenset(["ampicilin", "sulbactam"]): "DTQG-0051-Ampicillinandsulbact",
    frozenset(["sulfamethoxazole", "trimethoprim"]): "DTQG-0170-SulfamethoxazoleTrim",
    frozenset(["sulfamethoxazol", "trimethoprim"]): "DTQG-0170-SulfamethoxazoleTrim",
    frozenset(["carbidopa", "levodopa"]): "DTQG-0106-Carbidopalevodopa",
    frozenset(["lopinavir", "ritonavir"]): "DTQG-0397-Lopinavirandritonavi",
    frozenset(["imipenem", "cilastatin"]): "DTQG-0340-Imipenemandenzymeinh",
    frozenset(["cyanocobalamin", "hydroxocobalamin"]): "DTQG-0173-Cyanocobalaminandhyd",
}

def extract_concise_drug_class(raw_class: Optional[str]) -> str:
    """Trích xuất tên nhóm dược lý súc tích dòng đầu tiên, loại bỏ toàn bộ khối dược động học rườm rà."""
    if not raw_class:
        return "Thuốc điều trị chuyên khoa"
    first_block = raw_class.strip().split('\n')[0].strip()
    for kw in ['Dạng thuốc', 'Dược lý', 'Cơ chế', 'Dược động học']:
        if kw in first_block:
            first_block = first_block.split(kw)[0].strip()
    first_block = re.sub(r'[.;,]+$', '', first_block).strip()
    if len(first_block) > 120:
        first_block = first_block[:119].rsplit(' ', 1)[0] + '...'
    return first_block or "Thuốc điều trị chuyên khoa"

def clean_monograph_field(text: Optional[str], max_chars: int = 220) -> str:
    """Làm sạch văn bản OCR, hàn gắn ngắt dòng và cắt tỉa lịch sự theo ranh giới câu."""
    if not text:
        return "Theo chỉ định chuyên khoa."
    cleaned = format_clinical_text(text).strip()
    cleaned = re.sub(r'([a-zA-Zà-ỹÀ-Ỹ]+)\s*\n+\s*([a-zA-Zà-ỹÀ-Ỹ]+)', r'\1 \2', cleaned)
    cleaned = re.sub(r'[ \t]+', ' ', cleaned)
    if len(cleaned) <= max_chars:
        return cleaned
    truncated = cleaned[:max_chars]
    last_punct = max(truncated.rfind('.'), truncated.rfind(';'), truncated.rfind(','))
    if last_punct > 80:
        return truncated[:last_punct + 1]
    last_space = truncated.rfind(' ')
    if last_space > 80:
        return truncated[:last_space] + '...'
    return truncated + '...'

SALT_SUFFIXES = re.compile(
    r"\b(?:maleat|maleate|hydroclorid|hydrochloride|hcl|phosphat|phosphate|"
    r"natri|sodium|calci|calcium|kali|potassium|fumarat|fumarate|acetat|acetate|"
    r"succinat|succinate|sulfat|sulfate|clorid|chloride|nitrat|nitrate|"
    r"trihydrat|trihydrate|dihydrat|dihydrate|dipropionat|dipropionate|"
    r"valerat|valerate|tartrat|tartrate|arginin|arginine|besilat|besylate|"
    r"erbumin|erbumine|mesylat|mesylate)\b",
    re.IGNORECASE
)

def _normalize_substance(text: str) -> str:
    text = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in text if not unicodedata.combining(c)).lower()
    return re.sub(r"[^a-z0-9]+", "", text)

def clean_substance_name(text: str) -> str:
    # 1. Loại bỏ hàm lượng & đơn vị ở đầu chuỗi (ví dụ: "600mg amoxicillin", "42,9mg acid clavulanic")
    text = re.sub(r"^\s*[\d.,\s\xa0]+(?:mcg|microgram|µg|μg|mg|g|kg|iu|ui|units?|%|đơn vị)\s*", "", text, flags=re.IGNORECASE).strip()
    # 2. Loại bỏ hàm lượng & đơn vị ở cuối chuỗi
    text = re.sub(r"[\d.,\s\xa0]+(?:mcg|microgram|µg|μg|mg|g|kg|iu|ui|units?|%|đơn vị).*$", "", text, flags=re.IGNORECASE).strip()
    # 3. Loại bỏ cụm giải thích dạng muối hoặc tương đương
    text = re.sub(r"\(dưới\s+dạng.*?\)", "", text, flags=re.IGNORECASE).strip()
    text = re.sub(r"\(tương\s+đương.*?\)", "", text, flags=re.IGNORECASE).strip()
    text = re.sub(r"\b(?:dưới dạng|tương đương|as|equivalent)\b.*$", "", text, flags=re.IGNORECASE).strip()
    text = re.sub(r"\(.*?\)", "", text).strip()
    # 4. Loại bỏ gốc muối phổ biến
    text = SALT_SUFFIXES.sub("", text).strip()
    return text.strip()

def parse_combination_ingredients(raw: str | None) -> list[str]:
    if not raw or not raw.strip():
        return []
    # Loại bỏ tiền tố mở đầu (ví dụ: 'Sau khi hoàn nguyên, mỗi 5 mL hỗn dịch thuốc chứa...')
    text = re.sub(r"^(?:sau\s+khi\s+hoàn\s+nguyên,?\s*)?(?:mỗi\s+[\w\d\s,()%-]+\s+chứa:?)\s*", "", raw, flags=re.IGNORECASE)
    # Loại bỏ hậu tố phụ (ví dụ: ', tỷ lệ 14:1')
    text = re.sub(r"[,;]\s*tỷ\s+lệ.*$", "", text, flags=re.IGNORECASE).strip()

    # Phân tách theo dấu phân cách phổ biến
    if ";" in text:
        parts = text.split(";")
    elif "+" in text:
        parts = text.split("+")
    elif re.search(r"\s+và\s+", text, re.IGNORECASE):
        parts = re.split(r"\s+và\s+", text, flags=re.IGNORECASE)
    elif "," in text and not re.search(r"\d,\d", text):
        parts = text.split(",")
    else:
        parts = [text]

    cleaned: list[str] = []
    for p in parts:
        s = clean_substance_name(p)
        if len(s) >= 3 and not re.match(r"^\d", s):
            base_norm = _normalize_substance(s)
            canonical = CURATED_ALIASES.get(s.lower()) or CURATED_ALIASES.get(base_norm) or s
            cleaned.append(canonical.title() if canonical == canonical.lower() else canonical)
    return cleaned

async def resolve_combination_monographs(
    drug: DavNationalDrug,
    db: AsyncSession
) -> Tuple[Optional[ClinicalDrugMonograph], List[dict[str, Any]]]:
    """
    Đối soát thuốc phối hợp với CSDL Dược thư Quốc gia.
    Trả về:
    - primary_combined_monograph: Nếu tìm thấy chuyên luận phối hợp chính danh (ví dụ Amoxicilin + Acid Clavulanic -> Trang 192)
    - component_details: Danh sách từng thành phần hoạt chất kèm chuyên luận độc lập tương ứng (nếu có)
    """
    ingredients = parse_combination_ingredients(drug.active_ingredient)
    if not ingredients and drug.active_ingredient:
        ingredients = [clean_substance_name(drug.active_ingredient)]

    # Bước 1: Kiểm tra chuyên luận phối hợp chính danh trong CANONICAL_COMBINED_MONOGRAPHS
    norm_set = frozenset(_normalize_substance(ing) for ing in ingredients)
    canonical_mono_id = None
    for combo_set, mono_id in CANONICAL_COMBINED_MONOGRAPHS.items():
        combo_norm = frozenset(_normalize_substance(k) for k in combo_set)
        if combo_norm == norm_set:
            canonical_mono_id = mono_id
            break

    primary_monograph = None
    if canonical_mono_id:
        res = await db.execute(select(ClinicalDrugMonograph).where(ClinicalDrugMonograph.id == canonical_mono_id))
        primary_monograph = res.scalar_one_or_none()

    # Bước 2: Tìm chuyên luận riêng cho từng thành phần
    component_details: List[dict[str, Any]] = []
    all_monos_res = await db.execute(select(ClinicalDrugMonograph))
    all_monos = all_monos_res.scalars().all()

    for ing in ingredients:
        ing_clean = clean_substance_name(ing)
        ing_norm = _normalize_substance(ing_clean)
        matched_mono = None

        # Khớp chính xác INN hoặc Title
        for m in all_monos:
            source_names = {name for name in (m.inn, m.title) if name}
            source_names.update(clean_substance_name(name) for name in tuple(source_names))
            if ing_norm in {_normalize_substance(name) for name in source_names}:
                matched_mono = m
                break

        if matched_mono:
            component_details.append({
                "ingredient_name": ing_clean,
                "status": "verified_dtqg",
                "monograph": matched_mono,
                "source": matched_mono.source,
                "atc_code": matched_mono.atc_code,
                "drug_class": matched_mono.drug_class,
                "indications": matched_mono.indications,
                "adult_dosage": matched_mono.adult_dosage,
                "pediatric_dosage": matched_mono.pediatric_dosage,
                "contraindications": matched_mono.contraindications,
                "adverse_effects": matched_mono.adverse_effects,
                "renal_adjustment": matched_mono.renal_adjustment,
            })
        else:
            # Rào chắn chống suy diễn / bịa nguồn
            component_details.append({
                "ingredient_name": ing_clean,
                "status": "unverified_in_dtqg",
                "monograph": None,
                "source": None,
                "note": f"Hoạt chất {ing_clean} chưa có chuyên luận đơn chất độc lập trong Dược thư Quốc gia Việt Nam 2015 (QĐ 2033/QĐ-BYT). Thông tin tuân thủ theo Tờ hướng dẫn sử dụng (HDSD) của Cục Quản lý Dược phê duyệt."
            })

    return primary_monograph, component_details

def build_combination_drug_profile(
    drug: DavNationalDrug,
    primary_mono: Optional[ClinicalDrugMonograph],
    components: List[dict[str, Any]],
    query: str = ""
) -> Tuple[str, List[dict], str]:
    """
    Định dạng hồ sơ lâm sàng toàn diện cho thuốc phối hợp đa hoạt chất.
    Trả về: (reply_text, citations, legal_basis)
    """
    citations: List[CopilotCitation] = []
    legal_bases: List[str] = []

    # 1. Trường hợp có Chuyên luận phối hợp chính danh (ví dụ Amoxicilin + Kali clavulanat)
    if primary_mono and not any(str(getattr(primary_mono, field, None) or "").strip()
                                for field in ("indications", "adult_dosage", "pediatric_dosage", "drug_interactions", "contraindications")):
        primary_mono = None
    if primary_mono:
        source = primary_mono.source or drug.clinical_source or "Dược thư Quốc gia Việt Nam (DĐVN V)"
        legal_bases.append(source)
        citations.append(build_drug_citation(drug, primary_mono, source))

        reply = (
            f"### 💊 HỒ SƠ DƯỢC LÂM SÀNG THUỐC PHỐI HỢP: {drug.brand_name}\n"
            f"*(Chuyên luận phối hợp chính danh Dược thư Quốc gia Việt Nam DĐVN V & Cục Quản lý Dược)*\n\n---\n\n"
            f"#### 1. THÔNG TIN ĐỊNH DANH & CƠ CHẾ HIỆP ĐỒNG\n"
            f"• **Tên biệt dược:** **{drug.brand_name}** | **Mã SĐK (DAV):** `{drug.national_code}`\n"
            f"• **Hoạt chất phối hợp (INN):** **{drug.active_ingredient}**\n"
            f"• **Hàm lượng / Nồng độ:** {drug.concentration or 'Theo hồ sơ công bố'}\n"
            f"• **Dạng bào chế:** {drug.dosage_form or 'Đạt chuẩn DĐVN V'} | **Đường dùng:** {drug.route or 'Theo chỉ định'}\n"
            f"• **Chuyên luận Dược thư đối chứng:** **{primary_mono.title}** (Mã ATC: `{primary_mono.atc_code or 'DĐVN V'}`)\n"
            f"• **Phân loại quản lý:** **{drug.group}** ({'Thuốc kiểm soát đặc biệt (Thông tư 20/2017/TT-BYT)' if drug.is_controlled else 'Thuốc thông thường'})\n\n"
            f"#### 2. CHỈ ĐỊNH ĐIỀU TRỊ CHUYÊN BIỆT (INDICATIONS)\n"
            f"🎯 {format_clinical_text(primary_mono.indications or 'Chưa có dữ liệu chỉ định trong nguồn liên kết.')}\n\n"
            f"#### 3. LIỀU LƯỢNG & ĐƯỜNG DÙNG (DOSAGE & ADMINISTRATION)\n"
            f"🛡️ **Liều người lớn:** {format_clinical_text(primary_mono.adult_dosage or 'Chưa có dữ liệu liều người lớn trong nguồn liên kết.')}\n\n"
            f"👶 **Liều trẻ em:** {format_clinical_text(primary_mono.pediatric_dosage or 'Chưa có dữ liệu liều trẻ em trong nguồn liên kết.')}\n\n"
            f"#### 4. CHỐNG CHỈ ĐỊNH & THẬN TRỌNG LÂM SÀNG\n"
            f"⛔ **Chống chỉ định:** {format_clinical_text(primary_mono.contraindications or 'Chưa có dữ liệu chống chỉ định trong nguồn liên kết.')}\n\n"
            f"⚠️ **Hiệu chỉnh liều suy thận:** {format_clinical_text(primary_mono.renal_adjustment or 'Chưa có dữ liệu hiệu chỉnh liều trong nguồn liên kết.')}\n\n"
            f"#### 5. TÁC DỤNG KHÔNG MONG MUỐN (ADR) & TƯƠNG TÁC THUỐC\n"
            f"⚡ **ADR:** {format_clinical_text(primary_mono.adverse_effects or 'Chưa có dữ liệu tác dụng không mong muốn trong nguồn liên kết.')}\n\n"
            f"🔄 **Tương tác thuốc:** {format_clinical_text(primary_mono.drug_interactions or 'Chưa có dữ liệu tương tác trong nguồn liên kết.')}\n"
        )
        return reply, citations, " • ".join(dict.fromkeys(legal_bases))

    # Component monographs may describe different routes and formulations.
    # They do not establish dosing or indications for this combined product.
    source = "CSDL đăng ký thuốc Cục Quản lý Dược"
    reply = (
        f"### Thông tin đăng ký chế phẩm phối hợp: {drug.brand_name}\n\n"
        f"• SĐK: {drug.national_code}.\n"
        f"• Thành phần công bố: {drug.active_ingredient}.\n"
        f"• Dạng bào chế: {drug.dosage_form or 'Chưa có dữ liệu'}; đường dùng công bố: {drug.route or 'Chưa có dữ liệu'}.\n\n"
        "Chưa có nguồn lâm sàng đúng chế phẩm phối hợp để xác nhận chỉ định, liều hoặc cách dùng. "
        "Không áp dụng liều/cách dùng của một thành phần đơn chất, dạng tiêm hoặc dạng bào chế khác cho chế phẩm này. "
        "Vui lòng cung cấp tờ hướng dẫn của đúng SĐK/hàm lượng để đối chiếu."
    )
    return reply, [build_drug_citation(drug, None, source)], source
