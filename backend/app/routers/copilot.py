from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas.copilot import CopilotQuery, CopilotResponse
from app.services.copilot_catalog import find_matched_med, find_matched_eq
from app.services.copilot_intents_info import (
    handle_legal_intent,
    handle_shift_handover_intent,
    handle_coldchain_intent,
    handle_audit_intent,
    handle_ocr_intent
)
from app.services.copilot_intents_actions import (
    handle_borrow_intent,
    handle_equipment_intent,
    handle_fefo_intent,
    handle_restock_intent
)

router = APIRouter(prefix="/copilot", tags=["Trợ Lý Agent Lâm Sàng Thông Minh"])

@router.post("/chat", response_model=CopilotResponse)
async def chat_with_copilot(payload: CopilotQuery, db: AsyncSession = Depends(get_db)):
    query = payload.query.strip()
    lower_query = query.lower()
    user_role = payload.user_role
    user_name = payload.user_name

    is_legal = any(w in lower_query for w in [
        "phác đồ", "quy định", "thông tư", "nghị định", "tiêu chuẩn", "hướng dẫn", "tiêu hủy", "vỡ", "làm mất"
    ])
    has_action = any(w in lower_query for w in ["mượn", "lấy", "xuất", "hỏng", "báo hỏng", "kê", "cần"])

    if is_legal and not has_action:
        return await handle_legal_intent(lower_query)

    is_shift_handover = any(w in lower_query for w in [
        "đối soát", "giao ban", "ca trực", "ca đêm", "báo cáo ca", "chốt ca", "bàn giao ca", "07:00", "lệch sổ", "tổng hợp nợ"
    ])
    if is_shift_handover:
        return await handle_shift_handover_intent(db)

    matched_eq = find_matched_eq(lower_query)
    is_eq_intent = matched_eq is not None or any(w in lower_query for w in [
        "báo hỏng", "sự cố máy", "lỗi thiết bị", "xì khí", "không lên nguồn", "kẹt pít-tông", "chai pin"
    ])
    if is_eq_intent:
        return await handle_equipment_intent(query, lower_query, user_name, db)

    is_fefo = any(w in lower_query for w in [
        "fefo", "cận hạn", "hạn dùng", "date", "hết hạn", "sắp hết hạn", "ngày hết hạn", "ưu tiên xuất"
    ])
    if is_fefo:
        return await handle_fefo_intent(db)

    is_restock = any(w in lower_query for w in [
        "dự trù", "mẫu 01", "cạn kho", "sắp hết", "hết thuốc", "bù tồn kho", "chạm ngưỡng", "cơ số"
    ])
    if is_restock:
        return await handle_restock_intent(db)

    is_coldchain = any(w in lower_query for w in [
        "chuỗi lạnh", "cold chain", "nhiệt độ tủ lạnh", "datalogger", "vắc xin", "mkt", "mất điện tủ", "arrhenius"
    ])
    if is_coldchain:
        return await handle_coldchain_intent(db)

    is_audit = any(w in lower_query for w in [
        "kiểm toán", "toàn vẹn", "chuỗi băm", "sha256", "sha-256", "hmac", "nhật ký bảo mật", "sổ bất biến"
    ])
    if is_audit:
        return await handle_audit_intent(db)

    is_ocr = any(w in lower_query for w in [
        "hóa đơn", "ocr", "quét hóa đơn", "bóc tách", "phiếu nhập", "cpc1", "vat"
    ])
    if is_ocr:
        return await handle_ocr_intent()

    matched_med = find_matched_med(lower_query)
    is_dispense_intent = matched_med is not None or any(w in lower_query for w in [
        "mượn", "lấy", "rút", "xuất", "cần", "xin", "tiêm", "kê", "cấp phát", "thuốc"
    ])
    if is_dispense_intent:
        return await handle_borrow_intent(query, lower_query, user_name)

    return CopilotResponse(
        intent="GENERAL_CLINICAL_ASSISTANCE",
        reply_text=(
            "Chào bạn, tôi là **Trợ Lý Trí Tuệ Nhân Tạo Lâm Sàng (Clinical Copilot)**.\n"
            "Tôi có thể hỗ trợ bạn:\n"
            "• **Mượn khẩn cấp cứu:** Xuất nợ thuốc/vật tư ca đêm tủ trực (TT 22 & TT 20).\n"
            "• **Giao ban 07:00 AM:** Đối soát nợ vỏ thuốc gây nghiện và phát hiện lệch sổ.\n"
            "• **Báo hỏng TBYT:** Khởi tạo yêu cầu kỹ thuật phân loại rủi ro (NĐ 98/2021).\n"
            "• **Kho Dược GSP:** Quản lý hạn dùng FEFO & giám sát chuỗi lạnh vắc xin.\n"
            "• **Kiểm toán bất biến:** Xác thực chuỗi băm HMAC-SHA256."
        ),
        suggested_chips=["Đối soát ca trực 07:00 AM", "Mượn 2 ống Morphin", "Báo hỏng máy thở PB840"]
    )
