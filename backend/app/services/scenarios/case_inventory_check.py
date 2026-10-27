"""
Kịch bản 9: Tra cứu Tồn kho Thực tế & Vị trí Lưu trữ Dược phẩm (Thông tư 22/2011/TT-BYT & GSP)
"""

from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.inventory import InventoryBatch
from app.schemas.copilot import CopilotResponse, CopilotActionCard
from app.services.scenarios.base import BaseScenario
from app.services.scenarios.context import ClinicalContext

class InventoryCheckScenario(BaseScenario):
    scenario_id = "inventory_check"
    scenario_name = "Tra cứu tồn kho thực tế & vị trí lưu trữ"

    def can_handle(self, query: str, lower_query: str, ctx: ClinicalContext) -> bool:
        return any(w in lower_query for w in ["còn bao nhiêu", "tồn kho", "số lượng còn", "vị trí lưu trữ", "kệ nào", "tủ nào"]) and any(
            w in lower_query for w in ["morphin", "fentanyl", "hadunalin", "kali", "diazepam", "vaxigrip", "paracetamol", "meropenem", "meroright", "ceftriaxon"]
        )

    async def handle(
        self,
        query: str,
        lower_query: str,
        ctx: ClinicalContext,
        db: AsyncSession
    ) -> Optional[CopilotResponse]:
        res_batches = await db.execute(select(InventoryBatch))
        all_batches = res_batches.scalars().all()
        matched_batch = None
        for b in all_batches:
            if b.item_name.lower() in lower_query or (b.active_ingredient and b.active_ingredient.lower() in lower_query):
                matched_batch = b
                break
        
        if not matched_batch:
            return None

        if ctx.session:
            ctx.session.set_active_medication(
                name=matched_batch.item_name,
                ingredient=matched_batch.active_ingredient or matched_batch.item_name,
                batch=matched_batch.batch_number,
                stock=f"{matched_batch.current_stock} {matched_batch.unit}",
                location=matched_batch.warehouse_location,
                sdk=matched_batch.registration_number or matched_batch.national_code
            )

        reply = (
            f"### 📦 BÁO CÁO TỒN KHO THỰC TẾ: {matched_batch.item_name}\n\n"
            f"• **Số lượng tồn hiện tại:** **{matched_batch.current_stock} {matched_batch.unit}**\n"
            f"• **Số lô sản xuất (Batch):** `{matched_batch.batch_number}`\n"
            f"• **Hạn sử dụng (Expiry):** **{matched_batch.expiry_date}** ({matched_batch.days_left} ngày còn lại)\n"
            f"• **Vị trí lưu trữ trong viện:** **{matched_batch.warehouse_location}**\n"
            f"• **Số đăng ký (SĐK):** `{matched_batch.registration_number or matched_batch.national_code}`\n"
            f"• **Trạng thái cảnh báo:** {'⚠️ Thuốc cận hạn xuất trước' if matched_batch.is_near_expiry else '✅ Hạn dùng an toàn'}"
        )
        card = CopilotActionCard(
            card_type="fefo_inventory",
            title=f"Kho Dược: {matched_batch.item_name}",
            summary=f"Tồn kho: {matched_batch.current_stock} {matched_batch.unit} • {matched_batch.warehouse_location}",
            data={"itemId": matched_batch.id, "batchNumber": matched_batch.batch_number},
            primary_action_label="Mở Bảng Kho Dược",
            primary_action_type="NAVIGATE_TAB",
            target_tab="fefo"
        )
        return CopilotResponse(
            intent="CLINICAL_INVENTORY_LOOKUP",
            reply_text=reply,
            card=card,
            legal_basis="Thông tư 22/2011/TT-BYT & Nguyên tắc GSP",
            suggested_chips=["Xem bảng kho Dược", "Lập phiếu bù cơ số", "Đối soát ca trực 07:00 AM"]
        )
