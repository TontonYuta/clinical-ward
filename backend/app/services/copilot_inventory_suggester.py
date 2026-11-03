"""
Helper gợi ý đối soát tồn kho và chính tả biệt dược khi không tìm thấy trong DAV (<= 80 LOC).
"""
import difflib
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.inventory import InventoryBatch
from app.schemas.copilot import CopilotResponse, CopilotActionCard

async def suggest_inventory_typo(
    kw: str,
    db: AsyncSession
) -> Optional[CopilotResponse]:
    batch_res = await db.execute(select(InventoryBatch))
    all_batches = batch_res.scalars().all()
    best_batch, best_ratio = None, 0.0
    kw_clean = kw.lower().strip()

    for b in all_batches:
        name_ratio = difflib.SequenceMatcher(None, kw_clean, b.item_name.lower()).ratio()
        ing_ratio = difflib.SequenceMatcher(None, kw_clean, (b.active_ingredient or "").lower()).ratio()
        max_r = max(name_ratio, ing_ratio)
        if kw_clean in b.item_name.lower() or kw_clean in (b.active_ingredient or "").lower():
            max_r = max(max_r, 0.75)
        if max_r > best_ratio:
            best_ratio = max_r
            best_batch = b

    if best_batch and 0.55 <= best_ratio < 0.99:
        sdk_code = best_batch.registration_number or best_batch.national_code or "Đang cập nhật"
        active_name = best_batch.active_ingredient or best_batch.item_name
        reply = (
            f"### 🔍 KHÔNG TÌM THẤY TÊN CHÍNH XÁC - GỢI Ý ĐỐI SOÁT CHÍNH TẢ\n\n"
            f"• Hệ thống không tìm thấy `{kw}` trong CSDL 54.885 số đăng ký Cục Quản lý Dược.\n"
            f"👉 **Có phải bạn đang tìm:** **{best_batch.item_name}** (Hoạt chất: **{active_name}** | SĐK: `{sdk_code}`)\n"
        )
        card = CopilotActionCard(
            card_type="medication_safety", title=f"Gợi ý: {best_batch.item_name}",
            summary=f"SĐK: {sdk_code} • Tồn: {best_batch.current_stock} {best_batch.unit} ({best_batch.warehouse_location})",
            data={"national_code": sdk_code, "brand_name": best_batch.item_name, "active_ingredient": active_name, "targetTab": "fefo"},
            primary_action_label=f"Xem {best_batch.item_name}", primary_action_type="NAVIGATE_TAB", target_tab="fefo"
        )
        return CopilotResponse(
            intent="CLINICAL_TYPO_SUGGESTION", reply_text=reply, card=card,
            legal_basis="Thông tư 22/2011/TT-BYT & CSDL Cục Quản lý Dược",
            suggested_chips=[f"Thông tin {best_batch.item_name}", "Đối soát ca trực 07:00 AM", "Kiểm tra hạn dùng FEFO"],
            answer_type="medication_suggestion", source_status="inventory_suggestion", confidence=best_ratio
        )
    return None
