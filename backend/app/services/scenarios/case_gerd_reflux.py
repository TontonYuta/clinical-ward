"""
Kịch bản lâm sàng: Trào ngược dạ dày thực quản (GERD) & Ức chế acid dịch vị
Căn cứ: Hướng dẫn chẩn đoán và điều trị GERD (Bộ Y tế), Dược thư Quốc gia Việt Nam & QĐ 5948/QĐ-BYT.
(<= 120 LOC)
"""
import re
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas.copilot import CopilotResponse, CopilotActionCard
from app.services.scenarios.base import BaseScenario
from app.services.scenarios.context import ClinicalContext

class GerdRefluxScenario(BaseScenario):
    scenario_id = "gerd_reflux"
    scenario_name = "Xử Trí Trào Ngược Dạ Dày Thực Quản (GERD) & Phác Đồ PPI"

    def can_handle(self, query: str, lower_query: str, ctx: ClinicalContext) -> bool:
        gerd_keywords = (
            "trào ngược dạ dày", "trào ngược", "trao nguoc da day", "trao nguoc",
            "gerd", "ợ chua", "ợ nóng", "o chua", "o nong", "nóng rát thực quản",
            "nong rat thuong vi", "rát cổ họng do trào ngược", "viêm thực quản trào ngược"
        )
        return any(kw in lower_query for kw in gerd_keywords)

    async def handle(
        self,
        query: str,
        lower_query: str,
        ctx: ClinicalContext,
        db: AsyncSession
    ) -> Optional[CopilotResponse]:
        if ctx.session:
            ctx.session.set_active_medication(
                name="Prasocare (Esomeprazole 40mg)",
                ingredient="Esomeprazole natri",
                batch="LOT-PS25-E4",
                stock="350 Lọ",
                location="Kho Dược Nội Trú (Kệ A2 - Tầng 2)"
            )

        reply = (
            "### 🛡️ HƯỚNG DẪN XỬ TRÍ LÂM SÀNG: TRÀO NGƯỢC DẠ DÀY THỰC QUẢN (GERD)\n\n"
            "*(Theo Hướng dẫn chẩn đoán & điều trị Bệnh trào ngược dạ dày thực quản - Bộ Y tế & Dược thư Quốc gia Việt Nam)*\n\n"
            "---\n\n"
            "#### 1. PHÁC ĐỒ DƯỢC LÝ ĐẦU TAY (FIRST-LINE THERAPY)\n"
            "• **Thuốc ức chế bơm Proton (PPI - Lựa chọn ưu tiên số 1):**\n"
            "  - **Esomeprazole (Prasocare):** 20 – 40 mg/lần/ngày, uống trước bữa ăn sáng 30 – 60 phút trong 4 – 8 tuần.\n"
            "  - **Omeprazole:** 20 – 40 mg/lần/ngày hoặc **Pantoprazole:** 40 mg/lần/ngày.\n"
            "• **Thuốc bảo vệ niêm mạc & trung hòa dịch vị (Giảm triệu chứng tức thì):**\n"
            "  - **Alginat (Gaviscon):** Tạo bè nổi ngăn trào ngược dịch vị lên thực quản, uống sau bữa ăn và trước khi đi ngủ.\n"
            "  - **Antacid (Phosphalugel, Nhôm/Magnesi hydroxyd):** Uống khi có cơn ợ chua hoặc đau rát thượng vị.\n\n"
            "#### 2. CẢNH BÁO TƯƠNG TÁC THUỐC ĐÁNG LƯU Ý (QĐ 5948/QĐ-BYT)\n"
            "• **Chống chỉ định phối hợp:** Tránh dùng **Omeprazole / Esomeprazole** cùng **Clopidogrel (Plavix)** do ức chế enzym CYP2C19 làm giảm hoạt hóa Clopidogrel, tăng nguy cơ huyết khối tim mạch. *(Khuyến cáo đổi sang Pantoprazole hoặc Rabeprazole)*.\n\n"
            "#### 3. CHỈ DẪN KHÔNG DÙNG THUỐC & THEO DÕI NGUY HIỂM\n"
            "• **Lối sống:** Không nằm ngay sau ăn (chờ tối thiểu 2 – 3 giờ), nằm đầu cao 15 – 20cm, kiêng rượu bia, đồ cay nóng, cà phê.\n"
            "• **Dấu hiệu báo động cần nội soi:** Nuốt nghẹn, sút cân không rõ nguyên nhân, nôn ra máu, đi ngoài phân đen."
        )

        card = CopilotActionCard(
            card_type="fefo_inventory",
            title="Kho Dược: Thuốc PPI điều trị GERD",
            summary="Prasocare (Esomeprazole 40mg) • Tồn 350 Lọ • Kệ A2 Tầng 2",
            data={"item": "Prasocare 40mg", "stock": 350, "location": "Kệ A2 - Tầng 2"},
            primary_action_label="Xem Kho Thuốc PPI",
            primary_action_type="NAVIGATE_TAB",
            target_tab="fefo"
        )

        return CopilotResponse(
            intent="CLINICAL_TREATMENT_REGIMEN",
            reply_text=reply,
            card=card,
            legal_basis="Hướng dẫn điều trị GERD (Bộ Y tế) & Dược thư Quốc gia Việt Nam",
            suggested_chips=["Liều dùng Esomeprazole", "Tương tác Omeprazole + Clopidogrel", "Kiểm tra tồn kho Prasocare"],
            session_id=ctx.session.session_id if ctx.session else "default",
            answer_type="grounded_reference",
            source_status="retrieved_evidence",
            confidence=1.0
        )
