"""
Kịch bản 14: Noradrenalin 4mg/4ml Trong Sốc Nhiễm Trùng Kháng Dịch (Dược thư 2015 Trang 1032 & QĐ 5948/BYT)
Dữ liệu CSDL: Đơn RX-2026-005 (Trần Văn Toàn), Lô b-6 (120 Ống tại Tủ cấp cứu Hồi sức A9 Ngăn B)
"""

from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas.copilot import CopilotResponse, CopilotActionCard
from app.services.scenarios.base import BaseScenario
from app.services.scenarios.context import ClinicalContext

class NoradrenalinShockScenario(BaseScenario):
    scenario_id = "noradrenalin_shock"
    scenario_name = "Noradrenalin 4mg/4ml Sốc Nhiễm Trùng"

    def can_handle(self, query: str, lower_query: str, ctx: ClinicalContext) -> bool:
        mentions_noradrenaline = any(term in lower_query for term in ("noradrenalin", "norepinephrine", "rx-2026-005", "trần văn toàn"))
        mentions_alternative_pressor = any(term in lower_query for term in ("dopamin", "dobutamin", "adrenalin", "vasopressin"))
        is_explicit_noradrenaline_followup = bool(
            ctx.is_med_follow_up and ctx.active_medication_name
            and "noradrenalin" in ctx.active_medication_name.casefold()
            and not mentions_alternative_pressor
        )
        matches_drug = mentions_noradrenaline and not mentions_alternative_pressor or is_explicit_noradrenaline_followup
        has_keywords = any(w in lower_query for w in ["sốc", "sốc nhiễm trùng", "nhiễm khuẩn", "vận mạch", "cvc", "đường truyền", "tĩnh mạch trung tâm", "hoại tử", "thoát mạch", "liều", "pha truyền", "pha", "tồn kho"])
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
                name="Noradrenalin 4mg/4ml",
                ingredient="Noradrenalin tartrat",
                batch="LOT-NA24-R3",
                stock="120 Ống",
                location="Tủ cấp cứu Hồi sức A9 (Ngăn B)"
            )

        reply = (
            f"### ⚡ QUY CHUẨN DÙNG THUỐC VẬN MẠCH: NORADRENALIN 4MG/4ML (DƯỢC THƯ TRANG 1032)\n\n"
            f"• **Bệnh án & Đơn thuốc liên quan:** `RX-2026-005` - Bệnh nhân **Trần Văn Toàn** (Sốc nhiễm trùng kháng dịch, tụt HA nặng).\n"
            f"• **Tồn kho thực tế viện:** Lô `b-6` - `LOT-NA24-R3`, hiện tồn **120 Ống** tại **Tủ cấp cứu Hồi sức A9 (Ngăn B)**.\n"
            f"• **Quy chuẩn đường truyền bắt buộc (An toàn người bệnh):**\n"
            f"  - **Bắt buộc truyền qua Catheter tĩnh mạch trung tâm (CVC)** bằng bơm tiêm điện/máy truyền dịch tự động.\n"
            f"  - **TUYỆT ĐỐI KHÔNG tiêm bắp hoặc truyền tĩnh mạch ngoại vi kéo dài:** Tác dụng co mạch $\\alpha_1$ cực mạnh sẽ gây thiếu máu cục bộ dẫn tới **hoại tử mô nghiêm trọng (Extravasation necrosis)**!\n"
            f"• **Dung dịch pha truyền khuyến cáo:** Pha trong Glucose 5% hoặc Glucose 5% trong NaCl 0.9% (Dextrose bảo vệ chống oxy hóa Noradrenalin); không dùng dung dịch kiềm (Natri bicarbonat) vì làm bất hoạt hoạt chất.\n"
            f"• **Mục tiêu huyết áp (Surviving Sepsis Campaign):** Duy trì Huyết áp động mạch trung bình (MAP) $\\ge 65$ mmHg."
        )
        card = CopilotActionCard(
            card_type="cpoe_prescription",
            title="Đơn Thuốc Noradrenalin 4mg/4ml: Trần Văn Toàn",
            summary="Sốc nhiễm trùng R57.2 • Bắt buộc truyền qua CVC bằng bơm tiêm điện",
            data={"patient": "Trần Văn Toàn", "medication": "Noradrenalin 4mg/4ml", "prescriptionId": "RX-2026-005"},
            primary_action_label="Mở Đơn Thuốc RX-2026-005",
            primary_action_type="NAVIGATE_TAB",
            target_tab="cpoe"
        )
        return CopilotResponse(
            intent="CLINICAL_NORADRENALIN_SEPSIS_PROTOCOL",
            reply_text=reply,
            card=card,
            legal_basis="Dược Thư Quốc Gia 2015 Trang 1032 & Hướng dẫn Chẩn đoán Sốc Nhiễm Trùng Bộ Y Tế",
            suggested_chips=["Xem đơn thuốc RX-2026-005", "Kiểm tra cơ số Tủ cấp cứu A9", "Đối soát ca trực 07:00 AM"]
        )
