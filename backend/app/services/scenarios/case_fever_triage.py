"""
Kịch bản 20: Hướng Dẫn Xử Trí Sốt & Triage Lâm Sàng Thân Nhiệt (Fever Triage & Paracetamol Protocol)
Dữ liệu CSDL: Lô b-1 - PARACETAMOL 500mg (LOT-PC24-11A, Tồn 80 Viên, Kho Dược Nội Trú - Kệ A1 Tầng 1)
Căn cứ chuyên môn: Dược Thư Quốc Gia Việt Nam 2015 Trang 1095 & Hướng dẫn Điều trị Bộ Y Tế
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
        # Bắt các câu hỏi về sốt và xử trí hạ sốt của người bệnh
        has_fever_word = any(w in lower_query for w in ["sốt", "hạ sốt", "thân nhiệt", "nhiệt độ cơ thể", "cặp nhiệt độ"])
        has_action_or_temp = any(w in lower_query for w in [
            "38", "39", "40", "độ", "làm gì", "làm sao", "làm thế nào", "xử trí",
            "uống gì", "thuốc gì", "dùng gì", "cách hạ", "hạ thân nhiệt", "nguy hiểm không"
        ])
        # Tuyệt đối không nhầm sang chuỗi lạnh vắc xin
        is_vaccine_coldchain = any(w in lower_query for w in ["chuỗi lạnh", "vaxigrip", "tủ lạnh", "kho lạnh", "datalogger", "mkt"])
        return has_fever_word and has_action_or_temp and not is_vaccine_coldchain

    async def handle(
        self,
        query: str,
        lower_query: str,
        ctx: ClinicalContext,
        db: AsyncSession
    ) -> Optional[CopilotResponse]:
        # Trích xuất nhiệt độ sốt nếu có (ví dụ 39 độ, 40 độ)
        temp_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:độ|°c)", lower_query)
        temp_str = f"{temp_match.group(1)}°C" if temp_match else "sốt cao"

        # Tra cứu lô Paracetamol 500mg thực tế trong kho viện
        batch_res = await db.execute(select(InventoryBatch).where(InventoryBatch.id == "b-1"))
        batch_pcm = batch_res.scalar_one_or_none()
        stock_str = f"{batch_pcm.current_stock} {batch_pcm.unit}" if batch_pcm else "80 Viên"
        batch_no = batch_pcm.batch_number if batch_pcm else "LOT-PC24-11A"
        loc_str = batch_pcm.warehouse_location if batch_pcm else "Kho Dược Nội Trú (Kệ A1 - Tầng 1)"

        # Tự động ghi nhớ PARACETAMOL 500mg vào phiên làm việc (Active Medication Memory)
        if ctx.session:
            ctx.session.set_active_medication(
                name="PARACETAMOL 500mg",
                ingredient="Paracetamol",
                batch=batch_no,
                stock=stock_str,
                location=loc_str,
                sdk="893100110026"
            )

        reply = (
            f"### 🌡️ HƯỚNG DẪN XỬ TRÍ SỐT CAO ({temp_str.upper()}) & PHÁC ĐỒ HẠ SỐT AN TOÀN\n\n"
            f"Tình trạng **{temp_str}** là phản ứng miễn dịch khi cơ thể gặp nhiễm trùng hoặc viêm cấp tính, "
            f"cần hạ sốt kịp thời để tránh nguy cơ co giật, mất nước và rối loạn điện giải.\n\n"
            f"#### 1. Dùng thuốc hạ sốt đầu tay: **PARACETAMOL 500MG** (Kho viện hiện tồn: **{stock_str}** tại *{loc_str}*)\n"
            f"• **Liều lượng chuẩn (Dược Thư 2015 Trang 1095):**\n"
            f"  - Người lớn: Uống **500 mg - 1.000 mg/lần** (1 - 2 viên 500mg).\n"
            f"  - Trẻ em: Tính chuẩn theo cân nặng **10 - 15 mg/kg/lần**.\n"
            f"  - **Khoảng cách giữa 2 liều:** Uống lặp lại sau mỗi **4 - 6 giờ** nếu nhiệt độ vẫn $\\ge 38.5^\\circ\\text{{C}}$.\n"
            f"• **CẢNH BÁO LIỀU TỐI ĐA (Chống suy gan cấp):**\n"
            f"  - Tuyệt đối **không vượt quá 4.000 mg (4g)/ngày** ở người lớn (tối đa 8 viên 500mg trong 24 giờ).\n"
            f"  - Bệnh nhân có bệnh gan mạn hoặc nghiện rượu liều tối đa không quá 2g/ngày.\n"
            f"• **Cảnh báo an toàn Dược:** **Tránh tự ý dùng Aspirin hoặc Ibuprofen** khi chưa loại trừ bệnh Sốt xuất huyết Dengue (nguy cơ gây xuất huyết tiêu hóa ồ ạt) hoặc hội chứng Reye ở trẻ nhỏ.\n\n"
            f"#### 2. Các biện pháp hỗ trợ không dùng thuốc\n"
            f"• **Chườm ấm:** Dùng khăn thấm nước ấm (khoảng $37^\\circ\\text{{C}}$ - $38^\\circ\\text{{C}}$) lau vùng nách, bẹn, trán. **TUYỆT ĐỐI KHÔNG chườm đá lạnh hoặc dùng cồn** vì gây co mạch ngoại vi làm nhiệt độ lõi tăng cao hơn.\n"
            f"• **Bù nước & Điện giải:** Uống nhiều nước ấm, dung dịch Oresol (pha đúng tỷ lệ 1 gói/lượng nước ghi trên bao bì) hoặc nước hoa quả.\n"
            f"• Mặc quần áo thoáng mát, không đắp chăn dày kín mít.\n\n"
            f"#### 3. Dấu hiệu báo động đỏ cần đến bệnh viện ngay lập tức\n"
            f"🚨 Hãy đến cơ sở y tế gần nhất nếu sốt cao đi kèm: Co giật, lơ mơ, khó thở, nôn ói liên tục, xuất huyết dưới da (chấm bầm tím), hoặc sốt cao liên tục không hạ sau 2 cữ thuốc."
        )

        card = CopilotActionCard(
            card_type="medication_safety",
            title="Hạ Sốt An Toàn: Paracetamol 500mg",
            summary=f"Sốt {temp_str} • Liều 10-15mg/kg cách 4-6h • Tồn {stock_str} ({loc_str})",
            data={
                "medication": "PARACETAMOL 500mg",
                "activeIngredient": "Paracetamol",
                "stock": stock_str,
                "location": loc_str,
                "dosage": "500mg - 1000mg/lần cách 4-6h (Max 4g/24h)",
                "batch": batch_no
            },
            primary_action_label="Xem Chuyên Luận Paracetamol",
            primary_action_type="OPEN_MEDICATION_SAFETY",
            target_tab="fefo"
        )

        return CopilotResponse(
            intent="CLINICAL_FEVER_TRIAGE_PROTOCOL",
            reply_text=reply,
            card=card,
            legal_basis="Dược Thư Quốc Gia Việt Nam 2015 Trang 1095 & Hướng dẫn Chẩn đoán Điều trị Bộ Y Tế",
            suggested_chips=[
                "Thông tin về thuốc Paracetamol",
                "Dấu hiệu cảnh báo sốt xuất huyết",
                "Kiểm tra tồn kho Paracetamol",
                "Đối soát ca trực 07:00 AM"
            ]
        )
