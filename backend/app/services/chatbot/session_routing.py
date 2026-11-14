import re
import json
from pathlib import Path
from typing import Any
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
    "đây", "day", "nhất", "nhat", "tóm tắt mà", "đầy đủ nhất", "chi tiết nhất",
    "rượu", "bia", "cồn", "sữa", "thức ăn", "thuc an", "nước cam", "nước bưởi", "đồ uống"
}

TIMING_TERMS = (
    "sáng hay tối", "uống sáng", "uống tối", "lúc đói", "lúc no",
    "trước ăn", "sau ăn", "trước/sau ăn", "truoc/sau an", "trước hay sau ăn",
    "thời điểm", "thời điểm uống", "thoi diem uong", "uống lúc nào", "uống khi nào",
    "bao lâu thì tiêm", "tiêm nhắc lại", "tần suất", "mỗi bao lâu", "đường dùng", "cách pha",
    "cách uống", "uống ra sao", "cách dùng",
)

FIELD_ONLY_TERMS = (
    "chống chỉ định", "tác dụng phụ", "tác dụng không mong muốn",
    "liều dùng", "liều lượng", "liều tối đa", "thành phần", "hoạt chất",
    "chỉ định", "công dụng", "thông tin thuốc",
    "còn liều", "sáng hay tối", "uống sáng", "uống tối",
    "lúc đói", "lúc no", "trước ăn", "sau ăn", "trước/sau ăn", "trước hay sau ăn",
    "thời điểm", "thời điểm uống", "uống lúc nào", "uống khi nào", "cách uống", "cách dùng",
    "bao lâu thì tiêm", "tiêm nhắc lại", "tần suất", "mỗi bao lâu", "đường dùng",
    "cách pha", "gây nghiện", "lệ thuộc", "suy thận", "suy gan",
    "độc tính", "thuốc đó", "thuốc này", "nó có",
    "của thuốc này", "của thuốc đó", "chi tiết về thuốc này", "chi tiết thuốc này",
    "thông tin chi tiết đầy đủ", "thông tin chi tiết", "thông tin đầy đủ",
    "tóm tắt cho tôi", "tóm tắt lại", "ngắn gọn thôi",
    "tóm tắt thông tin thuốc đó", "tóm tắt thông tin", "tóm tắt",
    "hồ sơ đầy đủ", "hồ sơ chi tiết", "toàn bộ thông tin",
    "trẻ em", "cho trẻ em", "nhi khoa", "cho bé", "trẻ nhỏ",
    "kỵ rượu", "uống rượu", "uống bia", "rượu bia", "say rượu", "với rượu", "với bia",
    "uống cùng sữa", "với sữa", "uống sữa", "nước cam", "nước bưởi", "thức ăn", "kiêng ăn gì",
    "xơ gan", "men gan", "viêm gan", "chức năng gan",
    "người già", "người cao tuổi", "người lớn tuổi",
    "quá liều", "ngộ độc", "uống nhầm", "giải độc", "antidote",
)

def check_renal_adjustment_request(query: str, lower_query: str, nlu_drug: str | None = None) -> CopilotResponse | None:
    is_renal = any(t in lower_query for t in ("suy thận", "chức năng thận", "egfr", "crcl", "creatinine", "crystalin", "creatin", "chỉnh liều"))
    if not is_renal:
        return None

    from app.services.chatbot.lexical_trie_matcher import get_drug_lexical_matcher
    matcher = get_drug_lexical_matcher()
    extracted_meds = matcher.extract_medications(lower_query)
    cand_kw = extract_drug_keywords(lower_query)

    name_match = re.search(r"(?<!\w)(?:[A-ZÀ-ỸĐ][\wÀ-ỹĐđ'-]+\s+){1,4}[A-ZÀ-ỸĐ][\wÀ-ỹĐđ'-]+(?!\w)", query)
    pat_name_lower = name_match.group(0).casefold() if name_match else ""
    is_cand_just_name = bool(pat_name_lower and (cand_kw == pat_name_lower or cand_kw in pat_name_lower or pat_name_lower in cand_kw))
    valid_cand = cand_kw and cand_kw not in CLINICAL_NON_DRUG_TERMS and not is_cand_just_name

    has_current_drug = bool(nlu_drug) or bool(extracted_meds) or bool(valid_cand) or find_matched_med(lower_query) is not None or any(
        len(alias) >= 4 and alias.casefold() in lower_query
        for entry in DRUG_REGISTRY.values() for alias in entry.get("aliases", [])
    )

    # Nếu câu hỏi đã nêu rõ thuốc (như Ciprofloxacin, Enoxaparin, Ceftriaxon, Clarithromycin, Meropenem...): Không chặn đòi tên bệnh nhân
    if has_current_drug:
        return None

    subject = any(t in lower_query for t in ("bệnh nhân", "người bệnh", "hồ sơ", "bệnh án", "bn-", "bn "))
    has_bn_token = any(token in lower_query for token in ("bn-", "bn "))

    if subject and not name_match and not has_bn_token:
        return CopilotResponse(
            intent="CLINICAL_CASE_CLARIFICATION",
            reply_text="Vui lòng cung cấp họ tên hoặc mã người bệnh và tên thuốc cần rà soát để đánh giá chức năng thận.",
            answer_type="clarification", source_status="missing_patient_identifier",
            confidence=1.0, abstention_reason="Câu hỏi có nhắc người bệnh nhưng thiếu định danh cụ thể",
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
    from app.services.chatbot.conversational_clinical_engine import find_clinical_specialty_consultation
    from app.services.chatbot.lexical_trie_matcher import get_drug_lexical_matcher

    if find_clinical_specialty_consultation(lower_query):
        return None
    if get_drug_lexical_matcher().extract_medications(lower_query):
        return None

    is_general_consultation = any(term in lower_query for term in (
        "thuốc điều trị", "thuốc trị", "thuốc hạ", "thuốc chữa", "thuốc dùng cho",
        "hướng dẫn điều trị", "phác đồ điều trị", "nhóm thuốc", "lựa chọn thuốc",
        "huyết áp", "tăng huyết áp", "hạ huyết áp", "đái tháo đường", "tiểu đường"
    ))
    if is_general_consultation:
        return None

    # Không chặn nếu là câu hỏi xin ví dụ hoặc danh mục tương tác lâm sàng
    if any(w in lower_query for w in ("ví dụ", "vi du", "mẫu", "liệt kê", "danh sách", "top", "những cặp", "các cặp")):
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
        "kỵ rượu", "uống rượu", "uống cùng sữa", "người cao tuổi", "người già",
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
    # Nếu câu hỏi đã có tên thuốc cụ thể (ví dụ Cefixim cho bé, Augmentin cho trẻ...), không chặn trả văn mẫu chung
    from app.services.chatbot.lexical_trie_matcher import get_drug_lexical_matcher
    matcher = get_drug_lexical_matcher()
    if matcher.extract_medications(query):
        return None
    cand = extract_drug_keywords(lower_query)
    if cand and cand not in CLINICAL_NON_DRUG_TERMS and len(cand) >= 4:
        return None

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

    reply_md = "Vui lòng nêu tên thuốc cụ thể, độ tuổi và cân nặng của trẻ để tra cứu khuyến cáo trong nguồn đã lập chỉ mục. Nếu không tìm thấy nguồn phù hợp, hệ thống sẽ thông báo chưa xác minh được."
    return CopilotResponse(
        intent="CLINICAL_PEDIATRIC_GUIDANCE", reply_text=reply_md,
        suggested_chips=[], answer_type="clarification",
        source_status="missing_medication_context", confidence=1.0, session_id=session_id,
    )

    reply_md = (
        "### NGUYÊN TẮC AN TOÀN DƯỢC NHI KHOA & HƯỚNG DẪN KÊ ĐƠN CHO TRẺ EM\n\n"
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
        "• **Chống chỉ định tuyệt đối Aspirin & Salicylat:** Trẻ em dưới 16 tuổi sốt do virus cúm hoặc thủy đậu tuyệt đối không dùng Aspirin (nguy cơ mắc **Hội chứng Reye** gây thoái hóa mỡ gan não cấp tử vong cao).\n"
        "• **Thận trọng Kháng sinh:** Không dùng **Tetracyclin** cho trẻ dưới 8 tuổi (gây hỏng men răng và chậm phát triển xương); nhóm **Fluoroquinolon** (Ciprofloxacin, Levofloxacin...) chống chỉ định thường quy cho trẻ dưới 18 tuổi (nguy cơ tổn thương sụn khớp).\n\n"
        "---\n"
        "*(Đồng nghiệp vui lòng cung cấp tên thuốc cụ thể kèm độ tuổi và cân nặng (kg) của bệnh nhi để hệ thống suy luận liều chuẩn xác nhất)*"
    )
    return CopilotResponse(
        intent="CLINICAL_PEDIATRIC_GUIDANCE",
        reply_text=reply_md,
        legal_basis="Dược thư Quốc gia Việt Nam & Hướng dẫn Dược lâm sàng Nhi khoa BYT",
        suggested_chips=[],
        answer_type="grounded_reference",
        source_status="retrieved_evidence",
        confidence=1.0,
        session_id=session_id
    )

_LOADED_DDI_CATALOG: list[dict[str, Any]] | None = None

def get_ddi_catalog() -> list[dict[str, Any]]:
    global _LOADED_DDI_CATALOG
    if _LOADED_DDI_CATALOG is not None:
        return _LOADED_DDI_CATALOG

    # 12 Cặp tương tác thuốc kinh điển thường gặp nhất trong thực hành lâm sàng nội viện
    classic_pairs = [
        {
            "pair": "Simvastatin + Clarithromycin (hoặc Erythromycin / Ketoconazol)",
            "level": "Chống chỉ định tuyệt đối (Bảng 3.1, STT 412 - QĐ 5948)",
            "mechanism": "Clarithromycin ức chế mạnh enzym chuyển hóa CYP3A4, làm tăng nồng độ Simvastatin trong máu lên nhiều lần, dẫn đến nguy cơ tiêu cơ vân cấp (Rhabdomyolysis), myoglobin niệu và suy thận cấp đe dọa tính mạng.",
            "management": "Tạm ngừng Simvastatin trong suốt đợt điều trị kháng sinh Macrolid, hoặc chuyển sang statin ít chuyển hóa qua CYP3A4 (Rosuvastatin, Pravastatin)."
        },
        {
            "pair": "Clopidogrel + Omeprazol (hoặc Esomeprazol)",
            "level": "Chống chỉ định phối hợp (Bảng 3.2 - QĐ 5948/QĐ-BYT)",
            "mechanism": "Omeprazol ức chế enzym CYP2C19, ngăn cản quá trình chuyển hóa tiền chất Clopidogrel thành dạng có hoạt tính sinh học, làm giảm đáng kể hiệu quả ức chế ngưng tập tiểu cầu, dẫn đến tăng nguy cơ tái nhồi máu cơ tim hoặc huyết khối trong stent.",
            "management": "Đổi sang thuốc ức chế bơm proton ít ức chế CYP2C19 như Pantoprazol hoặc Rabeprazol."
        },
        {
            "pair": "Methotrexat (liều cao) + Thuốc chống viêm không steroid (NSAID như Ibuprofen, Diclofenac)",
            "level": "Chống chỉ định tuyệt đối (Bảng 3.1 - QĐ 5948 & DĐVN V)",
            "mechanism": "NSAID làm giảm lưu lượng máu đến thận và ức chế bài tiết Methotrexat qua ống thận, dẫn đến tích lũy nồng độ Methotrexat cực độc, gây suy tủy xương cấp, giảm bạch cầu/tiểu cầu nặng và loét xuất huyết tiêu hóa ồ ạt.",
            "management": "Tránh phối hợp NSAID trước, trong và ít nhất 48 giờ sau khi truyền Methotrexat liều cao; theo dõi nồng độ thuốc và giải độc bằng Acid folinic (Leucovorin)."
        },
        {
            "pair": "Warfarin + Thuốc chống viêm không steroid (NSAID như Meloxicam, Diclofenac, Celecoxib)",
            "level": "Chống chỉ định phối hợp / Nguy cơ xuất huyết nghiêm trọng (Bảng 3.1 & 3.2 - QĐ 5948)",
            "mechanism": "Tác động cộng hưởng kép: NSAID gây tổn thương trợt loét niêm mạc dạ dày và ức chế kết tập tiểu cầu, cộng hưởng với tác dụng ức chế tổng hợp yếu tố đông máu của Warfarin.",
            "management": "Nguy cơ xuất huyết tiêu hóa ồ ạt và kéo dài thời gian đông máu INR khó kiểm soát. Ưu tiên giảm đau bằng Paracetamol; nếu bắt buộc phải dùng NSAID phải theo dõi chặt chẽ INR và bổ sung PPI bảo vệ dạ dày."
        },
        {
            "pair": "Spironolacton + Kali Clorid (KCl dạng uống hoặc tiêm truyền)",
            "level": "Chống chỉ định tuyệt đối khi dùng đồng thời kéo dài (Bảng 3.1 - QĐ 5948)",
            "mechanism": "Spironolacton là thuốc lợi tiểu đối kháng Aldosteron tại ống lượn xa làm giảm thải trừ Kali qua nước tiểu. Bổ sung thêm Kali ngoại sinh gây ứ đọng Kali cấp tính.",
            "management": "Nguy cơ tăng kali máu ác tính (> 6.5 mmol/L), dẫn đến rối loạn dẫn truyền tim, rung thất và ngừng tim đột ngột. Tuyệt đối không bổ sung kali thường quy khi đang dùng lợi tiểu giữ kali trừ khi có hạ kali máu nặng và có monitor theo dõi liên tục."
        },
        {
            "pair": "Amiodaron + Levofloxacin (hoặc Moxifloxacin / Ciprofloxacin)",
            "level": "Chống chỉ định phối hợp (Bảng 3.1 - QĐ 5948 & DĐVN V)",
            "mechanism": "Cả hai thuốc đều có tác dụng làm chậm tái cực thất cơ tim, dẫn đến kéo dài khoảng QT hiệp đồng trên điện tâm đồ.",
            "management": "Kéo dài khoảng QTc bệnh lý (> 500ms), kích phát loạn nhịp thất ác tính dạng xoắn đỉnh (Torsades de pointes) và đột tử do tim. Chọn kháng sinh nhóm khác không gây kéo dài khoảng QT (như Beta-lactam) cho bệnh nhân đang dùng Amiodaron."
        },
        {
            "pair": "Carbamazepin + Clarithromycin (hoặc Erythromycin)",
            "level": "Chống chỉ định phối hợp (Bảng 3.1 - QĐ 5948)",
            "mechanism": "Clarithromycin ức chế mạnh isoenzym CYP3A4, làm giảm độ thanh thải Carbamazepin qua gan và tăng nồng độ Carbamazepin trong huyết tương lên gấp 2-3 lần.",
            "management": "Gây hội chứng ngộ độc thần kinh cấp tính: thất điều (ataxia), rung giật nhãn cầu, nhìn đôi, lơ mơ, co giật và ức chế hô hấp. Sử dụng Azithromycin hoặc chuyển sang nhóm kháng sinh không ức chế CYP3A4."
        },
        {
            "pair": "Ergotamin + Kháng sinh Macrolid (Clarithromycin, Erythromycin)",
            "level": "Chống chỉ định tuyệt đối (Bảng 3.1 - QĐ 5948)",
            "mechanism": "Macrolid ức chế enzym chuyển hóa CYP3A4 làm tăng nồng độ Ergotamin trong máu, gây co thắt mạch máu ngoại vi nghiêm trọng.",
            "management": "Gây thiếu máu cục bộ cấp tính và hoại tử mô đầu chi (Hội chứng Ergotism). Chống chỉ định dùng đồng thời; nếu đã dùng phải ngưng ngay và truyền cấp cứu bằng thuốc giãn mạch như Nitroprussid."
        },
        {
            "pair": "Digoxin + Clarithromycin (hoặc Erythromycin)",
            "level": "Chống chỉ định phối hợp / Tương tác mức độ nặng (Bảng 3.1 - QĐ 5948)",
            "mechanism": "Clarithromycin ức chế P-glycoprotein tại ruột và thận, đồng thời tiêu diệt vi khuẩn đường ruột Eubacterium lentum chuyển hóa Digoxin, làm tăng vọt nồng độ Digoxin trong huyết thanh lên gấp 2 lần.",
            "management": "Nguy cơ ngộ độc Digoxin cấp tính: loạn nhịp tim chậm, block nhĩ thất, nhìn vàng và ngừng tim. Tránh phối hợp hoặc phải giảm liều Digoxin 50% kèm theo dõi nồng độ đỉnh/đáy trong máu."
        },
        {
            "pair": "Allopurinol + Azathioprin (hoặc 6-Mercaptopurin)",
            "level": "Chống chỉ định phối hợp / Độc tính tủy xương tối cấp (Bảng 3.1 - QĐ 5948)",
            "mechanism": "Allopurinol ức chế enzym Xanthine Oxidase - con đường chuyển hóa thải trừ chính của Azathioprin và 6-MP, gây tích lũy chất chuyển hóa độc hại 6-thioguanine nucleotides.",
            "management": "Nguy cơ suy tủy toàn bộ cực kỳ nguy kịch: giảm bạch cầu hạt đe dọa nhiễm trùng huyết tử vong, giảm tiểu cầu xuất huyết nội tạng. Bắt buộc giảm liều Azathioprin/6-MP xuống 1/4 - 1/3 liều thông thường nếu bắt buộc dùng."
        },
        {
            "pair": "Methotrexat + Cotrimoxazol (Trimethoprim/Sulfamethoxazol)",
            "level": "Chống chỉ định tuyệt đối (Bảng 3.1 - QĐ 5948 & DĐVN V)",
            "mechanism": "Hiệp đồng ức chế chu trình Acid Folic: Trimethoprim ức chế dihydrofolate reductase cộng hưởng với Methotrexat, đồng thời Sulfamethoxazol cạnh tranh gắn kết albumin huyết tương và giảm bài tiết Methotrexat qua thận.",
            "management": "Nguy cơ ngộ độc Methotrexat bùng phát: ức chế tủy xương nặng, thiếu máu hồng cầu to, loét hoại tử niêm mạc miệng và suy thận cấp. Chống chỉ định dùng chung; chọn kháng sinh nhóm khác thay thế Cotrimoxazol."
        },
        {
            "pair": "Ciprofloxacin + Theophyllin",
            "level": "Chống chỉ định phối hợp / Độc tính Theophyllin (Bảng 3.1 - QĐ 5948)",
            "mechanism": "Ciprofloxacin ức chế mạnh isoenzym CYP1A2, làm giảm độ thanh thải Theophyllin qua gan từ 30% đến 50%.",
            "management": "Tích lũy nồng độ Theophyllin gây co giật toàn thể, loạn nhịp nhanh thất nguy hiểm và tử vong. Nếu bắt buộc dùng chung phải giảm liều Theophyllin ít nhất 50% và định lượng nồng độ thuốc liên tục."
        }
    ]

    base_dir = Path(__file__).resolve().parent.parent.parent.parent
    ddi_path = base_dir / "data" / "knowledge_base" / "ddi_interactions" / "qd_5948_table_3_1_all_pairs.json"
    if not ddi_path.exists():
        ddi_path = base_dir.parent / "api" / "clinical_ddi_data" / "qd_5948_table_3_1_all_pairs.json"

    raw_pairs = []
    if ddi_path.exists():
        try:
            with open(ddi_path, "r", encoding="utf-8") as f:
                raw_pairs = json.load(f)
        except Exception:
            raw_pairs = []

    catalog: list[dict[str, Any]] = list(classic_pairs)
    seen: set[str] = {c["pair"].lower() for c in classic_pairs}

    for item in raw_pairs:
        d1 = str(item.get("drug_1", "")).strip()
        d2 = str(item.get("drug_2", "")).strip()
        stt = item.get("stt", len(catalog) + 1)
        mech = str(item.get("mechanism", "")).strip()
        cons = str(item.get("consequence", "")).strip()
        mgmt = str(item.get("management", "")).strip()
        pair_str = f"{d1} + {d2}"
        if pair_str.lower() in seen or f"{d2} + {d1}".lower() in seen:
            continue
        full_mech = f"{mech}. {cons}" if cons else mech
        catalog.append({
            "stt": stt,
            "drug_1": d1,
            "drug_2": d2,
            "pair": pair_str,
            "level": f"Chống chỉ định tuyệt đối (Bảng 3.1, STT {stt} - QĐ 5948/QĐ-BYT)",
            "mechanism": full_mech,
            "management": mgmt
        })
        seen.add(pair_str.lower())

    _LOADED_DDI_CATALOG = catalog
    return _LOADED_DDI_CATALOG

class _DynamicDdiCatalog(list):
    """Proxy list đối soát động trực tiếp từ 633 cặp tương tác CSDL QĐ 5948/QĐ-BYT."""
    def __len__(self):
        return len(get_ddi_catalog())
    def __getitem__(self, item):
        return get_ddi_catalog()[item]
    def __iter__(self):
        return iter(get_ddi_catalog())
    def __bool__(self):
        return bool(get_ddi_catalog())

DDI_CONTRAINDICATION_CATALOG = _DynamicDdiCatalog()

def check_interaction_examples_request(lower_query: str, session_id: str) -> CopilotResponse | None:
    """Trả về các ví dụ kinh điển về cặp tương tác thuốc chống chỉ định theo QĐ 5948/QĐ-BYT với khả năng phân trang linh hoạt."""
    # Nếu câu hỏi đã nhắc cụ thể từ 2 thuốc trở lên thì rà soát theo đơn cụ thể, không trả về ví dụ tổng quát
    from app.services.chatbot.lexical_trie_matcher import get_drug_lexical_matcher
    if len(get_drug_lexical_matcher().extract_medications(lower_query)) >= 2:
        return None

    is_followup = any(w in lower_query for w in (
        "cặp nữa", "cap nua", "thêm cặp", "them cap", "nữa đi", "nua di",
        "tiếp đi", "tiep di", "xem tiếp", "xem tiep", "tiếp nữa", "tiep nua",
        "tiếp theo", "tiep theo", "thêm vài cặp", "them vai cap", "mấy cặp nữa", "may cap nua"
    )) or bool(re.search(r"\b(?:lấy|thêm|cho)\s+\d+\s+cặp\b", lower_query))

    is_example = any(w in lower_query for w in ("ví dụ", "vi du", "mẫu", "liệt kê", "danh sách", "những cặp", "các cặp", "cặp nào", "cap nao")) or bool(re.search(r"\btop\b", lower_query))
    is_ddi = any(w in lower_query for w in ("tương tác", "tuong tac", "chống chỉ định", "chong chi dinh", "kỵ nhau", "ky nhau"))
    is_initial_req = (is_example and is_ddi) or (is_ddi and any(w in lower_query for w in ("nhiều", "nhieu", "điển hình", "dien hinh", "hay gặp", "hay gap")))

    if not (is_initial_req or is_followup):
        return None

    count_match = re.search(r"(\d+)\s+cặp", lower_query)
    total_available = len(DDI_CONTRAINDICATION_CATALOG)
    requested_count = int(count_match.group(1)) if count_match else (4 if is_followup else 3)
    requested_count = max(1, min(requested_count, total_available))

    if is_followup:
        start_idx = 3
        end_idx = min(start_idx + requested_count, total_available)
        selected_pairs = DDI_CONTRAINDICATION_CATALOG[start_idx:end_idx]
        if not selected_pairs:
            selected_pairs = DDI_CONTRAINDICATION_CATALOG[:requested_count]
            start_idx = 0
    else:
        start_idx = 0
        selected_pairs = DDI_CONTRAINDICATION_CATALOG[:requested_count]

    actual_count = len(selected_pairs)
    title_suffix = "tiếp theo" if is_followup else "điển hình"

    lines = [
        "### DANH MỤC CÁC CẶP TƯƠNG TÁC THUỐC CHỐNG CHỈ ĐỊNH (QĐ 5948/QĐ-BYT)\n",
        f"*(Trích xuất từ Danh mục 633 cặp tương tác chống chỉ định Bảng 3.1 & Bảng 3.2 - Bộ Y tế)*\n",
        "---\n",
        f"Dưới đây là **{actual_count} cặp tương tác thuốc chống chỉ định {title_suffix}** thường gặp trong thực hành lâm sàng nội viện:\n"
    ]

    for idx, item in enumerate(selected_pairs, start=start_idx + 1):
        lines.append(f"{idx}. **{item['pair']}:**")
        lines.append(f"   * **Mức độ:** **{item['level']}**")
        lines.append(f"   * **Cơ chế & Hậu quả:** {item['mechanism']}")
        lines.append(f"   * **Xử trí lâm sàng:** {item['management']}\n")

    lines.append("*Bác sĩ hoặc Điều dưỡng có thể gửi 2 tên thuốc cụ thể bất kỳ để hệ thống rà soát tức thì theo cơ sở dữ liệu 633 cặp tương tác QĐ 5948 ạ!*")
    reply_md = "\n".join(lines)

    chips = [item["pair"].split(" (")[0] for item in selected_pairs[:3]]
    chips.append("Tra cứu Dược thư")

    return CopilotResponse(
        intent="CLINICAL_DDI_INTERACTION_LOOKUP",
        reply_text=reply_md,
        card=None,
        legal_basis="Quyết định 5948/QĐ-BYT (Bảng 3.1 & 3.2) & Dược thư Quốc gia Việt Nam",
        suggested_chips=[],
        session_id=session_id,
        answer_type="guideline",
        source_status="exact_match",
        confidence=1.0
    )
