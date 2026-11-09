"""
CRAG Contextual Clinical Query Rewriter & Multi-turn De-contextualization
Paper: Corrective Retrieval Augmented Generation (CRAG - Yan et al., 2024 / arXiv:2401.15884)
Paper: Google AMIE (Tu et al., 2024 - Nature / arXiv:2401.05654)
"""
import re
import time
from typing import Optional
from app.config import settings
from app.schemas.query_rewrite_schema import ClinicalRewriteResult
from app.services.rag.amie_context_buffer import AMIEContextBuffer

# Re-export schema for backward compatibility
__all__ = ["ClinicalRewriteResult", "assess_query_complexity", "rewrite_clinical_query"]

def assess_query_complexity(query: str, history: str = "") -> bool:
    """Đánh giá xem câu truy vấn có cần phân giải ngữ cảnh hay không (Fast Passthrough Guard)."""
    clean_q = query.strip()
    lower_q = clean_q.lower()

    # Phát hiện câu ghép vừa hỏi năng lực vừa hỏi thuốc
    if any(p in lower_q for p in ("làm được gì", "có thể làm gì")) and any(p in lower_q for p in ("thuốc", "hỏi về")):
        return True

    return AMIEContextBuffer.is_deictic_continuation(clean_q, history)

def _fast_heuristic_rewrite(query: str, history: str, active_med: Optional[str] = None) -> Optional[ClinicalRewriteResult]:
    """Bộ phân giải ngữ cảnh cục bộ siêu tốc (< 1ms, Zero Hardcoded Drug List)."""
    clean_q = query.strip()
    lower_q = clean_q.lower()
    recent_drug = (active_med.strip() if active_med and len(active_med.strip()) >= 3 else None) or AMIEContextBuffer.extract_recent_active_drug(history)

    # TH1: Câu ghép chào hỏi năng lực + hỏi thuốc cụ thể
    m_compound = re.search(
        r"(?i:hỏi về thuốc|về thuốc|tra cứu thuốc|thông tin thuốc)\s+([A-Za-z0-9à-ỹÀ-ỸĐđ\s'-]+)",
        clean_q
    )
    if m_compound and any(p in lower_q for p in ("làm được gì", "có thể làm gì")):
        target_drug = m_compound.group(1).strip().strip("?.!,")
        return ClinicalRewriteResult(
            original_query=clean_q,
            rewritten_query=f"Thông tin chi tiết chuyên luận thuốc {target_drug}",
            is_continuation=False,
            detected_drug_entities=[target_drug],
            detected_intent="MEDICATION_SAFETY_PROFILE",
            confidence=0.98
        )

    # TH2: Hội thoại tiếp nối danh mục tương tác thuốc ("lấy 4 cặp nữa")
    m_ddi_more = re.search(r"\b(\d+)\s+cặp\b", lower_q)
    if m_ddi_more or any(w in lower_q for w in ("cặp nữa", "thêm cặp", "xem tiếp các cặp")):
        count_num = m_ddi_more.group(1) if m_ddi_more else "4"
        return ClinicalRewriteResult(
            original_query=clean_q,
            rewritten_query=f"Liệt kê {count_num} cặp tương tác thuốc chống chỉ định tiếp theo theo QĐ 5948/QĐ-BYT",
            is_continuation=True,
            detected_drug_entities=["tương tác thuốc chống chỉ định"],
            detected_intent="CLINICAL_DDI_INTERACTION_LOOKUP",
            confidence=0.99
        )

    # TH3 & TH4: Hỏi đối tượng đặc thù hoặc thay thế đại từ kế thừa thuốc trước
    has_patient_named = any(w in lower_q for w in ("bệnh nhân", "người bệnh", "bn "))
    from app.services.chatbot.lexical_trie_matcher import get_drug_lexical_matcher
    try:
        matcher = get_drug_lexical_matcher()
        has_query_drug = bool(matcher.extract_medications(clean_q) or matcher.extract_sdk(clean_q))
    except Exception:
        has_query_drug = False

    if recent_drug and not has_patient_named and not has_query_drug:
        if any(w in lower_q for w in ("trẻ em", "cho bé", "nhi khoa")):
            return ClinicalRewriteResult(
                original_query=clean_q,
                rewritten_query=f"Liều dùng và lưu ý sử dụng {recent_drug} cho trẻ em",
                is_continuation=True,
                detected_drug_entities=[recent_drug],
                detected_intent="CLINICAL_PEDIATRIC_GUIDANCE",
                confidence=0.95
            )
        if any(w in lower_q for w in ("suy thận", "suy gan", "chức năng thận", "egfr")):
            return ClinicalRewriteResult(
                original_query=clean_q,
                rewritten_query=f"Chỉnh liều và lưu ý sử dụng {recent_drug} cho bệnh nhân suy thận",
                is_continuation=True,
                detected_drug_entities=[recent_drug],
                detected_intent="CLINICAL_RENAL_ADJUSTMENT",
                confidence=0.95
            )
        if any(w in lower_q for w in ("nó", "thuốc đó", "thuốc này")):
            replaced = re.sub(r"\b(nó|thuốc đó|thuốc này)\b", recent_drug, clean_q, flags=re.IGNORECASE)
            return ClinicalRewriteResult(
                original_query=clean_q,
                rewritten_query=replaced,
                is_continuation=True,
                detected_drug_entities=[recent_drug],
                detected_intent="MEDICATION_SAFETY_PROFILE",
                confidence=0.92
            )

    return None

async def _call_llm_rewriter(query: str, history: str, api_key: str, timeout_sec: float = 1.2) -> str:
    """Gọi Gemini Flash siêu nhẹ với timeout nghiêm ngặt để phân giải các trường hợp ngữ nghĩa phức tạp."""
    prompt = (
        "Bạn là Chuyên gia Ngôn ngữ học Lâm sàng (Clinical Query Reformulator - CRAG Pattern).\n"
        "Nhiệm vụ: Phân giải các câu hỏi tắt, đại từ thay thế ('nó', 'thuốc đó') hoặc câu ghép của bác sĩ "
        "thành một câu truy vấn y khoa hoàn chỉnh, độc lập ngữ cảnh (Stand-alone Query) để hệ thống tra cứu đúng CSDL.\n\n"
        "Quy tắc bắt buộc:\n"
        "1. Nếu câu hỏi đã đầy đủ và độc lập, hãy giữ nguyên câu gốc.\n"
        "2. TUYỆT ĐỐI không thay đổi tên thuốc người dùng đã ghi rõ.\n"
        "3. Nếu câu hỏi là câu ghép vừa chào hỏi vừa hỏi thuốc, chỉ trích xuất phần câu hỏi chuyên môn.\n"
        "4. Chỉ trả về duy nhất một chuỗi văn bản câu hỏi đã chuẩn hóa, không kèm giải thích rườm rà.\n\n"
        f"Lịch sử hội thoại gần nhất:\n{history or '(không có)'}\n\n"
        f"Câu hỏi người dùng: \"{query}\"\n\n"
        "Câu truy vấn lâm sàng chuẩn hóa:"
    )
    from app.services.llm_provider import query_clinical_llm
    res = await query_clinical_llm(
        prompt=prompt,
        api_key=api_key,
        temperature=0.0,
        max_output_tokens=100,
        timeout_sec=timeout_sec
    )
    if res:
        return res.strip().strip('"')
    raise RuntimeError("Query rewrite LLM unavailable")

async def rewrite_clinical_query(
    query: str,
    history: str = "",
    *,
    active_med: Optional[str] = None,
    api_key: Optional[str] = None,
    timeout_sec: float = 1.2
) -> ClinicalRewriteResult:
    """Điểm vào trung tâm (Entrypoint) của CRAG Contextual Clinical Query Rewriter."""
    start_time = time.time()
    clean_q = query.strip()

    if not assess_query_complexity(clean_q, history):
        return ClinicalRewriteResult(
            original_query=clean_q,
            rewritten_query=clean_q,
            is_continuation=False,
            confidence=1.0,
            latency_ms=round((time.time() - start_time) * 1000, 2)
        )

    fast_res = _fast_heuristic_rewrite(clean_q, history, active_med=active_med)
    if fast_res:
        fast_res.latency_ms = round((time.time() - start_time) * 1000, 2)
        return fast_res

    from app.services.admin_key_vault import get_active_api_key
    key = api_key or get_active_api_key(provider="gemini") or settings.GEMINI_API_KEY
    if key and key != "MY_GEMINI_API_KEY" and len(key.strip()) >= 10:
        try:
            rewritten_text = await _call_llm_rewriter(clean_q, history, key, timeout_sec=timeout_sec)
            if rewritten_text:
                return ClinicalRewriteResult(
                    original_query=clean_q,
                    rewritten_query=rewritten_text,
                    is_continuation=True,
                    confidence=0.90,
                    latency_ms=round((time.time() - start_time) * 1000, 2)
                )
        except Exception:
            pass

    return ClinicalRewriteResult(
        original_query=clean_q,
        rewritten_query=clean_q,
        is_continuation=False,
        confidence=0.60,
        latency_ms=round((time.time() - start_time) * 1000, 2),
        fallback_used=True
    )
