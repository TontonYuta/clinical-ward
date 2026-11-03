import re
import unicodedata
from app.schemas.copilot import CopilotResponse
from app.services.copilot_business_overview import CLINICAL_BUSINESS_DIRECTORY

def handle_greeting_and_acknowledgment(lower_query: str, user_name: str, user_role: str) -> CopilotResponse | None:
    clean_greeting = re.sub(r"[^\w\s]", "", lower_query).strip()
    clean_greeting_ascii = "".join(
        ch for ch in unicodedata.normalize("NFKD", clean_greeting) if not unicodedata.combining(ch)
    ).replace("đ", "d")
    greeting_tokens = set(clean_greeting.split())
    wellbeing = any(
        term in clean_greeting_ascii
        for term in ("hom nay ban thay the nao", "hom nay ban the nao", "how are you", "how do you feel")
    )
    is_pure_greeting = clean_greeting in {
        "hi", "hello", "chao", "chào", "xin chao", "xin chào", "alo", "hey",
        "chao ban", "chào bạn", "chao bot", "chào bot", "chao em", "chào em",
        "chao bac si", "chào bác sĩ", "hi bot", "hello bot", "halo", "yo"
    } or (len(greeting_tokens) <= 2 and any(t in greeting_tokens for t in ["hi", "hello", "alo", "hey"])) or wellbeing

    if is_pure_greeting:
        role_label = "Bác sĩ" if "doctor" in user_role.lower() or "bác" in user_name.lower() else "Nhân viên y tế"
        if wellbeing:
            return CopilotResponse(
                intent="GREETING_WELLBEING",
                reply_text=f"Tôi luôn sẵn sàng hỗ trợ, {role_label.lower()}. Bác sĩ cần tra cứu hoặc xử lý nghiệp vụ nào?",
            )
        return CopilotResponse(
            intent="GREETING_WELCOME",
            reply_text=f"Chào {role_label}. Tôi hỗ trợ tra cứu thuốc, rà soát ca bệnh và chuẩn bị nghiệp vụ trong biểu mẫu."
        )

    is_thanks = clean_greeting in {
        "cam on", "cảm ơn", "cảm ơn bạn", "cảm ơn bot", "cam on ban", "cam on bot",
        "thank you", "thanks", "ok", "oke", "ok bot", "da", "dạ", "tam biet", "tạm biệt"
    }
    if is_thanks:
        return CopilotResponse(
            intent="ACKNOWLEDGMENT",
            reply_text="Rất vui được hỗ trợ bác sĩ.",
        )

    is_pure_correction = clean_greeting in {
        "sai roi", "sai rồi", "nham roi", "nhầm rồi", "khong dung", "không đúng",
        "khong phai", "không phải", "bi nham", "bị nhầm"
    } or (
        any(c in clean_greeting_ascii for c in (
            "tra loi sai", "sai thong tin", "lai sai", "sai roi", "nham roi", "khong dung", "sai bet"
        )) and not any(k in clean_greeting_ascii for k in ("mg", "mcg", "tuong tac", "chong chi dinh"))
    )
    if is_pure_correction:
        role_label = "bác sĩ" if "doctor" in user_role.lower() or "bác" in user_name.lower() else "anh/chị"
        return CopilotResponse(
            intent="CONVERSATIONAL_CORRECTION",
            reply_text=f"Dạ xin lỗi {role_label}! Em xin tiếp thu để hoàn thiện liên tục. {role_label.title()} vui lòng cho biết câu hỏi cụ thể hoặc thông tin cần điều chỉnh để em hỗ trợ chính xác hơn ạ.",
            answer_type="conversational_correction",
            confidence=1.0,
            suggested_chips=["Tra cứu thông tin thuốc", "Kiểm tra tương tác hai thuốc", "Tra cứu Dược Thư Quốc Gia"]
        )

    is_capability_query = any(c in clean_greeting_ascii for c in (
        "khong xu ly duoc", "khong lam duoc", "khong biet lam", "khong tra loi duoc", "lam duoc gi", "co the lam gi"
    ))
    if is_capability_query:
        role_label = "Bác sĩ" if "doctor" in user_role.lower() or "bác" in user_name.lower() else "Nhân viên y tế"
        return CopilotResponse(
            intent="BOT_CAPABILITY_CLARIFICATION",
            reply_text=(
                f"Dạ em là Trợ lý Dược lâm sàng & Nghiệp vụ nội viện. Em có thể hỗ trợ {role_label.lower()}:\n\n"
                f"1. **Tra cứu thuốc & Dược thư:** Tra cứu 54.885 thuốc DAV, chỉ định, liều dùng, chống chỉ định, hoạt chất DĐVN V.\n"
                f"2. **Rà soát tương tác thuốc (DDI):** Kiểm tra tương tác chống chỉ định theo QĐ 5948/QĐ-BYT.\n"
                f"3. **Phác đồ cấp cứu & lâm sàng:** Cấp cứu phản vệ (TT 51/2017), quản lý thuốc gây nghiện (TT 20/2017), tiêu chảy mất nước, sốt cao.\n"
                f"4. **Kiểm tra kho dược & FEFO:** Tồn kho thực tế tại kho nội trú, tủ trực và hạn dùng.\n\n"
                f"{role_label} vui lòng gửi tên thuốc hoặc nội dung cần tra cứu cụ thể để em xử lý ạ!"
            ),
            answer_type="capability_overview",
            confidence=1.0,
            suggested_chips=["Tra cứu thông tin thuốc", "Kiểm tra tương tác hai thuốc", "Tra cứu tồn kho thuốc"]
        )

    is_style_feedback = any(c in clean_greeting_ascii for c in (
        "dung trong tam", "gon gang", "ngan gon", "cung nhac", "may moc", "dai dong",
        "dai qua", "tu nhien hon", "linh hoat hon", "ngan thoi", "gon hon", "ngan hon"
    )) and not any(k in clean_greeting_ascii for k in ("mg", "mcg", "tuong tac", "chong chi dinh"))
    if is_style_feedback:
        role_label = "Bác sĩ" if "doctor" in user_role.lower() or "bác" in user_name.lower() else "Nhân viên y tế"
        return CopilotResponse(
            intent="CONVERSATIONAL_FEEDBACK",
            reply_text=(
                f"Dạ em xin tiếp thu góp ý của {role_label.lower()}! Em sẽ trả lời ngắn gọn, đúng trọng tâm và linh hoạt hơn, "
                f"tập trung trực diện vào thông tin lâm sàng cốt lõi. {role_label} cần tra cứu hay xử lý nghiệp vụ gì tiếp theo ạ?"
            ),
            answer_type="conversational_feedback",
            confidence=1.0,
            suggested_chips=["Tra cứu thông tin thuốc", "Kiểm tra tương tác hai thuốc", "Tra cứu Dược Thư Quốc Gia"]
        )
    return None

def attach_correction_empathy(reply_text: str, query: str) -> str:
    lower = query.casefold()
    cues = ("sai rồi", "sai roi", "nhầm rồi", "nham roi", "không phải", "khong phai", "bị nhầm", "bi nham")
    if any(c in lower for c in cues) and not reply_text.startswith("Dạ xin lỗi"):
        return f"Dạ xin lỗi bác sĩ, hệ thống xin cập nhật lại thông tin:\n\n{reply_text}"
    return reply_text

def handle_out_of_scope_or_pricing(lower_query: str) -> CopilotResponse | None:
    if any(term in lower_query for term in ("giá bao nhiêu", "bao nhiêu tiền", "giá thuốc", "đơn này kê", "đơn này đúng", "duyệt đơn này")):
        is_price = any(term in lower_query for term in ("giá bao nhiêu", "bao nhiêu tiền", "giá thuốc"))
        return CopilotResponse(
            intent="CLINICAL_SAFE_ABSTENTION" if is_price else "CLINICAL_CASE_CLARIFICATION",
            reply_text=(
                "Trợ lý lâm sàng không cung cấp giá thương mại. Vui lòng tra cứu giá tại hệ thống dược/đấu thầu được bệnh viện phê duyệt."
                if is_price
                else "Vui lòng cung cấp mã đơn RX hoặc danh sách thuốc, liều, tần suất và đường dùng để rà soát đơn; hiện chưa có đơn nào được đính kèm."
            ),
            answer_type="safe_abstention" if is_price else "clarification",
            source_status="out_of_scope" if is_price else "missing_prescription_context",
            confidence=1.0,
            abstention_reason="Ngoài phạm vi hoặc thiếu dữ liệu đơn thuốc",
        )
    if any(term in lower_query for term in ("thời tiết", "dự báo thời tiết", "giá vàng", "tỷ giá", "kết quả bóng đá", "tin tức giải trí")):
        return CopilotResponse(
            intent="CLINICAL_SAFE_ABSTENTION",
            reply_text="Câu hỏi này nằm ngoài phạm vi trợ lý lâm sàng và nghiệp vụ bệnh viện. Tôi có thể hỗ trợ tra cứu thuốc, tương tác thuốc, hướng dẫn chuyên môn hoặc quy trình trong hệ thống.",
            answer_type="safe_abstention",
            source_status="out_of_scope",
            confidence=1.0,
            abstention_reason="Câu hỏi ngoài phạm vi trợ lý lâm sàng",
        )
    return None
