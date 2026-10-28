"""
Kịch bản 19: Tra Cứu Toàn Văn Hồ Sơ Bệnh Nhân (Patient EHR Profile & Clinical Summary)
Dữ liệu CSDL: Bảng patient_profiles và cpoe_prescriptions
"""

import json
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.patient import PatientProfile
from app.models.cpoe import CpoePrescription
from app.schemas.copilot import CopilotResponse, CopilotActionCard
from app.services.scenarios.base import BaseScenario
from app.services.scenarios.context import ClinicalContext

class PatientInquiryScenario(BaseScenario):
    scenario_id = "patient_inquiry"
    scenario_name = "Tra cứu hồ sơ bệnh nhân lâm sàng"

    def can_handle(self, query: str, lower_query: str, ctx: ClinicalContext) -> bool:
        # Nếu câu truy vấn hỏi về thuốc, dược phẩm hoặc các chủ đề lâm sàng chung mà không nhắc tới bệnh nhân -> TUYỆT ĐỐI KHÔNG can thiệp
        has_drug_or_general_ask = any(w in lower_query for w in [
            "thuốc", "các loại thuốc", "nhóm thuốc", "dược phẩm", "hoạt chất", "biệt dược",
            "hạ sốt", "giảm đau", "kháng sinh", "sốc phản vệ", "mất điện", "chuỗi lạnh", "tủ lạnh",
            "fefo", "hạn dùng", "tồn kho", "báo hỏng", "sự cố máy", "phác đồ"
        ])
        has_explicit_patient_mention = any(w in lower_query for w in [
            "bệnh nhân", "người bệnh", "ông ấy", "bà ấy", "ca này", "hồ sơ bệnh án"
        ]) or any(p.full_name.lower() in lower_query or p.id.lower() in lower_query for p in ctx.all_patients)

        if has_drug_or_general_ask and not has_explicit_patient_mention:
            return False

        has_patient_ask = any(w in lower_query for w in [
            "kiểm tra bệnh nhân", "thông tin bệnh nhân", "hồ sơ bệnh nhân", "hồ sơ bệnh án",
            "bệnh án của", "bệnh nhân", "tìm bệnh nhân", "tra cứu bệnh nhân", "thông tin ca bệnh"
        ]) or (ctx.is_follow_up and has_explicit_patient_mention and any(w in lower_query for w in ["hồ sơ", "bệnh án", "tiền sử", "chức năng thận", "dị ứng"]))
        has_patient_target = bool(ctx.patient) or any(p.full_name.lower() in lower_query or p.id.lower() in lower_query for p in ctx.all_patients)
        # Không trùng với tra cứu đơn thuốc cụ thể (có chữ "đơn thuốc", "xem đơn")
        is_rx_only = any(w in lower_query for w in ["xem đơn", "đơn thuốc của", "đơn của"])
        return has_patient_ask and has_patient_target and not is_rx_only

    async def handle(
        self,
        query: str,
        lower_query: str,
        ctx: ClinicalContext,
        db: AsyncSession
    ) -> Optional[CopilotResponse]:
        target_patient = ctx.patient
        if not target_patient:
            for p in ctx.all_patients:
                if p.full_name.lower() in lower_query or p.id.lower() in lower_query or (p.full_name.split()[-1].lower() in lower_query):
                    target_patient = p
                    break

        if not target_patient:
            return None

        if ctx.session:
            ctx.session.set_active_patient(target_patient.id, target_patient.full_name)

        # Lấy danh sách đơn thuốc của bệnh nhân trong CSDL
        rx_res = await db.execute(select(CpoePrescription).where(CpoePrescription.patient_name == target_patient.full_name))
        patient_rxs = rx_res.scalars().all()
        rx_summaries = []
        for r in patient_rxs:
            items = json.loads(r.items_json) if r.items_json else []
            med_names = ", ".join([it.get('medicationName', '') for it in items])
            rx_summaries.append(f"  - `{r.id}` ({r.diagnosis_text}): {med_names}")

        rx_block = "\n".join(rx_summaries) if rx_summaries else "  - Chưa ghi nhận đơn thuốc mới trong đợt điều trị này."

        renal_status = (
            f"eGFR = **{target_patient.egfr} mL/phút** (Creatinine: {target_patient.creatinine} umol/L) - "
            f"{'⚠️ Suy thận trung bình (Cần chỉnh liều thuốc đào thải qua thận)' if target_patient.egfr < 60 else '✅ Chức năng thận trong giới hạn an toàn'}"
        )

        reply = (
            f"### 🗂️ HỒ SƠ BỆNH NHÂN: {target_patient.full_name.upper()} (`{target_patient.id}`)\n\n"
            f"• **Thông tin hành chính:** {target_patient.age} tuổi | Giới tính: {target_patient.gender} | Khoa/Phòng: **{target_patient.room}**\n"
            f"• **Chỉ số sinh trắc học:** Cân nặng **{target_patient.weight_kg} kg** | Chức năng thận: {renal_status}\n"
            f"• **Bệnh nền mạn tính (ICD-10):** **{target_patient.chronic_conditions}**\n"
            f"• **Tiền sử DỊ ỨNG:** **{target_patient.allergies}** {'🚨 (NGUY CƠ PHẢN VỆ)' if target_patient.allergies and 'không' not in target_patient.allergies.lower() else ''}\n"
            f"• **Các y lệnh & đơn thuốc hiện hữu trong viện:**\n{rx_block}"
        )
        card = CopilotActionCard(
            card_type="medication_safety",
            title=f"Hồ Sơ Bệnh Nhân: {target_patient.full_name}",
            summary=f"Mã BN: {target_patient.id} • {target_patient.room} • eGFR: {target_patient.egfr}",
            data={
                "patientId": target_patient.id, "fullName": target_patient.full_name,
                "allergies": target_patient.allergies, "egfr": target_patient.egfr,
                "chronicConditions": target_patient.chronic_conditions
            },
            primary_action_label="Xem Đơn Thuốc Bệnh Nhân",
            primary_action_type="NAVIGATE_TAB",
            target_tab="cpoe"
        )
        return CopilotResponse(
            intent="CLINICAL_PATIENT_PROFILE_INQUIRY",
            reply_text=reply,
            card=card,
            legal_basis="Luật Khám bệnh, chữa bệnh số 15/2023/QH15 & Thông tư 52/2017/TT-BYT",
            suggested_chips=[
                f"Đơn thuốc của {target_patient.full_name.split()[-1]}",
                f"Hiệu chỉnh liều suy thận {target_patient.full_name.split()[-1]}",
                "Đối soát ca trực 07:00 AM"
            ]
        )
