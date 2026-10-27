"""
Kịch bản 13: Amiodaron 200mg & Kéo Dài Khoảng QT / Xoắn Đỉnh Torsades de Pointes (Dược thư 2015 Trang 112)
Dữ liệu CSDL: Lô b-17 - Tủ thuốc Hồi sức Cấp cứu Tim Mạch (Tồn 180 Viên)
"""

from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas.copilot import CopilotResponse, CopilotActionCard
from app.services.scenarios.base import BaseScenario
from app.services.scenarios.context import ClinicalContext

class AmiodaroneQtScenario(BaseScenario):
    scenario_id = "amiodarone_qt"
    scenario_name = "Cảnh báo Amiodaron 200mg & Kéo dài khoảng QT"

    def can_handle(self, query: str, lower_query: str, ctx: ClinicalContext) -> bool:
        matches_drug = "amiodaron" in lower_query or "amiodarone" in lower_query or (
            ctx.is_med_follow_up and ctx.active_medication_name and "amiodaron" in ctx.active_medication_name.lower()
        )
        has_keywords = any(w in lower_query for w in ["qt", "xoắn đỉnh", "torsades", "chống chỉ định", "tương tác", "tác dụng phụ", "loạn nhịp", "điện tâm đồ", "ecg", "là thuốc gì", "thông tin", "tồn kho"])
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
                name="Amiodarone Hydrochloride Tablets 200mg",
                ingredient="Amiodaron hydroclorid",
                batch="LOT-AM25-C1",
                stock="180 Viên",
                location="Tủ thuốc Hồi sức Cấp cứu Tim Mạch"
            )

        reply = (
            f"### 🫀 CẢNH BÁO AN TOÀN THUỐC LOẠN NHỊP: AMIODARON 200MG (DƯỢC THƯ TRANG 112)\n\n"
            f"• **Dữ liệu kho viện:** Lô `b-17` - `LOT-AM25-C1`, hiện tồn **180 Viên** tại **Tủ thuốc Hồi sức Cấp cứu Tim Mạch**.\n"
            f"• **Đặc tính dược lý học:** Thuốc chống loạn nhịp nhóm III, thời gian bán thải ($t_{{1/2}}$) cực dài (khoảng **20 - 100 ngày**) và tích lũy mô mỡ.\n"
            f"• **Cảnh báo tương tác gây xoắn đỉnh (Torsades de Pointes):**\n"
            f"  - **Chống chỉ định tuyệt đối** phối hợp với các thuốc gây kéo dài khoảng QT (Quinolone như Levofloxacin/Moxifloxacin, Macrolide như Erythromycin/Clarithromycin, thuốc chống loạn thần Haloperidol).\n"
            f"  - Bắt buộc kiểm tra điện giải đồ (Kali, Magie máu) trước và trong khi dùng; hạ Kali máu sẽ kích hoạt loạn nhịp thất chết người.\n"
            f"• **Theo dõi lâm sàng bắt buộc:** Đo ECG ghi nhận khoảng QTc ban đầu và định kỳ; ngừng thuốc nếu QTc > 500 ms; kiểm tra chức năng tuyến giáp và chụp X-quang phổi định kỳ do nguy cơ xơ phổi."
        )
        card = CopilotActionCard(
            card_type="medication_safety",
            title="Thuốc Chống Loạn Nhịp: Amiodaron 200mg",
            summary="Cảnh báo kéo dài khoảng QT & Xoắn đỉnh • Theo dõi ECG liên tục",
            data={"drug": "Amiodaron 200mg", "stock": 180, "location": "Tủ Hồi sức Tim Mạch", "risk": "QTc > 500ms"},
            primary_action_label="Xem Tủ Thuốc Tim Mạch",
            primary_action_type="NAVIGATE_TAB",
            target_tab="fefo"
        )
        return CopilotResponse(
            intent="CLINICAL_AMIODARONE_QT_ALERT",
            reply_text=reply,
            card=card,
            legal_basis="Dược Thư Quốc Gia 2015 Trang 112 & Hướng dẫn Cấp cứu Loạn nhịp Tim VNHA/BYT",
            suggested_chips=["Xem đơn bù điện giải Kali", "Kiểm tra tồn kho Amiodaron", "Đối soát ca trực 07:00 AM"]
        )
