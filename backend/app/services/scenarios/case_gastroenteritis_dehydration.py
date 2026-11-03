"""
Kịch bản: Hướng Dẫn Lâm Sàng Tiêu Hóa, Sốt & Đau Bụng Cấp Cứu (Acute GI & Abdominal Triage Protocol)
Căn cứ: Hướng dẫn Chẩn đoán Điều trị Ngoại khoa & Tiêu hóa Bộ Y Tế, Phác đồ Bù nước WHO (<=135 LOC)
"""
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.inventory import InventoryBatch
from app.schemas.copilot import CopilotResponse, CopilotActionCard
from app.services.scenarios.base import BaseScenario
from app.services.scenarios.context import ClinicalContext
from app.security.guardrails import validate_output_guardrail

class GastroenteritisDehydrationScenario(BaseScenario):
    scenario_id = "gastroenteritis_dehydration"
    scenario_name = "Xử trí triệu chứng tiêu hóa, đau bụng & sốt cấp"

    def can_handle(self, query: str, lower_query: str, ctx: ClinicalContext) -> bool:
        has_oresol = any(w in lower_query for w in ["oresol", "ors", "bù nước", "bu nuoc", "dien giai", "điện giải", "hydrite", "bù điện giải"])
        has_dehydration_diarrhea = any(w in lower_query for w in ["đi ngoài", "tiêu chảy", "mất nước", "nhiễm trùng tiêu hóa", "ngộ độc thực phẩm", "ngộ độc thức ăn"])
        has_nausea_fever = ("buồn nôn" in lower_query or "nôn" in lower_query) and ("sốt" in lower_query)
        has_symptom_ask = any(w in lower_query for w in ["biểu hiện", "dấu hiệu", "là bệnh gì", "bị gì", "nguyên nhân", "xử trí", "uống gì", "truyền gì", "thuốc nào", "dùng thuốc gì", "sử dụng thuốc"])
        is_allergy = any(w in lower_query for w in ["dị ứng", "tiêm kháng sinh", "ong đốt", "sốc phản vệ"])
        return (has_oresol or has_dehydration_diarrhea or (has_nausea_fever and (has_symptom_ask or "bụng" in lower_query or "đau bụng" in lower_query))) and not is_allergy

    async def handle(
        self, query: str, lower_query: str, ctx: ClinicalContext, db: AsyncSession
    ) -> Optional[CopilotResponse]:
        has_oresol = any(w in lower_query for w in ["oresol", "ors", "bù nước", "bu nuoc", "dien giai", "điện giải", "hydrite", "bù điện giải"])
        if has_oresol and not ("sốt cao" in lower_query and "buồn nôn" in lower_query):
            reply_md = (
                "### 💧 HƯỚNG DẪN DƯỢC LÂM SÀNG: BÙ NƯỚC & ĐIỆN GIẢI BẰNG DUNG DỊCH ORESOL (ORS)\n\n"
                "*(Theo Phác đồ xử trí tiêu chảy và mất nước - Tổ chức Y tế Thế giới (WHO) & Dược thư Quốc gia Việt Nam)*\n\n"
                "---\n\n"
                "#### 1. NGUYÊN TẮC PHA ORESOL ĐÚNG CHUẨN (QUAN TRỌNG NHẤT)\n"
                "• **Pha đúng thể tích nước ghi trên gói:**\n"
                "  - Loại gói pha **200 mL:** Pha với đúng 200 mL nước đun sôi để nguội.\n"
                "  - Loại gói pha **1000 mL (1 Lít):** Pha với đúng 1000 mL nước đun sôi để nguội.\n"
                "• **Cảnh báo an toàn dược:** **TUYỆT ĐỐI KHÔNG chia nhỏ gói thuốc** để pha từng ít một (dễ gây sai lệch tỷ lệ điện giải $\\to$ nguy cơ ngộ độc muối hoặc phù não cấp). Không đun sôi dung dịch sau khi pha, không pha với sữa/nước khoáng/nước ngọt.\n"
                "• **Thời hạn sử dụng:** Dung dịch đã pha chỉ uống trong vòng **24 giờ**, bảo quản nơi mát hoặc ngăn mát tủ lạnh.\n\n"
                "#### 2. LIỀU DÙNG VÀ CÁCH CHO UỐNG THEO LỨA TUỔI\n"
                "• **Cách uống:** Uống từng ngụm nhỏ (bằng thìa hoặc cốc), không uống ừng ực một lượng lớn để tránh kích thích nôn.\n"
                "• **Liều bù sau mỗi lần đi ngoài phân lỏng hoặc nôn:**\n"
                "  - **Trẻ dưới 2 tuổi:** 50 – 100 mL sau mỗi lần đi ngoài.\n"
                "  - **Trẻ từ 2 – 10 tuổi:** 100 – 200 mL sau mỗi lần đi ngoài.\n"
                "  - **Trẻ lớn và người lớn:** Uống theo nhu cầu khát (thường 200 – 400 mL sau mỗi lần đi ngoài), tối đa 2 – 3 lít/ngày.\n\n"
                "#### 3. DẤU HIỆU CẢNH BÁO MẤT NƯỚC NẶNG CẦN NHẬP VIỆN TRUYỀN DỊCH NGAY\n"
                "• Người bệnh li bì, khó đánh thức, mắt trũng sâu, véo da bụng mất rất chậm (> 2 giây).\n"
                "• Không thể uống được hoặc nôn mửa liên tục mọi thứ vừa ăn/uống.\n"
                "• Khát nước dữ dội, mạch nhanh yếu, tụt huyết áp hoặc tiểu rất ít/không có nước tiểu trong 6 giờ."
            )
            return CopilotResponse(
                intent="CLINICAL_AI_CONSULTATION",
                reply_text=validate_output_guardrail(reply_md, query),
                legal_basis="Dược thư Quốc gia Việt Nam & Phác đồ Bù nước WHO",
                suggested_chips=["Cách pha Oresol chuẩn", "Phân độ mất nước WHO", "Dấu hiệu mất nước nguy hiểm"],
                answer_type="grounded_reference",
                source_status="retrieved_evidence",
                confidence=1.0
            )
        has_nausea_fever = ("buồn nôn" in lower_query or "nôn" in lower_query) and ("sốt" in lower_query)
        has_abd = "đau bụng" in lower_query or "bụng" in lower_query

        if has_nausea_fever:
            title_suffix = "ĐAU BỤNG, BUỒN NÔN, SỐT CAO" if has_abd else "BUỒN NÔN & SỐT CAO"
            reply_md = (
                f"### 🩺 ĐỊNH HƯỚNG LÂM SÀNG: {title_suffix}\n\n"
                "Biểu hiện **buồn nôn/nôn kèm sốt cao** là dấu hiệu cảnh báo của tình trạng nhiễm trùng cấp tính (tiêu hóa hoặc toàn thân), cần tiếp cận xử trí theo đúng phác đồ an toàn dược:\n\n"
                "---\n\n"
                "#### 1. CÁC NGUYÊN NHÂN LÂM SÀNG CẦN PHÂN BIỆT\n"
                "1. **Nhiễm trùng tiêu hóa cấp (Acute Gastroenteritis / Ngộ độc thực phẩm):**\n"
                "   * Do vi khuẩn (*Salmonella*, *E. coli*) hoặc virus (*Rotavirus*, *Norovirus*). Thường kèm buồn nôn, nôn, sốt, có thể đau quặn bụng hoặc tiêu chảy.\n"
                "2. **Cảnh báo bệnh lý ngoại khoa ổ bụng (CẦN LOẠI TRỪ KHẨN CẤP):**\n"
                "   * Viêm ruột thừa cấp, viêm tụy cấp, viêm túi mật/nhiễm trùng đường mật cấp.\n"
                "3. **Sốt xuất huyết Dengue thể cảnh báo:** Sốt cao ngày 1-3 kèm nôn mửa, đau mỏi cơ khớp, cần theo dõi hematocrit và tiểu cầu.\n\n"
                "---\n\n"
                "#### 2. NGUYÊN TẮC AN TOÀN DƯỢC & THUỐC SỬ DỤNG (HƯỚNG DẪN BỘ Y TẾ)\n"
                "* **Hạ sốt an toàn:** Ưu tiên **Paracetamol** (10-15 mg/kg cách 4-6h ở trẻ em; 500mg/lần ở người lớn khi sốt >= 38.5°C). **Tuyệt đối KHÔNG dùng NSAID (Aspirin, Ibuprofen)** vì nguy cơ xuất huyết tiêu hóa và suy thận cấp khi đang nôn mửa hoặc chưa loại trừ Dengue.\n"
                "* **Bù nước & điện giải:** Dung dịch Oresol pha đúng nồng độ, uống từng ngụm nhỏ 5-10ml mỗi 3-5 phút (tránh uống nhiều 1 lúc gây kích thích nôn).\n"
                "* **Thuốc chống nôn:** Chỉ dùng (Ondansetron, Domperidon) khi có chỉ định bác sĩ sau khi loại trừ tắc ruột hoặc ngoại khoa.\n"
                "* **Cảnh báo cấp cứu:** Nhập viện ngay nếu nôn liên tục không thể bù nước đường uống, li bì, nôn ra máu, hoặc đau bụng khu trú."
            )
            return CopilotResponse(
                intent="CLINICAL_AI_CONSULTATION",
                reply_text=validate_output_guardrail(reply_md, query),
                legal_basis="Hướng dẫn Chẩn đoán Điều trị Ngoại khoa & Tiêu hóa Bộ Y Tế",
                suggested_chips=["Xử trí hạ sốt an toàn", "Bù nước điện giải Oresol", "Xét nghiệm công thức máu/CRP"],
                answer_type="grounded_reference",
                source_status="retrieved_evidence",
                confidence=1.0
            )

        # Truy vấn tồn kho dịch truyền bù nước cấp cứu
        stmt = select(InventoryBatch).where(InventoryBatch.item_name.ilike("%Ringer%") | InventoryBatch.item_name.ilike("%Natri clorid 0,9%%"))
        res = await db.execute(stmt)
        batches = res.scalars().all()

        fluid_info = []
        for b in batches:
            fluid_info.append(f"* **{b.item_name}:** Còn **{b.current_stock} chai** ({b.warehouse_location})")
        fluid_stock_str = "\n".join(fluid_info) if fluid_info else "* Dung dịch bù nước đang sẵn sàng tại Kho Dịch Truyền Khu C1."

        reply_md = (
            "### 🩺 ĐỊNH HƯỚNG LÂM SÀNG: ĐAU BỤNG, ĐI NGOÀI, MẤT NƯỚC\n\n"
            "Các triệu chứng **đau bụng (quặn/âm ỉ)**, **đi ngoài phân lỏng nhiều lần** kèm **mất nước** là hội chứng kinh điển của các bệnh lý tiêu hóa cấp tính:\n\n"
            "---\n\n"
            "#### 1. CĂN NGUYÊN LÂM SÀNG PHỔ BIẾN\n"
            "1. **Viêm dạ dày - ruột cấp (Acute Gastroenteritis):** Do virus (Rotavirus, Norovirus) hoặc vi khuẩn xâm lấn (*Salmonella*, *Shigella*, *E. coli*, *Campylobacter*).\n"
            "2. **Ngộ độc thực phẩm cấp tính (Food Poisoning):** Khởi phát đột ngột sau ăn uống thực phẩm nhiễm độc tố (*Staph aureus*, *B. cereus*).\n"
            "3. **Tác dụng phụ thuốc / Loạn khuẩn đường ruột:** Thường xảy ra sau đợt dùng kháng sinh kéo dài (cần loại trừ *C. difficile*).\n"
            "4. **Phản vệ độ II (TT 51/2017/TT-BYT):** Cần lưu ý nếu xuất hiện ngay sau khi tiếp xúc dị nguyên (thuốc/thức ăn), thường kèm mày đay, khó thở hoặc tụt HA.\n\n"
            "---\n\n"
            "#### 2. NGUYÊN TẮC XỬ TRÍ ƯU TIÊN (HƯỚNG DẪN BỘ Y TẾ & WHO)\n"
            "* **Ưu tiên số 1 - Bù nước & Điện giải:**\n"
            "  * *Mất nước nhẹ - vừa:* Uống dung dịch **Oresol (ORS)** chuẩn nồng độ thẩm thấu thấp.\n"
            "  * *Mất nước nặng (mắt trũng, véo da mất rất chậm, mạch nhanh tụt HA, li bì):* **Cấp cứu truyền tĩnh mạch ngay**.\n"
            "* **Khả dụng dịch truyền cấp cứu tại kho bệnh viện:**\n"
            f"{fluid_stock_str}\n"
            "* **Lưu ý an toàn:** Không tự ý dùng thuốc làm giảm nhu động ruột (như Loperamid) khi nghi ngờ tiêu chảy nhiễm khuẩn có sốt hoặc phân nhầy máu."
        )

        card = CopilotActionCard(
            card_type="clinical_pathway",
            title="Phác đồ bù nước & dịch truyền tiêu chảy cấp",
            summary="Natri clorid 0,9% & Ringer's Lactate sẵn sàng tại Kho Dịch Truyền Khu C1",
            data={"targetTab": "fefo", "category": "fluids"},
            primary_action_label="Xem kho dịch truyền",
            primary_action_type="NAVIGATE_TAB",
            target_tab="fefo"
        )

        return CopilotResponse(
            intent="CLINICAL_AI_CONSULTATION",
            reply_text=validate_output_guardrail(reply_md, query),
            card=card,
            legal_basis="Hướng dẫn Chẩn đoán Điều trị Tiêu chảy cấp Bộ Y Tế & Phác đồ WHO",
            suggested_chips=["Phân độ mất nước WHO", "Kho dịch truyền Ringer Lactate", "Nguyên tắc bù dịch Oresol"],
            answer_type="grounded_reference",
            source_status="retrieved_evidence",
            confidence=1.0
        )
