"""
Kịch bản: Tư Vấn Chuyên Khoa Ung Bướu & Giới Hạn Thẩm Quyền Điều Trị Đa Mô Thức
Căn cứ: Hướng dẫn Chẩn đoán & Điều trị Ung thư Bộ Y Tế, NCCN Guidelines & Quy chuẩn An toàn AI Y tế (WHO 2023)
Nguyên tắc: AI tuyệt đối không can thiệp chỉ định thuốc độc tế bào, hóa trị hoặc đích mà chuyển tuyến chuyên khoa.
"""

from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas.copilot import CopilotResponse
from app.services.scenarios.base import BaseScenario
from app.services.scenarios.context import ClinicalContext

class OncologySpecialtyScenario(BaseScenario):
    scenario_id = "oncology_specialty"
    scenario_name = "Tư vấn chuyên khoa Ung bướu & Giới hạn chỉ định điều trị"

    def can_handle(self, query: str, lower_query: str, ctx: ClinicalContext) -> bool:
        oncology_keywords = [
            "ung thư", "u bướu", "carcinoma", "khối u ác tính",
            "trị ung thư", "chữa ung thư", "thuốc ung thư", "thuốc trị ung thư",
            "hóa trị ung thư", "chống ung thư"
        ]
        return any(k in lower_query for k in oncology_keywords)

    async def handle(
        self,
        query: str,
        lower_query: str,
        ctx: ClinicalContext,
        db: AsyncSession
    ) -> Optional[CopilotResponse]:
        reply = (
            "### 🎗️ TƯ VẤN CHUYÊN KHOA UNG BƯỚU (Quy Chuẩn Điều Trị Đa Mô Thức)\n\n"
            "• **Bản chất bệnh học:** \"Ung thư\" là tập hợp hơn 200 bệnh lý ác tính phức tạp với cơ chế sinh học phân tử khác biệt. "
            "**Hoàn toàn không tồn tại một loại thuốc đơn lẻ hay phổ thông dùng chung cho mọi ca bệnh ung thư.**\n\n"
            "• **Các nhóm thuốc & phương pháp điều trị y học hiện đại:**\n"
            "  1. *Hóa trị liệu độc tế bào (Cytotoxic Chemotherapy):* Tác động lên chu kỳ phân bào (Cisplatin, Doxorubicin, Paclitaxel, 5-FU...).\n"
            "  2. *Liệu pháp nhắm trúng đích (Targeted Therapy):* Kháng thể đơn dòng (Trastuzumab, Rituximab), thuốc ức chế Tyrosine Kinase (Erlotinib, Osimertinib...).\n"
            "  3. *Liệu pháp miễn dịch (Immunotherapy):* Thuốc ức chế điểm kiểm soát miễn dịch Anti-PD1/PD-L1 (Pembrolizumab, Nivolumab...).\n"
            "  4. *Liệu pháp nội tiết & Chăm sóc giảm nhẹ:* Thuốc kháng Estrogen/Androgen và quản lý đau mạn tính bậc 3 theo WHO (Morphin sulfat theo Thông tư 20/2017/TT-BYT).\n\n"
            "🛡️ **RÀO CHẮN AN TOÀN LÂM SÀNG & GIỚI HẠN THẨM QUYỀN AI (Safe Deferral):**\n"
            "• Mọi phác đồ ung thư bắt buộc phải do **Hội đồng Ung bướu đa chuyên khoa (Tumor Board)** và **Bác sĩ chuyên khoa Ung bướu** "
            "chỉ định dựa trên: giải phẫu bệnh, giai đoạn TNM, xét nghiệm đột biến gen, diện tích da (BSA) và chức năng gan thận.\n"
            "• **Trợ lý AI tuyệt đối không đưa ra chỉ định thuốc cụ thể cho bệnh lý này.**\n"
            "• **Khuyến cáo người bệnh:** Cần thăm khám trực tiếp tại Bệnh viện K, Bệnh viện Ung bướu hoặc Trung tâm Ung bướu các bệnh viện tuyến tỉnh/trung ương; "
            "tuyệt đối không tự mua thuốc hoặc sử dụng các bài thuốc truyền miệng không rõ nguồn gốc."
        )

        return CopilotResponse(
            intent="ONCOLOGY_SPECIALTY_GUIDANCE",
            reply_text=reply,
            card=None,
            legal_basis="Hướng dẫn Chẩn đoán & Điều trị Ung thư Bộ Y Tế & NCCN Clinical Practice Guidelines",
            suggested_chips=[
                "Chăm sóc giảm nhẹ ung thư",
                "Quy chế thuốc gây nghiện TT 20",
                "Tra cứu Dược Thư 2015",
                "Đối soát ca trực 07:00 AM"
            ]
        )
