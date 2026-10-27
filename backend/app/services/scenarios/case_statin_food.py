"""
Kịch bản 3: Thẩm định Đơn Ngoại trú & Tương tác Bưởi chùm - Statin CYP3A4 (Dược thư 2015 Trang 175)
"""

from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas.copilot import CopilotResponse, CopilotActionCard
from app.services.scenarios.base import BaseScenario
from app.services.scenarios.context import ClinicalContext

class StatinFoodScenario(BaseScenario):
    scenario_id = "statin_food"
    scenario_name = "Tương tác Bưởi chùm - Statin"

    def can_handle(self, query: str, lower_query: str, ctx: ClinicalContext) -> bool:
        return ("atorvastatin" in lower_query or "statin" in lower_query or "rx-2026-012" in lower_query or "safeesem" in lower_query) and any(
            w in lower_query for w in ["bưởi", "nước bưởi", "bưởi chùm", "grapefruit", "uống cùng", "thức ăn", "xuất viện", "dặn dò"]
        )

    async def handle(
        self,
        query: str,
        lower_query: str,
        ctx: ClinicalContext,
        db: AsyncSession
    ) -> Optional[CopilotResponse]:
        reply = (
            f"### ⚠️ THẨM ĐỊNH ĐƠN NGOẠI TRÚ & TƯƠNG TÁC THỨC ĂN (RX-2026-012)\n\n"
            f"• **Bệnh nhân:** **Võ Minh Trí** (`BN-8820`) - Chẩn đoán: Tăng huyết áp & Rối loạn lipid máu mạn tính.\n"
            f"• **Danh mục thuốc kê:** Safeesem 5 (S-amlodipine 5mg) & Atorvastatin Sandoz 20mg.\n"
            f"• **Cảnh báo tương tác thực phẩm nghiêm trọng:**\n"
            f"  - **TUYỆT ĐỐI KHÔNG uống Atorvastatin cùng nước ép bưởi chùm (Grapefruit):** Furanocoumarin trong bưởi chùm ức chế không hồi phục enzym CYP3A4 tại ruột, làm tăng nồng độ Statin trong máu lên **gấp 2.5 - 3 lần**, dẫn tới nguy cơ **tiêu cơ vân cấp (Rhabdomyolysis)** và suy thận cấp!\n"
            f"• **Hướng dẫn thời điểm dùng thuốc tối ưu:**\n"
            f"  - `Safeesem 5`: Uống 1 viên vào **buổi sáng** sau ăn để kiểm soát huyết áp ban ngày.\n"
            f"  - `Atorvastatin 20mg`: Uống 1 viên vào **buổi tối trước khi đi ngủ** (thời điểm gan tổng hợp cholesterol cao nhất)."
        )
        card = CopilotActionCard(
            card_type="prescription_advice",
            title="Phiếu Dặn Dò Xuất Viện: Võ Minh Trí",
            summary="Đơn thuốc RX-2026-012 • Cảnh báo tương tác nước ép bưởi chùm CYP3A4",
            data={"patient": "Võ Minh Trí", "prescriptionId": "RX-2026-012"},
            primary_action_label="Lập Lịch Dặn Dò BN",
            primary_action_type="OPEN_PRESCRIPTION_ADVICE",
            target_tab="cpoe"
        )
        return CopilotResponse(
            intent="CLINICAL_STATIN_GRAPEFRUIT_INTERACTION",
            reply_text=reply,
            card=card,
            legal_basis="Dược Thư Quốc Gia 2015 Trang 175 & QĐ 5948/QĐ-BYT",
            suggested_chips=["Lập lịch dặn dò cữ thuốc", "Gửi email dặn dò bệnh nhân", "Xem đơn RX-2026-012"]
        )
