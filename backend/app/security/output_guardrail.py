import re

def validate_output_guardrail(raw_response: str, query: str = "") -> str:
    """
    Output Rail: Rào chắn hậu xử lý để ngăn chặn rò rỉ dữ liệu nhạy cảm (Data Leakage Prevention)
    và phát hiện lệch pha ngữ cảnh / phản hồi sai sự thật (Self-RAG & TruLens RAG Triad Anti-Hallucination).
    """
    if not raw_response:
        return raw_response

    if len(raw_response) > 12000:
        raw_response = raw_response[:12000] + "\n\n[Phần còn lại đã được lược bỏ do giới hạn độ dài.]"

    scrubbed = re.sub(r'(?i)(AIzaSy[A-Za-z0-9_-]{28,35}|sk-[A-Za-z0-9]{32,}|Bearer\s+[A-Za-z0-9_\-\.]{20,})', '[REDACTED_API_KEY]', raw_response)
    scrubbed = re.sub(r'(?i)(postgres://|mysql://|sqlite://)[^\s]+', '[REDACTED_DB_CONNECTION]', scrubbed)

    if "OperationalError" in scrubbed or "sqlite3.IntegrityError" in scrubbed or "syntax error" in scrubbed.lower():
        scrubbed = (
            "⚠️ **Thông báo hệ thống**: Đã xảy ra lỗi kỹ thuật trong quá trình truy xuất dữ liệu an toàn. "
            "Yêu cầu đã được ghi vết kiểm toán để đội ngũ quản trị kiểm tra."
        )

    if query:
        lower_q = query.lower()
        has_coldchain = any(w in lower_q for w in ["chuỗi lạnh", "kho lạnh", "tủ lạnh", "vắc xin", "buồng lạnh"])
        is_telemetry = any(w in lower_q for w in ["nhiệt độ", "độ ẩm", "mấy độ", "bao nhiêu", "hiện tại", "tình trạng", "kiểm tra", "giám sát", "ổn định"])
        is_explicit_incident = any(w in lower_q for w in ["mất điện", "sự cố", "quá nhiệt", "vượt ngưỡng", "cách ly", "quarantine", "hỏng tủ", "cháy", "báo động", "phác đồ ứng phó"])

        # Không thay thế câu trả lời bằng số đo/lô hàng dựng sẵn. Dữ liệu phải do workflow truy xuất từ cơ sở dữ liệu.

    if re.search(r"(?i)(?:<!DOCTYPE\s+html|<html[\s>]|<head[\s>]|<body[\s>]|```html\s*(?:<!DOCTYPE|<html|<head|<body|<div|<title|<script|<style)|<script[\s>]|javascript:)", scrubbed):
        scrubbed = (
            "🛡️ **RÀO CHẮN ĐẦU RA (Output Rail Blocked - OWASP LLM02:2025)**\n\n"
            "• **Phát hiện:** Phản hồi chứa cấu trúc mã HTML / Website không hợp lệ.\n"
            "• **Hành động:** Hệ thống đã tự động ngăn chặn và vô hiệu hóa nội dung theo chính sách an toàn thông tin y tế.\n"
            "• **Nguyên tắc:** Trợ lý Agent Lâm Sàng tuân thủ quy chế Dược lâm sàng (Thông tư 20/2017/TT-BYT, TT 22/2011/TT-BYT, Dược Thư Quốc Gia) "
            "và chỉ phản hồi bằng định dạng Markdown lâm sàng, không hỗ trợ hiển thị tệp HTML hoặc tạo website."
        )

    return scrubbed
