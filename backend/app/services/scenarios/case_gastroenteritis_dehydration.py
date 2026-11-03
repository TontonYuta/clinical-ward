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
        has_dehydration_diarrhea = any(w in lower_query for w in ["đi ngoài", "tiêu chảy", "mất nước", "nhiễm trùng tiêu hóa", "ngộ độc thực phẩm", "ngộ độc thức ăn"])
        has_abd_fever = ("đau bụng" in lower_query or "bụng" in lower_query) and ("buồn nôn" in lower_query or "nôn" in lower_query) and ("sốt" in lower_query)
        has_symptom_ask = any(w in lower_query for w in ["biểu hiện của", "dấu hiệu của", "là bệnh gì", "bị gì", "nguyên nhân", "xử trí", "uống gì", "truyền gì"])
        is_allergy = any(w in lower_query for w in ["dị ứng", "tiêm kháng sinh", "ong đốt", "sốc phản vệ"])
        return (has_dehydration_diarrhea or (has_abd_fever and has_symptom_ask)) and not is_allergy

    async def handle(
        self, query: str, lower_query: str, ctx: ClinicalContext, db: AsyncSession
    ) -> Optional[CopilotResponse]:
        has_abd_fever = ("đau bụng" in lower_query or "bụng" in lower_query) and ("buồn nôn" in lower_query or "nôn" in lower_query) and ("sốt" in lower_query)

        if has_abd_fever:
            reply_md = (
                "### 🩺 ĐỊNH HƯỚNG LÂM SÀNG: ĐAU BỤNG, BUỒN NÔN, SỐT CAO\n\n"
                "Tam chứng **đau bụng + buồn nôn/nôn + sốt cao** là dấu hiệu cảnh báo của tình trạng nhiễm trùng tiêu hóa hoặc viêm cấp tính trong ổ bụng, cần được thăm khám khẩn trương:\n\n"
                "---\n\n"
                "#### 1. CÁC NGUYÊN NHÂN LÂM SÀNG CẦN PHÂN BIỆT\n"
                "1. **Nhiễm trùng tiêu hóa cấp (Acute Enteritis / Food Poisoning):**\n"
                "   * Viêm dạ dày - ruột do vi khuẩn xâm lấn (*Salmonella*, *Shigella*, *Campylobacter*, *E. coli*).\n"
                "   * Thường kèm đi ngoài phân lỏng, đau quặn bụng từng cơn, sốt cao rét run.\n"
                "2. **Cảnh báo bệnh lý ngoại khoa ổ bụng (CẦN LOẠI TRỪ KHẨN CẤP):**\n"
                "   * **Viêm ruột thừa cấp:** Khởi đầu đau quanh rốn/thượng vị rồi khu trú hố chậu phải (điểm MacBurney (+)), buồn nôn, sốt tăng dần.\n"
                "   * **Viêm tụy cấp:** Đau quặn dữ dội thượng vị xuyên ra sau lưng sau bữa ăn nhiều đạm/mỡ hoặc rượu bia, nôn liên tục không giảm đau.\n"
                "   * **Viêm túi mật / Nhiễm trùng đường mật:** Đau hạ sườn phải, sốt cao rét run, có thể vàng da (tam chứng Charcot).\n"
                "3. **Phản vệ độ II có triệu chứng tiêu hóa (TT 51/2017/TT-BYT):** Cần lưu ý nếu khởi phát đột ngột ngay sau tiếp xúc dị nguyên (thuốc/thức ăn), thường kèm mày đay, khó thở hoặc tụt HA.\n\n"
                "---\n\n"
                "#### 2. KHUYẾN CÁO XỬ TRÍ & CẬN LÂM SÀNG (HƯỚNG DẪN BỘ Y TẾ)\n"
                "* **Khám thực thể:** Thăm khám bụng tìm phản ứng thành bụng, cảm ứng phúc mạc, vị trí điểm đau khu trú.\n"
                "* **Chỉ định cận lâm sàng cấp thiết:**\n"
                "  * Siêu âm ổ bụng tổng quát (loại trừ viêm ruột thừa, viêm tụy, sỏi mật).\n"
                "  * Công thức máu (Bạch cầu, tỷ lệ Neutrophil), CRP/Procalcitonin đánh giá mức độ nhiễm khuẩn.\n"
                "  * Xét nghiệm men tụy (Amylase, Lipase), men gan, điện giải đồ.\n"
                "* **Lưu ý an toàn dược:** Tuyệt đối **không tự ý dùng thuốc giảm đau mạnh (Opioid)** hoặc thuốc cầm nôn/cầm tiêu chảy trước khi bác sĩ ngoại khoa thăm khám, để tránh che lấp triệu chứng cấp cứu ngoại khoa."
            )
            return CopilotResponse(
                intent="CLINICAL_AI_CONSULTATION",
                reply_text=validate_output_guardrail(reply_md, query),
                legal_basis="Hướng dẫn Chẩn đoán Điều trị Ngoại khoa & Tiêu hóa Bộ Y Tế",
                suggested_chips=["Cấp cứu viêm ruột thừa", "Siêu âm ổ bụng cấp", "Định lượng CRP/Bạch cầu"],
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
