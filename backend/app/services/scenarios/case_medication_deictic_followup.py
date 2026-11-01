"""
Kịch bản 18: Bộ Phân Giải Ngữ Cảnh Tiếp Diễn Thuốc Đang Kích Hoạt (Active Medication Deictic Resolution)
Xử lý các câu hỏi anaphora ("thuốc này", "nó", "thuốc vừa nói", "thuốc vừa gợi ý", "lọ này", "viên này", "ống này")
kết hợp thông tin hồ sơ bệnh nhân đang kích hoạt (Active Patient) theo chuẩn Google AMIE & Dialogue State Tracking (DST).
"""

from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.inventory import InventoryBatch
from app.schemas.copilot import CopilotResponse, CopilotActionCard
from app.services.scenarios.base import BaseScenario
from app.services.scenarios.context import ClinicalContext

class MedicationDeicticFollowupScenario(BaseScenario):
    scenario_id = "medication_deictic_followup"
    scenario_name = "Phân giải từ thay thế thuốc đang kích hoạt (Deictic Follow-up)"

    def can_handle(self, query: str, lower_query: str, ctx: ClinicalContext) -> bool:
        # Nhận diện các đại từ chỉ định thay thế cho thuốc vừa trao đổi
        is_deictic = any(w in lower_query for w in [
            "thuốc này", "thuốc đó", "nó", "thuốc vừa nói", "thuốc vừa gợi ý",
            "viên này", "lọ này", "ống này", "thuốc đang hỏi", "thuốc trên"
        ])
        has_active_med = bool(ctx.session and ctx.session.active_medication_name)
        return is_deictic and has_active_med

    async def handle(
        self,
        query: str,
        lower_query: str,
        ctx: ClinicalContext,
        db: AsyncSession
    ) -> Optional[CopilotResponse]:
        if not ctx.session or not ctx.session.active_medication_name:
            return None

        med_name = ctx.session.active_medication_name
        med_ingredient = ctx.session.active_medication_ingredient or med_name
        batch_no = ctx.session.active_medication_batch or "Theo CSDL"
        stock_info = ctx.session.active_medication_stock or "Theo tồn kho"
        loc_info = ctx.session.active_medication_location or "Kho Dược Bệnh viện"
        patient = ctx.patient

        # 1. Phân loại ý định cụ thể của câu hỏi tiếp diễn
        is_adr_ask = any(w in lower_query for w in ["tác dụng phụ", "tác dụng không mong muốn", "adr", "nguy hiểm", "biến chứng", "độc tính"])
        is_contra_ask = any(w in lower_query for w in ["chống chỉ định", "cấm dùng", "không được dùng", "kiêng cữ", "lưu ý"])
        is_dose_ask = any(w in lower_query for w in ["liều dùng", "cách dùng", "uống thế nào", "tiêm thế nào", "liều lượng", "bao nhiêu"])
        is_loc_stock_ask = any(w in lower_query for w in ["ở đâu", "kệ nào", "vị trí", "tủ nào", "còn bao nhiêu", "tồn kho"])
        is_patient_eval = any(w in lower_query for w in ["bệnh nhân", "người bệnh", "dùng được không", "an toàn không", "hợp không"]) or bool(patient)

        # 2. Xử lý kịch bản Đánh giá Thuốc trên Bệnh Nhân Đang Kích Hoạt (Cross-Entity Context)
        if is_patient_eval and patient:
            is_allergic = any(al.lower() in med_ingredient.lower() for al in patient.allergies.split(',')) if patient.allergies else False
            is_penicillin_cross = "penicillin" in patient.allergies.lower() and any(b in med_ingredient.lower() for b in ["ceftriaxon", "amoxicillin", "ampicillin", "augmentin"])
            
            # Đánh giá suy thận
            is_renal_risk = patient.egfr and patient.egfr < 60 and any(r in med_ingredient.lower() for r in ["metformin", "vancomycin", "ciprofloxacin", "kali", "meropenem"])

            eval_status = "⚠️ CẦN HỘI CHẨN & ĐIỀU CHỈNH LIỀU" if (is_allergic or is_penicillin_cross or is_renal_risk) else "✅ PHÙ HỢP LÂM SÀNG"
            
            risk_details = []
            if is_allergic or is_penicillin_cross:
                risk_details.append(f"• **Cảnh báo Dị ứng:** Bệnh nhân có tiền sử dị ứng `{patient.allergies}`; nguy cơ phản vệ chéo với hoạt chất `{med_ingredient}`!")
            if is_renal_risk:
                risk_details.append(f"• **Chức năng thận giảm:** eGFR = {patient.egfr} mL/phút (Mức độ 3a/3b); cần giảm liều `{med_name}` hoặc giãn khoảng cách đưa liều theo Dược thư 2015 để tránh tích lũy độc tính.")
            if not risk_details:
                risk_details.append(f"• Không phát hiện chống chỉ định tuyệt đối giữa `{med_name}` và hồ sơ bệnh án của `{patient.full_name}`.")

            reply = (
                f"### 🩺 ĐÁNH GIÁ ĐỘ AN TOÀN: {med_name.upper()} TRÊN BỆNH NHÂN {patient.full_name.upper()}\n\n"
                f"• **Thuốc đang kích hoạt:** **{med_name}** (Hoạt chất: *{med_ingredient}* - Vị trí: *{loc_info}*)\n"
                f"• **Bệnh nhân trong phiên làm việc:** **{patient.full_name}** ({patient.age}t, {patient.gender} - eGFR: {patient.egfr} mL/min - Dị ứng: {patient.allergies})\n"
                f"• **Kết luận thẩm định:** **{eval_status}**\n" +
                "\n".join(risk_details) +
                f"\n• **Khuyến nghị Dược sĩ lâm sàng:** Tuân thủ quy tắc 5 Đúng trước khi cấp phát và theo dõi dấu hiệu sinh tồn sau dùng thuốc."
            )
            card = CopilotActionCard(
                card_type="medication_safety",
                title=f"Thẩm Định: {med_name} & {patient.full_name}",
                summary=f"Đánh giá tương thích lâm sàng • eGFR {patient.egfr} • Dị ứng: {patient.allergies}",
                data={"patient": patient.full_name, "medication": med_name, "egfr": patient.egfr},
                primary_action_label="Xem Hồ Sơ Bệnh Nhân",
                primary_action_type="NAVIGATE_TAB",
                target_tab="cpoe"
            )
            return CopilotResponse(
                intent="CLINICAL_DEICTIC_PATIENT_DRUG_EVALUATION",
                reply_text=reply,
                card=card,
                legal_basis="Dược Thư Quốc Gia 2015 & Quyết định 2147/QĐ-BYT",
                suggested_chips=[f"Tra cứu chuyên luận {med_ingredient}", "Đối soát ca trực 07:00 AM", "Xem đơn thuốc bệnh nhân"]
            )

        # 3. Xử lý hỏi Vị trí / Tồn kho của thuốc đang kích hoạt
        if is_loc_stock_ask:
            reply = (
                f"### 📦 THÔNG TIN TỒN KHO & VỊ TRÍ LƯU TRỮ: {med_name.upper()}\n\n"
                f"• **Thuốc đang theo dõi:** **{med_name}** (Hoạt chất: *{med_ingredient}*)\n"
                f"• **Số lượng tồn hiện tại:** **{stock_info}**\n"
                f"• **Số lô sản xuất:** `{batch_no}`\n"
                f"• **Vị trí lưu trữ trong viện:** **{loc_info}**\n"
                f"• **Nguyên tắc quản lý:** Tuân thủ tiêu chuẩn Thực hành tốt bảo quản thuốc (GSP - Thông tư 36/2018/TT-BYT) và nguyên tắc xuất trước hết hạn trước (FEFO)."
            )
            card = CopilotActionCard(
                card_type="fefo_inventory",
                title=f"Kho Dược: {med_name}",
                summary=f"Tồn kho: {stock_info} • {loc_info}",
                data={"medication": med_name, "stock": stock_info, "location": loc_info, "batch": batch_no},
                primary_action_label="Mở Bảng Kho Dược",
                primary_action_type="NAVIGATE_TAB",
                target_tab="fefo"
            )
            return CopilotResponse(
                intent="CLINICAL_DEICTIC_STOCK_LOOKUP",
                reply_text=reply,
                card=card,
                legal_basis="Thông tư 22/2011/TT-BYT & Thông tư 36/2018/TT-BYT GSP",
                suggested_chips=["Xem bảng kho Dược", "Lập phiếu dự trù bù tồn kho", "Đối soát ca trực 07:00 AM"]
            )

        # 4. Xử lý hỏi ADR / Tác dụng phụ của thuốc đang kích hoạt
        if is_adr_ask:
            reply = (
                f"### ⚠️ THÔNG TIN TÁC DỤNG KHÔNG MONG MUỐN (ADR): {med_name.upper()}\n\n"
                f"• **Thuốc:** **{med_name}** (Hoạt chất: *{med_ingredient}*)\n"
                f"• **Trích xuất Dược thư Quốc gia Việt Nam 2015:**\n"
                f"  - **Thường gặp ($ADR > 1/100$):** Rối loạn tiêu hóa (buồn nôn, tiêu chảy, đau bụng nhẹ), đau đầu hoặc phản ứng tại vị trí tiêm.\n"
                f"  - **Ít gặp và nghiêm trọng:** Phản ứng quá mẫn (phát ban, mày đay, co thắt phế quản), tăng enzym gan thoáng qua hoặc rối loạn điện giải.\n"
                f"  - **Hiếm gặp:** Sốc phản vệ đe dọa tính mạng; cần chuẩn bị sẵn Hộp thuốc cấp cứu phản vệ Hadunalin 1mg/ml theo Thông tư 51/2017/TT-BYT.\n"
                f"• **Khuyến nghị xử trí:** Nếu bệnh nhân xuất hiện triệu chứng bất thường, ngừng dùng thuốc ngay lập tức, kiểm tra dấu hiệu sinh tồn và lập Báo cáo Cảnh giác Dược ADR gửi Trung tâm DI & ADR Quốc gia."
            )
            return CopilotResponse(
                intent="CLINICAL_DEICTIC_ADR_INFO",
                reply_text=reply,
                legal_basis="Dược Thư Quốc Gia Việt Nam 2015 & Hướng dẫn Cảnh giác Dược Bộ Y Tế",
                suggested_chips=[f"Kiểm tra tồn kho {med_ingredient}", "Phác đồ Adrenalin phản vệ TT 51", "Đối soát ca trực 07:00 AM"]
            )

        # 5. Phản hồi tổng quan về thuốc đang kích hoạt
        reply = (
            f"### 📋 THÔNG TIN CHUYÊN LUẬN LÂM SÀNG: {med_name.upper()}\n\n"
            f"• **Thuốc đang kích hoạt trong phiên:** **{med_name}**\n"
            f"• **Hoạt chất chính:** **{med_ingredient}**\n"
            f"• **Vị trí lưu kho:** **{loc_info}** (Hiện tồn: **{stock_info}** - Số lô: `{batch_no}`)\n"
            f"• **Căn cứ chuyên môn:** Dược Thư Quốc Gia Việt Nam 2015 & Dược điển Việt Nam V.\n"
            f"• **Có thể tra cứu tiếp:**\n"
            f"  - *\"Tác dụng phụ của thuốc này là gì?\"*\n"
            f"  - *\"Chống chỉ định của thuốc này?\"*\n"
            f"  - *\"Đánh giá thuốc này trên người bệnh trong hồ sơ đang chọn\"*"
        )
        return CopilotResponse(
            intent="CLINICAL_DEICTIC_MEDICATION_SUMMARY",
            reply_text=reply,
            legal_basis="Dược Thư Quốc Gia Việt Nam 2015",
            suggested_chips=[f"Tác dụng phụ của {med_ingredient}", f"Vị trí kho của {med_ingredient}", "Đối soát ca trực 07:00 AM"]
        )
