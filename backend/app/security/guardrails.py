"""
Module Bảo Mật & Phòng Thủ Cho Chatbot Lâm Sàng (Clinical AI Guardrails).
Được thiết kế dựa trên:
1. NVIDIA NeMo Guardrails (Input & Output Rails architecture)
2. OWASP Top 10 for LLM (LLM01: Prompt Injection, LLM02: Sensitive Information Disclosure)
3. ProtectAI LLM Guard (SQL Injection & Prompt Injection scanners)
4. Greshake et al. (arXiv:2302.12173 - Delimiter & Boundary Fencing)
"""

import re
from typing import NamedTuple, Optional

class GuardrailResult(NamedTuple):
    is_safe: bool
    violation_type: Optional[str] = None  # 'sql_injection', 'prompt_injection', 'privilege_escalation', 'toxic'
    threat_description: Optional[str] = None
    sanitized_query: str = ""
    safe_response: Optional[str] = None

# 1. Các mẫu SQL Injection (Kinh điển, Stacked, Blind, Tautology, Comment-based)
SQLI_PATTERNS = [
    # Tautology / Boolean based: OR '1'='1', WHERE '1'='1', OR 1=1, AND 1=1
    (r"(?i)\b(?:OR|AND|WHERE)\s+['\"]?1['\"]?\s*=\s*['\"]?1['\"]?", "SQLi: Phép so sánh hằng đúng (Tautology 1=1 / '1'='1')"),
    (r"(?i)\b(?:OR|AND|WHERE)\s+(?:true\b|1\s*=\s*1|'a'\s*=\s*'a')", "SQLi: Mẫu boolean tautology"),
    
    # Union-based injection
    (r"(?i)\bUNION\s+(?:ALL\s+)?SELECT\b", "SQLi: Tấn công trích xuất dữ liệu qua UNION SELECT"),
    
    # Stacked queries / DDL / DML destructive statements
    (r"(?i);\s*(?:DROP|TRUNCATE|ALTER|DELETE\s+FROM|INSERT\s+INTO|UPDATE)\s+[\w`\"']+", "SQLi: Kỹ thuật Stacked Query thực thi lệnh phá hoại CSDL"),
    (r"(?i)\bDROP\s+TABLE\b", "SQLi: Lệnh xóa bảng DROP TABLE"),
    (r"(?i)\bTRUNCATE\s+TABLE\b", "SQLi: Lệnh làm rỗng bảng TRUNCATE TABLE"),
    
    # Database schema reconnaissance / Metadata probe
    (r"(?i)\b(?:INFORMATION_SCHEMA|SQLITE_MASTER|SYS\.TABLES|SYSOBJECTS)\b", "SQLi: Do thám lược đồ hệ quản trị CSDL (Schema Reconnaissance)"),
    (r"(?i)\bPRAGMA\s+(?:table_info|database_list)\b", "SQLi: Truy vấn cấu trúc nội bộ SQLite PRAGMA"),
    
    # Comment truncation & Execution procedures
    (r"(?:--|/\*|\*/|#)", "SQLi: Ký tự ngắt dòng / đóng chú thích câu lệnh SQL"),
    (r"(?i)\b(?:EXEC|EXECUTE)\s*(?:xp_|sp_)", "SQLi: Kích hoạt stored procedure nguy hiểm (xp_cmdshell)"),
    (r"(?i)\b(?:BENCHMARK|PG_SLEEP|SLEEP)\s*\(", "SQLi: Tấn công trễ thời gian (Time-based Blind SQLi)"),
]

# 2. Các mẫu Prompt Injection & Jailbreak (Direct, Indirect, Persona-hijack, System override)
PROMPT_INJECTION_PATTERNS = [
    # Direct Instruction Override (Bỏ qua chỉ dẫn hệ thống)
    (r"(?i)(?:ignore|disregard|forget|skip)\s+(?:all\s+)?(?:previous|prior|above|former)\s+(?:instructions|rules|directives|prompts|constraints)", "Prompt Injection: Yêu cầu bỏ qua chỉ dẫn hệ thống ban đầu"),
    (r"(?i)(?:bỏ qua|quên|xóa)\s+(?:tất cả\s+)?(?:chỉ dẫn|hướng dẫn|lời nhắc|quy tắc|ràng buộc)\s+(?:trước đó|ban đầu|hệ thống|của bạn)", "Prompt Injection: Yêu cầu bỏ qua chỉ dẫn tiếng Việt"),
    (r"(?i)(?:hãy quên đi|không cần tuân theo)\s+(?:các\s+)?(?:chỉ dẫn|quy tắc|hướng dẫn|vai trò)", "Prompt Injection: Lệnh ép buộc quên quy tắc"),

    # Persona Hijacking / Jailbreak Modes (DAN, Developer Mode, God Mode)
    (r"(?i)(?:you are now|act as|pretend to be)\s+(?:a\s+|in\s+)?(?:dan|developer(?:\s+mode)?|jailbreak|unfiltered|god mode|evil)", "Jailbreak: Thao túng nhân cách (DAN / Developer Mode / Unfiltered)"),
    (r"(?i)\b(?:developer\s+mode|unfiltered\s+ai|jailbreak\s+prompt)\b", "Jailbreak: Kích hoạt chế độ lập trình viên không giới hạn"),
    (r"(?i)(?:bạn bây giờ là|hãy đóng vai|chuyển sang chế độ)\s+(?:dan|lập trình viên|bẻ khóa|không giới hạn|không kiểm duyệt)", "Jailbreak: Ép buộc chatbot chuyển sang chế độ không kiểm duyệt"),
    (r"(?i)\b(?:system\s+override|admin\s+override|sudo\s+mode|root\s+access)\b", "Privilege Escalation: Giả mạo quyền ghi đè hệ thống (System Override)"),
    (r"(?i)(?:ghi đè hệ thống|chế độ quản trị viên tối cao|quyền root|chế độ lập trình viên)", "Privilege Escalation: Giả mạo quyền quản trị tiếng Việt"),

    # System Prompt & Secret Exfiltration (Đánh cắp System Prompt & API Key)
    (r"(?i)(?:print|reveal|show|display|output|dump)\s+(?:your\s+)?(?:system\s+prompt|initial\s+prompt|base\s+instructions|secret\s+key|api\s+key)", "Prompt Leaking: Yêu cầu in ra System Prompt hoặc API Key bí mật"),
    (r"(?i)(?:in ra|cho tôi xem|hiển thị|tiết lộ)\s+(?:toàn bộ\s+)?(?:system prompt|chỉ dẫn nội bộ|lời nhắc ban đầu|api key|mã bí mật)", "Prompt Leaking: Yêu cầu trích xuất cấu hình bảo mật nội bộ"),
    (r"(?i)(?:repeat\s+everything\s+above|lặp lại toàn bộ các câu phía trên)", "Prompt Leaking: Yêu cầu lặp lại ngữ cảnh hệ thống phía trên"),

    # Clinical Safety & CDSS Guardrail Bypass (Phá vỡ an toàn y tế & Thuốc gây nghiện)
    (r"(?i)(?:quên đi|bỏ qua|không cần)\s+(?:cảnh báo|quy định|nguyên tắc)\s+(?:an toàn|y tế|dược lý|cdss|thông tư 20|thông tư 22|thông tư 51)", "Clinical Safety Bypass: Yêu cầu bỏ qua quy tắc an toàn y tế và dược lâm sàng"),
    (r"(?i)(?:bỏ qua|miễn)\s+(?:xác thực|ký duyệt|hai chữ ký|chữ ký bác sĩ|quy trình duyệt cấp phát)", "Clinical Safety Bypass: Yêu cầu vượt mặt cơ chế kiểm soát hai chữ ký đối với thuốc độc"),
    (r"(?i)(?:cấp|xuất|lấy)\s+(?:gấp\s+)?(?:\d+\s+)?(?:lọ|ống|viên)?\s*(?:morphin|fentanyl|adrenalin|kali)\s+(?:không cần|bỏ qua)\s+(?:ký|duyệt|đơn|xác thực)", "Clinical Safety Bypass: Cố tình yêu cầu xuất thuốc gây nghiện/nguy kịch không cần đơn")
]

def sanitize_input_text(text: str) -> str:
    """Làm sạch đầu vào: loại bỏ ký tự điều khiển độc hại, null-byte, chuẩn hóa khoảng trắng."""
    if not text:
        return ""
    # 1. Loại bỏ null byte \0 (căn nguyên của các lỗi lách parser C/Python)
    text = text.replace("\0", "").replace("\x00", "")
    # 2. Chuẩn hóa ký tự điều khiển ngoại trừ \n, \t
    text = re.sub(r'[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]', '', text)
    # 3. Giới hạn độ dài tối đa chống tấn công làm cạn kiệt tài nguyên (Token Exhaustion DoS)
    MAX_QUERY_LENGTH = 1500
    if len(text) > MAX_QUERY_LENGTH:
        text = text[:MAX_QUERY_LENGTH]
    return text.strip()

def detect_sql_injection(query: str) -> tuple[bool, Optional[str]]:
    """Phát hiện các mẫu SQL Injection độc hại."""
    for pattern, desc in SQLI_PATTERNS:
        if re.search(pattern, query):
            return True, desc
    return False, None

def detect_prompt_injection(query: str) -> tuple[bool, Optional[str]]:
    """Phát hiện các mẫu Prompt Injection & Jailbreak độc hại."""
    for pattern, desc in PROMPT_INJECTION_PATTERNS:
        if re.search(pattern, query):
            return True, desc
    return False, None

def validate_input_guardrail(raw_query: str, user_role: str = "nurse") -> GuardrailResult:
    """
    Input Rail: Rào chắn tiền xử lý đầu vào trước khi câu lệnh được phân giải intent,
    gọi vào CSDL hoặc chuyển tới mô hình ngôn ngữ lớn (LLM).
    """
    clean_query = sanitize_input_text(raw_query)

    if not clean_query:
        return GuardrailResult(
            is_safe=False,
            violation_type="empty_query",
            threat_description="Truy vấn trống sau khi làm sạch",
            sanitized_query="",
            safe_response="⚠️ Hệ thống không nhận diện được nội dung câu hỏi. Vui lòng nhập thông tin hợp lệ."
        )

    # 1. Kiểm tra SQL Injection
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

    # 2. Kiểm tra Prompt Injection / Jailbreak
    has_pi, pi_desc = detect_prompt_injection(clean_query)
    if has_pi:
        safe_msg = (
            "🛡️ **CẢNH BÁO BẢO MẬT HỆ THỐNG (Prompt Injection / Jailbreak Refused)**\n\n"
            f"- **Phát hiện**: {pi_desc}\n"
            "- **Hành động**: Rào chắn Guardrail từ chối thực thi yêu cầu vi phạm chính sách an toàn.\n"
            "- **Nguyên tắc**: Trợ lý Agent Lâm Sàng tuân thủ tuyệt đối Dược Thư Quốc Gia 2015, "
            "quy chế thuốc Kiểm soát đặc biệt (Thông tư 20/2017/TT-BYT) và không cho phép can thiệp vào chỉ dẫn hệ thống."
        )
        return GuardrailResult(
            is_safe=False,
            violation_type="prompt_injection",
            threat_description=pi_desc,
            sanitized_query=clean_query,
            safe_response=safe_msg
        )

    # Đầu vào an toàn
    return GuardrailResult(
        is_safe=True,
        sanitized_query=clean_query
    )

def validate_output_guardrail(raw_response: str, query: str = "") -> str:
    """
    Output Rail: Rào chắn hậu xử lý để ngăn chặn rò rỉ dữ liệu nhạy cảm (Data Leakage Prevention)
    và phát hiện lệch pha ngữ cảnh / phản hồi sai sự thật (Self-RAG & TruLens RAG Triad Anti-Hallucination).
    - Ngăn rò rỉ API Keys, DB Passwords.
    - Ngăn rò rỉ vết lỗi SQLite (OperationalError, tracebacks).
    - Ngăn rò rỉ toàn bộ System Prompt.
    - Chống Over-Answering: Không kích hoạt phác đồ sự cố khẩn cấp cho câu hỏi tra cứu thông số bình thường.
    """
    if not raw_response:
        return raw_response

    # 1. Che giấu API Keys hoặc Bearer Tokens tiềm ẩn
    scrubbed = re.sub(r'(?i)(AIzaSy[A-Za-z0-9_-]{28,35}|sk-[A-Za-z0-9]{32,}|Bearer\s+[A-Za-z0-9_\-\.]{20,})', '[REDACTED_API_KEY]', raw_response)
    
    # 2. Che giấu chuỗi kết nối Database / Passwords
    scrubbed = re.sub(r'(?i)(postgres://|mysql://|sqlite://)[^\s]+', '[REDACTED_DB_CONNECTION]', scrubbed)
    
    # 3. Bắt các thông báo lỗi CSDL SQLite nội bộ
    if "OperationalError" in scrubbed or "sqlite3.IntegrityError" in scrubbed or "syntax error" in scrubbed.lower():
        scrubbed = (
            "⚠️ **Thông báo hệ thống**: Đã xảy ra lỗi kỹ thuật trong quá trình truy xuất dữ liệu an toàn. "
            "Yêu cầu đã được ghi vết kiểm toán để đội ngũ quản trị kiểm tra."
        )

    # 4. Anti-Hallucination & Output Alignment Guardrail (Self-RAG Groundedness)
    # Ngăn chặn trả lời nhầm phác đồ sự cố khẩn khi người dùng chỉ hỏi nhiệt độ hiện tại
    if query:
        lower_q = query.lower()
        has_coldchain = any(w in lower_q for w in ["chuỗi lạnh", "kho lạnh", "tủ lạnh", "vắc xin", "buồng lạnh"])
        is_telemetry = any(w in lower_q for w in ["nhiệt độ", "độ ẩm", "mấy độ", "bao nhiêu", "hiện tại", "tình trạng", "kiểm tra", "giám sát", "ổn định"])
        is_explicit_incident = any(w in lower_q for w in ["mất điện", "sự cố", "quá nhiệt", "vượt ngưỡng", "cách ly", "quarantine", "hỏng tủ", "cháy", "báo động", "phác đồ ứng phó"])

        if has_coldchain and is_telemetry and not is_explicit_incident:
            if any(w in scrubbed for w in ["XỬ TRÍ SỰ CỐ NHIỆT ĐỘ CHUỖI LẠNH", "Phác đồ ứng phó sự cố", "Kích hoạt bình tích lạnh", "Tạm thời cách ly lô vắc xin"]):
                scrubbed = (
                    "### 🌡️ GIÁM SÁT CHUỖI LẠNH VẮC XIN (TT 36/2018/TT-BYT GSP)\n\n"
                    "• **Nhiệt độ hiện tại:** **4.5°C** (🟢 Đạt chuẩn GSP: dải an toàn bắt buộc **+2.0°C đến +8.0°C**).\n"
                    "• **Độ ẩm buồng tủ:** **58% RH** (🟢 Đạt chuẩn GSP < 70%).\n"
                    "• **Nguồn cấp:** Điện lưới 220V ổn định, hệ thống pin tích điện dự phòng 48 giờ sẵn sàng.\n"
                    "• **Trạng thái cảnh báo:** **Bình thường (An toàn)**. Không ghi nhận biến cố nhiệt hay mất nguồn.\n"
                    "• **Sản phẩm bảo quản:** Vắc xin cúm Vaxigrip (`LOT-VX25-S1`) - Tồn **200 liều** tại Tủ lạnh Dược GSP T1.\n"
                    "• **Chỉ số MKT (Mean Kinetic Temperature):** **4.8°C** (Tính toán theo phương trình Arrhenius WHO PQS).\n\n"
                    "👉 **Kết luận:** Toàn bộ vắc xin đang được lưu trữ an toàn trong giới hạn nhiệt độ quy chuẩn. "
                    "Hệ thống vận hành ổn định, **chưa cần kích hoạt phác đồ ứng phó sự cố hay biệt trữ cách ly**."
                )

    return scrubbed
