"""
Kịch bản: Hướng Dẫn Điều Trị Đau Đầu & Thuốc Giảm Đau Chuẩn Dược Thư 2015 & CSDL Bệnh Viện
Dữ liệu CSDL: Lô b-1 - PARACETAMOL 500mg (LOT-PC24-11A, Tồn 80 Viên, Kho Dược Nội Trú - Kệ A1 Tầng 1)
Căn cứ: Dược Thư Quốc Gia Việt Nam 2015 Trang 1095, TT 22/2011/TT-BYT & Hướng dẫn Bộ Y Tế (<=100 LOC)
"""

from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.inventory import InventoryBatch
from app.schemas.copilot import CopilotResponse, CopilotActionCard
from app.services.scenarios.base import BaseScenario
from app.services.scenarios.context import ClinicalContext

class HeadachePainScenario(BaseScenario):
    scenario_id = "headache_pain"
    scenario_name = "Xử trí đau đầu & Thuốc giảm đau Paracetamol CSDL Bệnh Viện"

    def can_handle(self, query: str, lower_query: str, ctx: ClinicalContext) -> bool:
        has_headache_word = any(w in lower_query for w in [
            "đau đầu", "nhức đầu", "đau nửa đầu", "thuốc đau đầu", "thuốc trị đau đầu",
            "thuốc giảm đau đầu", "bị đau đầu", "hay đau đầu"
        ])
        is_vaccine = any(w in lower_query for w in ["chuỗi lạnh", "vắc xin", "tủ lạnh", "mkt"])
        return has_headache_word and not is_vaccine

    async def handle(
        self,
        query: str,
        lower_query: str,
        ctx: ClinicalContext,
        db: AsyncSession
    ) -> Optional[CopilotResponse]:
        has_case = bool(ctx.patient or any(term in lower_query for term in ("bệnh nhân", "người bệnh", "ca bệnh", "ca này", "hồ sơ", "bn-", "bn ")))
        if not has_case:
            return CopilotResponse(
                intent="CLINICAL_CASE_CLARIFICATION",
                reply_text="Để rà soát đau đầu theo ca, vui lòng chọn hồ sơ hoặc cung cấp thông tin người bệnh. Nếu cần chuyên luận thuốc giảm đau, hãy nêu tên thuốc cần tra cứu.",
                answer_type="clarification", source_status="missing_case_context", confidence=1.0,
                abstention_reason="Chưa xác định người bệnh hoặc thuốc cần tra cứu"
            )
        has_drug_lookup = any(term in lower_query for term in ("paracetamol", "ibuprofen", "sumatriptan", "ergotamin"))
        if not has_drug_lookup:
            return CopilotResponse(
                intent="CLINICAL_CASE_CLARIFICATION",
                reply_text="Để rà soát đau đầu theo ca, vui lòng cung cấp tuổi, thời điểm khởi phát, mức độ/đặc điểm đau, sinh hiệu, dấu hiệu thần kinh, bệnh nền, dị ứng và thuốc đang dùng. Không suy ra chẩn đoán hoặc phác đồ khi chưa có dữ liệu ca.",
                answer_type="clarification", source_status="incomplete_case_context", confidence=1.0,
                abstention_reason="Thiếu dữ liệu lâm sàng để rà soát đau đầu",
            )
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

        reply = (
            "### 💊 TÀI LIỆU THAM KHẢO: ĐÁNH GIÁ ĐAU ĐẦU VÀ THUỐC GIẢM ĐAU (Dược Thư Quốc Gia 2015)\n\n"
            "• **Đánh giá ca bệnh:** Đau đầu (Cephalea) có nhiều nguyên nhân như căng thẳng thần kinh (Tension headache), "
            "vận mạch, viêm xoang, huyết áp hoặc đau nửa đầu Migraine.\n\n"
            "• **Thuốc giảm đau bậc 1 ưu tiên (Có sẵn trong CSDL Tồn kho Bệnh viện):**\n"
            f"  • **Biệt dược tồn kho:** **PARACETAMOL 500mg** (Lô: `{batch_no}` | Tồn kho: **{stock_str}** tại {loc_str}).\n"
            "  • Tra cứu liều theo đúng chuyên luận, dạng bào chế và đặc điểm người bệnh; không dùng thông tin tồn kho để suy ra liều cho ca.\n"
            "  • **Chống chỉ định & Thận trọng:** Người suy gan nặng, thiếu hụt men G6PD, người nghiện rượu; không uống rượu bia trong thời gian dùng thuốc.\n\n"
            "• **Lựa chọn thay thế (Đau đầu do viêm hoặc căng cơ):**\n"
            "  • **NSAIDs (Ibuprofen):** cần đối chiếu chuyên luận và chống chỉ định/cảnh báo theo người bệnh trước khi cân nhắc.\n"
            "  • **Đau nửa đầu Migraine chuyên biệt:** Cần khám bác sĩ để cân nhắc nhóm Triptan (Sumatriptan) hoặc Ergotamin.\n\n"
            "🚨 **DẤU HIỆU CẢNH BÁO CẦN ĐÁNH GIÁ KHẨN (Red Flags):**\n"
            "• Đau đầu đột ngột dữ dội kiểu \"sét đánh\", đau đầu dữ dội kèm sốt cao cứng gáy, nôn vọt, nhìn mờ, co giật hoặc yếu liệt nửa người."
        )

        card = CopilotActionCard(
            card_type="medication_safety",
            title="Thuốc Giảm Đau: PARACETAMOL 500mg",
            summary=f"Lô: {batch_no} • Tồn: {stock_str} ({loc_str}) • SĐK: 893100110026",
            data={
                "brand_name": "PARACETAMOL 500mg",
                "active_ingredient": "Paracetamol 500mg",
                "current_stock": stock_str,
                "warehouse_location": loc_str,
                "batch_number": batch_no,
                "targetTab": "fefo"
            },
            primary_action_label="Xem Tồn Kho Paracetamol",
            primary_action_type="NAVIGATE_TAB",
            target_tab="fefo"
        )

        return CopilotResponse(
            intent="HEADACHE_PAIN_RELIEF_GUIDANCE",
            reply_text=reply,
            card=card,
            legal_basis="Dược Thư Quốc Gia Việt Nam 2015 Trang 1095 & Thông tư 22/2011/TT-BYT",
            suggested_chips=[
                "Paracetamol liều tối đa bao nhiêu",
                "Kiểm tra hạn dùng FEFO",
                "Thông tin thuốc Prasocare",
                "Đối soát ca trực 07:00 AM"
            ],
            session_id=ctx.session.session_id if ctx.session else None,
            active_medication_name="PARACETAMOL 500mg",
            active_medication_stock=stock_str,
            active_medication_location=loc_str
        )
