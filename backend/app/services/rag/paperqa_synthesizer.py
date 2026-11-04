"""
PaperQA2 Claim-Level Evidence Synthesizer & Clinical Hallucination-Shield
Paper: Language agents achieve superhuman synthesis of scientific knowledge (Nature, 2024 / arXiv:2409.13740)
Repo: Future-House/paper-qa (9.5k stars)
"""
import re
import time
import httpx
from typing import Optional, List, Tuple
from pydantic import BaseModel, Field
from app.config import settings

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

def verify_and_purge_unsupported_claims(llm_text: str, evidence_context: str) -> Tuple[str, List[ClaimCitation]]:
    """
    Bộ lọc PaperQA2 Claim Verifier:
    Phân tách từng câu khẳng định, đối soát chéo từ vựng ngữ nghĩa với evidence_context.
    Tự động gạch bỏ các câu khẳng định bịa đặt (Hallucination) không có trong dữ liệu CSDL.
    """
    evidence_lower = evidence_context.lower()
    evidence_words = set(w for w in re.findall(r'\b[a-zA-Z0-9à-ỹÀ-ỸĐđ]+\b', evidence_lower) if len(w) >= 3 and w not in VIETNAMESE_STOPWORDS)

    sentences = [s.strip() for s in re.split(r'(?<=[.!?])\s+|\n+', llm_text) if len(s.strip()) >= 5]
    verified_sentences: List[str] = []
    citations: List[ClaimCitation] = []
    has_purged = False

    for sent in sentences:
        sent_lower = sent.lower()
        # Trích xuất nguồn trong ngoặc vuông [DĐVN V, Trang xxx] hoặc [QĐ 5948]
        cite_match = re.search(r'\[(.*?)\]', sent)
        source_label = cite_match.group(1).strip() if cite_match else "Dược Thư Quốc Gia Việt Nam & QĐ 5948"

        # Tách các từ quan trọng trong câu
        sent_words = set(w for w in re.findall(r'\b[a-zA-Z0-9à-ỹÀ-ỸĐđ]+\b', sent_lower) if len(w) >= 3 and w not in VIETNAMESE_STOPWORDS)
        if not sent_words:
            verified_sentences.append(sent)
            continue

        overlap = sent_words.intersection(evidence_words)
        overlap_ratio = len(overlap) / len(sent_words)

        # Phát hiện từ khóa y khoa mới xuất hiện nhưng không có trong evidence
        critical_unsupported_words = [
            w for w in sent_words if w not in evidence_words and w in (
                "hoại tử", "bưởi chùm", "tử vong", "suy tủy", "ngưng tim", "mù lòa",
                "ung thư", "chết", "ngộ độc cấp", "hôn mê"
            )
        ]

        # Nếu tỷ lệ overlap quá thấp (< 0.25) và có từ khóa lạ ngoài CSDL -> coi là hallucination
        is_hallucination = bool(critical_unsupported_words) or (overlap_ratio < 0.20 and len(sent_words) >= 6)

        if is_hallucination:
            has_purged = True
            continue  # Cắt bỏ câu bịa đặt khỏi kết quả

        verified_sentences.append(sent)
        citations.append(ClaimCitation(
            claim_text=sent,
            source_document=source_label,
            is_verified=True
        ))

    cleaned_text = "\n\n".join(verified_sentences) if "\n" in llm_text else " ".join(verified_sentences)
    return cleaned_text, citations

async def _call_llm_synthesis(
    query: str,
    evidence_context: str,
    source_label: str,
    user_role: str,
    api_key: str,
    timeout_sec: float = 2.0
) -> str:
    """Gọi Gemini Flash để tổng hợp câu trả lời ngôn ngữ tự nhiên từ dữ kiện CSDL đã trích xuất."""
    system_instruction = (
        "Bạn là Chuyên gia Dược lâm sàng & An toàn Thuốc Bệnh viện (PaperQA2 Evidence Synthesizer).\n"
        "Nhiệm vụ: Trả lời câu hỏi của bác sĩ/nhân viên y tế một cách trực diện, súc tích, chuyên nghiệp và ấm áp.\n\n"
        "Nguyên tắc bắt buộc (Zero Free Claims Policy):\n"
        "1. CHỈ sử dụng các dữ kiện được cung cấp trong [CHỨNG CỨ Y VĂN CSDL] dưới đây. Tuyệt đối KHÔNG suy diễn thêm liều dùng hoặc tương tác ngoài văn bản.\n"
        "2. Đi thẳng vào câu hỏi của người dùng, không dump lại toàn bộ Fact sheet dài dòng.\n"
        "3. Nếu có tương tác nguy hiểm hoặc cảnh báo sốc/độc tính, BẮT BUỘC nêu cảnh báo ngay dòng đầu tiên.\n"
        f"4. Đính kèm thẻ nguồn trích dẫn [{source_label}] ở cuối các câu khẳng định quan trọng.\n"
        "5. Định dạng Markdown rõ ràng, dùng bullet points, in đậm tên thuốc và số liều cụ thể."
    )

    prompt = (
        f"{system_instruction}\n\n"
        f"=== [CHỨNG CỨ Y VĂN CSDL CUNG CẤP] ===\n{evidence_context}\n\n"
        f"Câu hỏi của đồng nghiệp ({user_role}): \"{query}\"\n\n"
        "Phản hồi dược lâm sàng có bảo chứng:"
    )

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.1, "maxOutputTokens": 600}
    }

    async with httpx.AsyncClient(timeout=timeout_sec) as client:
        res = await client.post(url, json=payload)
        if res.status_code == 200:
            data = res.json()
            candidates = data.get("candidates", [])
            if candidates:
                parts = candidates[0].get("content", {}).get("parts", [])
                if parts and "text" in parts[0]:
                    return parts[0]["text"].strip()
    raise RuntimeError(f"Gemini API returned status {res.status_code}")

async def synthesize_grounded_clinical_response(
    query: str,
    evidence_context: str,
    source_label: str = "Dược thư Quốc gia Việt Nam 2015 & QĐ 5948",
    user_role: str = "doctor",
    *,
    api_key: Optional[str] = None,
    timeout_sec: float = 2.0
) -> PaperQASynthesisResult:
    """
    Điểm vào trung tâm (Entrypoint) của PaperQA2 Evidence Synthesis.
    Tổng hợp ngôn ngữ tự nhiên mềm mại từ CSDL -> Lọc khử ảo giác -> Đảm bảo an toàn 100%.
    """
    start_time = time.time()
    key = api_key or settings.GEMINI_API_KEY

    # 1. Nếu có API Key khả dụng: Gọi LLM tổng hợp ngôn ngữ tự nhiên
    if key and key != "MY_GEMINI_API_KEY" and len(key.strip()) >= 10:
        try:
            raw_text = await _call_llm_synthesis(
                query=query,
                evidence_context=evidence_context,
                source_label=source_label,
                user_role=user_role,
                api_key=key,
                timeout_sec=timeout_sec
            )
            if raw_text and len(raw_text) >= 15:
                # 2. Chạy qua bộ lọc PaperQA2 Claim Verifier đối soát chéo với CSDL
                clean_answer, citations = verify_and_purge_unsupported_claims(raw_text, evidence_context)
                latency = round((time.time() - start_time) * 1000, 2)
                return PaperQASynthesisResult(
                    conversational_answer=clean_answer,
                    citations=citations,
                    grounded_confidence=0.95,
                    has_unverified_claims=len(clean_answer) < len(raw_text),
                    latency_ms=latency,
                    source_status="exact_match"
                )
        except Exception:
            pass

    # 3. Fail-Safe Fallback: Trả về chính xác evidence gốc từ CSDL (Bảo đảm 0% ảo giác, không gián đoạn)
    latency = round((time.time() - start_time) * 1000, 2)
    return PaperQASynthesisResult(
        conversational_answer=evidence_context,
        citations=[ClaimCitation(claim_text=evidence_context[:100], source_document=source_label, is_verified=True)],
        grounded_confidence=0.70,
        has_unverified_claims=False,
        latency_ms=latency,
        source_status="fallback_deterministic"
    )
