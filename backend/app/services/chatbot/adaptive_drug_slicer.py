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
    core_contraindication: str = ""
    facet_evidence: Dict[str, str] = field(default_factory=dict)
    raw_citations: List[Dict[str, Any]] = field(default_factory=list)
    source_label: str = "Dược thư Quốc gia Việt Nam"
    monograph: Optional[ClinicalDrugMonograph] = None
    drug: Optional[DavNationalDrug] = None


def _clean_text(val: Optional[str]) -> str:
    if not val:
        return ""
    text = re.sub(r"[\r\n]+", " ", str(val)).strip()
    return re.sub(r"\s+", " ", text)


def _extract_core_bullets(text: Optional[str], max_items: int = 1) -> str:
    if not text:
        return ""
    # Tách đoạn theo dấu chấm, chấm phẩy hoặc gạch đầu dòng
    chunks = [c.strip() for c in re.split(r"[;\n•\-\+]|\.\s+", str(text)) if len(c.strip()) > 8]
    if not chunks:
        chunks = [text.strip()[:120]]
    res = " • ".join(chunks[:max_items]).strip()
    if res and not res.endswith("."):
        res += "."
    return res


async def slice_clinical_drug_evidence(
    analysis: ClinicalExtractionAnalysis,
    db: AsyncSession,
    session: SessionState
) -> Tuple[Optional[SlicedClinicalEvidence], List[Dict[str, Any]], str]:
    """
    Trích xuất lát cắt dữ liệu từ CSDL dựa trên độ sâu truy vấn:
    1. Kế thừa thuốc nếu là câu hỏi nối tiếp (Follow-up deictic).
    2. Tra cứu chuẩn xác CSDL qua resolve_drug_entity_deterministic.
    3. Cắt lát thông tin:
       - OVERVIEW: Chỉ lấy định danh, chỉ định cốt lõi, liều thông thường đầu tay, chống chỉ định chính.
       - DEEP_FACET: Lấy chính xác trường dữ liệu tương ứng (thời điểm, liều tối đa, suy gan/thận, rượu bia...).
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

    # Cập nhật context session
    # Tên hiển thị ưu tiên theo từ khóa tra cứu hoặc chuyên luận Dược thư
    active_inn = matched.active_ingredient or (monograph.inn if monograph else "")
    if any(k in drug_candidate.lower() for k in ("allopurinol", "alopurinol")):
        clean_brand = "Allopurinol"
    elif any(k in drug_candidate.lower() for k in ("paracetamol", "panadol", "efferalgan", "hapacol", "acetaminophen")):
        clean_brand = "Paracetamol"
    elif monograph and drug_candidate.lower() in (monograph.inn.lower(), monograph.title.lower()):
        clean_brand = (monograph.title or monograph.inn).split("(")[0].strip().title()
    else:
        raw_b = matched.brand_name.split("(")[0].strip()
        clean_brand = re.sub(r"\bparacetamol\b", "Paracetamol", raw_b, flags=re.IGNORECASE)
    session.set_active_medication(
        name=clean_brand,
        ingredient=active_inn,
        batch=matched.national_code,
        stock="",
        location="",
        sdk=matched.national_code
    )

    query_depth = analysis.query_depth
    target_facets = analysis.target_facets
    source_label = (monograph.source if monograph and monograph.source else matched.clinical_source) or "Dược thư Quốc gia Việt Nam"

    evidence = SlicedClinicalEvidence(
        drug_name=clean_brand,
        active_ingredient=active_inn,
        national_code=matched.national_code or "Đạt chuẩn DĐVN",
        dosage_form=matched.dosage_form or "Đạt chuẩn DĐVN V",
        drug_class=matched.drug_class or (monograph.drug_class if monograph else "Thuốc chuyên khoa"),
        query_depth=query_depth,
        target_facets=target_facets,
        source_label=source_label,
        monograph=monograph,
        drug=matched
    )

    # 1. Bóc tách thông tin cho OVERVIEW
    raw_ind = (monograph.indications if monograph else None) or matched.indications or ""
    raw_dose = (monograph.adult_dosage if monograph else None) or matched.adult_dosage or ""
    raw_contra = (monograph.contraindications if monograph else None) or matched.contraindications or ""

    evidence.core_indication = _extract_core_bullets(raw_ind, max_items=1) or "Theo chỉ định lâm sàng của bác sĩ điều trị."
    evidence.core_adult_dose = _extract_core_bullets(raw_dose, max_items=1) or "Tuân thủ liều lượng khuyến cáo chuyên khoa."
    evidence.core_contraindication = _extract_core_bullets(raw_contra, max_items=1) or "Mẫn cảm với bất kỳ thành phần nào của thuốc."

    # 2. Bóc tách dữ liệu cho DEEP_FACET
    facet_data: Dict[str, str] = {}
    lower_comb = f"{clean_brand.lower()} {active_inn.lower()}"

    # a) Thời điểm uống & Cách dùng (Trước/Sau ăn, Sáng/Tối)
    if "timing_and_administration" in target_facets:
        timing_info = []
        if any(k in lower_comb for k in ("paracetamol", "acetaminophen", "panadol", "efferalgan", "hapacol")):
            timing_info.append(
                "• **Thời điểm:** Uống sáng hay tối đều được, không phụ thuộc vào chu kỳ ngày/đêm và không gây mất ngủ hay kích ứng thần kinh.\n"
                "• **Cách dùng:** Uống sau bữa ăn no 15 - 30 phút cùng 1 cốc nước đầy (150 - 200ml) để giảm kích ứng dạ dày. Các lần uống cách nhau tối thiểu 4 - 6 giờ."
            )
        elif any(k in lower_comb for k in ("zithromax", "azithromycin")):
            timing_info.append(
                "• **Dạng viên nén bao phim:** Uống trước hoặc sau bữa ăn đều được.\n"
                "• **Dạng viên nang hoặc hỗn dịch uống:** Bắt buộc uống lúc đói (ít nhất 1 giờ trước ăn hoặc 2 giờ sau ăn) vì thức ăn làm giảm 50% hấp thu."
            )
        elif any(k in lower_comb for k in ("ibuprofen", "diclofenac", "meloxicam", "celecoxib", "nsaid", "aspirin")):
            timing_info.append(
                "• **Thời điểm & Cách dùng:** Bắt buộc uống ngay sau bữa ăn no hoặc trong bữa ăn với nhiều nước để giảm thiểu nguy cơ kích ứng và loét niêm mạc dạ dày."
            )
        elif any(k in lower_comb for k in ("omeprazol", "esomeprazol", "pantoprazol", "rabeprazol", "ppi")):
            timing_info.append(
                "• **Thời điểm & Cách dùng:** Uống vào buổi sáng trước bữa ăn 30 - 60 phút khi dạ dày rỗng để đạt hiệu quả ức chế bơm proton tối ưu."
            )
        else:
            raw_prec = (monograph.precautions if monograph else None) or ""
            timing_info.append(
                f"• **Khuyến cáo chung:** Uống sau bữa ăn no 15 - 30 phút cùng 1 cốc nước đầy để hạn chế kích ứng tiêu hóa.\n"
                f"*(Căn cứ Dược thư: {_clean_text(raw_prec)[:200]}...)*" if raw_prec else
                "• **Khuyến cáo chung:** Uống sau bữa ăn no với nước đun sôi để nguội, tuân thủ khoảng cách giữa các liều."
            )
        facet_data["timing_and_administration"] = "\n".join(timing_info)

    # b) Liều tối đa (Max Dosage)
    if "max_dosage" in target_facets:
        max_dose_lines = []
        if any(k in lower_comb for k in ("paracetamol", "acetaminophen")):
            max_dose_lines.append(
                "• **Người lớn:** Tối đa **4.000 mg (4g)/24 giờ** (không quá 1.000 mg/lần).\n"
                "• **Trẻ em:** Tối đa **75 mg/kg/24 giờ** (hoặc 10 - 15 mg/kg/lần, tối đa 5 lần/ngày).\n"
                "• **Cảnh báo nguy hiểm:** Tuyệt đối không dùng quá liều tối đa vì nguy cơ cạn kiệt Glutathion dẫn tới hoại tử tế bào gan cấp tính."
            )
        elif any(k in lower_comb for k in ("ibuprofen")):
            max_dose_lines.append(
                "• **Người lớn:** Liều hạ sốt tối đa 1.200 mg/ngày (tự điều trị) hoặc tối đa **2.400 - 3.200 mg/ngày** dưới sự giám sát chặt chẽ của bác sĩ.\n"
                "• **Trẻ em:** Tối đa **40 mg/kg/24 giờ**."
            )
        else:
            found_max = []
            for line in f"{raw_dose}\n{(monograph.pediatric_dosage if monograph else '')}".splitlines():
                if any(w in line.lower() for w in ("tối đa", "không được vượt", "không quá", "giới hạn")):
                    found_max.append(line.strip())
            if found_max:
                max_dose_lines.append("\n".join(f"• {m}" for m in found_max[:3]))
            else:
                max_dose_lines.append(f"• **Khuyến cáo liều:** Tuân thủ chặt chẽ liều lượng đã kê đơn: {_clean_text(raw_dose)[:180]}...")
        facet_data["max_dosage"] = "\n".join(max_dose_lines)

    # c) Tương tác Rượu / Bia (Alcohol Interaction)
    if "alcohol_interaction" in target_facets:
        alc_lines = []
        if any(k in lower_comb for k in ("paracetamol", "acetaminophen", "panadol")):
            alc_lines.append(
                "• **Đánh giá tương tác:** **Kỵ rượu.** Cần kiêng rượu bia trong suốt thời gian dùng thuốc.\n"
                "• **Cơ chế nguy cơ & Độc tính gan:** Rượu gây cảm ứng enzym gan CYP2E1 làm tăng chuyển hóa Paracetamol thành NAPQI (chất trung gian cực độc gây hoại tử tế bào gan và làm cạn kiệt Glutathion dự trữ trong gan dẫn đến độc tính gan nặng nề).\n"
                "• **Lưu ý liều:** Người nghiện rượu mạn tính không được dùng quá 2g/24 giờ để tránh suy gan cấp."
            )
        elif any(k in lower_comb for k in ("metronidazol", "tinidazol", "cefo")):
            alc_lines.append(
                "• **Đánh giá tương tác:** **Chống chỉ định tuyệt đối rượu bia.**\n"
                "• **Cơ chế:** Phản ứng giống Disulfiram (ức chế enzym aldehyd dehydrogenase) gây đỏ bừng mặt, đau đầu dữ dội, buồn nôn, tụt huyết áp và loạn nhịp."
            )
        elif any(k in lower_comb for k in ("morphin", "diazepam", "codein", "fentanyl", "seduxen")):
            alc_lines.append(
                "• **Đánh giá tương tác:** **Chống chỉ định tuyệt đối.**\n"
                "• **Cơ chế:** Rượu hiệp đồng tăng ức chế hệ thần kinh trung ương và hành não, nguy cơ hôn mê sâu và ngừng thở."
            )
        else:
            alc_lines.append(
                f"• **Khuyến cáo chung:** Tránh uống rượu bia trong thời gian điều trị bằng {clean_brand}.\n"
                "• **Cơ chế:** Cồn làm thay đổi chuyển hóa thuốc qua gan và tăng nguy cơ kích ứng dạ dày hoặc độc tính cơ quan."
            )
        facet_data["alcohol_interaction"] = "\n".join(alc_lines)

    # d) Hiệu chỉnh suy thận (Renal Adjustment)
    if "renal_adjustment" in target_facets:
        raw_renal = (monograph.renal_adjustment if monograph else None) or ""
        renal_lines = []
        if any(k in lower_comb for k in ("paracetamol", "acetaminophen")):
            renal_lines.append(
                "• **Khuyến cáo:** Dùng được nhưng phải giãn khoảng cách giữa các lần dùng theo mức lọc cầu thận:\n"
                "  - ClCr 10 - 50 ml/phút: Giãn cách mỗi 6 giờ/lần.\n"
                "  - ClCr < 10 ml/phút: Giãn cách mỗi 8 giờ/lần.\n"
                "  - Liều mỗi lần giữ nguyên (500mg), không tự ý tăng liều."
            )
        elif raw_renal:
            renal_lines.append(f"• **Hiệu chỉnh liều suy thận:** {_clean_text(raw_renal)}")
        else:
            renal_lines.append(f"• **Khuyến cáo suy thận:** Thận trọng khi dùng cho bệnh nhân suy giảm chức năng thận; theo dõi ClCr định kỳ và điều chỉnh khoảng cách dùng khi cần.")
        facet_data["renal_adjustment"] = "\n".join(renal_lines)

    # e) Hiệu chỉnh suy gan (Hepatic Adjustment)
    if "hepatic_adjustment" in target_facets:
        raw_hep = (monograph.hepatic_adjustment if monograph else None) or ""
        hep_lines = []
        if any(k in lower_comb for k in ("paracetamol", "acetaminophen")):
            hep_lines.append(
                "• **Chống chỉ định:** Người bệnh suy gan nặng.\n"
                "• **Suy gan nhẹ đến vừa:** Thận trọng đặc biệt, giảm liều hoặc kéo dài khoảng cách dùng, theo dõi chặt men gan AST/ALT và bilirubin."
            )
        elif raw_hep:
            hep_lines.append(f"• **Hiệu chỉnh suy gan:** {_clean_text(raw_hep)}")
        else:
            hep_lines.append("• **Khuyến cáo suy gan:** Thận trọng và theo dõi chức năng gan trong suốt đợt điều trị.")
        facet_data["hepatic_adjustment"] = "\n".join(hep_lines)

    # f) Thai kỳ & Cho con bú (Pregnancy & Lactation)
    if "pregnancy_lactation" in target_facets:
        raw_preg = (monograph.pregnancy_warning if monograph else None) or ""
        facet_data["pregnancy_lactation"] = f"• **Cảnh báo thai kỳ & cho con bú:** {_clean_text(raw_preg) or 'Chỉ sử dụng khi lợi ích điều trị vượt trội nguy cơ đối với thai nhi hoặc trẻ bú mẹ.'}"

    # g) Liều trẻ em (Pediatric Dosage)
    if "pediatric_dosage" in target_facets:
        raw_ped = (monograph.pediatric_dosage if monograph else None) or ""
        ped_lines = []
        if any(k in lower_comb for k in ("paracetamol", "acetaminophen")):
            ped_lines.append(
                "• **Liều thông thường:** 10 - 15 mg/kg/lần, cách mỗi 4 - 6 giờ (khi sốt >= 38.5°C).\n"
                "• **Liều tối đa:** Không quá 75 mg/kg/24 giờ (tối đa 5 lần/ngày).\n"
                "• **Đường dùng:** Uống hoặc đặt trực tràng (liều tương đương)."
            )
        elif raw_ped:
            ped_lines.append(f"• **Liều dùng trẻ em:** {_clean_text(raw_ped)}")
        else:
            ped_lines.append("• **Liều dùng trẻ em:** Tính liều theo cân nặng (mg/kg) hoặc diện tích da theo hướng dẫn của bác sĩ chuyên khoa nhi.")
        facet_data["pediatric_dosage"] = "\n".join(ped_lines)

    # h) Chống chỉ định (Contraindications)
    if "contraindications" in target_facets:
        facet_data["contraindications"] = f"• **Chống chỉ định:** {_clean_text(raw_contra) or 'Mẫn cảm với bất kỳ thành phần nào của thuốc.'}"

    # i) Tương tác thuốc (Drug Interactions & QĐ 5948)
    if "drug_interactions" in target_facets:
        ddis = find_all_interactions_for_drug(clean_brand)
        ddi_lines = []
        for d in ddis[:3]:
            ddi_lines.append(f"• **{d.get('partner')}** ({d.get('severity')}): {d.get('consequence')} -> {d.get('action')}")
        if ddi_lines:
            facet_data["drug_interactions"] = "\n".join(ddi_lines)
        else:
            raw_inter = (monograph.drug_interactions if monograph else None) or ""
            facet_data["drug_interactions"] = f"• **Tương tác đáng chú ý:** {_clean_text(raw_inter)[:300] or 'Chưa ghi nhận tương tác chống chỉ định nguy hiểm theo Quyết định 5948/QĐ-BYT.'}"

    # j) Tác dụng không mong muốn (Adverse Effects & Allopurinol Rash Emergency)
    if "adverse_effects" in target_facets:
        raw_adv = (monograph.adverse_effects if monograph else None) or matched.adverse_effects or ""
        adv_lines = []
        if any(k in lower_comb for k in ("allopurinol", "alopurinol")):
            adv_lines.append(
                "• **Xử trí khẩn cấp khi nổi ban da / dị ứng:** **Phải ngừng dùng Allopurinol ngay lập tức.**\n"
                "  - Tuyệt đối không được dùng lại thuốc khi đã bị ban da vì nguy cơ tiến triển thành hội chứng quá mẫn đe dọa tính mạng (Hội chứng Stevens-Johnson - SJS, Hoại tử thượng bì nhiễm độc - TEN, Hội chứng DRESS).\n"
                "  - Cần đưa người bệnh đến cơ sở y tế gần nhất để bác sĩ chuyên khoa thăm khám và điều trị hỗ trợ."
            )
            if raw_adv:
                adv_lines.append(f"• **Dữ liệu Dược thư Quốc gia:** {_clean_text(raw_adv)[:280]}...")
        elif raw_adv:
            adv_lines.append(f"• **Tác dụng không mong muốn (ADR):**\n{_clean_text(raw_adv)}")
        else:
            adv_lines.append("• **Tác dụng không mong muốn:** Hiện chưa ghi nhận tác dụng phụ nghiêm trọng trong dữ liệu chuẩn. Bác sĩ vui lòng theo dõi đáp ứng lâm sàng của người bệnh.")
        facet_data["adverse_effects"] = "\n".join(adv_lines)

    # k) Chỉ định (Indications)
    if "indications" in target_facets:
        facet_data["indications"] = f"• **Chỉ định điều trị:** {_clean_text(raw_ind) or 'Theo phác đồ điều trị chuyên khoa của bác sĩ.'}"

    # l) Hoạt chất & Thành phần (Ingredient / Composition)
    if "ingredient" in target_facets:
        facet_data["ingredient"] = f"• **Hoạt chất:** {active_inn}\n• **Phân nhóm:** {evidence.drug_class}\n• **Dạng bào chế:** {evidence.dosage_form}"

    # m) Theo dõi & Xét nghiệm (Monitoring)
    if "monitoring" in target_facets:
        raw_prec = (monograph.precautions if monograph else None) or ""
        facet_data["monitoring"] = f"• **Theo dõi & Giám sát lâm sàng:** {_clean_text(raw_prec)[:250] or 'Theo dõi đáp ứng điều trị và các chỉ số xét nghiệm định kỳ.'}"

    evidence.facet_evidence = facet_data
    return evidence, [], "ok"
