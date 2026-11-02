"""
Kịch bản 6: Phác đồ Adrenalin Cấp Cứu Sốc Phản Vệ (Thông tư 51/2017/TT-BYT)
"""

from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas.copilot import CopilotResponse, CopilotActionCard
from app.services.scenarios.base import BaseScenario
from app.services.scenarios.context import ClinicalContext

class AnaphylaxisScenario(BaseScenario):
    scenario_id = "anaphylaxis"
    scenario_name = "Phác đồ Adrenalin Phản Vệ TT 51/2017"

    def can_handle(self, query: str, lower_query: str, ctx: ClinicalContext) -> bool:
        has_anaphylaxis_context = any(w in lower_query for w in ["phản vệ", "sốc phản vệ", "tt 51", "thông tư 51", "phác đồ phản vệ"])
        has_active_adrenaline = bool(ctx.active_medication_name and any(w in ctx.active_medication_name.casefold() for w in ["adrenalin", "hadunalin"]))
        explicit_adrenaline_protocol_question = any(w in lower_query for w in ["adrenalin", "hadunalin"]) and any(w in lower_query for w in ["liều", "tiêm", "nhắc lại", "phác đồ", "đường dùng"])
        has_red_flag_symptoms = any(w in lower_query for w in ["khó thở", "thở rít", "tụt huyết áp", "mày đay", "phù môi", "phù thanh quản", "phản vệ"])
        return has_anaphylaxis_context and (
            has_red_flag_symptoms or has_active_adrenaline or explicit_adrenaline_protocol_question
        ) or explicit_adrenaline_protocol_question and any(w in lower_query for w in ["phác đồ", "liều", "nhắc lại"])

    async def handle(
        self,
        query: str,
        lower_query: str,
        ctx: ClinicalContext,
        db: AsyncSession
    ) -> Optional[CopilotResponse]:
        if ctx.session:
            ctx.session.set_active_medication(
                name="Hadunalin 1 mg/ml",
                ingredient="Adrenalin",
                batch="LOT-AD24-E1",
                stock="30 Ống",
                location="Tủ cấp cứu Hồi sức A9 (Ngăn A - TT 51/2017)"
            )

        reply = (
            f"### ⚡ PHÁC ĐỒ CẤP CỨU SỐC PHẢN VỆ BẰNG ADRENALIN (THÔNG TƯ 51/2017/TT-BYT)\n\n"
            f"• **Cơ số cấp cứu tại viện:** Hadunalin 1mg/1ml (`LOT-AD24-E1`) - Hiện tồn **30 ống** tại Tủ cấp cứu Hồi sức A9.\n"
            f"• **Hành động cấp cứu tức thì (Áp dụng từ Phản vệ Độ II trở lên):**\n"
            f"  1. **Ngừng ngay tiếp xúc** với dị nguyên / thuốc đang truyền.\n"
            f"  2. **Tiêm bắp Adrenalin ngay lập tức vào mặt trước ngoài đùi:**\n"
            f"     - Người lớn: **1/2 ống (0.5 mg)**.\n"
            f"     - Trẻ em >30kg: 1/2 ống (0.5 mg); Trẻ 10-30kg: 1/3 - 1/4 ống (0.2 - 0.3 mg).\n"
            f"  3. **Theo dõi huyết áp:** Nhắc lại liều tiêm bắp sau mỗi **3 - 5 phút** nếu huyết áp chưa nâng lên hoặc còn khó thở.\n"
            f"  4. Đặt bệnh nhân nằm đầu thấp, thở oxy gọng kính 6 - 8 lít/phút, lập 2 đường truyền tĩnh mạch lớn với Natri clorid 0.9%."
        )
        card = CopilotActionCard(
            card_type="medication_safety",
            title="Hộp Thuốc Cấp Cứu Phản Vệ: Hadunalin 1mg/ml",
            summary="Tiêm bắp mặt trước ngoài đùi 1/2 ống ngay lập tức (TT 51/2017/TT-BYT)",
            data={"drug": "Hadunalin (Adrenalin 1mg/ml)", "stock": 30, "location": "Tủ cấp cứu A9"},
            primary_action_label="Xem Phác Đồ TT 51/2017",
            primary_action_type="OPEN_MED_SAFETY",
            target_tab="debts"
        )
        return CopilotResponse(
            intent="CLINICAL_ANAPHYLAXIS_EMERGENCY",
            reply_text=reply,
            card=card,
            legal_basis="Thông tư 51/2017/TT-BYT Hướng dẫn phòng, chẩn đoán và xử trí phản vệ",
            suggested_chips=["Xem tủ cấp cứu Hồi sức A9", "Đối soát ca trực 07:00 AM", "Tra cứu đơn RX-2026-004"]
        )
