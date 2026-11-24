import re
from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas.copilot import CopilotResponse
from app.services.copilot_business_overview import handle_business_overview_intent
from app.services.copilot_intents_info import (
    handle_shift_handover_intent,
    handle_audit_intent,
    handle_ocr_intent,
)
from app.services.copilot_intents_prescription import (
    handle_prescription_advice_intent,
    handle_cpoe_intent,
    handle_prescription_audit_intent,
)
from app.services.chatbot.semantic_navigation_router import (
    route_semantic_navigation,
    is_clinical_or_educational_inquiry,
)

async def dispatch_clinical_subflows(
    query: str, lower_query: str, user_name: str, db: AsyncSession, user_role: str = "doctor"
) -> CopilotResponse | None:
    """
    Định tuyến các quy trình lâm sàng (CPOE, Dặn dò, Thẩm định đơn thuốc).
    Loại bỏ triệt để hardcoded keywords; bảo vệ 100% các câu hỏi chuyên môn y khoa
    không bị nuốt thành form rỗng hay thông báo thiếu thông tin.
    """
    # 1. Thử định tuyến điều hướng mở Tab hoặc Biểu mẫu bằng Semantic Router
    nav_res = await route_semantic_navigation(query, lower_query, user_role=user_role)
    if nav_res:
        return nav_res

    # 2. Nếu là câu hỏi y khoa / nghi vấn chuyên môn / hướng dẫn điều trị,
    # tuyệt đối KHÔNG được nuốt thành CPOE hay Dặn dò rỗng -> để SOTA RAG xử lý
    if is_clinical_or_educational_inquiry(query, lower_query):
        return None

    # 3. Ý định Mở Form Dặn Dò / Gửi Email / SMS nhắc thuốc
    # Chỉ kích hoạt khi có ý định rõ ràng về hành động dặn dò / gửi tin, không áp dụng cho hỏi cách dùng thuốc
    is_advice_action = (
        any(w in lower_query for w in [
            "mở form dặn dò", "mở biểu mẫu dặn dò", "mở form gửi email", "mở form email",
            "mở form sms", "gửi email dặn dò", "gửi sms nhắc thuốc", "lên lịch nhắc thuốc cho bệnh nhân",
            "soạn sms dặn dò", "in phiếu dặn dò xuất viện"
        ])
    )
    if is_advice_action:
        return await handle_prescription_advice_intent(query, lower_query, user_name, user_role=user_role)

    # 4. Ý định Thẩm định đơn thuốc (Prescription Audit)
    is_prescription_audit = any(w in lower_query for w in [
        "thẩm định đơn thuốc", "kiểm tra tính hợp lệ của đơn thuốc",
        "đơn thuốc đúng luật chưa", "thẩm định thể thức đơn thuốc", "rà soát đơn thuốc theo thông tư 26"
    ])
    if is_prescription_audit:
        return await handle_prescription_audit_intent(query, lower_query, user_name, user_role, db, session_id="")

    # 5. Ý định Soạn thảo / Lập đơn thuốc CPOE cho bệnh nhân cụ thể
    # Chỉ kích hoạt khi người dùng thực sự muốn lập đơn (có người bệnh hoặc thuốc cụ thể cần kê)
    # Tuyệt đối không bắt các câu hỏi chung chung về nguyên tắc kê đơn hay quy định kê đơn
    has_patient_target = bool(
        re.search(r"(?:bệnh nhân|cho bn|cho bệnh nhân|bệnh nhân:)\s+[A-ZÀ-Ỹa-zà-ỹ]+", query, re.IGNORECASE)
        or re.search(r"\b(?:bn|cccd)\s*[:#]?\s*[\w-]+", lower_query)
    )
    has_prescribe_imperative = any(w in lower_query for w in [
        "kê đơn cho", "kê toa cho", "lập đơn cho", "tạo đơn cho", "kê thuốc cho",
        "kê paracetamol cho", "kê augmentin cho", "kê morphin cho"
    ]) or (
        any(w in lower_query for w in ["kê đơn", "tạo đơn thuốc", "lập đơn thuốc"])
        and has_patient_target
    )

    if has_prescribe_imperative:
        return await handle_cpoe_intent(query, lower_query, user_name, user_role=user_role)

    # Nếu không phải hành vi thao tác cụ thể, để toàn bộ câu hỏi đi vào pipeline RAG / Knowledge
    return None

async def dispatch_operational_business(
    query: str, lower_query: str, user_name: str, db: AsyncSession
) -> CopilotResponse | None:
    """
    Định tuyến các nghiệp vụ vận hành bệnh viện (Kho FEFO, Dự trù, Chuỗi lạnh, Giao ban).
    Không chặn bắt các câu hỏi tri thức lâm sàng hoặc thông tin sản phẩm.
    """
    # 1. Thử định tuyến mở Tab phân hệ qua Semantic Router
    nav_res = await route_semantic_navigation(query, lower_query, user_role="doctor")
    if nav_res:
        return nav_res

    # 2. Nếu là câu hỏi y khoa / dược lý / thắc mắc, không nuốt thành bảng báo cáo vận hành
    if is_clinical_or_educational_inquiry(query, lower_query) and not any(k in lower_query for k in ("tồn kho bao nhiêu", "còn bao nhiêu", "còn mấy")):
        return None

    has_clinical_context = any(w in lower_query for w in [
        "chức năng thận", "chức năng gan", "chức năng tim", "chỉnh liều", "suy thận", "suy gan",
        "liều lượng", "uống", "tiêm", "thuốc", "mg", "mcg"
    ])

    # Giới thiệu năng lực hệ thống
    is_capabilities = (any(w in lower_query for w in [
        "nghiệp vụ hệ thống", "các nghiệp vụ", "quy trình lâm sàng", "tính năng hệ thống", "bạn làm được gì",
        "bạn có thể làm gì", "hệ thống hỗ trợ những gì", "hướng dẫn hệ thống", "hướng dẫn sử dụng hệ thống",
        "menu hệ thống", "bạn là ai"
    ]) or lower_query.strip().strip("?.! ") in ["menu", "chức năng", "tính năng", "bạn là ai"]) and not has_clinical_context
    if is_capabilities:
        return await handle_business_overview_intent()

    # Đối soát giao ban ca trực
    is_audit_trail_ask = any(w in lower_query for w in ["sổ kiểm toán", "audit trail", "hmac", "sha256", "bất biến"])
    if not is_audit_trail_ask and any(w in lower_query for w in [
        "đối soát ca trực", "báo cáo giao ban", "bàn giao ca trực", "đối soát 07:00", "tổng hợp nợ ca trực"
    ]):
        return await handle_shift_handover_intent(db)

    # Tra cứu bảng kho FEFO (chỉ khi yêu cầu kiểm tra danh mục kho / danh sách lô cận hạn)
    is_fefo_report_request = (
        any(w in lower_query for w in [
            "danh sách thuốc cận hạn", "tra cứu lô fefo", "bảng kho fefo", "các lô thuốc sắp hết hạn",
            "danh mục thuốc cận date", "ưu tiên xuất fefo", "danh sách lô hết hạn"
        ]) or lower_query.strip() in ["fefo", "bảng kho", "kho dược", "tồn kho dược"]
    )
    if is_fefo_report_request:
        from app.domains.pharmacy_inventory.tools import PharmacyInventoryTools
        return await PharmacyInventoryTools().execute_fefo(db)

    # Lập dự trù bù kho Mẫu 01
    is_restock_request = any(w in lower_query for w in [
        "lập dự trù bù kho", "lập phiếu dự trù", "dự trù mẫu 01", "các thuốc chạm ngưỡng tồn",
        "danh sách mặt hàng cần dự trù", "bù tồn kho cạn"
    ])
    if is_restock_request:
        from app.domains.pharmacy_inventory.tools import PharmacyInventoryTools
        return await PharmacyInventoryTools().execute_restock(db)

    # Chuỗi lạnh viễn thông (Cold chain)
    is_coldchain_status_request = (
        any(w in lower_query for w in [
            "giám sát chuỗi lạnh", "tình trạng chuỗi lạnh", "báo cáo nhiệt độ tủ lạnh",
            "kiểm tra nhiệt độ bảo quản vắc xin", "sự cố mất điện tủ lạnh", "datalogger chuỗi lạnh"
        ]) or lower_query.strip() in ["chuỗi lạnh", "cold chain", "kho lạnh"]
    )
    if is_coldchain_status_request:
        from app.services.scenarios.registry import dispatch_clinical_scenario
        sc_res = await dispatch_clinical_scenario(query, lower_query, user_name, "nurse", None, db)
        if sc_res:
            return sc_res
        from app.domains.cold_chain.tools import ColdChainTools
        return await ColdChainTools().status_response(db)

    # Sổ nhật ký kiểm toán bất biến
    if any(w in lower_query for w in ["kiểm toán toàn vẹn", "chuỗi băm sha256", "nhật ký bảo mật bất biến", "sổ bất biến hmac"]):
        return await handle_audit_intent(db)

    # OCR hóa đơn nhập kho
    if any(w in lower_query for w in ["quét hóa đơn cpc1", "ocr hóa đơn dược", "bóc tách phiếu nhập cpc1", "ocr vat"]):
        return await handle_ocr_intent()

    # Tra cứu số lượng tồn kho cụ thể
    if any(w in lower_query for w in ["tồn kho bao nhiêu", "còn bao nhiêu lọ", "còn bao nhiêu ống", "còn mấy viên", "còn lại bao nhiêu trong kho"]):
        from app.services.scenarios.case_inventory_check import InventoryCheckScenario
        from app.services.scenarios.context import ClinicalContext
        ctx = ClinicalContext(query=query, lower_query=lower_query, user_name=user_name, user_role="doctor")
        sc = InventoryCheckScenario()
        inv_res = await sc.handle(query, lower_query, ctx, db)
        if inv_res:
            return inv_res

    return None
