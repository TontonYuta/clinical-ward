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
        has_renal_question = any(w in lower_query for w in ["suy thận", "chức năng thận", "cockcroft", "creatinine", "egfr", "crcl", "chỉnh liều"])
        has_identified_patient = bool(ctx.patient and any(term in lower_query for term in (
            "bệnh nhân", "người bệnh", "hồ sơ", "bệnh án", "bn-", "bn "
        )))
        has_identified_drug = bool(ctx.active_medication_name and any(term in lower_query for term in (
            "thuốc này", "thuốc đó", "thuốc vừa nói", "liều", "chỉnh", "dùng được"
        ))) or any(alias.casefold() in lower_query for entry in __import__(
            "app.services.clinical_ddi_engine.drug_registry", fromlist=["DRUG_REGISTRY"]
        ).DRUG_REGISTRY.values() for alias in entry.get("aliases", []) if len(alias) >= 4)
        return has_renal_question and has_identified_patient and has_identified_drug

    async def handle(
        self,
        query: str,
        lower_query: str,
        ctx: ClinicalContext,
        db: AsyncSession
    ) -> Optional[CopilotResponse]:
        p = ctx.patient
        if not p:
            return CopilotResponse(
                intent="CLINICAL_CASE_CLARIFICATION",
                reply_text="Để đánh giá suy thận, vui lòng chọn hồ sơ hoặc cung cấp định danh người bệnh cùng tên thuốc cần rà soát. Không sử dụng hồ sơ đang chọn nếu chưa được nêu rõ trong câu hỏi.",
                answer_type="clarification", source_status="missing_patient_context",
                confidence=1.0, abstention_reason="Chưa xác định người bệnh trong lượt hiện tại",
            )
        patient_name = p.full_name
        egfr = p.egfr
        creatinine = p.creatinine

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
            suggested_chips=["Lập lịch dặn dò cữ thuốc", "Xem chuyên luận Ciprofloxacin", "Thẩm định đơn thuốc theo TT 26"]
        )
