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
    return None

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
