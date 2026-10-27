"""
Kịch bản 5: Quy chế Quản lý Thuốc Gây Nghiện & Quy đổi Opioid MME (Thông tư 20/2017/TT-BYT)
"""

from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas.copilot import CopilotResponse, CopilotActionCard
from app.services.scenarios.base import BaseScenario
from app.services.scenarios.context import ClinicalContext

class OpioidMmeScenario(BaseScenario):
    scenario_id = "opioid_mme"
    scenario_name = "Quy chế Thuốc Gây Nghiện & Quy đổi Opioid"

    def can_handle(self, query: str, lower_query: str, ctx: ClinicalContext) -> bool:
        return any(w in lower_query for w in ["quy đổi", "mme", "tương đương", "morphin", "fentanyl"]) and any(
            w in lower_query for w in ["sang", "uống", "tiêm", "vỏ", "trả vỏ", "tt 20", "liều"]
        )

    async def handle(
        self,
        query: str,
        lower_query: str,
        ctx: ClinicalContext,
        db: AsyncSession
    ) -> Optional[CopilotResponse]:
        reply = (
            f"### 📋 QUY CHẾ QUẢN LÝ THUỐC GÂY NGHIỆN & QUY ĐỔI OPIOID (TT 20/2017/TT-BYT)\n\n"
            f"• **Thuốc trong CSDL kho viện:**\n"
            f"  - `Morphin hydroclorid 10mg/1ml` (`LOT-MP24-X4`): Tồn **35 ống** (Tủ sắt 2 khóa).\n"
            f"  - `Fentanyl 50 mcg/ml (0.1mg/2ml)` (`LOT-FT25-A2`): Tồn **160 ống** (Tủ sắt 2 khóa).\n"
            f"• **Hệ số quy đổi tương đương giảm đau (Equianalgesic):**\n"
            f"  - **10 mg Morphin tiêm tĩnh mạch** $\\approx$ **100 mcg (0.1 mg) Fentanyl tiêm tĩnh mạch**.\n"
            f"• **Quy định pháp lý bắt buộc (Thông tư 20/2017/TT-BYT):**\n"
            f"  - Mượn rút thuốc gây nghiện cấp cứu ca đêm bắt buộc có **2 nhân viên y tế chứng kiến và ký biên bản**.\n"
            f"  - Giữ lại toàn bộ vỏ ống thuốc đã sử dụng trong khay khóa đối soát ca trực 07:00 AM.\n"
            f"  - Hội đồng tiêu hủy vỏ ống thuốc gây nghiện họp định kỳ và lập biên bản tiêu hủy."
        )
        card = CopilotActionCard(
            card_type="debt_settle",
            title="Đối Soát Vỏ Thuốc Gây Nghiện Morphin / Fentanyl",
            summary="Quy chuẩn quản lý thuốc kiểm soát đặc biệt (Thông tư 20/2017/TT-BYT)",
            data={"morphinStock": 35, "fentanylStock": 160},
            primary_action_label="Xác Nhận Thu Hồi Vỏ Ống",
            primary_action_type="OPEN_DEBT_SETTLE",
            target_tab="debts"
        )
        return CopilotResponse(
            intent="CLINICAL_OPIOID_REGULATION",
            reply_text=reply,
            card=card,
            legal_basis="Thông tư 20/2017/TT-BYT & Hướng dẫn Giảm đau Bộ Y Tế",
            suggested_chips=["Đối soát ca trực 07:00 AM", "Xem đơn thuốc RX-2026-001", "Kiểm tra sổ nợ tủ trực"]
        )
