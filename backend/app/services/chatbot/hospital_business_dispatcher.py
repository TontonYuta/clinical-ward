import re
from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas.copilot import CopilotResponse
from app.services.copilot_catalog import find_matched_med, find_matched_eq
from app.services.copilot_business_overview import handle_business_overview_intent
from app.services.copilot_intents_info import (
    handle_legal_intent,
    handle_shift_handover_intent,
    handle_coldchain_intent,
    handle_audit_intent,
    handle_ocr_intent,
)
from app.services.copilot_intents_actions import (
    handle_borrow_intent,
    handle_equipment_intent,
    handle_fefo_intent,
    handle_restock_intent,
)
from app.services.copilot_intents_prescription import (
    handle_prescription_advice_intent,
    handle_cpoe_intent,
    handle_debt_settle_intent,
    handle_prescription_audit_intent,
)

async def dispatch_clinical_subflows(
    query: str, lower_query: str, user_name: str, db: AsyncSession, user_role: str = "doctor"
) -> CopilotResponse | None:
    is_advice = any(w in lower_query for w in [
        "dặn dò", "nhắc uống thuốc", "nhắc thuốc", "lịch uống", "lên lịch nhắc",
        "thông báo uống", "gửi mail", "gửi email", "gửi gmail", "uống thuốc hàng ngày",
        "gửi sms", "nhắn tin", "mở form gửi", "mở form email", "mở form sms", "email/sms"
    ]) or (
        any(w in lower_query for w in ["thông báo", "gửi", "nhắc", "dặn"])
        and any(w in lower_query for w in ["uống thuốc", "uống", "đơn thuốc", "lịch thuốc", "sms", "email"])
    ) or lower_query.strip() in ["gửi gmail", "gửi mail", "gmail", "email", "xem email", "in phiếu dặn dò", "gửi sms", "sms"]
    if is_advice:
        return await handle_prescription_advice_intent(query, lower_query, user_name, user_role=user_role)

    is_prescription_audit = any(w in lower_query for w in [
        "kiểm tra đơn thuốc", "thẩm định đơn thuốc", "đơn thuốc đúng luật", "đơn thuốc đúng quy định",
        "đơn thuốc hợp lệ chưa", "phù hợp chẩn đoán", "thẩm định đơn", "kiểm tra đơn", "rà soát đơn thuốc",
        "thể thức đơn", "đơn thuốc có phù hợp", "liều dùng phù hợp chưa"
    ])
    if is_prescription_audit:
        return await handle_prescription_audit_intent(query, lower_query, user_name, user_role, db, session_id="")

    is_cpoe = (any(w in lower_query for w in [
        "kê đơn", "tạo đơn thuốc", "lập đơn thuốc", "kê toa", "kê đơn cpoe", "cpoe đơn thuốc", "đơn thuốc điện tử",
        "mở form kê đơn", "mở form cpoe", "mở cpoe", "form kê đơn", "xem đơn thuốc", "xem đơn", "đơn thuốc bệnh nhân", "danh sách đơn thuốc"
    ]) or ("cpoe" in lower_query and any(w in lower_query for w in ["mở", "form", "biểu mẫu", "xem"]))) and not is_advice
    if is_cpoe:
        return await handle_cpoe_intent(query, lower_query, user_name, user_role=user_role)

    # Tạm thời comment tính năng xử lý trả nợ vỏ theo yêu cầu người dùng
    # is_debt_settle = any(w in lower_query for w in [
    #     "trả vỏ", "hoàn trả vỏ", "thu hồi vỏ", "thanh toán nợ", "thanh toán sổ nợ",
    #     "trả nợ thuốc", "xóa nợ thuốc", "đối soát vỏ morphin", "xác nhận trả vỏ"
    # ]) and not any(w in lower_query for w in ["quy định", "thông tư", "nghị định"])
    # if is_debt_settle:
    #     return await handle_debt_settle_intent(query, lower_query, db)

    return None

async def dispatch_operational_business(
    query: str, lower_query: str, user_name: str, db: AsyncSession
) -> CopilotResponse | None:
    is_capabilities = any(w in lower_query for w in [
        "nghiệp vụ", "các nghiệp vụ", "quy trình lâm sàng", "tính năng", "bạn làm được gì",
        "bạn có thể làm", "bạn giúp được", "hệ thống làm được", "làm được gì", "giúp được gì",
        "hướng dẫn hệ thống", "hướng dẫn sử dụng", "chức năng", "menu", "bạn là ai",
        "ông là ai", "anh là ai", "em là ai", "mày là ai", "who are you", "ai đấy", "ai thế"
    ])
    if is_capabilities:
        return await handle_business_overview_intent()

    is_legal = any(w in lower_query for w in [
        "phác đồ", "quy định", "quy chế", "thông tư", "nghị định", "tiêu chuẩn", "hướng dẫn", "tiêu hủy", "vỡ", "làm mất", "thuốc gây nghiện", "hướng thần", "kiểm soát đặc biệt"
    ])
    has_action = any(w in lower_query for w in ["mượn", "lấy", "xuất", "hỏng", "báo hỏng", "kê", "cần"])
    if is_legal and not has_action:
        return await handle_legal_intent(lower_query)

    if any(w in lower_query for w in ["đối soát", "giao ban", "ca trực", "ca đêm", "báo cáo ca", "chốt ca", "bàn giao ca", "07:00", "lệch sổ", "tổng hợp nợ"]):
        return await handle_shift_handover_intent(db)

    # Tạm thời comment tính năng báo hỏng TBYT theo yêu cầu người dùng
    # if find_matched_eq(lower_query) is not None or any(w in lower_query for w in [
    #     "báo hỏng", "sự cố máy", "lỗi thiết bị", "xì khí", "không lên nguồn", "kẹt pít-tông", "chai pin"
    # ]):
    #     return await handle_equipment_intent(query, lower_query, user_name, db)

    if any(w in lower_query for w in ["fefo", "cận hạn", "hạn dùng", "hết hạn", "sắp hết hạn", "ngày hết hạn", "ưu tiên xuất", "bảng kho", "kho dược", "tồn kho dược", "bảng kho dược"]) or re.search(r"\bdate\b", lower_query):
        return await handle_fefo_intent(db)

    if any(w in lower_query for w in ["dự trù", "mẫu 01", "cạn kho", "sắp hết", "hết thuốc", "bù tồn kho", "chạm ngưỡng", "cơ số"]):
        return await handle_restock_intent(db)

    if any(w in lower_query for w in ["chuỗi lạnh", "cold chain", "nhiệt độ tủ lạnh", "datalogger", "mất điện tủ", "arrhenius", "giám sát tủ lạnh", "nhiệt độ bảo quản"]) or re.search(r"\bmkt\b", lower_query):
        return await handle_coldchain_intent(db)

    if any(w in lower_query for w in ["kiểm toán", "toàn vẹn", "chuỗi băm", "sha256", "sha-256", "hmac", "nhật ký bảo mật", "sổ bất biến"]):
        return await handle_audit_intent(db)

    if any(w in lower_query for w in ["hóa đơn", "ocr", "quét hóa đơn", "bóc tách", "phiếu nhập", "cpc1", "vat"]):
        return await handle_ocr_intent()

    matched_med = find_matched_med(lower_query)
    has_dispense_verb = any(w in lower_query for w in ["mượn", "lấy", "rút", "xuất", "cần", "xin", "tiêm", "truyền", "cấp phát"]) or (
        "cho" in lower_query and any(w in lower_query for w in ["lọ", "ống", "chai", "viên", "liều", "morphin", "adre"])
    )
    is_med_info = any(w in lower_query for w in [
        "thời gian bán thải", "chỉ định", "chống chỉ định", "tác dụng phụ", "tác dụng",
        "công dụng", "tương tác", "dùng để làm gì", "liều tối đa", "liều dùng", "là gì",
        "dị ứng", "huyết tương", "dược động học", "cơ chế", "thành phần", "uống lúc nào",
        "thế nào", "như thế nào", "bao nhiêu", "hỏi về", "thông tin"
    ])
    # Tạm thời comment tính năng mượn nợ thuốc tủ trực theo yêu cầu người dùng
    # if matched_med is not None and not is_med_info and (has_dispense_verb or any(c.isdigit() for c in query)):
    #     return await handle_borrow_intent(query, lower_query, user_name)

    return None
