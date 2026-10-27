"""
Kịch bản 17: Prasocare (Esomeprazole 40mg Tiêm Tĩnh Mạch) - Xuất Huyết Tiêu Hóa Do Loét (Dược thư 2015 Trang 586)
Dữ liệu CSDL: Bệnh nhân BN-8791 (Nguyễn Hải Đăng), Lô b-16 (350 Lọ tại Kho Dược Nội Trú - Kệ A2 Tầng 2)
"""

from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas.copilot import CopilotResponse, CopilotActionCard
from app.services.scenarios.base import BaseScenario
from app.services.scenarios.context import ClinicalContext

class EsomeprazoleUlcerScenario(BaseScenario):
    scenario_id = "esomeprazole_ulcer"
    scenario_name = "Prasocare Esomeprazole 40mg Loét Xuất Huyết"

    def can_handle(self, query: str, lower_query: str, ctx: ClinicalContext) -> bool:
        matches_drug = "prasocare" in lower_query or "esomeprazol" in lower_query or "esomeprazole" in lower_query or "nguyễn hải đăng" in lower_query or "bn-8791" in lower_query or (
            ctx.is_med_follow_up and ctx.active_medication_name and "prasocare" in ctx.active_medication_name.lower()
        )
        has_keywords = any(w in lower_query for w in ["loét", "dạ dày", "xuất huyết", "tiêu hóa", "tiêm tĩnh mạch", "pha truyền", "ph", "ppi", "tồn kho"])
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
                name="Prasocare (Esomeprazole 40mg)",
                ingredient="Esomeprazole natri 40mg",
                batch="LOT-PS25-E4",
                stock="350 Lọ",
                location="Kho Dược Nội Trú (Kệ A2 - Tầng 2)"
            )

        reply = (
            f"### 🛡️ PHÁC ĐỒ ỨC CHẾ TIẾT ACID: PRASOCARE (ESOMEPRAZOLE 40MG TIÊM TM) (DƯỢC THƯ TRANG 586)\n\n"
            f"• **Hồ sơ bệnh nhân trong CSDL:** `BN-8791` - **Nguyễn Hải Đăng** (45t, Tiền sử: Loét dạ dày tá tràng mạn tính, GERD).\n"
            f"• **Dữ liệu kho thuốc:** Lô `b-16` - `LOT-PS25-E4`, hiện tồn **350 Lọ** tại **Kho Dược Nội Trú (Kệ A2 - Tầng 2)**.\n"
            f"• **Chỉ định cấp tính & Mục tiêu sinh lý:**\n"
            f"  - Điều trị và dự phòng tái xuất huyết sau nội soi can thiệp loét dạ dày - tá tràng.\n"
            f"  - Mục tiêu duy trì **pH dịch vị $\\ge 6.0$** liên tục để tạo điều kiện tối ưu cho sự kết tập tiểu cầu và ổn định cục máu đông.\n"
            f"• **Quy chuẩn tiêm truyền tĩnh mạch (Dược Thư 2015):**\n"
            f"  - **Tiêm tĩnh mạch chậm:** Hoàn nguyên lọ 40mg với 5 mL Natri clorid 0.9%, tiêm chậm tối thiểu **trong 3 phút**.\n"
            f"  - **Truyền tĩnh mạch ngắt quãng:** Pha trong 100 mL Natri clorid 0.9% hoặc Glucose 5%, truyền trong 10 - 30 phút.\n"
            f"• **Tương tác thuốc đáng lưu ý:** Esomeprazole ức chế nhẹ enzym CYP2C19; có thể làm giảm hoạt tính chống kết tập tiểu cầu của Clopidogrel (Plavix) khi dùng chung dài ngày."
        )
        card = CopilotActionCard(
            card_type="fefo_inventory",
            title="Kho Dược: Prasocare (Esomeprazole 40mg)",
            summary="Tồn 350 Lọ • Kệ A2 - Tầng 2 • Phác đồ duy trì pH dạ dày >= 6.0",
            data={"item": "Prasocare 40mg", "stock": 350, "location": "Kệ A2 - Tầng 2", "patient": "Nguyễn Hải Đăng"},
            primary_action_label="Xem Lô Thuốc Prasocare",
            primary_action_type="NAVIGATE_TAB",
            target_tab="fefo"
        )
        return CopilotResponse(
            intent="CLINICAL_ESOMEPRAZOLE_ULCER_PROTOCOL",
            reply_text=reply,
            card=card,
            legal_basis="Dược Thư Quốc Gia 2015 Trang 586 & Hướng dẫn Xử trí Xuất huyết Tiêu hóa VNAGE/BYT",
            suggested_chips=["Xem hồ sơ bệnh nhân BN-8791", "Kiểm tra tồn kho Prasocare", "Đối soát ca trực 07:00 AM"]
        )
