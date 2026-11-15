"""
Kịch bản 9: Tra cứu Tồn kho Thực tế & Vị trí Lưu trữ Dược phẩm (Thông tư 22/2011/TT-BYT & GSP)
"""

from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas.copilot import CopilotResponse
from app.domains.pharmacy_inventory.tools import PharmacyInventoryTools
from app.services.scenarios.base import BaseScenario
from app.services.scenarios.context import ClinicalContext

class InventoryCheckScenario(BaseScenario):
    scenario_id = "inventory_check"
    scenario_name = "Tra cứu tồn kho thực tế & vị trí lưu trữ"

    def can_handle(self, query: str, lower_query: str, ctx: ClinicalContext) -> bool:
        return any(w in lower_query for w in ["còn bao nhiêu", "tồn kho", "số lượng còn", "vị trí lưu trữ", "kệ nào", "tủ nào", "còn mấy", "còn lại bao nhiêu"])

    async def handle(
        self,
        query: str,
        lower_query: str,
        ctx: ClinicalContext,
        db: AsyncSession
    ) -> Optional[CopilotResponse]:
        response = await PharmacyInventoryTools().execute_stock_lookup(db, query)
        if not response.card or not response.card.data.get("batches"):
            return response
        first_batch = response.card.data["batches"][0]
        from app.domains.pharmacy_inventory.service import PharmacyInventoryService
        result = await PharmacyInventoryService().get_stock(db, item_id=first_batch["item_id"])
        matched_batch = result.records[0] if result.records else None
        if matched_batch is None:
            return response

        if ctx.session:
            ctx.session.set_active_medication(
                name=matched_batch.item_name,
                ingredient=matched_batch.active_ingredient or matched_batch.item_name,
                batch=matched_batch.batch_number,
                stock=f"{matched_batch.current_stock} {matched_batch.unit}",
                location=matched_batch.warehouse_location,
                sdk=matched_batch.registration_number or matched_batch.national_code
            )

        return response
