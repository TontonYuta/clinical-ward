"""
CRAG Contextual Clinical Query Rewriter & Multi-turn De-contextualization
Paper: Corrective Retrieval Augmented Generation (CRAG - Yan et al., 2024 / arXiv:2401.15884)
Repo: HuskyInSalt/CRAG & LangGraph Agentic Workflows
"""
import re
import json
import time
import httpx
from typing import Optional, List
from pydantic import BaseModel, Field
from app.config import settings

class ClinicalRewriteResult(BaseModel):
    """Kết quả phân giải ngữ cảnh và chuẩn hóa câu truy vấn lâm sàng (CRAG Pattern)."""
    original_query: str = Field(description="Câu hỏi gốc của người dùng")
    rewritten_query: str = Field(description="Câu truy vấn lâm sàng hoàn chỉnh, độc lập ngữ cảnh")
    is_continuation: bool = Field(default=False, description="Có phải câu hỏi tiếp nối ngữ cảnh trước không")
    detected_drug_entities: List[str] = Field(default_factory=list, description="Danh sách thuốc/hoạt chất được kế thừa hoặc nhận diện")
    detected_intent: Optional[str] = Field(default=None, description="Ý định lâm sàng dự kiến")
    confidence: float = Field(default=1.0, ge=0.0, le=1.0, description="Độ tin cậy của việc chuẩn hóa (0.0 - 1.0)")
    latency_ms: float = Field(default=0.0, description="Thời gian thực thi chuẩn hóa (milliseconds)")
    fallback_used: bool = Field(default=False, description="Có phải dùng fallback an toàn khi LLM timeout không")

# Các từ khóa chỉ báo câu hỏi phụ thuộc ngữ cảnh hội thoại trước đó (Deictic Markers)
CONTINUATION_MARKERS = (
    "nữa", "nua", "tiếp", "tiep", "còn", "con", "thêm", "them", "nó", "no",
    "thuốc này", "thuoc nay", "thuốc đó", "thuoc do", "vừa rồi", "vua roi",
    "thì sao", "thi sao", "thế nào", "the nao", "được không", "duoc khong",
    "trẻ em", "tre em", "cho bé", "cho be", "cho con bú", "phụ nữ có thai",
    "suy thận", "suy gan", "kỵ", "kỵ nhau", "uống cùng", "dùng cùng", "mấy cặp", "may cap"
)

def assess_query_complexity(query: str, history: str = "") -> bool:
    """
    Đánh giá xem câu truy vấn có cần phân giải ngữ cảnh hay không (Fast Passthrough Guard).
    Nếu câu đã độc lập, đủ nghĩa và không có đại từ thay thế -> Bỏ qua rewriting để đạt latency 0ms.
    """
    clean_q = query.strip()
    lower_q = clean_q.lower()

    # 0. Bỏ qua ngay các lệnh nghiệp vụ, quản trị tủ trực, form kê đơn (Fast-Bypass 0ms)
    if any(op in lower_q for op in (
        "mở form", "mo form", "kê đơn", "ke don", "tạo đơn", "tao don",
        "báo hỏng", "bao hong", "tủ trực", "tu truc", "giao ban",
        "kiểm kê", "kiem ke", "kho fefo", "chuỗi lạnh", "chuoi lanh"
    )):
        return False

    # 1. Phát hiện câu ghép vừa hỏi năng lực vừa hỏi thuốc
    if any(p in lower_q for p in ("làm được gì", "lam duoc gi", "có thể làm gì", "co the lam gi")) and any(p in lower_q for p in ("thuốc", "thuoc", "hỏi về", "hoi ve")):
        return True

    # 2. Nếu câu hỏi đã nêu rõ ca bệnh / bệnh nhân cụ thể thì là ca bệnh mới, không phụ thuộc thuốc trước
    if any(p in lower_q for p in ("bệnh nhân", "người bệnh", "bn ", "bn-")) and not any(term in lower_q for term in ("nó", "thuốc đó", "thuốc này")):
        return False

    # 3. Nếu có lịch sử hội thoại và câu hỏi có dấu hiệu tiếp nối hoặc ngắn (< 5 từ)
    if history.strip():
        if any(marker in lower_q for marker in CONTINUATION_MARKERS):
            return True
        if len(clean_q.split()) <= 4:
            return True

    # 4. Đại từ chỉ định trực tiếp
    if any(term in lower_q for term in ("nó có", "thuốc đó", "thuốc này", "vừa hỏi", "vừa nói", "cặp nữa")):
        return True

    return False

def _extract_recent_active_drug(history: str) -> Optional[str]:
    """Trích xuất tên thuốc đang được thảo luận gần nhất từ lịch sử hội thoại."""
    if not history:
        return None
    lines = history.strip().split("\n")
    stopwords_drug = {
        "này", "đó", "thuốc", "bác sĩ", "trợ lý", "gì", "giảm đau", "hạ sốt", "kháng sinh",
        "chống viêm", "an toàn", "chỉ định", "liều dùng", "người lớn", "trẻ em", "thông tin"
    }
    drug_patterns = [
        r"\b(Coversyl|Paracetamol|Teglutik|Venclexta|Simvastatin|Clopidogrel|Omeprazol|Aspirin|Warfarin|Methotrexat|Amiodaron|Morphin|Zithromax|Propranolol|Perindopril|Amlodipin|Augmentin|Ceftriaxon|Diazepam|Salbutamol)\b",
        r"(?:thuốc|chuyên luận|thẩm định cho thuốc|về thuốc)\s+[*]{0,2}([A-ZÀ-ỸĐ][a-zA-Z0-9à-ỹÀ-ỸĐđ'-]+)[*]{0,2}"
    ]
    for line in reversed(lines):
        for pat in drug_patterns:
            m = re.search(pat, line, re.IGNORECASE)
            if m:
                drug_candidate = m.group(1).strip()
                if drug_candidate.lower() not in stopwords_drug and len(drug_candidate) >= 3:
                    return drug_candidate
    return None

def _fast_heuristic_rewrite(query: str, history: str) -> Optional[ClinicalRewriteResult]:
    """
    Bộ phân giải ngữ cảnh cục bộ siêu tốc (< 1ms).
    Xử lý ngay lập tức các mẫu hội thoại lâm sàng kinh điển mà không cần gọi API LLM.
    """
    clean_q = query.strip()
    lower_q = clean_q.lower()

    # 0. Bỏ qua ngay các lệnh nghiệp vụ, quản trị tủ trực, form kê đơn (Fast-Bypass 0ms)
    if any(op in lower_q for op in (
        "mở form", "mo form", "kê đơn", "ke don", "tạo đơn", "tao don",
        "báo hỏng", "bao hong", "tủ trực", "tu truc", "giao ban",
        "kiểm kê", "kiem ke", "kho fefo", "chuỗi lạnh", "chuoi lanh"
    )):
        return False
    recent_drug = _extract_recent_active_drug(history)

    # TH1: Câu ghép chào hỏi năng lực + hỏi thuốc cụ thể
    # Ví dụ: "Bạn có thể làm được gì Tôi muốn hỏi về thuốc Coversyl"
    m_compound = re.search(r"(?:hỏi về thuốc|về thuốc|tra cứu thuốc|thông tin thuốc)\s+([A-ZÀ-ỸĐa-zA-Z0-9à-ỹÀ-ỸĐđ\s'-]+)", clean_q, re.IGNORECASE)
    if m_compound and any(p in lower_q for p in ("làm được gì", "lam duoc gi", "có thể làm gì", "co the lam gi")):
        target_drug = m_compound.group(1).strip().strip("?.!,")
        return ClinicalRewriteResult(
            original_query=clean_q,
            rewritten_query=f"Thông tin chi tiết chuyên luận thuốc {target_drug}",
            is_continuation=False,
            detected_drug_entities=[target_drug],
            detected_intent="MEDICATION_SAFETY_PROFILE",
            confidence=0.98,
            fallback_used=False
        )

    # TH2: Hội thoại tiếp nối danh mục tương tác thuốc ("lấy 4 cặp nữa", "lấy ví dụ 5 cặp nữa", "thêm 3 cặp nữa")
    m_ddi_more = re.search(r"\b(\d+)\s+cặp\b", lower_q)
    if m_ddi_more or any(w in lower_q for w in ("cặp nữa", "cap nua", "thêm cặp", "xem tiếp các cặp")):
        count_num = m_ddi_more.group(1) if m_ddi_more else "4"
        return ClinicalRewriteResult(
            original_query=clean_q,
            rewritten_query=f"Liệt kê {count_num} cặp tương tác thuốc chống chỉ định tiếp theo theo QĐ 5948/QĐ-BYT",
            is_continuation=True,
            detected_drug_entities=["tương tác thuốc chống chỉ định"],
            detected_intent="CLINICAL_DDI_INTERACTION_LOOKUP",
            confidence=0.99,
            fallback_used=False
        )

    # TH3: Hỏi liều dùng đối tượng đặc thù kế thừa thuốc trước ("trẻ em thì dùng thế nào", "suy thận có uống được không")
    has_patient_named = any(w in lower_q for w in ("bệnh nhân", "người bệnh", "bn ", "bn-"))
    if recent_drug and not has_patient_named:
        if any(w in lower_q for w in ("trẻ em", "tre em", "cho bé", "cho be", "nhi khoa")):
            return ClinicalRewriteResult(
                original_query=clean_q,
                rewritten_query=f"Liều dùng và lưu ý sử dụng {recent_drug} cho trẻ em",
                is_continuation=True,
                detected_drug_entities=[recent_drug],
                detected_intent="CLINICAL_PEDIATRIC_GUIDANCE",
                confidence=0.95,
                fallback_used=False
            )
        if any(w in lower_q for w in ("suy thận", "suy gan", "chức năng thận", "egfr")):
            return ClinicalRewriteResult(
                original_query=clean_q,
                rewritten_query=f"Chỉnh liều và lưu ý sử dụng {recent_drug} cho bệnh nhân suy thận",
                is_continuation=True,
                detected_drug_entities=[recent_drug],
                detected_intent="CLINICAL_RENAL_ADJUSTMENT",
                confidence=0.95,
                fallback_used=False
            )
        # TH4: Đại từ thay thế ("nó có kỵ...", "thuốc đó có tương tác...")
        if any(w in lower_q for w in ("nó", "thuốc đó", "thuốc này")):
            replaced = re.sub(r"\b(nó|thuốc đó|thuốc này)\b", recent_drug, clean_q, flags=re.IGNORECASE)
            return ClinicalRewriteResult(
                original_query=clean_q,
                rewritten_query=replaced,
                is_continuation=True,
                detected_drug_entities=[recent_drug],
                detected_intent="MEDICATION_SAFETY_PROFILE",
                confidence=0.92,
                fallback_used=False
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
    api_key: Optional[str] = None,
    timeout_sec: float = 1.2
) -> ClinicalRewriteResult:
    """
    Điểm vào trung tâm (Entrypoint) của CRAG Contextual Clinical Query Rewriter.
    Tự động thẩm định độ phức tạp -> Phân giải cục bộ siêu tốc -> Fallback an toàn.
    """
    start_time = time.time()
    clean_q = query.strip()

    # 1. Kiểm tra Fast Passthrough
    if not assess_query_complexity(clean_q, history):
        return ClinicalRewriteResult(
            original_query=clean_q,
            rewritten_query=clean_q,
            is_continuation=False,
            confidence=1.0,
            latency_ms=round((time.time() - start_time) * 1000, 2),
            fallback_used=False
        )

    # 2. Thử phân giải cục bộ siêu tốc (Fast Heuristic Resolver < 1ms)
    fast_res = _fast_heuristic_rewrite(clean_q, history)
    if fast_res:
        fast_res.latency_ms = round((time.time() - start_time) * 1000, 2)
        return fast_res

    # 3. Phân giải qua LLM Gemini Flash (với Timeout nghiêm ngặt)
    key = api_key or settings.GEMINI_API_KEY
    if key and key != "MY_GEMINI_API_KEY" and len(key.strip()) >= 10:
        try:
            rewritten_text = await _call_llm_rewriter(clean_q, history, key, timeout_sec=timeout_sec)
            if rewritten_text and len(rewritten_text) >= 3:
                return ClinicalRewriteResult(
                    original_query=clean_q,
                    rewritten_query=rewritten_text,
                    is_continuation=True,
                    confidence=0.90,
                    latency_ms=round((time.time() - start_time) * 1000, 2),
                    fallback_used=False
                )
        except Exception:
            pass

    # 4. Fail-Safe Fallback: Luôn bảo toàn tính liên tục của hệ thống
    return ClinicalRewriteResult(
        original_query=clean_q,
        rewritten_query=clean_q,
        is_continuation=False,
        confidence=0.60,
        latency_ms=round((time.time() - start_time) * 1000, 2),
        fallback_used=True
    )
