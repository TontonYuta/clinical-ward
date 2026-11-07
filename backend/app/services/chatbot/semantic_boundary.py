"""
Semantic Boundary & Safe Abstention Gate (Self-RAG Asai et al., 2024 / FDA CDSS 2022).
Paper: Self-RAG: Learning to Retrieve, Generate, and Critique through Self-Reflection (arXiv:2310.11511)
Đo khoảng cách ngữ nghĩa và kích hoạt từ chối an toàn khi câu hỏi nằm ngoài phạm vi Dược lâm sàng.
"""
import unicodedata
from typing import Optional, Tuple
from pydantic import BaseModel, Field
from app.schemas.copilot import CopilotResponse

class BoundaryAssessment(BaseModel):
    is_out_of_domain: bool = Field(description="Câu hỏi có nằm ngoài phạm vi lâm sàng không")
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)
    category: str = Field(default="clinical", description="Phân loại: clinical, frivolous, entertainment, unknown")

# Không gian ngữ nghĩa các nguyên mẫu Out-of-Domain (OOD Archetypes)
OOD_ARCHETYPES = {
    "lottery_gambling": {"xo so", "so xo", "ve so", "lo de", "danh de", "danh lo", "vietlott", "kqxs", "quay so"},
    "weather_finance": {"thoi tiet", "du bao thoi tiet", "gia vang", "ty gia", "bitcoin", "chung khoan", "bong da", "showbiz"},
    "entertainment_poetry": {"chuyen cuoi", "chuyen ma", "ke chuyen", "lam tho", "bai tho", "tho tinh", "hat di", "hat mot bai"},
    "cooking_gaming": {"choi game", "game gi", "hom nay an gi", "an mon gi", "nau mon gi", "cong thuc nau"},
    "relationship_social": {"nguoi yeu", "ban gai", "ban trai", "tan gai", "thich ai", "yeu ai", "may tuoi", "sinh nam bao nhieu", "que o dau", "nha o dau"},
    "astrology_fortune": {"xem boi", "tu vi", "phong thuy", "cung hoang dao"},
    "general_education": {"giai toan", "hoc toan", "day toan", "bai toan", "hoc van", "hoc tieng anh", "hoc hoa", "hoc ly", "viet code"},
    "idle_chitchat": {"chem gio", "buon chuyen", "noi chuyen linh tinh", "chuyen linh tinh", "linh tinh", "vo van", "tao lao"}
}

CLINICAL_ANCHORS = {
    "thuốc", "liều", "dược", "bệnh", "chữa", "điều trị", "kháng sinh", "sốt", "đau", "viêm",
    "phác đồ", "tồn kho", "tủ trực", "bệnh nhân", "huyết áp", "truyền dịch", "paracetamol", "morphin",
    "tác dụng", "chống chỉ định", "thất điều", "độc tính", "ngộ độc", "quá liều", "men gan",
    "thai kỳ", "cho con bú", "suy thận", "suy gan", "suy tim", "phenytoin", "aspirin", "insulin",
    "amiodaron", "loét", "co giật", "kháng histamin", "antacid", "dị ứng", "phản vệ", "cpoe", "fefo",
    "kỵ", "tương tác", "vắc xin", "vacxin", "bảo quản", "nhiệt độ", "chuỗi lạnh", "chỉ định"
}

def evaluate_semantic_boundary(query: str) -> BoundaryAssessment:
    """Đo khoảng cách ngữ nghĩa và thẩm định tính hợp lệ của câu hỏi lâm sàng."""
    lower_q = query.lower().strip()
    norm_q = "".join(ch for ch in unicodedata.normalize("NFKD", lower_q) if not unicodedata.combining(ch)).replace("đ", "d")

    # 1. Thẩm định khoảng cách với các không gian OOD (Frivolous / Entertainment)
    for cat, terms in OOD_ARCHETYPES.items():
        if any(term in norm_q for term in terms):
            # Nếu có neo ngữ nghĩa lâm sàng bảo vệ (như "thuốc", "bệnh nhân") thì không reject nhầm
            has_clinical_anchor = any(anc in lower_q for anc in CLINICAL_ANCHORS)
            if not has_clinical_anchor:
                return BoundaryAssessment(is_out_of_domain=True, confidence=0.98, category=cat)

    # 2. Mọi câu hỏi không vi phạm ranh giới OOD đều được tiếp nhận trong phạm vi lâm sàng
    return BoundaryAssessment(is_out_of_domain=False, confidence=0.95, category="clinical")

def generate_safe_abstention_copilot_response() -> CopilotResponse:
    """Tạo thông điệp từ chối an toàn chuẩn mực FDA CDSS 2022 & Bộ Y Tế."""
    return CopilotResponse(
        intent="CLINICAL_SAFE_ABSTENTION",
        reply_text=(
            "### 🛡️ TỪ CHỐI TIẾP NHẬN: CÂU HỎI NGOÀI PHẠM VI CHUYÊN MÔN\n\n"
            "Hệ thống là **Trợ lý Dược lâm sàng & Nghiệp vụ Bệnh viện chuyên dụng**, tuân thủ nghiêm ngặt các quy định Bộ Y tế.\n\n"
            "Hệ thống **chỉ hỗ trợ** các nội dung chuyên môn và nghiệp vụ y tế sau:\n"
            "1. **Tra cứu thuốc & Dược thư:** 54.885 thuốc cấp phép DAV, chỉ định, liều dùng, chống chỉ định, hoạt chất DĐVN V.\n"
            "2. **Rà soát tương tác thuốc (DDI):** Cảnh báo tương tác chống chỉ định theo QĐ 5948/QĐ-BYT.\n"
            "3. **Phác đồ điều trị & cấp cứu:** Phản vệ (TT 51/2017), quản lý thuốc gây nghiện (TT 20/2017), phác đồ WHO/BYT.\n"
            "4. **Nghiệp vụ kho Dược & tủ trực:** Tồn kho FEFO, giao ban ca trực, lập dự trù cơ số (TT 22/2011).\n\n"
            "👉 **Em xin phép từ chối trả lời các câu hỏi giải trí, đời sống hoặc nằm ngoài nghiệp vụ y tế.** Vui lòng gửi câu hỏi chuyên môn hoặc tên thuốc cần tra cứu ạ!"
        ),
        answer_type="safe_abstention",
        source_status="out_of_scope",
        confidence=1.0,
        abstention_reason="Câu hỏi ngoài phạm vi trợ lý lâm sàng",
        suggested_chips=["Tra cứu thông tin thuốc", "Kiểm tra tương tác hai thuốc", "Hướng dẫn sử dụng hệ thống"]
    )
