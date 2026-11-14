"""Presentation helpers for OCR facts returned by clinical image extraction."""

import re
from collections.abc import Mapping


_DOCUMENT_TYPE_LABELS = {
    "PRESCRIPTION": "Đơn thuốc",
    "MEDICATION": "Nhãn hoặc bao bì thuốc",
    "BHYT_DOCUMENT": "Chứng từ bảo hiểm y tế",
    "NON_CLINICAL": "Hình ảnh ngoài phạm vi hỗ trợ",
}


def _clean_text(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def format_image_extraction_report(result: Mapping[str, object]) -> str:
    """Render extracted facts by section; preserve raw text as a safe fallback."""
    type_code = _clean_text(result.get("category")).upper()
    document_type = _clean_text(result.get("document_type_label")) or _DOCUMENT_TYPE_LABELS.get(type_code, "Chưa phân loại")
    sections = result.get("extracted_sections")
    lines = ["## Kết quả đọc ảnh", "", f"**Loại tài liệu:** {document_type}"]

    rendered_sections = False
    if isinstance(sections, list):
        for section in sections:
            if not isinstance(section, Mapping):
                continue
            title = _clean_text(section.get("title"))
            items = section.get("items")
            if not title or not isinstance(items, list):
                continue
            clean_items = [_clean_text(item) for item in items if _clean_text(item)]
            if not clean_items:
                continue
            lines.extend(["", f"### {title}", "", *[f"• {item}" for item in clean_items]])
            rendered_sections = True

    raw_text = _clean_text(result.get("extracted_text") or result.get("reply_markdown"))
    if not rendered_sections and raw_text:
        raw_text = re.sub(r"^#{1,6}\s*(?:dữ kiện (?:đọc|trích xuất) từ ảnh|kết quả đọc ảnh)\s*", "", raw_text, flags=re.IGNORECASE)
        lines.extend(["", "### Dữ kiện nhận diện", "", raw_text])

    unreadable = result.get("unreadable_fields")
    if isinstance(unreadable, list):
        fields = [_clean_text(item) for item in unreadable if _clean_text(item)]
        if fields:
            lines.extend(["", "### Trường chưa đọc rõ", "", *[f"• {field}" for field in fields]])

    lines.extend(["", "### Trạng thái đối chiếu", "", "> Trích xuất từ ảnh, chưa xác minh với cơ sở dữ liệu. Chưa kết luận về liều dùng, tương tác hoặc điều kiện thanh toán khi chưa có nguồn hỗ trợ."])
    return "\n".join(lines)
