"""
Kịch bản 16: Salbutamol 2,5mg/2,5ml - Khí Dung Cơn Hen Phế Quản Ác Tính (Dược thư 2015 Trang 1234)
Dữ liệu CSDL: Đơn RX-2026-008 (Vũ Đình Hưng - J45.9), Lô b-15 (300 Ống tại Tủ thuốc Cấp cứu Hô hấp A9)
"""

from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas.copilot import CopilotResponse, CopilotActionCard
from app.services.scenarios.base import BaseScenario
from app.services.scenarios.context import ClinicalContext

class SalbutamolAsthmaScenario(BaseScenario):
    scenario_id = "salbutamol_asthma"
    scenario_name = "Salbutamol Khí Dung Cơn Hen Phế Quản"

    def can_handle(self, query: str, lower_query: str, ctx: ClinicalContext) -> bool:
        matches_drug = "salbutamol" in lower_query or "ventolin" in lower_query or "rx-2026-008" in lower_query or "vũ đình hưng" in lower_query or (
            ctx.is_med_follow_up and ctx.active_medication_name and "salbutamol" in ctx.active_medication_name.lower()
        )
        has_keywords = any(w in lower_query for w in ["hen", "khí dung", "phế quản", "nhịp tim", "hạ kali", "co thắt", "liều", "tác dụng phụ", "tồn kho"])
        return matches_drug and (has_keywords or ctx.is_med_follow_up)

    async def handle(
        self,
        query: str,
        lower_query: str,
        ctx: ClinicalContext,
        db: AsyncSession
    ) -> Optional[CopilotResponse]:
        if ctx.session:
            ctx.session.set_active_medication(
                name="Salbutamol 2,5 mg/ 2,5 ml",
                ingredient="Salbutamol sulfat",
                batch="LOT-SB25-K1",
                stock="300 Ống",
                location="Tủ thuốc Cấp cứu Hô hấp A9"
            )

        reply = (
            f"### 🫁 PHÁC ĐỒ KHÍ DUNG KHẨN CẤP: SALBUTAMOL 2,5MG (DƯỢC THƯ TRANG 1234)\n\n"
            f"• **Bệnh án & Đơn thuốc liên quan:** `RX-2026-008` - Bệnh nhân **Vũ Đình Hưng** (Cơn hen phế quản ác tính - ICD-10: `J45.9`).\n"
            f"• **Dữ liệu kho thuốc:** Lô `b-15` - `LOT-SB25-K1`, hiện tồn **300 Ống** tại **Tủ thuốc Cấp cứu Hô hấp A9**.\n"
            f"• **Cơ chế & Phương pháp sử dụng chuẩn:**\n"
            f"  - Chủ vận chọn lọc thụ thể $\\beta_2$-adrenergic trên cơ trơn phế quản, khởi phát tác dụng giãn phế quản sau 2 - 3 phút.\n"
            f"  - Dùng khí dung qua buồng đệm / máy phun khí dung (Nebulizer) với lưu lượng oxy **6 - 8 lít/phút** trong 10 - 15 phút.\n"
            f"  - Trong cơn hen nặng, có thể nhắc lại mỗi 20 phút trong giờ đầu tiên (tổng cộng 3 cữ).\n"
            f"• **Hai tác dụng phụ lâm sàng quan trọng cần giám sát:**\n"
            f"  1. **Tim đập nhanh (Sinus Tachycardia) & Đánh trống ngực:** Do kích thích thụ thể $\\beta_1$ tại tim khi dùng liều cao.\n"
            f"  2. **Hạ Kali máu cấp (Hypokalemia):** Salbutamol kích thích bơm Na+/K+-ATPase đưa Kali từ ngoại bào vào trong tế bào. Cần xét nghiệm điện giải đồ nếu phải khí dung liên tục."
        )
        card = CopilotActionCard(
            card_type="cpoe_prescription",
            title="Đơn Thuốc Cấp Cứu Hô Hấp: Vũ Đình Hưng",
            summary="Cơn hen phế quản J45.9 • Khí dung Salbutamol 2.5mg • Giám sát nhịp tim & Kali",
            data={"patient": "Vũ Đình Hưng", "medication": "Salbutamol 2.5mg/2.5ml", "prescriptionId": "RX-2026-008"},
            primary_action_label="Mở Đơn Thuốc RX-2026-008",
            primary_action_type="NAVIGATE_TAB",
            target_tab="cpoe"
        )
        return CopilotResponse(
            intent="CLINICAL_SALBUTAMOL_ASTHMA_PROTOCOL",
            reply_text=reply,
            card=card,
            legal_basis="Dược Thư Quốc Gia 2015 Trang 1234 & Phác đồ Cấp cứu Cơn hen Phế quản GINA/BYT",
            suggested_chips=["Xem đơn thuốc RX-2026-008", "Kiểm tra Tủ cấp cứu Hô hấp A9", "Đối soát ca trực 07:00 AM"]
        )
