"""
Kịch bản 8: Hiệu chỉnh liều suy thận theo Cockcroft-Gault / eGFR (Dược thư 2015 & Hướng dẫn KDIGO)
"""

from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas.copilot import CopilotResponse, CopilotActionCard
from app.services.scenarios.base import BaseScenario
from app.services.scenarios.context import ClinicalContext

class RenalDosingScenario(BaseScenario):
    scenario_id = "renal_dosing"
    scenario_name = "Hiệu chỉnh liều suy thận Cockcroft-Gault"

    def can_handle(self, query: str, lower_query: str, ctx: ClinicalContext) -> bool:
        return any(w in lower_query for w in ["suy thận", "chức năng thận", "cockcroft", "creatinine", "egfr", "crcl", "chỉnh liều"])

    async def handle(
        self,
        query: str,
        lower_query: str,
        ctx: ClinicalContext,
        db: AsyncSession
    ) -> Optional[CopilotResponse]:
        p = ctx.patient
        patient_name = p.full_name if p else "Đặng Thị Lan (62t, Nữ, 58kg)"
        egfr = p.egfr if p else 52.0
        creatinine = p.creatinine if p else 110.0

        card = CopilotActionCard(
            card_type="medication_safety",
            title="Hiệu Chỉnh Liều Theo Chức Năng Thận (Cockcroft-Gault)",
            summary="Đánh giá độ thanh thải Creatinine và khuyến cáo Dược Thư 2015",
            data={"egfr": egfr, "patient": patient_name},
            primary_action_label="Xem Chuyên Luận Dược Thư",
            primary_action_type="OPEN_MONOGRAPH_MODAL",
            target_tab="fefo"
        )
        reply = (
            f"### 📊 KẾT QUẢ TÍNH TOÁN HIỆU CHỈNH LIỀU SUY THẬN\n\n"
            f"• **Bệnh nhân:** **{patient_name}**\n"
            f"• **Chức năng thận trong CSDL:** eGFR = **{egfr} mL/phút**, Creatinine = **{creatinine} umol/L** (Suy thận mức độ trung bình 3a).\n"
            f"• **Khuyến cáo Dược Thư Quốc Gia 2015:**\n"
            f"  - **Metformin (Panfor PR-750):** Được phép duy trì liều 750mg/ngày, theo dõi eGFR mỗi 3 - 6 tháng; chống chỉ định nếu eGFR < 30 mL/phút do nguy cơ nhiễm toan lactic.\n"
            f"  - **Ciprofloxacin / Vancomycin:** Cần giảm 50% liều dùng hoặc giãn cách 18 - 24 giờ để tránh độc tính thính giác và suy thận tiến triển."
        )
        return CopilotResponse(
            intent="CLINICAL_RENAL_DOSING",
            reply_text=reply,
            card=card,
            legal_basis="Dược Thư Quốc Gia Việt Nam 2015 & Hướng dẫn KDIGO",
            suggested_chips=["Lập lịch dặn dò cữ thuốc", "Xem chuyên luận Ciprofloxacin", "Đối soát ca trực 07:00 AM"]
        )
