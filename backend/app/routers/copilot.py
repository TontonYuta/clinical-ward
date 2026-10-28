from fastapi import APIRouter, Depends
import re
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
from app.services.copilot_drug_lookup import lookup_drug_authoritative
from app.services.copilot_business_overview import handle_business_overview_intent, CLINICAL_BUSINESS_DIRECTORY
from app.services.copilot_gemini import ask_backend_gemini_copilot
from app.services.copilot_intents_prescription import (
    handle_prescription_advice_intent,
    handle_cpoe_intent,
    handle_debt_settle_intent
)
from app.services.copilot_gemini_scenarios import detect_and_handle_gemini_clinical_scenario
from app.security.guardrails import validate_input_guardrail, validate_output_guardrail

router = APIRouter(prefix="/copilot", tags=["Trợ Lý Agent Lâm Sàng Thông Minh"])

@router.post("/chat", response_model=CopilotResponse)
async def chat_with_copilot(payload: CopilotQuery, db: AsyncSession = Depends(get_db)):
    user_role = payload.user_role
    user_name = payload.user_name
    session_id = payload.session_id or f"session_{user_name.replace(' ', '_')}"

    # === LỚP BẢO MẬT INPUT GUARDRAIL: CHỐNG PROMPT INJECTION & SQL INJECTION ===
    guard_res = validate_input_guardrail(payload.query, user_role=user_role)
    if not guard_res.is_safe:
        return CopilotResponse(
            intent="SECURITY_GUARDRAIL_BLOCKED",
            reply_text=guard_res.safe_response,
            legal_basis="OWASP LLM01:2025, TT 20/2017 & An toàn An ninh Y tế",
            suggested_chips=["Tra cứu Dược Thư 2015", "Quy chế thuốc gây nghiện TT 20", "Hướng dẫn sử dụng hệ thống"]
        )

    query = guard_res.sanitized_query
    lower_query = query.lower()

    # 0a. Dặn dò bác sĩ & Lịch uống thuốc qua Google Apps Script / Email
    is_advice = any(w in lower_query for w in ["dặn dò", "nhắc uống thuốc", "nhắc thuốc", "lịch uống", "lên lịch nhắc", "thông báo uống", "gửi mail", "gửi email", "gửi gmail", "uống thuốc hàng ngày"]) or (
        any(w in lower_query for w in ["thông báo", "gửi", "nhắc", "dặn"]) and any(w in lower_query for w in ["uống thuốc", "uống", "đơn thuốc", "lịch thuốc"])
    ) or lower_query.strip() in ["gửi gmail", "gửi mail", "gmail", "email", "xem email", "in phiếu dặn dò"]
    if is_advice:
        return await handle_prescription_advice_intent(query, lower_query, user_name)

    # 0b. Kê đơn thuốc điện tử CPOE
    is_cpoe = any(w in lower_query for w in ["kê đơn", "tạo đơn thuốc", "lập đơn thuốc", "kê toa", "kê đơn cpoe", "cpoe đơn thuốc", "đơn thuốc điện tử"]) and not is_advice
    if is_cpoe:
        return await handle_cpoe_intent(query, lower_query, user_name)

    # 0c. Hoàn trả vỏ thuốc độc gây nghiện & Xóa nợ
    is_debt_settle = any(w in lower_query for w in ["trả vỏ", "hoàn trả vỏ", "thu hồi vỏ", "thanh toán nợ", "thanh toán sổ nợ", "trả nợ thuốc", "xóa nợ thuốc", "đối soát vỏ morphin", "xác nhận trả vỏ"]) and not any(w in lower_query for w in ["quy định", "thông tư", "nghị định"])
    if is_debt_settle:
        return await handle_debt_settle_intent(query, lower_query, db)

    # 0d. 12 Kịch Bản Lâm Sàng Chuyên Sâu Tách File & AMIE Multi-turn Context
    scenario_res = await detect_and_handle_gemini_clinical_scenario(
        query, lower_query, user_name, db, user_role=user_role, session_id=session_id
    )
    if scenario_res:
        scenario_res.reply_text = validate_output_guardrail(scenario_res.reply_text, query)
        return scenario_res

    # 1. Tra cứu Bản đồ 10 Đại Nghiệp vụ Bệnh viện
    if any(w in lower_query for w in ["nghiệp vụ", "các nghiệp vụ", "quy trình lâm sàng", "tính năng", "bạn làm được gì", "hướng dẫn hệ thống", "chức năng", "menu"]):
        return await handle_business_overview_intent()

    # 2. Căn cứ pháp lý & phác đồ Thông tư Bộ Y tế
    is_legal = any(w in lower_query for w in ["phác đồ", "quy định", "thông tư", "nghị định", "tiêu chuẩn", "hướng dẫn", "tiêu hủy", "vỡ", "làm mất"])
    has_action = any(w in lower_query for w in ["mượn", "lấy", "xuất", "hỏng", "báo hỏng", "kê", "cần"])
    if is_legal and not has_action:
        return await handle_legal_intent(lower_query)

    # 3. Giao ban & Đối soát ca trực 07:00 AM (TT 22 & TT 20)
    if any(w in lower_query for w in ["đối soát", "giao ban", "ca trực", "ca đêm", "báo cáo ca", "chốt ca", "bàn giao ca", "07:00", "lệch sổ", "tổng hợp nợ"]):
        return await handle_shift_handover_intent(db)

    # 4. Báo hỏng Trang thiết bị Y tế (NĐ 98/2021)
    matched_eq = find_matched_eq(lower_query)
    if matched_eq is not None or any(w in lower_query for w in ["báo hỏng", "sự cố máy", "lỗi thiết bị", "xì khí", "không lên nguồn", "kẹt pít-tông", "chai pin"]):
        return await handle_equipment_intent(query, lower_query, user_name, db)

    # 5. Kho FEFO & Cận hạn (TT 36/2018 GSP)
    if any(w in lower_query for w in ["fefo", "cận hạn", "hạn dùng", "date", "hết hạn", "sắp hết hạn", "ngày hết hạn", "ưu tiên xuất"]):
        return await handle_fefo_intent(db)

    # 6. Dự trù bù tồn kho Mẫu 01 (TT 22/2011)
    if any(w in lower_query for w in ["dự trù", "mẫu 01", "cạn kho", "sắp hết", "hết thuốc", "bù tồn kho", "chạm ngưỡng", "cơ số"]):
        return await handle_restock_intent(db)

    # 7. Giám sát Chuỗi lạnh Vắc xin (WHO PQS)
    if any(w in lower_query for w in ["chuỗi lạnh", "cold chain", "nhiệt độ tủ lạnh", "datalogger", "vắc xin", "mkt", "mất điện tủ", "arrhenius"]):
        return await handle_coldchain_intent(db)

    # 8. Sổ kiểm toán bất biến (NĐ 130/2018 HMAC-SHA256)
    if any(w in lower_query for w in ["kiểm toán", "toàn vẹn", "chuỗi băm", "sha256", "sha-256", "hmac", "nhật ký bảo mật", "sổ bất biến"]):
        return await handle_audit_intent(db)

    # 9. Thị giác AI Hóa đơn dược phẩm (Vision OCR)
    if any(w in lower_query for w in ["hóa đơn", "ocr", "quét hóa đơn", "bóc tách", "phiếu nhập", "cpc1", "vat"]):
        return await handle_ocr_intent()

    # 10. Mượn thuốc khẩn cấp ca đêm & Y lệnh thuốc
    matched_med = find_matched_med(lower_query)
    has_dispense_verb = any(w in lower_query for w in ["mượn", "lấy", "rút", "xuất", "cần", "xin", "tiêm", "truyền", "cấp phát"]) or (
        "cho" in lower_query and any(w in lower_query for w in ["lọ", "ống", "chai", "viên", "liều", "morphin", "adre"])
    )
    is_med_info = any(w in lower_query for w in ["thời gian bán thải", "chỉ định", "chống chỉ định", "tác dụng phụ", "tác dụng", "công dụng", "tương tác", "dùng để làm gì", "liều tối đa", "liều dùng", "là gì", "dị ứng", "huyết tương", "dược động học", "cơ chế", "thành phần", "uống lúc nào", "thế nào", "như thế nào", "bao nhiêu", "hỏi về", "thông tin"])
    if matched_med is not None and not is_med_info and not is_advice and (has_dispense_verb or any(c.isdigit() for c in query)):
        return await handle_borrow_intent(query, lower_query, user_name)

    # 11. Tra cứu Dược Quốc Gia 54.885 SĐK chính xác 100/100
    has_sdk = bool(re.search(r"((?:vn|vd|gc|qlsp|vs)-[0-9]+-[0-9]+)", lower_query))
    is_deep_pharmacology = any(w in lower_query for w in ["thời gian bán thải", "huyết tương", "dược động học", "cơ chế tác dụng"])
    has_drug_ask = any(w in lower_query for w in [
        "thông tin thuốc", "tra cứu thuốc", "sđk", "số đăng ký", "là thuốc gì", "dược thư", "thuốc", "về thuốc",
        "hỏi về thuốc", "biệt dược", "hoạt chất", "liều dùng", "liều lượng", "uống thế nào", "dùng thế nào",
        "dùng để làm gì", "chỉ định", "chống chỉ định", "tác dụng phụ", "uống được không", "dùng được không"
    ]) or (matched_med is not None and is_med_info and not is_deep_pharmacology)
    if (has_sdk or has_drug_ask) and not is_deep_pharmacology:
        return await lookup_drug_authoritative(query, db, session_id=session_id)

    # 12. Tư vấn lâm sàng sâu bằng Gemini AI Copilot
    gemini_reply = await ask_backend_gemini_copilot(query, user_role, user_name, db)
    if gemini_reply:
        from app.services.session_context import get_or_create_session
        session = get_or_create_session(session_id, user_name, user_role)
        lower_reply = gemini_reply.lower()
        if "paracetamol" in lower_reply:
            session.set_active_medication("PARACETAMOL 500mg", "Paracetamol", batch="LOT-PC24-11A", stock="80 Viên", location="Kho Dược Nội Trú (Kệ A1 - Tầng 1)", sdk="893100110026")
        elif "amiodaron" in lower_reply:
            session.set_active_medication("Amiodarone Hydrochloride Tablets 200mg", "Amiodaron hydroclorid", batch="LOT-AM25-C1", stock="180 Viên", location="Tủ thuốc Hồi sức Cấp cứu Tim Mạch")
        elif "vancomycin" in lower_reply:
            session.set_active_medication("VANCOMYCIN 1g", "Vancomycin", batch="LOT-VC25-V1", stock="180 Lọ", location="Kho Dược Nội Trú (Kệ B2 - Tầng 2)")
        elif "noradrenalin" in lower_reply:
            session.set_active_medication("Noradrenalin 4mg/4ml", "Noradrenalin tartrat", batch="LOT-NA24-R3", stock="120 Ống", location="Tủ cấp cứu Hồi sức A9 (Ngăn B)")
        elif "salbutamol" in lower_reply:
            session.set_active_medication("Salbutamol 2,5 mg/ 2,5 ml", "Salbutamol sulfat", batch="LOT-SB25-K1", stock="300 Ống", location="Tủ thuốc Cấp cứu Hô hấp A9")
        elif "prasocare" in lower_reply or "esomeprazol" in lower_reply:
            session.set_active_medication("Prasocare (Esomeprazole 40mg)", "Esomeprazole natri 40mg", batch="LOT-PS25-E4", stock="350 Lọ", location="Kho Dược Nội Trú (Kệ A2 - Tầng 2)")

        return CopilotResponse(
            intent="CLINICAL_AI_CONSULTATION",
            reply_text=gemini_reply,
            legal_basis="Dược Thư Quốc Gia Việt Nam & Hướng dẫn Bộ Y Tế",
            suggested_chips=["Cho tôi thông tin về thuốc đó", "Đối soát ca trực 07:00 AM", "Kiểm tra hạn dùng FEFO"],
            session_id=session.session_id,
            active_medication_name=session.active_medication_name,
            active_medication_stock=session.active_medication_stock,
            active_medication_location=session.active_medication_location
        )

    # 13. Phản hồi chào mừng và bảng điều hướng lâm sàng
    return CopilotResponse(
        intent="GENERAL_CLINICAL_ASSISTANCE",
        reply_text=CLINICAL_BUSINESS_DIRECTORY,
        legal_basis="Thông tư 22/2011, TT 20/2017, TT 51/2017 & Nghị định 98/2021",
        suggested_chips=["Đối soát ca trực 07:00 AM", "Tra cứu SĐK VD-24757-16", "Thuốc cận hạn FEFO", "Báo hỏng máy thở PB840"]
    )
