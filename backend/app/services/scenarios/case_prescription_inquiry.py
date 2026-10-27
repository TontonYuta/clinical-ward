"""
Kịch bản 10: Tra cứu Toàn văn Đơn thuốc Bệnh nhân (Thông tư 52/2017 & TT 18/2018/TT-BYT)
"""

import json
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.cpoe import CpoePrescription
from app.schemas.copilot import CopilotResponse, CopilotActionCard
from app.services.scenarios.base import BaseScenario
from app.services.scenarios.context import ClinicalContext

class PrescriptionInquiryScenario(BaseScenario):
    scenario_id = "prescription_inquiry"
    scenario_name = "Tra cứu đơn thuốc bệnh nhân"

    def can_handle(self, query: str, lower_query: str, ctx: ClinicalContext) -> bool:
        has_ask = any(w in lower_query for w in ["xem đơn", "đơn thuốc của", "đơn của", "tra cứu đơn", "đơn thuốc"]) or "rx-2026-" in lower_query
        return has_ask

    async def handle(
        self,
        query: str,
        lower_query: str,
        ctx: ClinicalContext,
        db: AsyncSession
    ) -> Optional[CopilotResponse]:
        res_rx = await db.execute(select(CpoePrescription))
        all_rx = res_rx.scalars().all()
        matched_rx = None
        for rx in all_rx:
            if (
                (ctx.patient and rx.patient_id == ctx.patient.id)
                or rx.id.lower() in lower_query
                or rx.patient_name.lower() in lower_query
                or (rx.patient_name.split()[-1].lower() in lower_query and len(rx.patient_name.split()[-1]) > 2)
            ):
                matched_rx = rx
                break
        
        if not matched_rx:
            return None

        items = json.loads(matched_rx.items_json) if matched_rx.items_json else []
        med_lines = "\n".join([
            f"  - **{it.get('medicationName')}**: {it.get('quantity')} {it.get('unit')} ({it.get('dosage')}, {it.get('route')} - {it.get('instructions')})"
            for it in items
        ])
        reply = (
            f"### 📋 ĐƠN THUỐC: {matched_rx.id} - BỆNH NHÂN {matched_rx.patient_name.upper()}\n\n"
            f"• **Loại đơn:** {'Đơn ngoại trú xuất viện' if matched_rx.prescription_type == 'outpatient' else 'Y lệnh điều trị nội trú'}\n"
            f"• **Chẩn đoán ICD-10:** `{matched_rx.diagnosis_icd10}` - {matched_rx.diagnosis_text}\n"
            f"• **Bác sĩ điều trị:** {matched_rx.doctor_name} (CCHN: {matched_rx.doctor_certificate})\n"
            f"• **Thời gian ký số:** {matched_rx.prescribed_at}\n"
            f"• **Danh mục thuốc chỉ định:**\n{med_lines}"
        )
        card = CopilotActionCard(
            card_type="cpoe_prescription",
            title=f"Đơn Thuốc: {matched_rx.id}",
            summary=f"{matched_rx.patient_name} • {matched_rx.diagnosis_text}",
            data={"prescriptionId": matched_rx.id, "patient": matched_rx.patient_name},
            primary_action_label="Xem Chi Tiết Đơn Thuốc",
            primary_action_type="NAVIGATE_TAB",
            target_tab="cpoe"
        )
        return CopilotResponse(
            intent="CLINICAL_PRESCRIPTION_INQUIRY",
            reply_text=reply,
            card=card,
            legal_basis="Thông tư 52/2017/TT-BYT & TT 18/2018/TT-BYT",
            suggested_chips=["Lập lịch dặn dò cữ thuốc", "Xem bảng đối soát 5 đúng", "Đối soát ca trực 07:00 AM"]
        )
