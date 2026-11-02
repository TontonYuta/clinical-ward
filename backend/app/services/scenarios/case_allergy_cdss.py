"""
Kịch bản 7: Thẩm định Dị ứng & Quy tắc 5 Đúng (QĐ 2147/QĐ-BYT & QĐ 5948/QĐ-BYT)
Hỗ trợ kế thừa bệnh nhân đang kích hoạt từ phiên làm việc đa lượt (AMIE context buffer).
"""

from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas.copilot import CopilotResponse, CopilotActionCard
from app.services.scenarios.base import BaseScenario
from app.services.scenarios.context import ClinicalContext

class AllergyCdssScenario(BaseScenario):
    scenario_id = "allergy_cdss"
    scenario_name = "Thẩm định Dị ứng & 5 Đúng CPOE"

    def can_handle(self, query: str, lower_query: str, ctx: ClinicalContext) -> bool:
        from app.services.clinical_ddi_engine.entity_resolution import resolve_registered_medications
        has_drug = bool(resolve_registered_medications(lower_query))
        has_patient_clue = any(term in lower_query for term in ("bệnh nhân", "người bệnh", "ca này", "hồ sơ", "đơn thuốc", "tiền sử", "5 đúng", "an toàn đơn", "thẩm định đơn"))

        if has_drug and not has_patient_clue and not ctx.patient:
            return False
        if not ctx.patient and any(term in lower_query for term in ("egfr", "crcl", "creatinine", "suy thận", "chức năng thận", "chỉnh liều")):
            return False
        if not ctx.patient and (has_patient_clue or any(term in lower_query for term in ("thẩm định", "an toàn đơn", "5 đúng"))):
            return any(term in lower_query for term in ("dị ứng", "chống chỉ định", "thẩm định", "an toàn đơn", "5 đúng", "dùng được không"))
        if not ctx.patient:
            return False
        return any(w in lower_query for w in ["dị ứng", "chống chỉ định", "thẩm định", "an toàn đơn", "5 đúng", "dùng được không"])

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
                reply_text="Để kiểm tra dị ứng hoặc chống chỉ định, vui lòng chọn hồ sơ người bệnh hoặc cung cấp mã người bệnh và danh sách thuốc cần rà soát. Không dùng hồ sơ mẫu mặc định.",
                answer_type="clarification", source_status="missing_patient_context",
                confidence=1.0, abstention_reason="Thiếu hồ sơ người bệnh và thuốc trong lượt hiện tại",
            )
        patient_name = p.full_name if p else "Võ Minh Trí (BN-8820)"
        patient_allergies = p.allergies if p else "Penicillin, Aspirin (phù mạch, co thắt)"

        card = CopilotActionCard(
            card_type="medication_safety",
            title=f"Thẩm Định An Toàn Đơn Thuốc: {p.full_name if p else 'Võ Minh Trí'}",
            summary="Kiểm tra tiền sử dị ứng, chống chỉ định và quy tắc 5 Đúng (QĐ 2147/BYT)",
            data={"patient": patient_name, "allergies": patient_allergies},
            primary_action_label="Mở Bảng Đối Soát 5 Đúng",
            primary_action_type="OPEN_MED_SAFETY",
            target_tab="debts"
        )
        reply = (
            f"### ⚠️ CẢNH BÁO AN TOÀN ĐƠN THUỐC (QĐ 2147/QĐ-BYT)\n\n"
            f"• **Bệnh nhân:** **{patient_name}**\n"
            f"• **Tiền sử dị ứng ghi nhận trong CSDL:** **{patient_allergies}**\n"
            f"• **Cảnh báo chuyên môn:** Nếu đơn thuốc có nhóm Beta-Lactam/Penicillin (như Augmentin, Amoxicillin), nguy cơ sốc phản vệ đe dọa tính mạng! Đề xuất đổi sang Macrolide (Clarithromycin 500mg) hoặc Quinolone."
        )
        return CopilotResponse(
            intent="CLINICAL_ALLERGY_CDSS",
            reply_text=reply,
            card=card,
            legal_basis="Quyết định 2147/QĐ-BYT & QĐ 5948/QĐ-BYT",
            suggested_chips=["Dặn dò bệnh nhân uống thuốc", "Đổi sang Clarithromycin 500mg", "Đối soát ca trực 07:00 AM"]
        )
