"""
Kịch bản: Hướng Dẫn Xử Trí Sốt & Triage Lâm Sàng Thân Nhiệt (Fever Triage & Paracetamol Protocol)
Dữ liệu CSDL: Lô b-1 - PARACETAMOL 500mg (LOT-PC24-11A, Tồn 80 Viên, Kho Dược Nội Trú - Kệ A1 Tầng 1)
Căn cứ: Dược Thư Quốc Gia Việt Nam 2015 Trang 1095 & Hướng dẫn Điều trị Bộ Y Tế (<=120 LOC)
"""

import re
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.inventory import InventoryBatch
from app.schemas.copilot import CopilotResponse, CopilotActionCard
from app.services.scenarios.base import BaseScenario
from app.services.scenarios.context import ClinicalContext

class FeverTriageScenario(BaseScenario):
    scenario_id = "fever_triage"
    scenario_name = "Xử trí sốt cao & Hướng dẫn hạ sốt Paracetamol"

    def can_handle(self, query: str, lower_query: str, ctx: ClinicalContext) -> bool:
        has_antipyretic = any(w in lower_query for w in [
            "thuốc hạ sốt", "các loại thuốc hạ sốt", "thuốc hạ nhiệt", "thuốc giảm sốt", "thuốc trị sốt",
            "uống thuốc hạ sốt", "nhóm thuốc hạ sốt", "hạ sốt bằng thuốc", "hạ sốt thế nào", "hạ sốt làm sao",
            "cách hạ sốt", "hướng dẫn hạ sốt", "phác đồ hạ sốt", "cho tôi 1 loại thuốc hạ sốt", "loại thuốc hạ sốt",
            "cho tôi thuốc hạ sốt", "1 loại thuốc hạ sốt", "loại hạ sốt"
        ])
        has_dengue_warning = any(w in lower_query for w in [
            "sốt xuất huyết", "dengue", "dấu hiệu cảnh báo", "cảnh báo sốt", "dấu hiệu nguy hiểm", "dấu hiệu cảnh báo sốt xuất huyết"
        ])
        has_fever_word = any(w in lower_query for w in ["sốt", "hạ sốt", "thân nhiệt", "nhiệt độ cơ thể", "cặp nhiệt độ"])
        has_action_or_temp = any(w in lower_query for w in [
            "38", "39", "40", "độ", "làm gì", "làm sao", "làm thế nào", "xử trí",
            "uống gì", "thuốc gì", "dùng gì", "loại nào", "nên uống", "cách hạ", "hạ thân nhiệt", "nguy hiểm không", "các loại thuốc", "thông tin", "1 loại", "cảnh báo"
        ])
        is_vaccine_coldchain = any(w in lower_query for w in ["chuỗi lạnh", "vaxigrip", "tủ lạnh", "kho lạnh", "datalogger", "mkt"])
        return (has_dengue_warning or has_antipyretic or (has_fever_word and has_action_or_temp)) and not is_vaccine_coldchain

    async def handle(
        self,
        query: str,
        lower_query: str,
        ctx: ClinicalContext,
        db: AsyncSession
    ) -> Optional[CopilotResponse]:
        has_dengue_warning = any(w in lower_query for w in [
            "sốt xuất huyết", "dengue", "dấu hiệu cảnh báo"
        ])
        if has_dengue_warning:
            reply = (
                "### Hướng dẫn chuyên môn: Dấu hiệu Cảnh Báo Sốt Xuất Huyết Dengue & Lưu Ý Dùng Thuốc\n\n"
                "Theo **Hướng dẫn Chẩn đoán & Điều trị Sốt xuất huyết Dengue (Bộ Y tế - QĐ 2760/QĐ-BYT)**, người bệnh sốt cao cần được theo dõi sát các **dấu hiệu cảnh báo nguy hiểm (thường xuất hiện từ ngày thứ 3 đến ngày thứ 7 của bệnh)**:\n\n"
                "• **7 Dấu hiệu cảnh báo sốt xuất huyết Dengue cần nhập viện / cấp cứu ngay:**\n"
                "  1. **Tri giác thay đổi:** Vật vã, lừ đừ, li bì, mệt lả.\n"
                "  2. **Đau bụng:** Đau nhiều và liên tục hoặc tăng cảm giác đau vùng gan (hạ sườn phải).\n"
                "  3. **Nôn ói nhiều:** Nôn liên tục (>= 3 lần/1 giờ hoặc >= 4 lần/6 giờ).\n"
                "  4. **Xuất huyết niêm mạc:** Chảy máu cam, chảy máu chân răng, nôn ra máu, đi ngoài phân đen, tiểu ra máu hoặc rong kinh bất thường.\n"
                "  5. **Gan to:** Sờ thấy gan to > 2 cm dưới bờ sườn, ấn đau.\n"
                "  6. **Giảm lượng nước tiểu:** Tiểu ít hoặc không đi tiểu trong vòng 6 - 8 giờ.\n"
                "  7. **Cận lâm sàng:** Hematocrit (HCT) tăng cao kèm số lượng tiểu cầu giảm nhanh chóng.\n\n"
                "• **Nguyên tắc dùng thuốc hạ sốt an toàn khi nghi ngờ sốt xuất huyết:**\n"
                "  - **Lựa chọn duy nhất:** **Paracetamol đơn chất** với liều 10 - 15 mg/kg/lần, cách 4 - 6 giờ (người lớn tối đa 1g/lần và không quá 4g/ngày).\n"
                "  - ⛔ **CHỐNG CHỈ ĐỊNH TUYỆT ĐỐI:** **Aspirin, Ibuprofen, Diclofenac và các NSAID khác**. Các thuốc này ức chế kết tập tiểu cầu và kích ứng niêm mạc dạ dày, gây **xuất huyết ồ ạt, sốc và toan chuyển hóa đe dọa tính mạng**!\n"
                "  - **Bù nước điện giải:** Khuyến khích uống nhiều dung dịch Oresol (pha đúng tỷ lệ) hoặc nước trái cây, nước dừa.\n\n"
                "⚠️ **Khuyến cáo lâm sàng:** Khi xuất hiện bất kỳ dấu hiệu cảnh báo nào ở trên, người bệnh phải được đưa đến cơ sở y tế gần nhất để điều trị và truyền dịch theo phác đồ."
            )
            return CopilotResponse(
                intent="CLINICAL_FEVER_TRIAGE_PROTOCOL",
                reply_text=reply,
                card=None,
                answer_type="guideline",
                source_status="clinical_guideline",
                legal_basis="Quyết định 2760/QĐ-BYT (Hướng dẫn Chẩn đoán, Điều trị Sốt xuất huyết Dengue) & Dược Thư Quốc Gia 2015",
                suggested_chips=[
                    "Liều Paracetamol hạ sốt cho người lớn",
                    "Liều Paracetamol cho trẻ em theo cân nặng",
                    "Cách pha và uống dung dịch Oresol bù nước"
                ],
                session_id=ctx.session.session_id if ctx.session else None,
            )

        has_active_patient_in_session = bool(ctx.patient or (ctx.session and ctx.session.active_patient_id))
        query_has_case_mention = any(term in lower_query for term in ("bệnh nhân", "người bệnh", "ca bệnh", "ca này", "hồ sơ", "bn-", "bn "))
        if has_active_patient_in_session and not query_has_case_mention and not any(term in lower_query for term in ("tài liệu tham khảo chung", "chuyên luận")):
            return CopilotResponse(
                intent="CLINICAL_CASE_CLARIFICATION",
                reply_text="Phiên làm việc đang mở hồ sơ người bệnh. Vui lòng cho biết câu hỏi về thuốc hạ sốt áp dụng cho người bệnh này hay bạn đang tra cứu tài liệu tham khảo chung.",
                answer_type="clarification", source_status="active_patient_ambiguity", confidence=1.0,
                abstention_reason="Ngữ cảnh người bệnh đang mở trong phiên",
                session_id=ctx.session.session_id if ctx.session else None,
            )
        has_case = bool(ctx.patient or query_has_case_mention)
        is_general_reference = any(term in lower_query for term in (
            "thông tin", "tài liệu", "tham khảo", "hướng dẫn", "phác đồ",
            "thuốc hạ sốt", "các loại thuốc", "nhóm thuốc", "danh mục", "cảnh báo", "sốt xuất huyết"
        ))
        if not has_case and not is_general_reference:
            return CopilotResponse(
                intent="CLINICAL_CASE_CLARIFICATION",
                reply_text="Để tra cứu xử trí sốt theo ca, vui lòng chọn hồ sơ hoặc cung cấp thông tin người bệnh. Nếu cần tài liệu tham khảo chung, hãy nêu rõ nội dung cần tra cứu.",
                answer_type="clarification", source_status="missing_case_context", confidence=1.0,
                abstention_reason="Chưa xác định người bệnh hoặc yêu cầu tra cứu chung"
            )
        temp_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:độ|°c)", lower_query)
        temp_str = f"{temp_match.group(1)}°C" if temp_match else "chưa cung cấp"
        context = (
            f"Ca bệnh đã nêu nhiệt độ {temp_str}; các thông tin tuổi, cân nặng, thời gian sốt, bệnh nền/dị ứng và thuốc đang dùng "
            "cần được đối chiếu trước khi đánh giá liều hoặc lựa chọn điều trị."
        ) if has_case and temp_match else "Hướng dẫn sử dụng thuốc hạ sốt và xử trí người bệnh sốt an toàn theo Dược thư Quốc gia Việt Nam & Phác đồ Bộ Y tế."
        reply = (
            "### Hướng dẫn chuyên môn: Sử dụng thuốc hạ sốt & Xử trí người bệnh sốt\n\n"
            f"{context}\n\n"
            "• **Thuốc hạ sốt đầu tay (Lựa chọn 1):** **Paracetamol (Acetaminophen)**\n"
            "  - *Liều người lớn:* 500mg - 1000mg/lần, cách mỗi 4 - 6 giờ (tối đa 4g/24h).\n"
            "  - *Liều trẻ em:* 10 - 15 mg/kg/lần, cách mỗi 4 - 6 giờ (tối đa 60 mg/kg/24h).\n"
            "  - *Chống chỉ định:* Người bệnh suy gan nặng, quá mẫn với paracetamol.\n\n"
            "• **Thuốc hạ sốt thay thế (Lựa chọn 2 - Khi cần kháng viêm):** **Ibuprofen (NSAID)**\n"
            "  - *Liều người lớn:* 200mg - 400mg mỗi 4 - 6 giờ khi cần (tối đa 1200mg/ngày không kê đơn).\n"
            "  - ⚠️ **CẢNH BÁO AN TOÀN LÂM SÀNG:** Tuyệt đối **KHÔNG dùng Ibuprofen hoặc Aspirin** khi người bệnh nghi ngờ hoặc chưa loại trừ **Sốt xuất huyết Dengue** do nguy cơ gây xuất huyết ồ ạt đe dọa tính mạng!\n\n"
            "• **Dấu hiệu cảnh báo đỏ (Red Flags) cần chuyển cấp cứu:** Sốt cao liên tục không hạ sau 48h, co giật, lơ mơ, khó thở, nôn ói liên tục, xuất huyết dưới da hoặc mất nước nặng."
        )
        return CopilotResponse(
            intent="CLINICAL_FEVER_TRIAGE_PROTOCOL",
            reply_text=reply, card=None,
            answer_type="guideline",
            source_status="clinical_guideline",
            legal_basis="Dược Thư Quốc Gia Việt Nam 2015 & Hướng dẫn Bộ Y tế (đối chiếu nguồn hiện hành)",
            suggested_chips=[
                "Dấu hiệu cảnh báo sốt xuất huyết ở người bệnh",
                "Liều Paracetamol cho trẻ em theo cân nặng",
                "Thông tin thuốc Paracetamol 500mg"
            ],
            session_id=ctx.session.session_id if ctx.session else None,
        )
