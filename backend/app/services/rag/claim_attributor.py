"""
PaperQA2 Claim Attribution Engine & Evidence Cross-Verification (Kỹ thuật 6).
Paper: Language agents achieve superhuman synthesis of scientific knowledge (Nature, 2024 / arXiv:2409.13740)
Repo: Future-House/paper-qa (9.5k stars)
Bóc tách các câu khẳng định (Claims) và đối soát chéo 1:1 với CSDL y văn (Zero Free Claims Policy).
"""
import re
from typing import List, Tuple
from pydantic import BaseModel, Field

class ClaimCitation(BaseModel):
    """Mỗi luận điểm y khoa khẳng định bắt buộc phải có nguồn chứng thực (PaperQA2 Provenance)."""
    claim_text: str = Field(description="Nội dung khẳng định lâm sàng")
    source_document: str = Field(description="Tài liệu nguồn: Dược thư DĐVN V hoặc QĐ 5948")
    page_or_section: str = Field(default="", description="Trang số hoặc Mục/Bảng quy định cụ thể")
    is_verified: bool = Field(default=True, description="Đã được đối soát chéo thành công với CSDL")

class PaperQASynthesisResult(BaseModel):
    """Đầu ra của bộ tổng hợp y văn có chứng cứ lâm sàng."""
    conversational_answer: str = Field(description="Nội dung phản hồi tự nhiên, gãy gọn, đúng trọng tâm")
    citations: List[ClaimCitation] = Field(default_factory=list, description="Danh sách chứng cứ bảo chứng")
    grounded_confidence: float = Field(default=1.0, ge=0.0, le=1.0, description="Độ tin cậy chứng thực (0.0 - 1.0)")
    has_unverified_claims: bool = Field(default=False, description="Có phát hiện câu nói bịa đặt ngoài CSDL bị cắt bỏ không")
    latency_ms: float = Field(default=0.0, description="Thời gian tổng hợp (milliseconds)")
    source_status: str = Field(default="exact_match", description="Trạng thái nguồn gốc dữ liệu")

VIETNAMESE_STOPWORDS = {
    "và", "là", "thì", "mà", "ở", "với", "cho", "của", "trong", "được", "có", "các",
    "những", "này", "đó", "một", "vào", "lúc", "khi", "để", "như", "theo", "sau", "trước",
    "hoặc", "nếu", "bởi", "vì", "từ", "ra", "lại", "rất", "quá", "nên", "phải", "đã"
}

CRITICAL_HALLUCINATION_TRIGGERS = (
    "hoại tử", "bưởi chùm", "tử vong", "suy tủy", "ngưng tim", "mù lòa",
    "ung thư", "chết", "ngộ độc cấp", "hôn mê"
)

_NUM_UNIT_RE = re.compile(
    r"\b(\d+(?:[.,]\d+)?)\s*(mg/kg/ngày|mg/kg|mcg/kg|g/ngày|mg|mcg|µg|g|ml/phút|ml|ui|iu|tuần|tháng|tuổi|giờ|%)\b",
    re.IGNORECASE,
)


def _has_ungrounded_dose_number(sent_lower: str, evidence_lower: str) -> bool:
    """Reject sentence if any dose/clinical number+unit is fabricated (absent from evidence)."""
    sent_pairs = _NUM_UNIT_RE.findall(sent_lower)
    if not sent_pairs:
        return False
    ev_pairs = {
        (num.replace(",", "."), unit.lower())
        for num, unit in _NUM_UNIT_RE.findall(evidence_lower)
    }
    ev_numbers = {m.replace(",", ".") for m in re.findall(r"\b\d+(?:[.,]\d+)?\b", evidence_lower)}
    for num, unit in sent_pairs:
        norm_num = num.replace(",", ".")
        norm_unit = unit.lower()
        if (norm_num, norm_unit) not in ev_pairs and norm_num not in ev_numbers:
            return True
    return False

def verify_and_purge_unsupported_claims(llm_text: str, evidence_context: str) -> Tuple[str, List[ClaimCitation]]:
    """
    Bộ lọc PaperQA2 Claim Verifier:
    Phân tách từng câu khẳng định, đối soát chéo từ vựng ngữ nghĩa với evidence_context.
    Tự động gạch bỏ các câu khẳng định bịa đặt (Hallucination) không có trong dữ liệu CSDL.
    """
    evidence_lower = evidence_context.lower()
    evidence_words = set(
        w for w in re.findall(r'\b[a-zA-Z0-9à-ỹÀ-ỸĐđ]+\b', evidence_lower)
        if len(w) >= 3 and w not in VIETNAMESE_STOPWORDS
    )

    raw_lines = [l.rstrip() for l in llm_text.splitlines() if l.strip()]
    verified_lines: List[str] = []
    citations: List[ClaimCitation] = []

    for raw_line in raw_lines:
        is_heading = bool(re.match(r"^\s*#{1,6}\s+", raw_line))
        if is_heading:
            verified_lines.append(raw_line.strip())
            continue

        indent_prefix = "  " if re.match(r"^\s{2,}[-*•]\s+", raw_line) else ""
        sent = raw_line.strip()
        if len(sent) < 5:
            continue

        sent_lower = sent.lower()
        cite_match = re.search(r'\[(.*?)\]', sent)
        source_label = cite_match.group(1).strip() if cite_match else "Dược Thư Quốc Gia Việt Nam & QĐ 5948"

        sent_words = set(
            w for w in re.findall(r'\b[a-zA-Z0-9à-ỹÀ-ỸĐđ]+\b', sent_lower)
            if len(w) >= 3 and w not in VIETNAMESE_STOPWORDS
        )
        if not sent_words:
            verified_lines.append(sent)
            continue

        overlap = sent_words.intersection(evidence_words)
        overlap_ratio = len(overlap) / len(sent_words)

        critical_unsupported_words = [
            w for w in sent_words if w not in evidence_words and w in CRITICAL_HALLUCINATION_TRIGGERS
        ]

        is_hallucination = (
            bool(critical_unsupported_words)
            or (overlap_ratio < 0.20 and len(sent_words) >= 6)
            or _has_ungrounded_dose_number(sent_lower, evidence_lower)
        )
        if is_hallucination:
            continue

        # Strip dangling/unpaired markdown bold markers left when splitting multi-line LLM claims
        clean_sent = re.sub(r"\*{3,}", "", sent).strip()
        if clean_sent.count("**") % 2 != 0:
            clean_sent = clean_sent.replace("**", "").strip()
        if not clean_sent:
            continue

        verified_lines.append(f"{indent_prefix}{clean_sent}")
        citations.append(ClaimCitation(
            claim_text=clean_sent,
            source_document=source_label,
            is_verified=True
        ))

    # Drop truncated trailing fragment if LLM stopped mid-sentence (e.g. "Thông thường: 2")
    if len(verified_lines) > 1:
        last_line = verified_lines[-1].strip()
        if not re.match(r"^#{1,6}\s+", last_line) and not re.search(r"[.!?:;…)\"”'\]]\s*$", last_line):
            verified_lines.pop()

    cleaned_text = "\n".join(verified_lines)
    return cleaned_text, citations
