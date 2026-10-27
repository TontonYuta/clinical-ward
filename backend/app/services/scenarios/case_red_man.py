"""
Kịch bản 2: Cảnh giác dược - Hội chứng Red Man do Vancomycin (Dược thư 2015 Trang 1455)
"""

from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas.copilot import CopilotResponse, CopilotActionCard
from app.services.scenarios.base import BaseScenario
from app.services.scenarios.context import ClinicalContext

class RedManScenario(BaseScenario):
    scenario_id = "red_man"
    scenario_name = "Hội chứng Red Man Vancomycin"

    def can_handle(self, query: str, lower_query: str, ctx: ClinicalContext) -> bool:
        return any(w in lower_query for w in ["red man", "đỏ bừng", "vancomycin", "hội chứng đỏ"]) and any(
            w in lower_query for w in ["truyền", "tác dụng phụ", "xử trí", "tốc độ", "nguyễn quốc bảo", "rx-2026-011", "adr"]
        )

    async def handle(
        self,
        query: str,
        lower_query: str,
        ctx: ClinicalContext,
        db: AsyncSession
    ) -> Optional[CopilotResponse]:
        reply = (
            f"### ⚠️ XỬ TRÍ HỘI CHỨNG RED MAN DO VANCOMYCIN (DƯỢC THƯ TRANG 1455)\n\n"
            f"• **Đơn thuốc liên quan:** `RX-2026-011` - Bệnh nhân **Nguyễn Quốc Bảo** (Nhiễm tụ cầu vàng MRSA).\n"
            f"• **Cơ chế phản ứng:** Truyền Vancomycin với tốc độ quá nhanh kích thích giải phóng Histamin trực tiếp từ dưỡng bào (Mast cell), gây đỏ bừng mặt, cổ, ngực trên, ngứa dữ dội và tụt huyết áp.\n"
            f"• **Phác đồ xử trí chuẩn:**\n"
            f"  1. Ngừng truyền Vancomycin ngay lập tức, kiểm tra dấu hiệu sinh tồn (Mạch, Huyết áp, SpO2).\n"
            f"  2. Tiêm kháng Histamin H1 (Diphenhydramin 25-50mg tiêm bắp/tĩnh mạch chậm).\n"
            f"  3. Khi triệu chứng thuyên giảm, tiếp tục truyền với **tốc độ giảm 50%** (thời gian truyền tối thiểu **60 - 100 phút**, nồng độ pha loãng không quá 5mg/mL trong NaCl 0.9%)."
        )
        card = CopilotActionCard(
            card_type="cpoe_prescription",
            title="Đơn Thuốc Vancomycin 1g: Nguyễn Quốc Bảo",
            summary="Phòng ngừa hội chứng Red Man - Yêu cầu tốc độ truyền >=60 phút",
            data={"patient": "Nguyễn Quốc Bảo", "medication": "Vancomycin 1g", "prescriptionId": "RX-2026-011"},
            primary_action_label="Mở Đơn Thuốc RX-2026-011",
            primary_action_type="NAVIGATE_TAB",
            target_tab="cpoe"
        )
        return CopilotResponse(
            intent="CLINICAL_ADR_RED_MAN",
            reply_text=reply,
            card=card,
            legal_basis="Dược Thư Quốc Gia 2015 Trang 1455 & Thông tư 51/2017/TT-BYT",
            suggested_chips=["Xem đơn thuốc RX-2026-011", "Tra cứu chuyên luận Vancomycin", "Đối soát ca trực 07:00 AM"]
        )
