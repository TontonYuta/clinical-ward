"""Presentation boundary for offline drug lookup responses."""

import re

from app.schemas.copilot import CopilotResponse
from app.services.copilot_drug_formatter import _evidence_claim_contract

_SECTION_LABELS = {
    "indications": "Chỉ định",
    "adult_dosage": "Liều dùng người lớn",
    "pediatric_dosage": "Liều dùng trẻ em",
    "contraindications": "Chống chỉ định",
    "precautions": "Thận trọng",
    "pregnancy_warning": "Lưu ý khi mang thai",
    "lactation_warning": "Lưu ý khi cho con bú",
    "adverse_effects": "Tác dụng không mong muốn",
    "adr_management": "Xử trí tác dụng không mong muốn",
    "drug_interactions": "Tương tác thuốc",
    "overdose_treatment": "Xử trí quá liều",
    "antidote": "Thuốc giải độc",
    "renal_adjustment": "Hiệu chỉnh liều khi suy thận",
    "hepatic_adjustment": "Hiệu chỉnh liều khi suy gan",
    "pharmacodynamics": "Dược lực học",
    "pharmacokinetics": "Dược động học",
    "dosage_forms": "Dạng thuốc và hàm lượng",
    "incompatibilities": "Tương kỵ",
    "storage_stability": "Bảo quản và độ ổn định",
    "active_ingredient": "Hoạt chất",
    "brand_name": "Tên thuốc",
}
_SCHEMA_MARKERS = (
    "drug identity", "dosage matrix", "brand name", "standard dose",
    "routine", "pediatric", "adult",
)
_SECTION_KEY_PATTERN = r"(?im)^\s*(?:\*\*)?[a-z][a-z0-9_]{2,}(?:\*\*)?\s*:"
_INLINE_SOURCE_LINE = re.compile(
    r"(?im)^\s*(?:[>*_•-]\s*)*Nguồn(?:\s+tham\s+chiếu)?\s*:\s*.*$"
)
_INLINE_SOURCE_LINK = re.compile(
    r"\s*\[[^\]\n]+\]\((?:[^)]*/)?[^)]*\.pdf(?:#[^)]*)?\)",
    re.IGNORECASE,
)
_BRACKETED_TEXT = re.compile(r"\[([^\]\n]+)\]")
_SOURCE_TOKEN = re.compile(
    r"\s*\[((?:DTQG|DĐVN|Dược thư|QĐ|TT|NĐ|Luật|Bộ Y tế)[^\]\n]*)\]",
    re.IGNORECASE,
)


def _remove_inline_sources(text: str, citations: list[dict] | None = None) -> str:
    """Keep source metadata in ``citations`` rather than in answer prose."""
    without_source_lines = _INLINE_SOURCE_LINE.sub("", text or "")
    without_source_links = _INLINE_SOURCE_LINK.sub("", without_source_lines)
    source_labels = {
        str(citation.get(field) or "").strip().casefold()
        for citation in citations or []
        for field in ("source", "legal_basis", "title", "document_id")
        if str(citation.get(field) or "").strip()
    }

    def remove_citation_label(match: re.Match[str]) -> str:
        label = match.group(1).strip().casefold()
        label_without_page = re.sub(r"\s+(?:tr\.?|trang)\s*\d+.*$", "", label).strip()
        is_source_label = any(
            label_without_page == source
            or label_without_page.startswith(source)
            or source.startswith(label_without_page)
            for source in source_labels
        )
        return "" if is_source_label else match.group(0)

    without_source_tokens = _SOURCE_TOKEN.sub("", without_source_links)
    without_source_tokens = _BRACKETED_TEXT.sub(remove_citation_label, without_source_tokens)
    lines = [line.rstrip() for line in without_source_tokens.splitlines()]
    cleaned: list[str] = []
    for line in lines:
        if line.strip() or (cleaned and cleaned[-1].strip()):
            cleaned.append(line)
    return "\n".join(cleaned).strip()


def _is_schema_dump(text: str) -> bool:
    normalized = (text or "").casefold()
    marker_hits = sum(marker in normalized for marker in _SCHEMA_MARKERS)
    field_labels = sum(
        1 for key in _SECTION_LABELS
        if re.search(rf"(?im)^\s*(?:\*\*)?{re.escape(key)}(?:\*\*)?\s*:", text or "")
    )
    return marker_hits >= 2 or field_labels >= 2 or (re.search(_SECTION_KEY_PATTERN, text or "") is not None and field_labels >= 1)


def _evidence_sections(response: CopilotResponse) -> list[tuple[str, str]]:
    sections: list[tuple[str, str]] = []
    seen: set[tuple[str, str]] = set()
    cited_chunks = {
        str(citation.get("chunk_id"))
        for citation in response.citations or []
        if citation.get("chunk_id")
    }
    for item in response.evidence or []:
        if not item.get("source_id") or not item.get("source_version"):
            continue
        if item.get("evidence_type") != "document_chunk":
            continue
        if not item.get("chunk_id") or str(item.get("chunk_id")) not in cited_chunks:
            continue
        content = str(item.get("content") or "").strip()
        if not content:
            continue
        section = str(item.get("section") or "").strip()
        label = _SECTION_LABELS.get(section, "Thông tin từ nguồn")
        pair = (label, content)
        if pair not in seen:
            sections.append(pair)
            seen.add(pair)
    return sections


def format_offline_drug_reply(response: CopilotResponse) -> CopilotResponse:
    """Normalize reply prose and replace leaked schema using verified evidence."""
    response.reply_text = _remove_inline_sources(response.reply_text, response.citations)
    if response.intent != "MEDICATION_SAFETY_PROFILE" or not _is_schema_dump(response.reply_text):
        return response

    sections = _evidence_sections(response)
    if not sections:
        response.reply_text = "Chưa thể trình bày hồ sơ thuốc vì chưa có dữ liệu nguồn đã xác minh."
        response.answer_type = "safe_abstention"
        response.source_status = "evidence_provenance_missing"
        response.rag_grounded = False
        response.confidence = 0.0
        response.citations = []
        response.evidence = []
        response.claims = []
        response.evidence_claim_map = {}
        return response

    response.reply_text = "\n\n".join(f"**{label}:**\n{content}" for label, content in sections)
    cited_chunks = {
        str(citation.get("chunk_id")) for citation in response.citations or []
        if citation.get("chunk_id")
    }
    contract = _evidence_claim_contract([
        item for item in response.evidence or []
        if item.get("chunk_id") in {
            str(citation.get("chunk_id")) for citation in response.citations or []
            if citation.get("chunk_id")
        }
    ], response.reply_text, cited_chunks)
    response.claims = contract["claims"]
    response.evidence_claim_map = contract["evidence_claim_map"]
    response.rag_grounded = bool(response.rag_grounded and response.claims)
    if not response.rag_grounded:
        response.reply_text = "Chưa thể trình bày hồ sơ thuốc vì chưa có dữ liệu nguồn đã xác minh."
        response.answer_type = "safe_abstention"
        response.source_status = "evidence_provenance_missing"
        response.confidence = 0.0
        response.citations = []
        response.evidence = []
        response.claims = []
        response.evidence_claim_map = {}
    return response
