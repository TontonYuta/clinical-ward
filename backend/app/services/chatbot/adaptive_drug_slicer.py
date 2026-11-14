"""
Adaptive Clinical Drug Data Slicer (Part 2).
Extracts strictly scoped data slices from SQLite (DĐVN V monographs and DAV drugs)
based on query depth (OVERVIEW vs. DEEP_FACET) and maintains session context continuity.
"""
from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any, Tuple
import re
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.registry import DavNationalDrug, ClinicalDrugMonograph
from app.schemas.clinical_extraction_schema import ClinicalExtractionAnalysis
from app.services.chatbot.clinical_db_resolver import resolve_drug_entity_deterministic
from app.services.session_context import SessionState
from app.services.clinical_ddi_engine.full_catalog import find_all_interactions_for_drug


@dataclass
class SlicedClinicalEvidence:
    drug_name: str
    active_ingredient: str
    national_code: str
    dosage_form: str
    drug_class: str
    query_depth: str
    target_facets: List[str]
    core_indication: str = ""
    core_adult_dose: str = ""
    core_pediatric_dose: str = ""
    core_contraindication: str = ""
    core_adverse_effects: str = ""
    core_precautions: str = ""
    core_timing: str = ""
    facet_evidence: Dict[str, str] = field(default_factory=dict)
    raw_citations: List[Dict[str, Any]] = field(default_factory=list)
    source_label: str = "Dược thư Quốc gia Việt Nam"
    monograph: Optional[ClinicalDrugMonograph] = None
    drug: Optional[DavNationalDrug] = None
    evidence: List[Dict[str, Any]] = field(default_factory=list)


def _clean_text(val: Optional[str]) -> str:
    if not val:
        return ""
    text = re.sub(r"[\r\n]+", " ", str(val)).strip()
    return re.sub(r"\s+", " ", text)


def _extract_core_bullets(text: Optional[str], max_items: int = 1) -> str:
    if not text:
        return ""
    # Chuẩn hóa ngắt dòng: Nối các dòng ngắt giữa câu (wrapped lines từ bản scan PDF)
    lines = [l.strip().lstrip("•*-+ ") for l in str(text).splitlines() if l.strip()]
    if not lines:
        return ""

    merged_blocks = []
    current_block = []
    for line in lines:
        if current_block and (current_block[-1].endswith(':') or line.startswith(('•', '-', '*'))):
            merged_blocks.append(" ".join(current_block))
            current_block = []
        current_block.append(line)
        if line.endswith('.'):
            merged_blocks.append(" ".join(current_block))
            current_block = []
    if current_block:
        merged_blocks.append(" ".join(current_block))

    all_sentences = []
    for block in merged_blocks:
        # Bỏ qua nếu block chỉ là tiêu đề ngắn phân mục kết thúc bằng :
        if block.endswith(':') and len(block) < 30 and not any(c.isdigit() for c in block):
            continue
        parts = [p.strip() for p in re.split(r"(?<=[a-zA-ZÀ-ỹ\)])\.\s+(?=[A-ZÀ-Ỹ0-9•\-])", block) if len(p.strip()) > 8]
        if parts:
            all_sentences.extend(parts)
        elif len(block) > 8:
            all_sentences.append(block)

    # Ưu tiên các câu chứa dữ kiện định lượng hoặc hành động lâm sàng thực tế
    dosing_sentences = [s for s in all_sentences if re.search(r'\b(?:mg|g|ml|kg|lần|ngày|liều|tuổi|uống|tiêm|truyền)\b', s, re.I)]
    candidates = dosing_sentences if dosing_sentences else all_sentences

    cleaned = []
    for cand in candidates:
        clean_s = re.sub(r'^(?:[A-ZÀ-Ỹa-zà-ỹ\s,]+:\s*)+', '', cand).strip()
        if not clean_s or len(clean_s) < 10:
            clean_s = cand
        if clean_s and not clean_s.endswith('.'):
            clean_s += '.'
        cleaned.append(clean_s)

    return " • ".join(cleaned[:max_items]).strip()


def _extract_timing_from_monograph(monograph, matched) -> str:
    """Trích xuất động thời điểm uống và cách dùng từ chuyên luận Dược thư."""
    raw_time = getattr(monograph, "administration_timing", None) or ""
    if raw_time:
        return f"• **Thời điểm & Cách dùng theo Dược thư:** {_clean_text(raw_time)}"
    raw_prec = (monograph.precautions if monograph else None) or ""
    raw_adm = (monograph.adult_dosage if monograph else None) or (matched.adult_dosage if matched else "") or ""
    combined = f"{raw_prec}\n{raw_adm}"
    
    timing_keywords = ("trước ăn", "sau ăn", "lúc đói", "lúc no", "uống cùng", "thời điểm", "bữa ăn", "buổi sáng", "buổi tối", "uống nhiều nước", "nguyên viên", "cách xa", "uống sáng", "uống tối")
    sentences = [s.strip() for s in re.split(r'[.\n;]+', combined) if s.strip()]
    matched_sentences = [s for s in sentences if any(kw in s.lower() for kw in timing_keywords)]
    
    if matched_sentences:
        return "• **Thời điểm & Cách dùng theo Dược thư:**\n" + "\n".join(f"  * {s}." for s in matched_sentences[:4])
    if raw_adm:
        first_line = sentences[0] if sentences else _clean_text(raw_adm)[:150]
        return f"• **Cách dùng theo Dược thư:** {first_line}."
    return "• **Hướng dẫn chung:** Uống thuốc đúng liều lượng và khoảng cách thời gian theo chỉ định của bác sĩ điều trị."


def _extract_max_dosage_from_monograph(monograph, matched) -> str:
    """Trích xuất động giới hạn liều tối đa từ chuyên luận Dược thư."""
    raw_ad = (monograph.adult_dosage if monograph else None) or (matched.adult_dosage if matched else "") or ""
    raw_ped = (monograph.pediatric_dosage if monograph else None) or getattr(matched, "pediatric_dosage", None) or ""
    raw_over = (monograph.overdose_treatment if monograph else None) or ""
    combined = f"{raw_ad}\n{raw_ped}\n{raw_over}"
    
    max_keywords = ("tối đa", "không quá", "không được vượt", "giới hạn", "liều trần", "quá liều", "/24 giờ", "/ngày", "liều độc")
    sentences = [s.strip() for s in re.split(r'[.\n;]+', combined) if s.strip()]
    matched_sentences = [s for s in sentences if any(kw in s.lower() for kw in max_keywords)]
    
    if matched_sentences:
        return "• **Giới hạn liều theo Dược thư:**\n" + "\n".join(f"  * {s}." for s in matched_sentences[:4])
    return f"• **Khuyến cáo liều:** Tuân thủ chặt chẽ liều lượng đã kê đơn: {_clean_text(raw_ad)[:180]}..."


def _extract_alcohol_interaction_from_monograph(clean_brand: str, monograph, matched) -> str:
    """Trích xuất động cảnh báo tương tác rượu bia từ Dược thư."""
    raw_inter = (monograph.drug_interactions if monograph else None) or (matched.drug_interactions if matched else "") or ""
    raw_prec = (monograph.precautions if monograph else None) or ""
    combined = f"{raw_inter}\n{raw_prec}"
    
    alc_keywords = ("rượu", "bia", "cồn", "ethanol", "đồ uống có cồn")
    sentences = [s.strip() for s in re.split(r'[.\n;]+', combined) if s.strip()]
    matched_sentences = [s for s in sentences if any(kw in s.lower() for kw in alc_keywords)]
    
    if matched_sentences:
        return (
            f"• **Tương tác với Rượu/Cồn (Dược thư ghi nhận - Kỵ rượu bia):**\n"
            + "\n".join(f"  * {s}." for s in matched_sentences[:3])
            + f"\n• **Khuyến cáo an toàn:** Cần kiêng rượu bia (kỵ rượu) trong suốt thời gian điều trị bằng {clean_brand} để tránh tăng độc tính hoặc tương tác bất lợi."
        )
    return (
        f"• **Tương tác rượu bia (Kỵ rượu bia):** Trong Dược thư Quốc gia Việt Nam, chuyên luận {clean_brand} chưa ghi nhận tương tác đặc hiệu với rượu bia.\n"
        f"• **Khuyến cáo an toàn:** Nên hạn chế rượu bia (kỵ rượu) trong thời gian dùng thuốc để tránh ảnh hưởng đến chuyển hóa thuốc qua gan/thận và giảm hiệu quả điều trị."
    )


def _extract_adult_dosage_facet(monograph, matched) -> str:
    """Trích xuất liều người lớn từ chuyên luận Dược thư."""
    raw_ad = (monograph.adult_dosage if monograph else None) or (matched.adult_dosage if matched else "") or ""
    if not raw_ad:
        return "• **Liều dùng người lớn:** Tuân thủ theo chỉ định chuyên khoa của bác sĩ điều trị."
    from app.services.chatbot.conversational_clinical_engine import format_hierarchical_dosage
    formatted = format_hierarchical_dosage(str(raw_ad), "", is_detailed=True, target_audience="adult")
    if formatted:
        return "\n".join(formatted)
    return f"• **Liều dùng người lớn theo Dược thư:** {_clean_text(raw_ad)}"


def _extract_pediatric_dosage_facet(monograph, matched) -> str:
    """Trích xuất liều trẻ em từ chuyên luận Dược thư."""
    raw_ped = (monograph.pediatric_dosage if monograph else None) or getattr(matched, "pediatric_dosage", None) or ""
    if not raw_ped:
        return "• **Liều dùng trẻ em:** Tính liều theo cân nặng (mg/kg) hoặc diện tích da theo hướng dẫn của bác sĩ chuyên khoa nhi."
    from app.services.chatbot.conversational_clinical_engine import format_hierarchical_dosage
    formatted = format_hierarchical_dosage("", str(raw_ped), is_detailed=True, target_audience="pediatric")
    if formatted:
        return "\n".join(formatted)
    return f"• **Liều dùng cho Trẻ em (Nhi khoa) theo Dược thư:** {_clean_text(raw_ped)}"


def _extract_renal_facet(monograph, matched) -> str:
    """Trích xuất lưu ý chức năng thận từ Dược thư."""
    raw_renal = (monograph.renal_adjustment if monograph else None) or ""
    if raw_renal:
        return f"• **Hiệu chỉnh liều theo chức năng thận (Dược thư):** {_clean_text(raw_renal)}"
    raw_prec = (monograph.precautions if monograph else None) or ""
    raw_ad = (monograph.adult_dosage if monograph else None) or (matched.adult_dosage if matched else "") or ""
    sentences = [s.strip() for s in re.split(r'[.\n;]+', f"{raw_prec}\n{raw_ad}") if s.strip()]
    renal_s = [s for s in sentences if any(k in s.lower() for k in ("suy thận", "thận", "clcr", "creatinin"))]
    if renal_s:
        return "• **Lưu ý chức năng thận theo Dược thư:**\n" + "\n".join(f"  * {s}." for s in renal_s[:3])
    return "• **Khuyến cáo suy thận:** Thận trọng khi dùng cho bệnh nhân suy giảm chức năng thận; theo dõi ClCr định kỳ và điều chỉnh liều theo phác đồ."


def _extract_hepatic_facet(monograph, matched) -> str:
    """Trích xuất lưu ý chức năng gan từ Dược thư."""
    raw_hep = (monograph.hepatic_adjustment if monograph else None) or ""
    if raw_hep:
        return f"• **Hiệu chỉnh suy gan (Dược thư):** {_clean_text(raw_hep)}"
    raw_contra = (monograph.contraindications if monograph else None) or (matched.contraindications if matched else "") or ""
    raw_prec = (monograph.precautions if monograph else None) or ""
    sentences = [s.strip() for s in re.split(r'[.\n;]+', f"{raw_contra}\n{raw_prec}") if s.strip()]
    hep_s = [s for s in sentences if any(k in s.lower() for k in ("suy gan", "gan", "men gan"))]
    if hep_s:
        return "• **Lưu ý chức năng gan theo Dược thư:**\n" + "\n".join(f"  * {s}." for s in hep_s[:3])
    return "• **Khuyến cáo suy gan:** Thận trọng và theo dõi chức năng gan trong suốt đợt điều trị."


def _extract_adverse_effects_facet(clean_brand: str, monograph, matched) -> str:
    """Trích xuất tác dụng không mong muốn (ADR) và cảnh báo nguy hiểm từ Dược thư."""
    raw_adv = (monograph.adverse_effects if monograph else None) or (matched.adverse_effects if matched else "") or ""
    raw_prec = (monograph.precautions if monograph else None) or ""
    if raw_adv:
        sentences = [s.strip() for s in re.split(r'[.\n;]+', f"{raw_prec}\n{raw_adv}") if s.strip()]
        urgent_s = [s for s in sentences if any(k in s.lower() for k in ("ngừng ngay", "ngừng thuốc", "stevens-johnson", "lyell", "hoại tử", "quá mẫn"))]
        lines = []
        if urgent_s:
            lines.append("• **Lưu ý phản ứng nghiêm trọng (Dược thư):** " + ". ".join(urgent_s[:2]) + ".")
        lines.append(f"• **Tác dụng không mong muốn (ADR theo Dược thư):**\n{_clean_text(raw_adv)}")
        return "\n".join(lines)
    return "• **Tác dụng không mong muốn:** Hiện chưa ghi nhận tác dụng phụ nghiêm trọng trong dữ liệu chuẩn. Bác sĩ vui lòng theo dõi đáp ứng lâm sàng của người bệnh."


async def slice_clinical_drug_evidence(
    analysis: ClinicalExtractionAnalysis,
    db: AsyncSession,
    session: SessionState
) -> Tuple[Optional[SlicedClinicalEvidence], List[Dict[str, Any]], str]:
    """
    Trích xuất lát cắt dữ liệu từ CSDL dựa trên độ sâu truy vấn:
    1. Kế thừa thuốc nếu là câu hỏi nối tiếp (Follow-up deictic).
    2. Tra cứu chuẩn xác CSDL qua resolve_drug_entity_deterministic.
    3. Cắt lát thông tin động 100% không hardcode tên thuốc.
    """
    drug_candidate = ""
    if analysis.medications:
        drug_candidate = analysis.medications[0].surface_form
    elif analysis.is_followup_question and session.active_medication_name:
        drug_candidate = session.active_medication_name

    if not drug_candidate:
        return None, [], "missing_drug_context"

    resolved_rec, candidates = await resolve_drug_entity_deterministic(drug_candidate, db)
    if not resolved_rec:
        return None, candidates, "not_found"

    matched = resolved_rec.drug
    monograph = resolved_rec.monograph

    # Tên hiển thị động lấy trực tiếp từ CSDL / Chuyên luận
    active_inn = (matched.active_ingredient if matched else None) or (monograph.inn if monograph else "")
    if monograph and (monograph.inn or monograph.title):
        clean_brand = (monograph.title or monograph.inn).split("(")[0].strip().title()
    elif matched and matched.brand_name:
        clean_brand = matched.brand_name.split("(")[0].strip().title()
    else:
        clean_brand = drug_candidate.strip().title()

    session.set_active_medication(
        name=clean_brand,
        ingredient=active_inn,
        batch=matched.national_code if matched else "",
        stock="",
        location="",
        sdk=matched.national_code if matched else ""
    )

    query_depth = analysis.query_depth
    target_facets = analysis.target_facets
    source_label = (
        (monograph.source if monograph and monograph.source else matched.clinical_source)
        if (monograph or (matched and matched.clinical_source))
        else "Cục Quản lý Dược Việt Nam (Bộ Y Tế)"
    )

    evidence = SlicedClinicalEvidence(
        drug_name=clean_brand,
        active_ingredient=active_inn,
        national_code=(matched.national_code if matched else None) or "Đạt chuẩn DĐVN",
        dosage_form=(matched.dosage_form if matched else None) or "Đạt chuẩn DĐVN V",
        drug_class=(matched.drug_class if matched else None) or (monograph.drug_class if monograph else "Thuốc chuyên khoa"),
        query_depth=query_depth,
        target_facets=target_facets,
        source_label=source_label,
        monograph=monograph,
        drug=matched
    )
    if monograph and monograph.source_id and monograph.source_version:
        for field_name in ("indications", "adult_dosage", "pediatric_dosage", "contraindications", "precautions", "adverse_effects", "renal_adjustment", "hepatic_adjustment", "pregnancy_warning", "drug_interactions", "overdose_treatment", "antidote"):
            excerpt = getattr(monograph, field_name, None)
            if excerpt and str(excerpt).strip():
                evidence.evidence.append({
                    "evidence_id": f"monograph:{monograph.id}:{field_name}",
                    "evidence_type": "document_chunk",
                    "source_id": monograph.source_id,
                    "source_version": monograph.source_version,
                    "chunk_id": f"monograph:{monograph.id}:{field_name}",
                    "source_name": monograph.source or evidence.source_label,
                    "section": field_name,
                    "content": str(excerpt),
                })
    if matched and matched.source_id and matched.source_version:
        catalog_content = "\n".join(str(getattr(matched, field_name, "") or "") for field_name in ("brand_name", "active_ingredient", "national_code", "dosage_form", "concentration", "indications", "contraindications", "adult_dosage", "pediatric_dosage", "adverse_effects", "drug_interactions") if getattr(matched, field_name, None))
        if catalog_content:
            evidence.evidence.append({
                "evidence_id": f"registry:{matched.id}", "evidence_type": "document_chunk",
                "source_id": matched.source_id, "source_version": matched.source_version,
                "chunk_id": f"registry:{matched.id}", "source_name": matched.clinical_source or matched.source_id,
                "section": matched.brand_name, "content": catalog_content,
            })

    # 1. Bóc tách thông tin cho OVERVIEW
    raw_ind = (monograph.indications if monograph else None) or (matched.indications if matched else "") or ""
    raw_dose = (monograph.adult_dosage if monograph else None) or (matched.adult_dosage if matched else "") or ""
    raw_ped = (monograph.pediatric_dosage if monograph else None) or getattr(matched, "pediatric_dosage", None) or ""
    raw_contra = (monograph.contraindications if monograph else None) or (matched.contraindications if matched else "") or ""
    raw_adv = (monograph.adverse_effects if monograph else None) or (matched.adverse_effects if matched else "") or ""
    raw_prec = (monograph.precautions if monograph else None) or ""
    raw_timing = getattr(monograph, "administration_timing", None) or ""

    evidence.core_indication = _extract_core_bullets(raw_ind, max_items=1)
    evidence.core_adult_dose = _extract_core_bullets(raw_dose, max_items=1)
    evidence.core_pediatric_dose = _extract_core_bullets(raw_ped, max_items=1)
    evidence.core_contraindication = _extract_core_bullets(raw_contra, max_items=1)
    evidence.core_adverse_effects = _extract_core_bullets(raw_adv, max_items=1)
    evidence.core_precautions = _extract_core_bullets(raw_prec, max_items=1)
    if raw_timing:
        evidence.core_timing = _clean_text(raw_timing)

    if not (evidence.core_indication or evidence.core_adult_dose or evidence.core_contraindication):
        return None, None, "insufficient_evidence"

    # 2. Bóc tách dữ liệu cho DEEP_FACET động 100% từ CSDL
    facet_data: Dict[str, str] = {}

    # a) Thời điểm uống & Cách dùng
    if "timing_and_administration" in target_facets:
        facet_data["timing_and_administration"] = _extract_timing_from_monograph(monograph, matched)

    # b) Liều tối đa
    if "max_dosage" in target_facets:
        facet_data["max_dosage"] = _extract_max_dosage_from_monograph(monograph, matched)

    # c) Tương tác Rượu / Bia
    if "alcohol_interaction" in target_facets:
        facet_data["alcohol_interaction"] = _extract_alcohol_interaction_from_monograph(clean_brand, monograph, matched)

    # d) Hiệu chỉnh suy thận
    if "renal_adjustment" in target_facets:
        facet_data["renal_adjustment"] = _extract_renal_facet(monograph, matched)

    # e) Hiệu chỉnh suy gan
    if "hepatic_adjustment" in target_facets:
        facet_data["hepatic_adjustment"] = _extract_hepatic_facet(monograph, matched)

    # f) Thai kỳ & Cho con bú
    if "pregnancy_lactation" in target_facets:
        raw_preg = (monograph.pregnancy_warning if monograph else None) or ""
        facet_data["pregnancy_lactation"] = f"• **Cảnh báo thai kỳ & cho con bú:** {_clean_text(raw_preg) or 'Chỉ sử dụng khi lợi ích điều trị vượt trội nguy cơ đối với thai nhi hoặc trẻ bú mẹ.'}"

    # g0) Liều người lớn
    if "adult_dosage" in target_facets:
        facet_data["adult_dosage"] = _extract_adult_dosage_facet(monograph, matched)

    # g) Liều trẻ em
    if "pediatric_dosage" in target_facets:
        facet_data["pediatric_dosage"] = _extract_pediatric_dosage_facet(monograph, matched)

    # h) Chống chỉ định
    if "contraindications" in target_facets:
        facet_data["contraindications"] = f"• **Chống chỉ định:** {_clean_text(raw_contra) or 'Mẫn cảm với bất kỳ thành phần nào của thuốc.'}"

    # i) Tương tác thuốc
    if "drug_interactions" in target_facets:
        ddis = find_all_interactions_for_drug(clean_brand)
        ddi_lines = []
        for d in ddis[:3]:
            ddi_lines.append(f"• **{d.get('partner')}** ({d.get('severity')}): {d.get('consequence')} -> {d.get('action')}")
        if ddi_lines:
            facet_data["drug_interactions"] = "\n".join(ddi_lines)
        else:
            raw_inter = (monograph.drug_interactions if monograph else None) or (matched.drug_interactions if matched else "") or ""
            facet_data["drug_interactions"] = f"• **Tương tác đáng chú ý (Dược thư):** {_clean_text(raw_inter)[:300] or 'Chưa ghi nhận tương tác chống chỉ định nguy hiểm theo Quyết định 5948/QĐ-BYT.'}"

    # j) Tác dụng không mong muốn (ADR)
    if "adverse_effects" in target_facets:
        facet_data["adverse_effects"] = _extract_adverse_effects_facet(clean_brand, monograph, matched)

    # k) Chỉ định
    if "indications" in target_facets:
        facet_data["indications"] = f"• **Chỉ định điều trị:** {_clean_text(raw_ind) or 'Theo phác đồ điều trị chuyên khoa của bác sĩ.'}"

    # l) Hoạt chất & Thành phần
    if "ingredient" in target_facets:
        facet_data["ingredient"] = f"• **Hoạt chất:** {active_inn}\n• **Phân nhóm:** {evidence.drug_class}\n• **Dạng bào chế:** {evidence.dosage_form}"

    # m) Theo dõi & Xét nghiệm
    if "monitoring" in target_facets:
        raw_prec = (monograph.precautions if monograph else None) or ""
        facet_data["monitoring"] = f"• **Theo dõi & Giám sát lâm sàng:** {_clean_text(raw_prec)[:250] or 'Theo dõi đáp ứng điều trị và các chỉ số xét nghiệm định kỳ.'}"

    # n) Nếu là truy vấn chi tiết toàn diện (DETAILED) hoặc rỗng facet ở lượt con
    if query_depth == "DETAILED" or (not facet_data and not target_facets and query_depth != "OVERVIEW"):
        if raw_ind:
            facet_data["indications"] = f"• **Chỉ định điều trị:** {_clean_text(raw_ind)}"
        if raw_dose:
            facet_data["adult_dosage"] = _extract_adult_dosage_facet(monograph, matched)
        if raw_ped:
            facet_data["pediatric_dosage"] = _extract_pediatric_dosage_facet(monograph, matched)
        facet_data["timing_and_administration"] = _extract_timing_from_monograph(monograph, matched)
        if raw_contra:
            facet_data["contraindications"] = f"• **Chống chỉ định:** {_clean_text(raw_contra)}"
        if raw_adv:
            facet_data["adverse_effects"] = _extract_adverse_effects_facet(clean_brand, monograph, matched)
        if hasattr(monograph, "overdose_treatment") and getattr(monograph, "overdose_treatment"):
            facet_data["overdose_treatment"] = f"• **Xử trí quá liều & Giải độc:** {_clean_text(monograph.overdose_treatment)}"
        evidence.target_facets = list(facet_data.keys())

    evidence.facet_evidence = facet_data
    return evidence, [], "ok"
