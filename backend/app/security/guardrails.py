import re
import unicodedata
from typing import Optional
from app.security.guardrail_patterns import GuardrailResult, SQLI_PATTERNS, PROMPT_INJECTION_PATTERNS
from app.security.output_guardrail import validate_output_guardrail

__all__ = [
    "GuardrailResult",
    "SQLI_PATTERNS",
    "PROMPT_INJECTION_PATTERNS",
    "sanitize_input_text",
    "detect_sql_injection",
    "detect_prompt_injection",
    "validate_input_guardrail",
    "validate_output_guardrail",
]

def sanitize_input_text(text: str) -> str:
    """Làm sạch đầu vào: loại bỏ ký tự điều khiển độc hại, null-byte, chuẩn hóa khoảng trắng."""
    if not text:
        return ""
    text = unicodedata.normalize("NFKC", text)
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Cf")
    text = text.replace("\0", "").replace("\x00", "")
    text = re.sub(r'[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]', '', text)
    MAX_QUERY_LENGTH = 1500
    if len(text) > MAX_QUERY_LENGTH:
        text = text[:MAX_QUERY_LENGTH]
    return text.strip().lstrip("\\/")

def detect_sql_injection(query: str) -> tuple[bool, Optional[str]]:
    """Phát hiện các mẫu SQL Injection độc hại."""
    for pattern, desc in SQLI_PATTERNS:
        if re.search(pattern, query):
            return True, desc
    return False, None

def detect_prompt_injection(query: str) -> tuple[bool, Optional[str]]:
    """Phát hiện các mẫu Prompt Injection & Jailbreak độc hại."""
    query = unicodedata.normalize("NFKC", query)
    query = "".join(ch for ch in query if unicodedata.category(ch) != "Cf")
    for pattern, desc in PROMPT_INJECTION_PATTERNS:
        if re.search(pattern, query):
            return True, desc
    return False, None

def validate_input_guardrail(raw_query: str, user_role: str = "nurse") -> GuardrailResult:
    """Input Rail: Rào chắn tiền xử lý đầu vào."""
    clean_query = sanitize_input_text(raw_query)

    if not clean_query:
        return GuardrailResult(
            is_safe=False,
            violation_type="empty_query",
            threat_description="Truy vấn trống sau khi làm sạch",
            sanitized_query="",
            safe_response="⚠️ Hệ thống không nhận diện được nội dung câu hỏi. Vui lòng nhập thông tin hợp lệ."
        )

    has_sqli, sqli_desc = detect_sql_injection(clean_query)
    if has_sqli:
        safe_msg = (
            "🛡️ **CẢNH BÁO BẢO MẬT HỆ THỐNG (SQL Injection Blocked)**\n\n"
            f"- **Phát hiện**: {sqli_desc}\n"
            "- **Hành động**: Yêu cầu đã bị rào chắn bảo vệ (Input Guardrail) chặn đứng tức thì.\n"
            "- **Căn cứ**: Chính sách An toàn Thông tin Y tế & Toàn vẹn Cơ sở Dữ liệu Bệnh viện. "
            "Mọi truy vấn tham số hóa (Prepared Statements) đều được bảo vệ nghiêm ngặt."
        )
        return GuardrailResult(
            is_safe=False,
            violation_type="sql_injection",
            threat_description=sqli_desc,
            sanitized_query=clean_query,
            safe_response=safe_msg
        )

    has_pi, pi_desc = detect_prompt_injection(clean_query)
    if has_pi:
        is_format_hijack = "Format Hijacking" in (pi_desc or "") or "Markup Injection" in (pi_desc or "")
        if is_format_hijack:
            safe_msg = (
                "🛡️ **CẢNH BÁO BẢO MẬT & GIỚI HẠN VAI TRÒ (Scope & Format Guardrail Blocked)**\n\n"
                f"- **Phát hiện**: {pi_desc}\n"
                "- **Hành động**: Rào chắn an toàn từ chối thực thi yêu cầu lập trình web hoặc tạo mã nguồn website/HTML/script (OWASP LLM01:2025 & NeMo Domain Rails).\n"
                "- **Nguyên tắc**: Trợ lý Trí tuệ Nhân tạo Lâm Sàng được thiết kế chuyên biệt để hỗ trợ nhân viên y tế tra cứu dược lý (Dược Thư Quốc Gia 2015), quy chế quản lý thuốc (Thông tư 20/2017/TT-BYT, TT 22/2011/TT-BYT), an toàn kê đơn CPOE và phác đồ cấp cứu (TT 51/2017/TT-BYT). Hệ thống **không hỗ trợ lập trình, sinh mã HTML/CSS/JS hoặc tạo trang web**.\n"
                "- **Gợi ý**: Vui lòng đặt câu hỏi liên quan đến thuốc, liều dùng hoặc chuyên môn y tế."
            )
            v_type = "format_hijacking"
        else:
            safe_msg = (
                "🛡️ **CẢNH BÁO BẢO MẬT HỆ THỐNG (Prompt Injection / Jailbreak Refused)**\n\n"
                f"- **Phát hiện**: {pi_desc}\n"
                "- **Hành động**: Rào chắn Guardrail từ chối thực thi yêu cầu vi phạm chính sách an toàn.\n"
                "- **Nguyên tắc**: Trợ lý Agent Lâm Sàng tuân thủ tuyệt đối Dược Thư Quốc Gia 2015, "
                "quy chế thuốc Kiểm soát đặc biệt (Thông tư 20/2017/TT-BYT) và không cho phép can thiệp vào chỉ dẫn hệ thống."
            )
            v_type = "prompt_injection"
        return GuardrailResult(
            is_safe=False,
            violation_type=v_type,
            threat_description=pi_desc,
            sanitized_query=clean_query,
            safe_response=safe_msg
        )

    return GuardrailResult(
        is_safe=True,
        sanitized_query=clean_query
    )
