"""
Kịch bản 15: Diazepam Injection 10mg/2ml - Cắt Cơn Co Giật Động Kinh & Quản Lý Hướng Thần (TT 20/2017 & Dược thư Trang 520)
Dữ liệu CSDL: Đơn RX-2026-006 (Lê Hoàng Nam - G41.9), Lô b-7 (90 Ống tại Tủ sắt thuốc hướng thần)
"""

from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas.copilot import CopilotResponse, CopilotActionCard
from app.services.scenarios.base import BaseScenario
from app.services.scenarios.context import ClinicalContext

class DiazepamSeizureScenario(BaseScenario):
    scenario_id = "diazepam_seizure"
    scenario_name = "Diazepam Cắt Cơn Động Kinh & Thuốc Hướng Thần"

    def can_handle(self, query: str, lower_query: str, ctx: ClinicalContext) -> bool:
        matches_drug = "diazepam" in lower_query or "seduxen" in lower_query or "rx-2026-006" in lower_query or "lê hoàng nam" in lower_query or (
            ctx.is_med_follow_up and ctx.active_medication_name and "diazepam" in ctx.active_medication_name.lower()
        )
        has_keywords = any(w in lower_query for w in ["động kinh", "co giật", "tiêm tĩnh mạch", "tốc độ tiêm", "hướng thần", "tt 20", "tủ sắt", "liều", "ức chế hô hấp", "tồn kho"])
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
                name="Diazepam Injection BP 10mg/2ml",
                ingredient="Diazepam 5mg/ml",
                batch="LOT-DZ25-01",
                stock="90 Ống",
                location="Tủ sắt thuốc hướng thần (Khóa kép, TT 20/2017)"
            )

        reply = (
            f"### 🧠 PHÁC ĐỒ CẮT CƠN CO GIẬT: DIAZEPAM 10MG/2ML & QUẢN LÝ HƯỚNG THẦN (TT 20/2017)\n\n"
            f"• **Bệnh án & Đơn thuốc liên quan:** `RX-2026-006` - Bệnh nhân **Lê Hoàng Nam** (Cơn co giật động kinh liên tục - ICD-10: `G41.9`).\n"
            f"• **Dữ liệu kho thuốc:** Lô `b-7` - `LOT-DZ25-01`, hiện tồn **90 Ống** tại **Tủ sắt thuốc hướng thần** (Khóa kép 2 lớp, theo Thông tư 20/2017/TT-BYT).\n"
            f"• **Kỹ thuật tiêm tĩnh mạch an toàn (Dược Thư 2015 Trang 520):**\n"
            f"  - Tiêm tĩnh mạch **chậm** vào tĩnh mạch lớn (tốc độ tối đa **1 mL/phút** tương đương 5mg/phút ở người lớn).\n"
            f"  - **CẢNH BÁO:** Tiêm tĩnh mạch quá nhanh sẽ gây ngừng thở cấp (Apnea), tụt huyết áp nghiêm trọng và viêm tĩnh mạch huyết khối.\n"
            f"  - Phải chuẩn bị sẵn bóng Ambu, mask thở oxy và máy hút đờm dãi tại giường bệnh nhân.\n"
            f"• **Quy chế quản lý thuốc hướng thần (TT 20/2017/TT-BYT):**\n"
            f"  - Bắt buộc ghi chép Sổ theo dõi xuất nhập thuốc hướng thần (Mẫu 04/TT20).\n"
            f"  - Không bắt buộc thu hồi vỏ ống như thuốc gây nghiện (Morphin), nhưng phải lưu đơn thuốc và hồ sơ bệnh án tối thiểu **02 năm** kể từ ngày bệnh nhân xuất viện."
        )
        card = CopilotActionCard(
            card_type="debt_settle",
            title="Thuốc Hướng Thần: Diazepam 10mg/2ml",
            summary="Đơn RX-2026-006 • Tiêm tĩnh mạch chậm <=1ml/phút • Quản lý theo TT 20/2017",
            data={"patient": "Lê Hoàng Nam", "medication": "Diazepam 10mg/2ml", "prescriptionId": "RX-2026-006", "stock": 90},
            primary_action_label="Xem Sổ Thuốc Hướng Thần",
            primary_action_type="OPEN_DEBT_SETTLE",
            target_tab="debts"
        )
        return CopilotResponse(
            intent="CLINICAL_DIAZEPAM_SEIZURE_PROTOCOL",
            reply_text=reply,
            card=card,
            legal_basis="Dược Thư Quốc Gia 2015 Trang 520 & Thông tư 20/2017/TT-BYT",
            suggested_chips=["Xem đơn thuốc RX-2026-006", "Kiểm tra Tủ sắt thuốc hướng thần", "Đối soát ca trực 07:00 AM"]
        )
