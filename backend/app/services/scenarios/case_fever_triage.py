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
        has_fever_word = any(w in lower_query for w in ["sốt", "hạ sốt", "thân nhiệt", "nhiệt độ cơ thể", "cặp nhiệt độ"])
        has_action_or_temp = any(w in lower_query for w in [
            "38", "39", "40", "độ", "làm gì", "làm sao", "làm thế nào", "xử trí",
            "uống gì", "thuốc gì", "dùng gì", "cách hạ", "hạ thân nhiệt", "nguy hiểm không", "các loại thuốc", "thông tin", "1 loại"
        ])
        is_vaccine_coldchain = any(w in lower_query for w in ["chuỗi lạnh", "vaxigrip", "tủ lạnh", "kho lạnh", "datalogger", "mkt"])
        return (has_antipyretic or (has_fever_word and has_action_or_temp)) and not is_vaccine_coldchain

    async def handle(
        self,
        query: str,
        lower_query: str,
        ctx: ClinicalContext,
        db: AsyncSession
    ) -> Optional[CopilotResponse]:
        temp_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:độ|°c)", lower_query)
        temp_str = f"{temp_match.group(1)}°C" if temp_match else ""

        batch_res = await db.execute(select(InventoryBatch).where(InventoryBatch.id == "b-1"))
        batch_pcm = batch_res.scalar_one_or_none()
        stock_str = f"{batch_pcm.current_stock} {batch_pcm.unit}" if batch_pcm else "80 Viên"
        batch_no = batch_pcm.batch_number if batch_pcm else "LOT-PC24-11A"
        loc_str = batch_pcm.warehouse_location if batch_pcm else "Kho Dược Nội Trú (Kệ A1 - Tầng 1)"

        if ctx.session:
            ctx.session.set_active_medication(
                name="PARACETAMOL 500mg",
                ingredient="Paracetamol",
                batch=batch_no,
                stock=stock_str,
                location=loc_str,
                sdk="893100110026"
            )

        title_header = (
            "### 🌡️ HƯỚNG DẪN CÁC LOẠI THUỐC HẠ SỐT & PHÁC ĐỒ XỬ TRÍ AN TOÀN (Dược Thư Quốc Gia 2015)\n\n"
            if not temp_str else f"### 🌡️ HƯỚNG DẪN XỬ TRÍ SỐT CAO ({temp_str.upper()}) & PHÁC ĐỒ HẠ SỐT AN TOÀN\n\n"
        )

        reply = (
            title_header +
            "Sốt là phản ứng bảo vệ của hệ miễn dịch khi cơ thể gặp nhiễm trùng hoặc viêm cấp tính. Dưới đây là phân loại các nhóm thuốc hạ sốt chuẩn y khoa và phác đồ sử dụng an toàn:\n\n"
            f"#### 1. Nhóm thuốc hạ sốt đầu tay: **PARACETAMOL (ACETAMINOPHEN)**\n"
            f"• **Vị thế lâm sàng:** Thuốc hạ sốt an toàn nhất, ít tác dụng phụ lên đường tiêu hóa và đông máu.\n"
            f"• **Biệt dược có sẵn trong kho bệnh viện:** **PARACETAMOL 500mg** (Lô: `{batch_no}` | Tồn kho: **{stock_str}** tại *{loc_str}*).\n"
            "• **Liều lượng chuẩn (Dược Thư Quốc Gia 2015 Trang 1095):**\n"
            "  - **Người lớn:** Uống **500mg - 1.000mg/lần** (1 - 2 viên 500mg), cách mỗi **4 - 6 giờ** nếu nhiệt độ **≥ 38.5°C**.\n"
            "  - **Trẻ em:** Liều chuẩn theo cân nặng **10 - 15 mg/kg/lần**, cách mỗi 4 - 6 giờ (tối đa không quá 60 mg/kg/ngày).\n"
            "• **CẢNH BÁO NGUY HIỂM VỀ LIỀU TỐI ĐA (Chống suy gan cấp):**\n"
            "  - **Tuyệt đối không uống quá 4.000mg (4g)/24 giờ** ở người lớn (tương đương 8 viên 500mg).\n"
            "  - Bệnh nhân suy gan hoặc nghiện rượu liều tối đa không quá **2g/24 giờ**.\n\n"
            "#### 2. Nhóm thuốc thay thế: **NSAIDs (IBUPROFEN)**\n"
            "• **Chỉ định:** Dùng khi sốt cao không đáp ứng Paracetamol hoặc có kèm triệu chứng đau viêm cấp.\n"
            "• **Liều dùng người lớn:** **200mg - 400mg/lần**, uống sau khi ăn no, cách mỗi 6 - 8 giờ (tối đa 1.200mg/ngày).\n"
            "• **Thận trọng & Chống chỉ định:** Người có tiền sử viêm loét dạ dày tá tràng, suy thận mạn tính, hen suyễn.\n\n"
            "🚨 **HAI CẢNH BÁO BẮT BUỘC TRONG HẠ SỐT (An Toàn Dược Lâm Sàng):**\n"
            "1. **NGUY CƠ SỐT XUẤT HUYẾT DENGUE:** **Tuyệt đối KHÔNG tự ý dùng Aspirin hoặc Ibuprofen** khi người bệnh sốt chưa rõ nguyên nhân vì gây ức chế ngưng tập tiểu cầu, dẫn đến xuất huyết nội tạng và tiêu hóa dữ dội nguy hiểm tính mạng.\n"
            "2. **HỘI CHỨNG REYE Ở TRẺ EM:** **Tuyệt đối KHÔNG dùng Aspirin cho trẻ em và thanh thiếu niên** nghi ngờ nhiễm virus cúm hoặc thủy đậu vì có thể gây thoái hóa mỡ gan và phù não cấp tính (tử vong cao).\n\n"
            "#### 3. Các biện pháp hỗ trợ không dùng thuốc\n"
            "• **Lau ấm:** Dùng khăn thấm nước ấm **(37°C – 38°C)** lau vùng nách, bẹn, trán. **Tuyệt đối không chườm đá lạnh hoặc cồn**.\n"
            "• **Bù nước & Điện giải:** Uống nhiều nước ấm, dung dịch Oresol (pha đúng thể tích) để tránh mất nước.\n\n"
            "🚨 **DẤU HIỆU BÁO ĐỘNG ĐỎ CẦN ĐẾN CƠ SỞ Y TẾ NGAY:**\n"
            "• Sốt cao kèm: Co giật, lơ mơ, khó thở, nôn ói liên tục, xuất huyết dưới da (chấm bầm tím), hoặc sốt cao liên tục không hạ sau 2 cữ thuốc."
        )

        return CopilotResponse(
            intent="CLINICAL_FEVER_TRIAGE_PROTOCOL",
            reply_text=reply,
            card=None,  # Đã loại bỏ Action Card thừa theo yêu cầu người dùng
            legal_basis="Dược Thư Quốc Gia Việt Nam 2015 Trang 1095 & Hướng dẫn Chẩn đoán Điều trị Bộ Y Tế",
            suggested_chips=[
                "Thông tin về thuốc Paracetamol",
                "Dấu hiệu cảnh báo sốt xuất huyết",
                "Kiểm tra tồn kho Paracetamol",
                "Đối soát ca trực 07:00 AM"
            ]
        )
