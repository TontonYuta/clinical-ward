"""
Kịch bản 4: Cảnh báo Thuốc Nguy Cơ Cao (High-Alert): Kali Clorid 10% (Dược thư 2015 Trang 788)
"""

from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas.copilot import CopilotResponse, CopilotActionCard
from app.services.scenarios.base import BaseScenario
from app.services.scenarios.context import ClinicalContext

class HighAlertKclScenario(BaseScenario):
    scenario_id = "high_alert_kcl"
    scenario_name = "Cảnh báo Thuốc Nguy Cơ Cao Kali Clorid 10%"

    def can_handle(self, query: str, lower_query: str, ctx: ClinicalContext) -> bool:
        return ("kali" in lower_query or "kcl" in lower_query) and any(
            w in lower_query for w in ["tiêm", "tiêm trực tiếp", "pha truyền", "high-alert", "cảnh báo đỏ", "nguy cơ cao", "nồng độ", "ecg"]
        )

    async def handle(
        self,
        query: str,
        lower_query: str,
        ctx: ClinicalContext,
        db: AsyncSession
    ) -> Optional[CopilotResponse]:
        if ctx.session:
            ctx.session.set_active_medication(
                name="Kali clorid 10%",
                ingredient="Kali clorid",
                batch="LOT-KC24-08",
                stock="60 Ống",
                location="Tủ thuốc Nguy cơ cao High-Alert"
            )

        reply = (
            f"### 🚨 CẢNH BÁO THUỐC NGUY CƠ CAO (HIGH-ALERT): KALI CLORID 10%\n\n"
            f"• **Dữ liệu kho thuốc:** Lô `b-5` - `LOT-KC24-08`, nồng độ 1g/10ml, hiện tồn **60 ống** tại Tủ thuốc Nguy cơ cao (Dán nhãn đỏ High-Alert).\n"
            f"• **CẢNH BÁO TỐI KHẨN CẤP:** **CẤM TUYỆT ĐỐI TIÊM TĨNH MẠCH TRỰC TIẾP!** Tiêm bolus trực tiếp sẽ gây tăng kali máu cấp dẫn tới ngừng tim tức thì.\n"
            f"• **Quy chuẩn pha truyền theo Dược Thư 2015 (Trang 788):**\n"
            f"  - Bắt buộc pha loãng trong Natri clorid 0.9% hoặc Glucose 5%.\n"
            f"  - Nồng độ truyền ngoại vi không vượt quá **40 mEq/L** (khoảng 3g/L).\n"
            f"  - Tốc độ truyền tối đa **10 - 20 mEq/giờ**, bắt buộc dùng máy truyền dịch hoặc bơm tiêm điện và theo dõi điện tâm đồ liên tục (Monitor ECG)."
        )
        card = CopilotActionCard(
            card_type="fefo_inventory",
            title="Thuốc High-Alert: Kali Clorid 10%",
            summary="Cấm tiêm tĩnh mạch trực tiếp • Bắt buộc pha loãng theo Dược Thư 2015",
            data={"item": "Kali clorid 10%", "batch": "LOT-KC24-08", "stock": 60},
            primary_action_label="Xem Tủ Thuốc High-Alert",
            primary_action_type="NAVIGATE_TAB",
            target_tab="fefo"
        )
        return CopilotResponse(
            intent="CLINICAL_HIGH_ALERT_POTASSIUM",
            reply_text=reply,
            card=card,
            legal_basis="Dược Thư Quốc Gia 2015 Trang 788 & Danh mục High-Alert ISMP/BYT",
            suggested_chips=["Xem đơn bù điện giải RX-2026-001", "Kiểm tra tồn kho High-Alert", "Thẩm định đơn thuốc theo TT 26"]
        )
