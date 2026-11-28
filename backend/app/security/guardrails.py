import re
import unicodedata
from typing import Optional
from urllib.parse import unquote
from app.security.guardrail_patterns import GuardrailResult, SQLI_PATTERNS, PROMPT_INJECTION_PATTERNS
from app.security.input_canonicalizer import score_prompt_injection_risk
from app.security.output_guardrail import validate_output_guardrail, detect_system_prompt_leakage

__all__ = [
    "GuardrailResult",
    "SQLI_PATTERNS",
    "PROMPT_INJECTION_PATTERNS",
    "sanitize_input_text",
    "normalize_for_sqli_scan",
    "detect_sql_injection",
    "detect_prompt_injection",
    "validate_input_guardrail",
    "validate_output_guardrail",
    "detect_system_prompt_leakage",
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

def normalize_for_sqli_scan(query: str) -> list[str]:
    """
    Chuẩn hóa chuỗi phục vụ quét SQLi chống kỹ thuật lách luật (URL encoding, inline comment /* */):
    Trả về các biến thể đã giải mã để quét song song với chuỗi gốc.
    """
    if not query:
        return []
    decoded = query
    for _ in range(2):
        nxt = unquote(decoded)
        if nxt == decoded:
            break
        decoded = nxt

    variants = [query]
    if decoded != query:
        variants.append(decoded)

    if "/*" in decoded and "*/" in decoded:
        # Khử /*...*/ thành rỗng (bắt UN/**/ION) và thành khoảng trắng (bắt SELECT/*x*/FROM)
        decomment_empty = re.sub(r'/\*[\s\S]*?\*/', '', decoded)
        decomment_space = re.sub(r'/\*[\s\S]*?\*/', ' ', decoded)
        for v in (decomment_empty, decomment_space):
            collapsed = re.sub(r'[ \t]+', ' ', v).strip()
            if collapsed and collapsed not in variants:
                variants.append(collapsed)

    return variants


def detect_sql_injection(query: str) -> tuple[bool, Optional[str]]:
    """Phát hiện các mẫu SQL Injection độc hại theo ngữ cảnh và chống obfuscation."""
    if not query:
        return False, None
    for candidate in normalize_for_sqli_scan(query):
        for pattern, desc in SQLI_PATTERNS:
            if re.search(pattern, candidate):
                return True, desc
    return False, None

def detect_prompt_injection(
    query: str,
    history: str = "",
    *,
    raw_query: Optional[str] = None,
    session_risk_score: float = 0.0,
    blocked_turn_count: int = 0,
) -> tuple[bool, Optional[str]]:
    """
    Phát hiện Prompt Injection & Jailbreak đa tầng:
    - Lớp phát hiện Unicode Tag Smuggling (U+E0000-U+E007F) & BiDi override trên đầu vào gốc
    - Lớp chuẩn hóa chống obfuscation (NFKC, Homoglyph, Separator collapse, không dấu, Base64/Hex/URL)
    - Lớp kiểm tra control-token / XML delimiter smuggling (StruQ)
    - Lớp đối soát mẫu mở rộng & điểm ngữ nghĩa numpy (blake2b) + cửa sổ đa lượt & Crescendo risk accumulator
    - Lớp bảo vệ ngữ cảnh lâm sàng hợp lệ chống chặn nhầm (InjecGuard)
    """
    if not query and not raw_query:
        return False, None
    assessment = score_prompt_injection_risk(
        query,
        PROMPT_INJECTION_PATTERNS,
        history=history,
        raw_query=raw_query,
        session_risk_score=session_risk_score,
        blocked_turn_count=blocked_turn_count,
    )
    return assessment.is_injection, assessment.reason

def validate_input_guardrail(
    raw_query: str,
    user_role: str = "nurse",
    history: str = "",
    *,
    session_risk_score: float = 0.0,
    blocked_turn_count: int = 0,
) -> GuardrailResult:
    """Input Rail: Rào chắn tiền xử lý đầu vào (OWASP LLM01:2025 Defense-in-Depth)."""
    clean_query = sanitize_input_text(raw_query)

    # Inspect raw_query FIRST for Unicode Tag Smuggling even if clean_query becomes empty after Cf stripping
    if raw_query and not clean_query:
        raw_assessment = score_prompt_injection_risk(
            "",
            PROMPT_INJECTION_PATTERNS,
            history=history,
            raw_query=raw_query,
            session_risk_score=session_risk_score,
            blocked_turn_count=blocked_turn_count,
        )
        if raw_assessment.is_injection:
            safe_msg = (
                "🛡️ **CẢNH BÁO BẢO MẬT HỆ THỐNG (Prompt Injection / Invisible Smuggling Refused)**\n\n"
                f"- **Phát hiện**: {raw_assessment.reason}\n"
                "- **Hành động**: Yêu cầu đã bị từ chối theo chính sách an toàn hệ thống y tế."
            )
            return GuardrailResult(
                is_safe=False,
                violation_type=raw_assessment.category or "prompt_injection",
                threat_description=raw_assessment.reason,
                sanitized_query="",
                safe_response=safe_msg,
                risk_score=raw_assessment.risk_score,
                soft_risk_delta=raw_assessment.soft_risk_delta,
            )

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
            "- **Hành động**: Yêu cầu đã bị rào chắn bảo vệ chặn đứng tức thì.\n"
            "- **Căn cứ**: Chính sách An toàn Thông tin Y tế & Toàn vẹn Cơ sở Dữ liệu Bệnh viện."
        )
        return GuardrailResult(
            is_safe=False,
            violation_type="sql_injection",
            threat_description=sqli_desc,
            sanitized_query=clean_query,
            safe_response=safe_msg,
            risk_score=1.0,
            soft_risk_delta=0.6,
        )

    assessment = score_prompt_injection_risk(
        clean_query,
        PROMPT_INJECTION_PATTERNS,
        history=history,
        raw_query=raw_query,
        session_risk_score=session_risk_score,
        blocked_turn_count=blocked_turn_count,
    )
    if assessment.is_injection:
        pi_desc = assessment.reason
        is_format_hijack = "Format Hijacking" in (pi_desc or "") or "Markup Injection" in (pi_desc or "")
        if is_format_hijack:
            safe_msg = (
                "🛡️ **CẢNH BÁO BẢO MẬT & GIỚI HẠN VAI TRÒ (Scope & Format Guardrail Blocked)**\n\n"
                f"- **Phát hiện**: {pi_desc}\n"
                "- **Hành động**: Rào chắn an toàn từ chối thực thi yêu cầu lập trình web hoặc tạo mã nguồn website/HTML/script.\n"
                "- **Nguyên tắc**: Trợ lý Trí tuệ Nhân tạo Lâm Sàng được thiết kế chuyên biệt để hỗ trợ nhân viên y tế tra cứu dược lý (Dược Thư Quốc Gia), quy chế quản lý thuốc (Thông tư 20/2017/TT-BYT, TT 22/2011/TT-BYT), an toàn kê đơn CPOE và phác đồ cấp cứu (TT 51/2017/TT-BYT). Hệ thống **không hỗ trợ lập trình, sinh mã HTML/CSS/JS hoặc tạo trang web**.\n"
                "- **Gợi ý**: Vui lòng đặt câu hỏi liên quan đến thuốc, liều dùng hoặc chuyên môn y tế."
            )
            v_type = "format_hijacking"
        else:
            safe_msg = (
                "🛡️ **CẢNH BÁO BẢO MẬT HỆ THỐNG (Prompt Injection / Jailbreak Refused)**\n\n"
                f"- **Phát hiện**: {pi_desc}\n"
                "- **Hành động**: Yêu cầu đã bị từ chối theo chính sách an toàn hệ thống y tế.\n"
                "- **Nguyên tắc**: Trợ lý Dược Lâm Sàng tuân thủ nghiêm ngặt Dược Thư Quốc Gia và quy chế quản lý thuốc Bộ Y tế, "
                "không cho phép can thiệp chỉ dẫn hệ thống hoặc vượt qua các cảnh báo an toàn."
            )
            v_type = (
                assessment.category
                if assessment.category in ("unicode_tag_smuggling", "bidi_smuggling", "crescendo_multi_turn")
                else "prompt_injection"
            )
        return GuardrailResult(
            is_safe=False,
            violation_type=v_type,
            threat_description=pi_desc,
            sanitized_query=clean_query,
            safe_response=safe_msg,
            risk_score=assessment.risk_score,
            soft_risk_delta=assessment.soft_risk_delta,
        )

    return GuardrailResult(
        is_safe=True,
        sanitized_query=clean_query,
        risk_score=assessment.risk_score,
        soft_risk_delta=assessment.soft_risk_delta,
    )
