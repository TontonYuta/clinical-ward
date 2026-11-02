from typing import NamedTuple, Optional

class GuardrailResult(NamedTuple):
    is_safe: bool
    violation_type: Optional[str] = None
    threat_description: Optional[str] = None
    sanitized_query: str = ""
    safe_response: Optional[str] = None

SQLI_PATTERNS = [
    (r"(?i)\b(?:OR|AND|WHERE)\s+['\"]?1['\"]?\s*=\s*['\"]?1['\"]?", "SQLi: Phép so sánh hằng đúng (Tautology 1=1 / '1'='1')"),
    (r"(?i)\b(?:OR|AND|WHERE)\s+(?:true\b|1\s*=\s*1|'a'\s*=\s*'a')", "SQLi: Mẫu boolean tautology"),
    (r"(?i)\bUNION\s+(?:ALL\s+)?SELECT\b", "SQLi: Tấn công trích xuất dữ liệu qua UNION SELECT"),
    (r"(?i);\s*(?:DROP|TRUNCATE|ALTER|DELETE\s+FROM|INSERT\s+INTO|UPDATE)\s+[\w`\"']+", "SQLi: Kỹ thuật Stacked Query thực thi lệnh phá hoại CSDL"),
    (r"(?i)\bDROP\s+TABLE\b", "SQLi: Lệnh xóa bảng DROP TABLE"),
    (r"(?i)\bTRUNCATE\s+TABLE\b", "SQLi: Lệnh làm rỗng bảng TRUNCATE TABLE"),
    (r"(?i)\b(?:INFORMATION_SCHEMA|SQLITE_MASTER|SYS\.TABLES|SYSOBJECTS)\b", "SQLi: Do thám lược đồ hệ quản trị CSDL (Schema Reconnaissance)"),
    (r"(?i)\bPRAGMA\s+(?:table_info|database_list)\b", "SQLi: Truy vấn cấu trúc nội bộ SQLite PRAGMA"),
    (r"(?:--|/\*|\*/|#)", "SQLi: Ký tự ngắt dòng / đóng chú thích câu lệnh SQL"),
    (r"(?i)\b(?:EXEC|EXECUTE)\s*(?:xp_|sp_)", "SQLi: Kích hoạt stored procedure nguy hiểm (xp_cmdshell)"),
    (r"(?i)\b(?:BENCHMARK|PG_SLEEP|SLEEP)\s*\(", "SQLi: Tấn công trễ thời gian (Time-based Blind SQLi)"),
]

PROMPT_INJECTION_PATTERNS = [
    (r"(?i)(?:ignore|disregard|forget|skip)\s+(?:all\s+)?(?:previous|prior|above|former)\s+(?:instructions|rules|directives|prompts|constraints)", "Prompt Injection: Yêu cầu bỏ qua chỉ dẫn hệ thống ban đầu"),
    (r"(?i)(?:bỏ qua|quên|xóa)\s+(?:tất cả\s+)?(?:chỉ dẫn|hướng dẫn|lời nhắc|quy tắc|ràng buộc)\s+(?:trước đó|ban đầu|hệ thống|của bạn)", "Prompt Injection: Yêu cầu bỏ qua chỉ dẫn tiếng Việt"),
    (r"(?i)(?:hãy quên đi|không cần tuân theo)\s+(?:các\s+)?(?:chỉ dẫn|quy tắc|hướng dẫn|vai trò)", "Prompt Injection: Lệnh ép buộc quên quy tắc"),
    (r"(?i)(?:you are now|act as|pretend to be)\s+(?:a\s+|in\s+)?(?:dan|developer(?:\s+mode)?|jailbreak|unfiltered|god mode|evil)", "Jailbreak: Thao túng nhân cách (DAN / Developer Mode / Unfiltered)"),
    (r"(?i)\b(?:developer\s+mode|unfiltered\s+ai|jailbreak\s+prompt)\b", "Jailbreak: Kích hoạt chế độ lập trình viên không giới hạn"),
    (r"(?i)(?:bạn bây giờ là|hãy đóng vai|chuyển sang chế độ)\s+(?:dan|lập trình viên|bẻ khóa|không giới hạn|không kiểm duyệt)", "Jailbreak: Ép buộc chatbot chuyển sang chế độ không kiểm duyệt"),
    (r"(?i)\b(?:system\s+override|admin\s+override|sudo\s+mode|root\s+access)\b", "Privilege Escalation: Giả mạo quyền ghi đè hệ thống (System Override)"),
    (r"(?i)(?:ghi đè hệ thống|chế độ quản trị viên tối cao|quyền root|chế độ lập trình viên)", "Privilege Escalation: Giả mạo quyền quản trị tiếng Việt"),
    (r"(?i)(?:print|reveal|show|display|output|dump)\s+(?:your\s+)?(?:system\s+prompt|initial\s+prompt|base\s+instructions|secret\s+key|api\s+key)", "Prompt Leaking: Yêu cầu in ra System Prompt hoặc API Key bí mật"),
    (r"(?i)(?:in ra|cho tôi xem|hiển thị|tiết lộ)\s+(?:toàn bộ\s+)?(?:system prompt|chỉ dẫn nội bộ|lời nhắc ban đầu|api key|mã bí mật)", "Prompt Leaking: Yêu cầu trích xuất cấu hình bảo mật nội bộ"),
    (r"(?i)(?:repeat\s+everything\s+above|lặp lại toàn bộ các câu phía trên)", "Prompt Leaking: Yêu cầu lặp lại ngữ cảnh hệ thống phía trên"),
    (r"(?i)(?:quên đi|bỏ qua|không cần)\s+(?:cảnh báo|quy định|nguyên tắc)\s+(?:an toàn|y tế|dược lý|cdss|thông tư 20|thông tư 22|thông tư 51)", "Clinical Safety Bypass: Yêu cầu bỏ qua quy tắc an toàn y tế và dược lâm sàng"),
    (r"(?i)bỏ qua\s+(?:tất cả\s+|mọi\s+)?(?:quy chế|quy định|nguyên tắc|cảnh báo)\s+(?:an toàn\s+)?(?:trước đây|đã nêu|hiện hành|y tế)?", "Clinical Safety Bypass: Yêu cầu bỏ qua quy chế an toàn"),
    (r"(?i)(?:bỏ qua|miễn)\s+(?:xác thực|ký duyệt|hai chữ ký|chữ ký bác sĩ|quy trình duyệt cấp phát)", "Clinical Safety Bypass: Yêu cầu vượt mặt cơ chế kiểm soát hai chữ ký đối với thuốc độc"),
    (r"(?i)(?:cấp|xuất|lấy)\s+(?:gấp\s+)?(?:\d+\s+)?(?:lọ|ống|viên)?\s*(?:morphin|fentanyl|adrenalin|kali)\s+(?:không cần|bỏ qua)\s+(?:ký|duyệt|đơn|xác thực)", "Clinical Safety Bypass: Cố tình yêu cầu xuất thuốc gây nghiện/nguy kịch không cần đơn"),
    (
        r"(?i)(?:trả lời|viết|tạo|xuất|render|làm|sinh|chuyển|cần|cho tôi|xin|muốn|yêu cầu|đổi|gửi)\s+(?:thành|ra|dưới dạng|bằng|dạng|theo)?\s*(?:1\s+)?(?:đoạn\s+|file\s+|tệp\s+|trang\s+|bản\s+|mẫu\s+)?(?:mã|code|file|tệp)?\s*(?:html|website|web page|web|trang web|script|giao diện web|mã nguồn html|css|javascript|python|bash)",
        "Format Hijacking: Yêu cầu sinh mã HTML / tạo website trái với phạm vi lâm sàng"
    ),
    (
        r"(?i)\b(?:mã|code|file|tệp|định dạng|dạng|ngôn ngữ|bằng|sang|thành)\s+html\b",
        "Format Hijacking: Yêu cầu mã nguồn HTML trong ứng dụng y tế"
    ),
    (
        r"(?i)(?:dưới dạng|theo định dạng|bằng định dạng|dạng)\s+(?:mã\s+)?(?:html|web|website|script|code)",
        "Format Hijacking: Yêu cầu định dạng HTML / Code"
    ),
    (
        r"(?i)\b(?:code\s+web|lập trình\s+web|thiết kế\s+web(?:site)?|làm\s+web(?:site)?)\b",
        "Format Hijacking: Yêu cầu phát triển web"
    ),
    (
        r"(?i)(?:tạo|viết|code|lập trình)\s+(?:cho tôi\s+)?(?:1\s+)?(?:file|trang|bản)?\s*(?:website|trang web|web app|html|javascript|css|web)",
        "Format Hijacking: Yêu cầu lập trình website / tạo mã giao diện web"
    ),
    (
        r"(?i)(?:generate|create|write|output|reply with|render)\s+(?:as\s+|in\s+)?(?:an?\s+)?(?:html(?:\s+(?:file|page|website|document|template))?|website|web page|javascript|script)",
        "Format Hijacking: Yêu cầu LLM sinh mã HTML / website hoặc script tùy ý"
    ),
    (
        r"(?i)(?:<!doctype\s+html|<html[\s>]|<script[\s>]|javascript:|<style[\s>])",
        "Markup Injection: Chứa thẻ HTML / script nhúng trong truy vấn"
    ),
]
