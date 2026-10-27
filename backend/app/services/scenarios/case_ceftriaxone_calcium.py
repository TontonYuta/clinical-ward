"""
Kịch bản 1: Tương kỵ tử vong Ceftriaxon & Ringer Lactat / Dung dịch Calci (Dược thư 2015 Trang 371)
"""

from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas.copilot import CopilotResponse, CopilotActionCard
from app.services.scenarios.base import BaseScenario
from app.services.scenarios.context import ClinicalContext

class CeftriaxoneCalciumScenario(BaseScenario):
    scenario_id = "ceftriaxone_calcium"
    scenario_name = "Tương kỵ Ceftriaxon - Calci"

    def can_handle(self, query: str, lower_query: str, ctx: ClinicalContext) -> bool:
        return ("ceftriaxon" in lower_query or "ceftriaxona" in lower_query) and any(
            w in lower_query for w in ["calci", "calcium", "ringer", "lactat", "tương kỵ", "kết tủa", "pha chung", "truyền cùng"]
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
                name="Ceftriaxona Normon 1g",
                ingredient="Ceftriaxon",
                batch="LOT-CF24-03B",
                stock="45 Lọ",
                location="Kho Dược Nội Trú (Kệ B1 - Tầng 2)"
            )

        reply = (
            f"### ⛔ CẢNH BÁO TƯƠNG KỴ NGUY HIỂM TÍNH MẠNG (QĐ 5948/QĐ-BYT)\n\n"
            f"• **Hoạt chất:** Ceftriaxon (Lô Ceftriaxona Normon 1g - `LOT-CF24-03B`) và Dung dịch Calci / Ringer Lactat (`RX-2026-009`).\n"
            f"• **Khuyến cáo Dược thư Quốc gia 2015 (Trang 371):** **CHỐNG CHỈ ĐỊNH TUYỆT ĐỐI** phối hợp Ceftriaxon với các dung dịch chứa Calci (Ringer Lactat, Calci clorid, Calci gluconat) qua cùng hoặc khác đường truyền.\n"
            f"• **Hậu quả lâm sàng:** Nguy cơ hình thành tủa muối Ceftriaxon-Calci không tan gây tắc mạch phổi và suy thận cấp, đã có báo cáo ca tử vong ở cả trẻ sơ sinh và người lớn.\n"
            f"• **Hướng xử trí:** Thay thế dịch truyền hồi sức bằng Natri clorid 0.9% hoặc truyền Ceftriaxon cách xa các dung dịch chứa Calci ít nhất 48 giờ."
        )
        card = CopilotActionCard(
            card_type="fefo_inventory",
            title="Kiểm Tra Tương Kỵ: Ceftriaxon & Ringer Lactat",
            summary="Chống chỉ định phối hợp dung dịch chứa Calci (Dược Thư 2015 Trang 371)",
            data={"drug": "Ceftriaxon 1g", "incompatible": "Ringer Lactat / Calci"},
            primary_action_label="Xem Lô Thuốc Ceftriaxon",
            primary_action_type="NAVIGATE_TAB",
            target_tab="fefo"
        )
        return CopilotResponse(
            intent="CLINICAL_DDI_CEFTRIAXONE_CALCIUM",
            reply_text=reply,
            card=card,
            legal_basis="Dược Thư Quốc Gia 2015 Trang 371 & QĐ 5948/QĐ-BYT",
            suggested_chips=["Xem bảng kho Dược Nội Trú", "Đối soát ca trực 07:00 AM", "Tra cứu SĐK 840110304425"]
        )
