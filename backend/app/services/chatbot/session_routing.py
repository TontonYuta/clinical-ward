import re
from sqlalchemy import select, or_, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas.copilot import CopilotResponse
from app.models.registry import DavNationalDrug, ClinicalDrugMonograph
from app.services.copilot_catalog import find_matched_med
from app.services.copilot_drug_lookup import extract_drug_keywords, lookup_drug_authoritative
from app.services.clinical_ddi_engine.entity_resolution import resolve_registered_medications
from app.services.clinical_ddi_engine.drug_registry import DRUG_REGISTRY

CLINICAL_NON_DRUG_TERMS = {
    "sốt", "hạ sốt", "đau đầu", "đau bụng", "ung thư", "khó thở", "đột quỵ",
    "cấp cứu", "thuốc", "bệnh nhân", "người bệnh", "hàng ngày", "hàng tuần",
    "tại", "ở", "tăng", "giảm", "hạ", "hen", "phế quản", "phổi", "huyết áp",
    "đường huyết", "tiểu đường", "đái tháo đường", "suy thận", "suy gan", "suy tim",
    "thai", "phụ nữ", "có thai", "mang thai", "thai kỳ", "cho con bú", "trẻ em",
    "sơ sinh", "người lớn", "cao tuổi", "quy chế", "quy định", "thông tư", "nghị định",
    "tủ trực", "ca trực", "kho", "tồn kho", "nhiễm khuẩn", "nhiễm trùng", "vi khuẩn",
    "viêm dạ dày", "loét dạ dày", "dị ứng", "sốc phản vệ", "phản vệ", "tiêu chảy", "táo bón",
    "co thắt", "giãn cơ", "kháng sinh", "chống viêm", "giảm đau",
    "tóm tắt", "tom tat", "chi tiết", "chi tiet", "đầy đủ", "day du", "hồ sơ", "ho so",
    "đây", "day", "nhất", "nhat", "tóm tắt mà", "đầy đủ nhất", "chi tiết nhất"
}

TIMING_TERMS = (
    "sáng hay tối", "uống sáng", "uống tối", "lúc đói", "lúc no",
    "trước ăn", "sau ăn", "bao lâu thì tiêm", "tiêm nhắc lại",
    "tần suất", "mỗi bao lâu", "đường dùng", "cách pha",
)

FIELD_ONLY_TERMS = (
    "chống chỉ định", "tác dụng phụ", "tác dụng không mong muốn",
    "liều dùng", "liều tối đa", "thành phần", "hoạt chất",
    "chỉ định", "công dụng", "thông tin thuốc", "liều tối đa",
    "còn liều", "sáng hay tối", "uống sáng", "uống tối",
    "lúc đói", "lúc no", "trước ăn", "sau ăn", "bao lâu thì tiêm",
    "tiêm nhắc lại", "tần suất", "mỗi bao lâu", "đường dùng",
    "cách pha", "gây nghiện", "lệ thuộc", "suy thận", "suy gan",
    "độc tính", "thuốc đó", "thuốc này", "nó có",
    "của thuốc này", "của thuốc đó",
    "thông tin chi tiết đầy đủ", "thông tin chi tiết", "thông tin đầy đủ",
    "tóm tắt thông tin thuốc đó", "tóm tắt thông tin", "tóm tắt",
    "hồ sơ đầy đủ", "hồ sơ chi tiết", "toàn bộ thông tin",
    "trẻ em", "cho trẻ em", "nhi khoa", "cho bé", "trẻ nhỏ",
)

def check_renal_adjustment_request(query: str, lower_query: str) -> CopilotResponse | None:
    is_renal = any(t in lower_query for t in ("suy thận", "chức năng thận", "egfr", "crcl", "creatinine", "chỉnh liều"))
    if not is_renal:
        return None
    subject = any(t in lower_query for t in ("bệnh nhân", "người bệnh", "hồ sơ", "bệnh án", "bn-", "bn "))
    name_match = re.search(r"(?<!\w)(?:[A-ZÀ-ỸĐ][\wÀ-ỹĐđ'-]+\s+){1,4}[A-ZÀ-ỸĐ][\wÀ-ỹĐđ'-]+(?!\w)", query)
    has_bn_token = any(token in lower_query for token in ("bn-", "bn "))

    if subject and not name_match and not has_bn_token:
        return CopilotResponse(
            intent="CLINICAL_CASE_CLARIFICATION",
            reply_text="Vui lòng cung cấp họ tên hoặc mã người bệnh và tên thuốc cần rà soát để đánh giá chức năng thận.",
            answer_type="clarification", source_status="missing_patient_identifier",
            confidence=1.0, abstention_reason="Câu hỏi có nhắc người bệnh nhưng thiếu định danh cụ thể",
        )

    has_current_drug = find_matched_med(lower_query) is not None or any(
        len(alias) >= 4 and alias.casefold() in lower_query
        for entry in DRUG_REGISTRY.values() for alias in entry.get("aliases", [])
    )

    if subject and name_match and not has_current_drug:
        return CopilotResponse(
            intent="CLINICAL_CASE_CLARIFICATION",
            reply_text="Đã nhận diện người bệnh được nêu. Vui lòng cho biết tên thuốc cần rà soát; hệ thống chưa tra hồ sơ hay đưa ra khuyến cáo liều khi chưa có thuốc cụ thể.",
            answer_type="clarification", source_status="missing_drug_context",
            confidence=1.0, abstention_reason="Thiếu tên thuốc trong lượt hiện tại",
        )

    if subject and any(p in lower_query for p in ("có dùng được không", "dùng được không")) and not has_current_drug:
        return CopilotResponse(
            intent="CLINICAL_CASE_CLARIFICATION",
            reply_text="Để đánh giá suy thận, vui lòng cung cấp tên hoặc mã người bệnh và tên thuốc cần rà soát. Không sử dụng hồ sơ bệnh nhân đang chọn nếu chưa được nêu rõ trong câu hỏi.",
            answer_type="clarification", source_status="missing_patient_or_drug_context",
            confidence=1.0, abstention_reason="Thiếu định danh ca bệnh hoặc tên thuốc trong lượt hiện tại",
        )
    return None

async def find_dav_candidate_drug(lower_query: str, db: AsyncSession) -> tuple[str, bool]:
    cand_drug = extract_drug_keywords(lower_query)
    if not cand_drug or len(cand_drug) < 3 or cand_drug in CLINICAL_NON_DRUG_TERMS or any(b == cand_drug for b in CLINICAL_NON_DRUG_TERMS):
        return "", False
    active_cond = (
        func.lower(DavNationalDrug.active_ingredient).like(f"%{cand_drug}%")
        if len(cand_drug) >= 4 else
        func.lower(DavNationalDrug.active_ingredient).like(f"{cand_drug} %")
    )
    cand_res = await db.execute(
        select(DavNationalDrug.id).where(or_(
            func.lower(DavNationalDrug.brand_name) == cand_drug,
            func.lower(DavNationalDrug.brand_name).like(f"{cand_drug} %"),
            func.lower(DavNationalDrug.brand_name).like(f"% {cand_drug}"),
            active_cond
        )).limit(1)
    )
    if cand_res.scalar_one_or_none() is not None:
        return cand_drug, True
    mono_res = await db.execute(
        select(ClinicalDrugMonograph.id).where(or_(
            func.lower(ClinicalDrugMonograph.inn) == cand_drug,
            func.lower(ClinicalDrugMonograph.inn).like(f"{cand_drug} %"),
            func.lower(ClinicalDrugMonograph.inn).like(f"% {cand_drug}%"),
            func.lower(ClinicalDrugMonograph.title).like(f"%{cand_drug}%")
        )).limit(1)
    )
    if mono_res.scalar_one_or_none() is not None:
        return cand_drug, True
    if len(cand_drug.split()) > 1:
        last_tok = cand_drug.split()[-1]
        if len(last_tok) >= 4 and last_tok not in CLINICAL_NON_DRUG_TERMS and last_tok not in ("đây", "day", "nhất", "nhat", "kia", "đó", "do", "vừa", "rồi", "cơ", "mà"):
            cand_res2 = await db.execute(
                select(DavNationalDrug.id).where(or_(
                    func.lower(DavNationalDrug.brand_name) == last_tok,
                    func.lower(DavNationalDrug.brand_name).like(f"{last_tok} %"),
                    func.lower(DavNationalDrug.brand_name).like(f"% {last_tok}"),
                    func.lower(DavNationalDrug.active_ingredient).like(f"%{last_tok}%")
                )).limit(1)
            )
            if cand_res2.scalar_one_or_none() is not None:
                return last_tok, True
            mono_res2 = await db.execute(
                select(ClinicalDrugMonograph.id).where(or_(
                    func.lower(ClinicalDrugMonograph.inn) == last_tok,
                    func.lower(ClinicalDrugMonograph.inn).like(f"{last_tok} %"),
                    func.lower(ClinicalDrugMonograph.inn).like(f"% {last_tok}%"),
                    func.lower(ClinicalDrugMonograph.title).like(f"%{last_tok}%")
                )).limit(1)
            )
            if mono_res2.scalar_one_or_none() is not None:
                return last_tok, True
    return cand_drug, False

def build_insufficient_formulation_response(med_name: str, session_id: str) -> CopilotResponse:
    return CopilotResponse(
        intent="MEDICATION_LOOKUP_CLARIFICATION",
        reply_text=(
            f"Câu hỏi về thời điểm hoặc cách dùng của {med_name} cần được đối chiếu theo đúng dạng bào chế, hàm lượng và chỉ định. "
            "Vui lòng cung cấp chế phẩm cụ thể hoặc chỉ định để tra cứu hướng dẫn đã được xác thực."
        ),
        answer_type="clarification",
        source_status="insufficient_formulation_context",
        session_id=session_id,
        confidence=1.0,
    )

def check_contextless_clinical_question(lower_query: str) -> CopilotResponse | None:
    is_general_consultation = any(term in lower_query for term in (
        "thuốc điều trị", "thuốc trị", "thuốc hạ", "thuốc chữa", "thuốc dùng cho",
        "hướng dẫn điều trị", "phác đồ điều trị", "nhóm thuốc", "lựa chọn thuốc",
        "huyết áp", "tăng huyết áp", "hạ huyết áp", "đái tháo đường", "tiểu đường"
    ))
    if is_general_consultation:
        return None

    context_required_terms = (
        "liều tối đa", "liều dùng", "liều lượng", "chống chỉ định",
        "tác dụng phụ", "tác dụng không mong muốn", "uống lúc đói",
        "lúc no", "suy thận", "suy gan", "phụ nữ có thai",
        "cho con bú", "thuốc đó", "thuốc này", "thuốc này kỵ",
        "có vỏ ống", "cách bảo quản", "bao lâu thì dừng",
        "tiêm bắp được", "pha chung", "thuốc giải độc",
        "hàng ngày hay hàng tuần", "sáng hay tối", "trước ăn bao lâu",
        "tác dụng kéo dài bao lâu", "dấu hiệu ngộ độc", "gây nghiện không",
        "liều bolus", "tiêm nhắc lại", "tốc độ truyền",
    )
    is_contextless_clinical = any(term in lower_query for term in context_required_terms)
    is_contextless_stock = any(term in lower_query for term in ("có trong tủ trực không", "còn trong tủ trực", "còn thuốc không"))
    if is_contextless_clinical or is_contextless_stock:
        intent = "CLINICAL_SAFE_ABSTENTION" if lower_query.strip().rstrip("?.! ") in {
            "còn chống chỉ định", "chống chỉ định gì nữa không"
        } else "MEDICATION_LOOKUP_CLARIFICATION"
        return CopilotResponse(
            intent=intent,
            reply_text="Mình chưa xác định được thuốc cần tra cứu. Vui lòng nêu tên thuốc hoặc hoạt chất (và hàm lượng/dạng dùng nếu liên quan) để trả lời chính xác.",
            answer_type="safe_abstention" if intent == "CLINICAL_SAFE_ABSTENTION" else "clarification",
            source_status="missing_medication_context",
            confidence=1.0,
            abstention_reason="Thiếu tên thuốc hoặc ngữ cảnh thuốc trong phiên",
        )
    return None

def check_pediatric_guidance_request(lower_query: str, query: str, session_id: str) -> CopilotResponse | None:
    ped_cues = (
        "tôi cần cho trẻ em", "cần cho trẻ em", "dành cho trẻ em", "cho trẻ em", "dùng cho trẻ em",
        "trẻ em thì sao", "nhi khoa thì sao", "liều trẻ em", "liều cho trẻ em", "thuốc cho trẻ em",
        "trẻ nhỏ thì sao", "cho trẻ nhỏ", "trẻ em uống được không", "trẻ em dùng được không",
        "cho be", "cho bé", "tre em", "cho tre em"
    )
    is_pediatric = any(cue in lower_query for cue in ped_cues) or lower_query.strip().rstrip("?.! ") in {
        "tôi cần cho trẻ em", "cho trẻ em", "trẻ em", "nhi khoa", "liều trẻ em", "trẻ nhỏ"
    }
    if not is_pediatric:
        return None

    reply_md = (
        "### 👶 NGUYÊN TẮC AN TOÀN DƯỢC NHI KHOA & HƯỚNG DẪN KÊ ĐƠN CHO TRẺ EM\n\n"
        "*(Căn cứ Dược thư Quốc gia Việt Nam & Hướng dẫn Dược lâm sàng Nhi khoa - Bộ Y tế)*\n\n"
        "---\n\n"
        "#### 1. NGUYÊN TẮC VÀNG TRONG SỬ DỤNG THUỐC CHO TRẺ EM\n"
        "• **Tuyệt đối không chia nhỏ liều người lớn cảm tính:** Trẻ em không phải là người lớn thu nhỏ. Khả năng chuyển hóa qua gan và lọc qua thận của trẻ khác biệt theo từng giai đoạn lứa tuổi.\n"
        "• **Cách tính liều chuẩn:** Luôn tính liều theo **cân nặng thực tế ($mg/kg/ngày$ hoặc $mg/kg/lần$)** hoặc **diện tích da ($m^2$)**.\n"
        "• **Ưu tiên dạng bào chế phù hợp:** Gói bột/cốm pha hỗn dịch, dung dịch/siro uống, hoặc viên đặt trực tràng khi trẻ nôn mửa nhiều.\n\n"
        "#### 2. LIỀU CHUẨN CÁC NHÓM THUỐC THƯỜNG DÙNG TRONG NHI KHOA\n"
        "• **Hạ sốt & Giảm đau (Paracetamol):**\n"
        "  - **Liều chuẩn:** $10 - 15\\text{ mg/kg/lần}$, uống cách mỗi $4 - 6\\text{ giờ}$ khi trẻ sốt $\\ge 38.5^\\circ\\text{C}$.\n"
        "  - **Liều tối đa:** Không vượt quá $60\\text{ mg/kg/ngày}$ (hoặc tối đa $4\\text{ liều}/24\\text{ giờ}$).\n"
        "• **Bù nước & Điện giải (Oresol / ORS áp lực thẩm thấu thấp):**\n"
        "  - **Trẻ < 2 tuổi:** Uống $50 - 100\\text{ mL}$ sau mỗi lần đi ngoài phân lỏng hoặc nôn.\n"
        "  - **Trẻ 2 – 10 tuổi:** Uống $100 - 200\\text{ mL}$ sau mỗi lần đi ngoài.\n"
        "  - **Cách uống:** Cho uống từng thìa nhỏ hoặc ngụm nhỏ, không uống vội để tránh nôn trớ.\n\n"
        "#### 3. CẢNH BÁO NGUY HIỂM & CHỐNG CHỈ ĐỊNH ĐẶC THÙ Ở TRẺ EM\n"
        "⚠️ **Chống chỉ định tuyệt đối Aspirin & Salicylat:** Trẻ em dưới 16 tuổi sốt do virus cúm hoặc thủy đậu tuyệt đối không dùng Aspirin (nguy cơ mắc **Hội chứng Reye** gây thoái hóa mỡ gan não cấp tử vong cao).\n"
        "⚠️ **Thận trọng Kháng sinh:** Không dùng **Tetracyclin** cho trẻ dưới 8 tuổi (gây hỏng men răng và chậm phát triển xương); nhóm **Fluoroquinolon** (Ciprofloxacin, Levofloxacin...) chống chỉ định thường quy cho trẻ dưới 18 tuổi (nguy cơ tổn thương sụn khớp).\n\n"
        "---\n"
        "👉 **Bác sĩ vui lòng gửi tên thuốc cụ thể kèm độ tuổi và cân nặng (kg) của bé** để em rà soát liều chuẩn và chống chỉ định chi tiết nhất cho bệnh nhi ạ!"
    )
    return CopilotResponse(
        intent="CLINICAL_PEDIATRIC_GUIDANCE",
        reply_text=reply_md,
        legal_basis="Dược thư Quốc gia Việt Nam & Hướng dẫn Dược lâm sàng Nhi khoa BYT",
        suggested_chips=["Liều Paracetamol cho trẻ em", "Cách bù nước Oresol trẻ em", "Chống chỉ định thuốc nhi khoa"],
        answer_type="grounded_reference",
        source_status="retrieved_evidence",
        confidence=1.0,
        session_id=session_id
    )
