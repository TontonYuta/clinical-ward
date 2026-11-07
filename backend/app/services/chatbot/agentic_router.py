"""
Agentic Clinical NLU & Intent Router (Zero Hardcoded Keywords)
Tuân thủ chuẩn Berkeley Function Calling & Google AMIE (Multi-turn Context Buffer).
Sử dụng Structured JSON Output từ Gemini LLM kết hợp LRU Semantic Cache.
"""

import json
import re
import hashlib
from typing import Optional, Dict

from app.config import settings
from app.schemas.agentic_intent import (
    ClinicalIntent,
    IntentExtractionResult,
    BERKELEY_FUNCTION_SPECS
)
from app.services.chatbot.semantic_fallback import fallback_semantic_classification

# In-memory LRU / Semantic Cache cho Intent Classification
_INTENT_CACHE: Dict[str, IntentExtractionResult] = {}
_MAX_INTENT_CACHE = 500

SYSTEM_NLU_PROMPT = """Bạn là Bộ Phân Loại Ý Định & Bóc Tách Thực Thể Lâm Sàng (Agentic Clinical Router).
Nhiệm vụ của bạn là phân tích câu nói tự nhiên của Bác sĩ / Điều dưỡng trong bệnh viện và trả về JSON thuần túy (không markdown block) theo đúng schema sau:

{
  "intent": "<DISPENSE_MEDICATION | REPORT_EQUIPMENT_INCIDENT | FEFO_INVENTORY_CHECK | RESTOCK_PROPOSAL | SHIFT_HANDOVER_AUDIT | COLDCHAIN_CHECK | CHECK_DRUG_INTERACTION | CLINICAL_CONSULTATION | CONVERSATIONAL_GREETING | CLINICAL_SAFE_ABSTENTION>",
  "confidence": 0.95,
  "drug_name": "<Tên thuốc/vật tư nếu có>",
  "drug_b": "<Tên thuốc thứ 2 nếu kiểm tra tương tác>",
  "quantity": <Số lượng nguyên, mặc định 1>,
  "unit": "<lọ, ống, viên, cái, bộ, chai...>",
  "patient_name": "<Tên hoặc mã bệnh nhân nếu có>",
  "patient_room": "<Khoa phòng, buồng bệnh, phòng mổ nếu có>",
  "device_name": "<Tên thiết bị y tế nếu báo hỏng>",
  "device_location": "<Vị trí đặt máy nếu có>",
  "issue_description": "<Mô tả ngắn gọn sự cố thiết bị>",
  "urgency": "<urgent hoặc routine>",
  "clinical_reason": "<Lý do lâm sàng hoặc triệu chứng nếu có>",
  "threshold_days": <Số ngày cận hạn nếu hỏi hạn dùng, mặc định 60>
}

Quy tắc phân loại:
1. DISPENSE_MEDICATION: Khi người dùng yêu cầu XUẤT, MƯỢN, LẤY, RÚT thuốc/vật tư khẩn cấp tại tủ trực khoa phòng (ví dụ: "mượn 2 ống morphin", "xuất khẩn cấp 1 lọ kcl"). KHÔNG dùng intent này cho câu dặn dò, nhắc lịch uống thuốc (như "Nhắc thuốc cho bệnh nhân...", "Lịch uống thuốc..."), không dùng cho câu hỏi tra cứu thông tin hay kê đơn ngoại trú.
2. REPORT_EQUIPMENT_INCIDENT: Khi người dùng thông báo máy móc, thiết bị y tế (máy thở, monitor, bơm tiêm điện...) bị hỏng, lỗi, xì khí, mất nguồn, chai pin.
3. FEFO_INVENTORY_CHECK: Khi người dùng hỏi thuốc cận hạn, hạn dùng, kiểm tra date kho thuốc.
4. RESTOCK_PROPOSAL: Khi người dùng yêu cầu LẬP PHIẾU DỰ TRÙ BÙ KHO, mặt hàng chạm ngưỡng min cần đặt thêm (ví dụ: "lập dự trù bù kho", "các thuốc sắp hết cần dự trù"). KHÔNG dùng intent này khi người dùng chỉ hỏi tra cứu số lượng/tồn kho hiện tại của một thuốc (đó là CLINICAL_CONSULTATION).
5. SHIFT_HANDOVER_AUDIT: Khi người dùng hỏi đối soát ca trực, giao ban, kiểm tra nợ vỏ morphin, nợ ca trực.
6. COLDCHAIN_CHECK: Khi người dùng hỏi nhiệt độ tủ lạnh vắc xin, dây chuyền lạnh, hoặc sự cố mất điện tủ lạnh.
7. CHECK_DRUG_INTERACTION: Khi hỏi tương tác giữa 2 thuốc (ví dụ Clopidogrel và Omeprazol).
8. CLINICAL_CONSULTATION: Khi hỏi về dược lý, chỉ định, chống chỉ định, liều dùng, tác dụng phụ, tra cứu thông tin hoặc số lượng tồn kho của một thuốc cụ thể, phác đồ điều trị, dặn dò uống thuốc, tư vấn ca bệnh.
9. CONVERSATIONAL_GREETING: Chào hỏi, cảm ơn, hỏi thăm thông thường.
"""

async def classify_intent_with_llm(query: str, history: str = "") -> Optional[IntentExtractionResult]:
    """Phân loại ý định không dùng từ khóa cứng qua Gemini LLM Structured JSON."""
    from app.services.admin_key_vault import get_active_api_key
    api_key = get_active_api_key(provider="gemini") or settings.GEMINI_API_KEY
    if not api_key or api_key == "MY_GEMINI_API_KEY" or len(api_key.strip()) < 10:
        return None

    try:
        from app.services.llm_provider import query_clinical_llm

        prompt = f"Ngữ cảnh hội thoại trước đó (nếu có):\n{history}\n\nCâu nói của nhân viên y tế:\n\"{query}\""
        raw_json = await query_clinical_llm(
            prompt=prompt,
            system_instruction=SYSTEM_NLU_PROMPT,
            api_key=api_key,
            temperature=0.0,
            max_output_tokens=400,
            timeout_sec=4.0
        )
        if not raw_json:
            return None

        cleaned = re.sub(r"^```(?:json)?\s*", "", raw_json.strip())
        cleaned = re.sub(r"\s*```$", "", cleaned)
        data = json.loads(cleaned)
        return IntentExtractionResult(**data)
    except Exception:
        return None

async def route_clinical_intent(query: str, history: str = "", user_role: str = "doctor") -> IntentExtractionResult:
    """Entrypoint chính: Phân loại ý định qua Semantic Cache -> Gemini LLM -> Semantic Fallback."""
    clean_q = query.strip()
    cache_key = hashlib.md5(f"{clean_q.lower()}_{user_role}".encode("utf-8")).hexdigest()

    if cache_key in _INTENT_CACHE:
        return _INTENT_CACHE[cache_key]

    # 1. Thử phân loại bằng LLM NLU Tool-Calling
    res = await classify_intent_with_llm(clean_q, history=history)

    # 2. Nếu LLM chưa khả dụng hoặc timeout, dùng Semantic Prototype Fallback
    if not res:
        res = fallback_semantic_classification(clean_q)

    # 3. Disambiguation Guardrail: Phân biệt dặn dò/nhắc thuốc/tra cứu tồn kho với hành động xuất kho
    lower_clean = clean_q.lower()
    is_advice_or_lookup = any(p in lower_clean for p in [
        "nhắc thuốc", "lịch uống", "dặn dò", "còn bao nhiêu", "số lượng còn",
        "hỏi số lượng", "kê đơn", "tạo đơn", "đơn thuốc điện tử"
    ])
    if is_advice_or_lookup:
        is_explicit_dispense = any(w in lower_clean for w in ["mượn", "xuất khẩn", "rút khẩn"])
        is_explicit_restock = any(w in lower_clean for w in ["dự trù", "mẫu 01", "chạm ngưỡng min"])
        if not is_explicit_dispense and not is_explicit_restock:
            res.intent = ClinicalIntent.CLINICAL_CONSULTATION

    if len(_INTENT_CACHE) >= _MAX_INTENT_CACHE:
        _INTENT_CACHE.clear()
    _INTENT_CACHE[cache_key] = res
    return res
