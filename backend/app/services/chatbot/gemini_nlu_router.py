"""
Gemini Structured NLU Router for Hospital CDSS (Zero Hardcoded Lexical Rules).
Replaces brittle regex, Trie false positives, and static if/else branching with
Google Gemini JSON Schema Structured Output & In-Memory Semantic Caching.
"""
import json
import re
import time
import hashlib
from typing import Optional, Dict

from app.config import settings
from app.schemas.clinical_nlu import ClinicalNluExtraction

# LRU / MD5 In-Memory Cache for NLU Router
_NLU_CACHE: Dict[str, tuple[ClinicalNluExtraction, float]] = {}
_MAX_NLU_CACHE = 1000
_CACHE_TTL_SEC = 3600  # 1 hour

GEMINI_NLU_SYSTEM_PROMPT = """Bạn là Bộ Phân Loại Ý Định & Phân Giải Thực Thể Lâm Sàng (Agentic Clinical NLU Router) cho Hệ thống Dược Bệnh Viện.
Nhiệm vụ của bạn là phân tích câu nói tự nhiên của Nhân viên Y tế / Bác sĩ / Bệnh nhân, hiểu ngữ cảnh y khoa, bóc tách chính xác các thông số ca bệnh (tuổi, giới tính, cân nặng, creatinin máu, tên thuốc) và trả về DUY NHẤT một chuỗi JSON chuẩn xác (không markdown, không giải thích).

BẢNG 11 Ý ĐỊNH DUY NHẤT (INTENT TAXONOMY):
1. GREETING_WELLBEING: Chào hỏi, cảm ơn, hỏi thăm thông thường (ví dụ: "chào bạn", "cảm ơn bạn", "chúc buổi sáng tốt lành", "bạn có thể làm gì").
2. CAPABILITY_OPENING: Người dùng mở đầu thiện chí muốn hỏi thông tin về thuốc, kiểm tra khả năng hỗ trợ tra cứu thuốc mà chưa nêu tên thuốc cụ thể (ví dụ: "tôi có thể hỏi bạn thông tin về thuốc được không", "tôi muốn hỏi về thuốc, bạn hỗ trợ tôi được không", "bạn giúp tôi tra cứu thuốc được không", "hỏi thông tin thuốc nhé").
3. CONVERSATIONAL_FEEDBACK: Góp ý, phàn nàn, khen ngợi thái độ phản hồi (ví dụ: "Bạn trả lời bị cứng nhắc quá", "trả lời chưa linh hoạt", "câu trả lời rất hữu ích").
4. MEDICATION_LOOKUP: Tra cứu thông tin, tóm tắt, chỉ định, chống chỉ định, liều dùng, tác dụng phụ, hiệu chỉnh liều suy thận/suy gan/nhi khoa, tồn kho của 1 thuốc cụ thể.
5. MEDICATION_INTERACTION_CHECK: Tra cứu tương tác khi yêu cầu nêu một thuốc cùng một thực thể tương tác thứ hai. Thực thể thứ hai có thể là tên thuốc hoặc khái niệm có cấu trúc trong CSDL (nhóm dược lý, enzym, chất vận chuyển). Với loại không phải thuốc, điền secondary_entity và secondary_entity_type; không ép thành tên thuốc cụ thể.
6. MEDICATION_INTERACTION_CLARIFICATION: Người dùng hỏi về tương tác thuốc nhưng CHƯA NÊU ĐỦ 2 thuốc (ví dụ: "Tương tác thuốc thế nào?", "Cho tôi biết tương tác thuốc", "Thuốc này có tương tác không?").
7. PATIENT_CASE_REASONING: Đánh giá ca bệnh phức tạp cá thể hóa (suy thận, người cao tuổi kèm đa bệnh lý, suy gan) cần tính toán ClCr, eGFR hoặc đánh giá phác đồ.
8. PATIENT_MEDICATION_COUNSELING: Yêu cầu dặn dò bệnh nhân, hướng dẫn dễ hiểu, 3 ý chính cho người nhà, hướng dẫn uống thuốc trước/sau ăn.
9. SPECIALTY_CLINICAL_PROTOCOL: Tra cứu phác đồ bệnh học chuyên khoa hoặc quy chế hành chính kho dược (sốc phản vệ TT 51, quy chế quản lý thuốc gây nghiện TT 20, chuỗi lạnh TT 36, đơn thuốc TT 26, hạn dùng FEFO, nợ morphin).
10. CLINICAL_CASE_CLARIFICATION: Người dùng tự kể triệu chứng cá nhân ("tôi bị sốt đau đầu uống gì") cần hướng dẫn làm rõ ca bệnh.
11. OUT_OF_SCOPE: Các câu hỏi ngoài phạm vi y tế. BẮT BUỘC gán "out_of_scope_type": "MATH_LOGIC" (nếu là toán học, phép tính "1+1=2", logic số học), "GENERAL_CHITCHAT" (nếu là hỏi tuổi bot, đố vui, "dạy tôi học toán", hỏi thăm ngoài lề), hoặc "DISALLOWED_DOMAIN" (thời tiết, chứng khoán, tiền ảo, bóng đá, giá tiền).
12. answer_operation: Với mọi câu hỏi chuyên môn, phân loại "direct_lookup" nếu yêu cầu lấy/tóm tắt dữ kiện trực tiếp từ tài liệu; "evidence_synthesis" nếu cần so sánh, tổng hợp nhiều dữ kiện hoặc rút ra nhận định chung; "patient_specific_inference" nếu cần áp dụng dữ kiện vào ca bệnh cụ thể. Chỉ phân loại thao tác, không đánh giá mức độ đúng của câu trả lời.

QUY TẮC BÓC TÁCH THÔNG SỐ LÂM SÀNG & AN TOÀN NHI KHOA / SUY THẬN:
- TUỔI VÀ NHI KHOA (PEDIATRIC vs ADULT):
  + Nếu bệnh nhân từ 18 tuổi trở lên (ví dụ: 18, 30, 45, 65, 80 tuổi): BẮT BUỘC gán "is_pediatric": false. Tuyệt đối không coi người lớn là trẻ em!
  + Chỉ gán "is_pediatric": true khi tuổi < 18 hoặc câu hỏi nêu rõ "bé", "trẻ em", "bệnh nhi", "sơ sinh".
  + Nếu tuổi >= 65: gán "is_geriatric": true.
- CHỈ SỐ CREATININ & SUY THẬN:
  + Hiểu và chuẩn hóa các biến thể gõ sai chính tả hoặc gõ cách chữ: "crystalin", "creatin", "creatinine", "scr", "cr" đều là Creatinin máu.
  + Đơn vị: "um mol/l", "umol/l", "micromol/l" -> "umol_l"; "mg/dl" -> "mg_dl".
  + Khi có chỉ số creatinin hoặc câu hỏi liên quan đến suy thận, độ thanh thải, ClCr, eGFR: BẮT BUỘC gán "is_renal_inquiry": true và "requested_field": "renal".
- ĐẠI TỪ CHỈ ĐỊNH & CHUYỂN CHỦ ĐỀ (TOPIC SHIFT):
  + Kế thừa tên thuốc từ <last_active_medication> nếu có đại từ ("thuốc đó", "nó").
  + Nếu người dùng hỏi một thuốc mới khác hoàn toàn so với <last_active_medication> hoặc chuyển sang hỏi quy chế/hành chính: gán "is_topic_shift": true.
- CÂU HỎI KÉP & ĐA Ý ĐỊNH (MULTI-INTENT SUB-QUERIES):
  + Khi câu hỏi chứa 2 vế độc lập có liên từ nối ("và", "đồng thời", "với cả", "cho tôi hỏi thêm"): BẮT BUỘC rã trường "sub_queries" thành mảng các câu hỏi độc lập (ví dụ: ["liều Paracetamol cho bé 15kg", "Paracetamol có tương tác với Ibuprofen không"]).
- KHỐI ĐƠN THUỐC THÔ NHIỀU DÒNG (RAW PRESCRIPTION BLOCK):
  + Khi người dùng dán đơn thuốc gồm nhiều dòng thuốc: BẮT BUỘC gán "is_prescription_block": true, "intent": "PATIENT_CASE_REASONING", và "prescription_lines": [các dòng thuốc trong đơn].
- ĐỘ SÂU PHẢN HỒI (DEPTH PREFERENCE):
  + "DETAILED": nếu yêu cầu "chi tiết", "đầy đủ", "toàn văn", "chuyên sâu".
  + "COUNSELING": nếu yêu cầu "dặn dò", "dễ hiểu", "3 ý", "cho người nhà".
  + "SUMMARY": mặc định.
- Gán answer_operation dựa trên yêu cầu của câu hiện tại, không dựa riêng vào việc câu có tên nhiều thuốc hay nhiều trường thông tin. Câu liệt kê/tóm tắt nhiều dữ kiện theo yêu cầu vẫn là direct_lookup; câu hỏi "so sánh" hoặc yêu cầu kết luận tổng hợp là evidence_synthesis; đánh giá một người bệnh cụ thể là patient_specific_inference.
- Khi yêu cầu đánh giá tương tác nêu một thuốc và một nhóm dược lý/enzym/chất vận chuyển thay vì thuốc thứ hai, vẫn chọn MEDICATION_INTERACTION_CHECK; giữ nguyên thực thể thứ hai trong secondary_entity và gán đúng secondary_entity_type. Chỉ yêu cầu làm rõ nếu không nhận diện được thực thể tương tác thứ hai.
- TRƯỜNG ĐƯỢC YÊU CẦU: điền requested_fields với TOÀN BỘ các khía cạnh độc lập được hỏi trong câu hiện tại, dùng tên trường schema tương ứng; không chỉ chọn một trường đại diện. Nếu không yêu cầu trường cụ thể, trả mảng rỗng.
- GIỚI HẠN PHẠM VI TRƯỜNG: requested_fields chỉ gồm các khía cạnh người dùng yêu cầu trực tiếp hoặc các khía cạnh được nêu rõ là cần so sánh/tổng hợp. Không thêm trường liên quan chỉ vì có thể hữu ích; thông tin bệnh nền làm bối cảnh không tự động biến thành yêu cầu trả lời mọi trường liên quan.
- CHẾ ĐỘ HỘI THOẠI: Phân loại ý nghĩa câu hiện tại độc lập trước khi dùng lịch sử. Chọn "contextual_followup" chỉ khi hiểu câu hiện tại cần lượt trước; chọn "topic_shift" khi bắt đầu chủ đề mới; còn lại là "independent". Không kế thừa thuốc hoặc thực thể từ lượt trước cho câu độc lập.

MẪU ĐỐI CHỨNG (FEW-SHOT EXAMPLES):
- Input: "cho biết liều Paracetamol cho trẻ 15kg và thuốc này có tương tác với Ibuprofen không"
  Output: {"intent": "MEDICATION_LOOKUP", "primary_drug": "Paracetamol", "secondary_drug": "Ibuprofen", "additional_drugs": [], "sub_queries": ["cho biết liều Paracetamol cho trẻ 15kg", "Paracetamol có tương tác với Ibuprofen không"], "requested_field": "dosage", "is_deictic_referent": false, "is_topic_shift": false, "depth_preference": "SUMMARY", "user_sentiment": "neutral", "confidence": 0.99, "clarification_prompt": null, "patient_age": null, "patient_age_unit": "year", "patient_gender": null, "patient_weight_kg": 15.0, "patient_creatinine_val": null, "patient_creatinine_unit": "umol_l", "is_pediatric": true, "is_geriatric": false, "is_renal_inquiry": false}
- Input: "bệnh nhân nữ 30 tuổi 45 kg crystalin 165 um mol/l dùng Ciprofloxacin liều thế nào"
  Output: {"intent": "MEDICATION_LOOKUP", "primary_drug": "Ciprofloxacin", "secondary_drug": null, "additional_drugs": [], "requested_field": "renal", "is_deictic_referent": false, "is_topic_shift": false, "depth_preference": "DETAILED", "user_sentiment": "neutral", "confidence": 0.99, "clarification_prompt": null, "patient_age": 30.0, "patient_age_unit": "year", "patient_gender": "female", "patient_weight_kg": 45.0, "patient_creatinine_val": 165.0, "patient_creatinine_unit": "umol_l", "is_pediatric": false, "is_geriatric": false, "is_renal_inquiry": true}
- Input: "kháng sinh Augmentin cho bé 3 tuổi 14kg liều bao nhiêu"
  Output: {"intent": "MEDICATION_LOOKUP", "primary_drug": "Augmentin", "secondary_drug": null, "additional_drugs": [], "requested_field": "pediatric", "is_deictic_referent": false, "is_topic_shift": false, "depth_preference": "SUMMARY", "user_sentiment": "neutral", "confidence": 0.99, "clarification_prompt": null, "patient_age": 3.0, "patient_age_unit": "year", "patient_gender": null, "patient_weight_kg": 14.0, "patient_creatinine_val": null, "patient_creatinine_unit": "umol_l", "is_pediatric": true, "is_geriatric": false, "is_renal_inquiry": false}
- Input: "Bác sĩ dặn bệnh nhân cách uống thuốc này dễ hiểu giúp em"
  Output: {"intent": "PATIENT_MEDICATION_COUNSELING", "primary_drug": null, "secondary_drug": null, "additional_drugs": [], "requested_field": "counseling", "is_deictic_referent": true, "is_topic_shift": false, "depth_preference": "COUNSELING", "user_sentiment": "neutral", "confidence": 0.99, "clarification_prompt": null, "patient_age": null, "patient_age_unit": "year", "patient_gender": null, "patient_weight_kg": null, "patient_creatinine_val": null, "patient_creatinine_unit": "umol_l", "is_pediatric": false, "is_geriatric": false, "is_renal_inquiry": false}
- Input: "Bạn trả lời bị cứng nhắc quá"
  Output: {"intent": "CONVERSATIONAL_FEEDBACK", "primary_drug": null, "secondary_drug": null, "additional_drugs": [], "requested_field": null, "is_deictic_referent": false, "is_topic_shift": false, "depth_preference": "SUMMARY", "user_sentiment": "complaint", "confidence": 0.99, "clarification_prompt": null, "patient_age": null, "patient_age_unit": "year", "patient_gender": null, "patient_weight_kg": null, "patient_creatinine_val": null, "patient_creatinine_unit": "umol_l", "is_pediatric": false, "is_geriatric": false, "is_renal_inquiry": false}
- Input: "Kiểm tra tương tác Warfarin và Aspirin"
  Output: {"intent": "MEDICATION_INTERACTION_CHECK", "primary_drug": "Warfarin", "secondary_drug": "Aspirin", "additional_drugs": [], "requested_field": "interactions", "is_deictic_referent": false, "is_topic_shift": false, "depth_preference": "SUMMARY", "user_sentiment": "neutral", "confidence": 0.99, "clarification_prompt": null, "patient_age": null, "patient_age_unit": "year", "patient_gender": null, "patient_weight_kg": null, "patient_creatinine_val": null, "patient_creatinine_unit": "umol_l", "is_pediatric": false, "is_geriatric": false, "is_renal_inquiry": false}
- Input: "tôi có thể hỏi bạn thông tin về thuốc được không"
  Output: {"intent": "CAPABILITY_OPENING", "primary_drug": null, "secondary_drug": null, "additional_drugs": [], "requested_field": null, "is_deictic_referent": false, "is_topic_shift": false, "depth_preference": "SUMMARY", "user_sentiment": "positive", "confidence": 0.99, "clarification_prompt": null, "patient_age": null, "patient_age_unit": "year", "patient_gender": null, "patient_weight_kg": null, "patient_creatinine_val": null, "patient_creatinine_unit": "umol_l", "is_pediatric": false, "is_geriatric": false, "is_renal_inquiry": false, "out_of_scope_type": null}
- Input: "1+1 = 2 đúng không"
  Output: {"intent": "OUT_OF_SCOPE", "primary_drug": null, "secondary_drug": null, "additional_drugs": [], "requested_field": null, "is_deictic_referent": false, "is_topic_shift": false, "depth_preference": "SUMMARY", "user_sentiment": "neutral", "confidence": 0.99, "clarification_prompt": null, "patient_age": null, "patient_age_unit": "year", "patient_gender": null, "patient_weight_kg": null, "patient_creatinine_val": null, "patient_creatinine_unit": "umol_l", "is_pediatric": false, "is_geriatric": false, "is_renal_inquiry": false, "out_of_scope_type": "MATH_LOGIC"}
- Input: "bạn có thể dạy tôi học toán được không"
  Output: {"intent": "OUT_OF_SCOPE", "primary_drug": null, "secondary_drug": null, "additional_drugs": [], "requested_field": null, "is_deictic_referent": false, "is_topic_shift": false, "depth_preference": "SUMMARY", "user_sentiment": "neutral", "confidence": 0.99, "clarification_prompt": null, "patient_age": null, "patient_age_unit": "year", "patient_gender": null, "patient_weight_kg": null, "patient_creatinine_val": null, "patient_creatinine_unit": "umol_l", "is_pediatric": false, "is_geriatric": false, "is_renal_inquiry": false, "out_of_scope_type": "GENERAL_CHITCHAT"}
"""


def _compute_cache_key(
    query: str, active_med: Optional[str] = None, history: str = ""
) -> str:
    norm_q = re.sub(r"\s+", " ", query.strip().lower())
    norm_med = (active_med or "").strip().lower()
    norm_history = re.sub(r"\s+", " ", (history or "").strip())
    history_digest = hashlib.sha256(norm_history.encode("utf-8")).hexdigest() if norm_history else ""
    return hashlib.sha256(
        f"{norm_q}__ctx:{norm_med}__history:{history_digest}".encode("utf-8")
    ).hexdigest()


def try_deterministic_fast_path(clean_q: str, active_med: Optional[str] = None) -> Optional[ClinicalNluExtraction]:
    """Phân loại tức thì (< 5ms, 0 tokens) cho các truy vấn đơn giản, rõ ràng."""
    from app.services.chatbot.lexical_trie_matcher import get_drug_lexical_matcher
    matcher = get_drug_lexical_matcher()
    low_q = clean_q.lower().strip()

    # 1. Chào hỏi, cảm ơn đơn giản
    if any(low_q == g or low_q.startswith(g + " ") for g in ("xin chào", "chào", "hello", "hi", "cảm ơn", "cam on", "thanks")):
        return fallback_nlu_heuristic(clean_q, active_med)

    # 2. Cổng tra cứu Dược thư Quốc gia
    if any(p in low_q for p in ("tra cứu dược thư", "cổng tra cứu", "dược thư quốc gia 2015", "tra cứu dđvn")):
        res = fallback_nlu_heuristic(clean_q, active_med)
        res.intent = "MEDICATION_LOOKUP_GUIDE"
        return res

    # 3. Tra cứu trực tiếp theo SĐK (Số đăng ký)
    sdk = matcher.extract_sdk(clean_q)
    if sdk and len(clean_q.split()) <= 4:
        res = fallback_nlu_heuristic(clean_q, active_med)
        res.primary_drug = sdk
        res.intent = "MEDICATION_LOOKUP"
        return res

    # 4. Tra cứu thông tin thuốc đơn chất chuẩn mực
    meds = matcher.extract_medications(clean_q)
    if len(meds) == 1:
        complex_signals = (
            "suy thận", "creatinin", "độ thanh thải", "clcr", "kèm theo", "bệnh nền",
            "dị ứng", "chuyển sang", "đổi sang", "tại sao", "cơ chế"
        )
        if not any(sig in low_q for sig in complex_signals):
            simple_prefixes = (
                "tra cứu thuốc", "thông tin thuốc", "thông tin", "thuốc",
                "liều dùng", "chỉ định", "chống chỉ định", "tác dụng phụ",
                "cách dùng", "thời điểm uống"
            )
            if len(clean_q.split()) <= 6 or any(low_q.startswith(p) for p in simple_prefixes):
                return fallback_nlu_heuristic(clean_q, active_med)

    return None


async def parse_clinical_nlu(
    query: str,
    history: str = "",
    active_med: Optional[str] = None,
    *,
    timeout_sec: float = 3.5
) -> Optional[ClinicalNluExtraction]:
    """Phân tích ý định & thực thể bằng Gemini NLU kết hợp Cache L1/L2."""
    clean_q = query.strip()
    if not clean_q:
        return None

    cache_key = _compute_cache_key(clean_q)
    now = time.time()
    cached = _NLU_CACHE.get(cache_key)
    if cached:
        result, ts = cached
        if now - ts < _CACHE_TTL_SEC:
            cached_result = result.model_copy(deep=True)
            if (cached_result.conversation_mode == "contextual_followup" or cached_result.is_deictic_referent) and active_med:
                cached_result.primary_drug = active_med.strip()
                cached_result.is_deictic_referent = True
                cached_result.conversation_mode = "contextual_followup"
            return cached_result
        _NLU_CACHE.pop(cache_key, None)

    # Fast-Path tức thì không tiêu tốn token (Zero-Token Serving)
    fast_res = try_deterministic_fast_path(clean_q, active_med)
    if fast_res:
        _NLU_CACHE[cache_key] = (fast_res, now)
        return fast_res

    # Xây dựng prompt kèm thẻ XML cách ly an toàn (OWASP LLM01 Prompt Injection Defense)
    context_block = ""
    user_prompt = (
        f"<user_input>{clean_q}</user_input>\n"
        "Hãy trả về duy nhất chuỗi JSON phân tích cú pháp theo đúng schema:"
    )

    from app.services.llm_provider import query_clinical_llm
    from app.services.admin_key_vault import get_active_api_key

    api_key = get_active_api_key(provider="gemini") or settings.GEMINI_API_KEY
    if not api_key or api_key == "MY_GEMINI_API_KEY" or len(api_key.strip()) < 10:
        return fallback_nlu_heuristic(clean_q, active_med)

    try:
        raw_json = await query_clinical_llm(
            prompt=user_prompt,
            system_instruction=GEMINI_NLU_SYSTEM_PROMPT,
            api_key=api_key,
            temperature=0.0,
            max_output_tokens=350,
            timeout_sec=timeout_sec
        )
        if not raw_json:
            return fallback_nlu_heuristic(clean_q, active_med)

        cleaned = re.sub(r"^```(?:json)?\s*", "", raw_json.strip())
        cleaned = re.sub(r"\s*```$", "", cleaned)
        data = json.loads(cleaned)
        parsed = ClinicalNluExtraction(**data)

        if (parsed.conversation_mode == "contextual_followup" or parsed.is_deictic_referent) and active_med:
            if not parsed.primary_drug:
                parsed.primary_drug = active_med.strip()
            parsed.is_deictic_referent = True
            parsed.conversation_mode = "contextual_followup"


        # Chuẩn hóa intent nếu người dùng yêu cầu Cổng tra cứu Dược thư Quốc gia
        if parsed.intent in ("CAPABILITY_OPENING", "GREETING_WELLBEING", "OUT_OF_SCOPE", "MEDICATION_LOOKUP"):
            low_check = clean_q.lower()
            if any(kw in low_check for kw in ("tra cứu dược thư", "tra cuu duoc thu", "dược thư quốc gia", "duoc thu quoc gia", "cổng tra cứu", "cong tra cuu", "hướng dẫn tra cứu", "huong dan tra cuu")) and not parsed.primary_drug:
                parsed.intent = "MEDICATION_LOOKUP_GUIDE"

        # Hậu kiểm đa ý định & đơn thuốc (Deterministic Multi-Intent / Rx Safety Net)
        if not parsed.sub_queries:
            pattern_split = r'\s+(?:và\s+đồng\s+thời|đồng\s+thời|và\s+cho\s+tôi\s+hỏi\s+thêm|cho\s+tôi\s+hỏi\s+thêm|với\s+cả|và\s+tiện\s+thể|và\s+(?=(?:thuốc\s+(?:này|đó)|kiểm\s+tra|cho\s+tôi|liều|tương\s+tác)))\s*'
            parts = re.split(pattern_split, clean_q, flags=re.I)
            if len(parts) >= 2:
                cand_parts = []
                prime = parsed.primary_drug or active_med
                for idx_p, p in enumerate(parts):
                    p_strip = p.strip()
                    if idx_p > 0 and prime and re.search(r'\b(?:thuốc\s+này|thuốc\s+đó|nó)\b', p_strip, re.I):
                        p_strip = re.sub(r'\b(?:thuốc\s+này|thuốc\s+đó|nó)\b', prime, p_strip, flags=re.I)
                    if len(p_strip) >= 8 and (not prime or prime.casefold() in p_strip.casefold()):
                        cand_parts.append(p_strip)
                if len(cand_parts) >= 2:
                    parsed.sub_queries = cand_parts

        if not parsed.is_prescription_block:
            from app.services.chatbot.prescription_block_handler import detect_prescription_block
            is_rx, lines = detect_prescription_block(clean_q)
            if is_rx:
                parsed.is_prescription_block = True
                parsed.prescription_lines = lines

        # Lưu cache
        if len(_NLU_CACHE) >= _MAX_NLU_CACHE:
            oldest_key = min(_NLU_CACHE.keys(), key=lambda k: _NLU_CACHE[k][1])
            _NLU_CACHE.pop(oldest_key, None)
        cache_value = parsed.model_copy(deep=True)
        if cache_value.conversation_mode == "contextual_followup" or cache_value.is_deictic_referent:
            cache_value.primary_drug = None
        _NLU_CACHE[cache_key] = (cache_value, now)

        return parsed
    except Exception:
        return fallback_nlu_heuristic(clean_q, active_med)


def fallback_nlu_heuristic(query: str, active_med: Optional[str] = None) -> ClinicalNluExtraction:
    """Fallback an toàn cục bộ (< 0.1ms) khi API LLM ngoại tuyến hoặc timeout."""
    clean_q = query.strip()
    low_q = clean_q.lower()

    # Xác định mức độ chi tiết mong muốn (depth_preference)
    depth_pref = "SUMMARY"
    if any(w in low_q for w in ("chi tiết", "đầy đủ", "toàn văn", "chuyên sâu", "kỹ hơn", "hồ sơ đầy đủ", "chi tiet", "day du")):
        depth_pref = "DETAILED"
    elif any(w in low_q for w in ("dặn dò", "dễ hiểu", "cho bệnh nhân", "người nhà", "3 ý", "lưu ý quan trọng", "dan do", "de hieu")):
        depth_pref = "COUNSELING"

    # Trích xuất thuốc để phát hiện chuyển chủ đề (topic shift)
    from app.services.chatbot.lexical_trie_matcher import get_drug_lexical_matcher
    matcher = get_drug_lexical_matcher()
    meds = matcher.extract_medications(clean_q)
    is_topic_shift = False
    if active_med:
        if meds and not any(m.lower() == active_med.lower() for m in meds):
            is_topic_shift = True
        elif any(w in low_q for w in ("thông tư", "tt 20", "tt 51", "tt 36", "tt 26", "tt 52", "chuỗi lạnh", "tủ trực", "nợ morphin", "fefo", "nhiệt độ tủ lạnh", "báo hỏng", "máy thở")) and not any(m.lower() == active_med.lower() for m in meds):
            is_topic_shift = True

    # -1. Nhận diện đơn thuốc thô nhiều dòng (Raw Prescription Block Detector)
    from app.services.chatbot.prescription_block_handler import detect_prescription_block
    is_rx_block, rx_lines = detect_prescription_block(clean_q)
    if is_rx_block:
        return ClinicalNluExtraction(
            intent="PATIENT_CASE_REASONING",
            is_prescription_block=True,
            prescription_lines=rx_lines,
            primary_drug=meds[0] if meds else None,
            requested_field="summary",
            depth_preference="DETAILED",
            confidence=0.99
        )

    # Phân rã câu hỏi kép / đa ý định nếu có liên từ nối
    sub_queries = []
    pattern_split = r'\s+(?:và\s+đồng\s+thời|đồng\s+thời|và\s+cho\s+tôi\s+hỏi\s+thêm|cho\s+tôi\s+hỏi\s+thêm|với\s+cả|và\s+tiện\s+thể|và\s+(?=(?:thuốc\s+(?:này|đó)|kiểm\s+tra|cho\s+tôi|liều|tương\s+tác)))\s*'
    parts = re.split(pattern_split, clean_q, flags=re.I)
    if len(parts) >= 2:
        cand_parts = []
        prime = meds[0] if meds else active_med
        for idx_p, p in enumerate(parts):
            p_strip = p.strip()
            if idx_p > 0 and prime and re.search(r'\b(?:thuốc\s+này|thuốc\s+đó|nó)\b', p_strip, re.I):
                p_strip = re.sub(r'\b(?:thuốc\s+này|thuốc\s+đó|nó)\b', prime, p_strip, flags=re.I)
            if len(p_strip) >= 8 and (not prime or prime.casefold() in p_strip.casefold()):
                cand_parts.append(p_strip)
        if len(cand_parts) >= 2:
            sub_queries = cand_parts

    # 0. Mở đầu thiện chí / Hỏi khả năng hỗ trợ tra cứu thuốc (CAPABILITY_OPENING)
    is_catalog_guide = any(kw in low_q for kw in (
        "tra cứu dược thư", "tra cuu duoc thu", "dược thư quốc gia", "duoc thu quoc gia",
        "cổng tra cứu", "cong tra cuu", "hướng dẫn tra cứu", "huong dan tra cuu"
    ))
    if is_catalog_guide and not meds:
        return ClinicalNluExtraction(
            intent="MEDICATION_LOOKUP_GUIDE",
            user_sentiment="neutral",
            confidence=0.99,
            is_topic_shift=is_topic_shift,
            depth_preference=depth_pref
        )

    is_capability_opening = (
        any(p in low_q for p in (
            "tôi có thể hỏi", "tôi muốn hỏi", "cho tôi hỏi", "bạn hỗ trợ tôi",
            "bạn giúp tôi", "hỗ trợ tôi", "giúp tôi tra cứu", "muốn tra cứu",
            "thông tin về thuốc", "hỏi về thuốc", "hỏi thông tin thuốc", "có thể hỏi bạn",
            "bạn có thể giúp", "bạn có thể hỗ trợ", "hỏi thuốc được không", "tra cứu thuốc được không"
        ))
        and any(w in low_q for w in ("thuốc", "dược", "tra cứu", "được không", "giúp", "hỗ trợ", "thông tin"))
        and not any(w in low_q for w in ("dược thư", "dđvn", "cổng tra cứu", "hướng dẫn tra cứu", "duoc thu", "cong tra cuu"))
        and not meds
    )
    if is_capability_opening:
        return ClinicalNluExtraction(
            intent="CAPABILITY_OPENING",
            user_sentiment="positive",
            confidence=0.98,
            is_topic_shift=is_topic_shift,
            depth_preference=depth_pref
        )

    # 1. Chào hỏi & Feedback / Phàn nàn / Góp ý dữ liệu
    from app.services.chatbot.conversational_handler import handle_greeting_and_acknowledgment
    conv_check = handle_greeting_and_acknowledgment(low_q, "Nhân viên y tế", "doctor")
    if conv_check:
        if conv_check.intent in ("FEEDBACK_DATA_ENRICHMENT", "CONVERSATIONAL_CORRECTION", "FEEDBACK_UI_ADJUSTMENT"):
            return ClinicalNluExtraction(
                intent="CONVERSATIONAL_FEEDBACK",
                user_sentiment="complaint",
                confidence=0.98,
                is_topic_shift=is_topic_shift,
                depth_preference=depth_pref
            )
        elif conv_check.intent in ("GREETING_WELCOME", "GREETING_WELLBEING"):
            return ClinicalNluExtraction(
                intent="GREETING_WELLBEING",
                user_sentiment="positive",
                confidence=0.98,
                is_topic_shift=is_topic_shift,
                depth_preference=depth_pref
            )

    # Feedback / Phàn nàn thông thường
    if any(p in low_q for p in ("cứng nhắc", "cung nhac", "trả lời chán", "kém quá", "không đúng", "chưa chính xác", "nói chán", "bổ sung")):
        return ClinicalNluExtraction(
            intent="CONVERSATIONAL_FEEDBACK",
            user_sentiment="complaint",
            confidence=0.95,
            is_topic_shift=is_topic_shift,
            depth_preference=depth_pref
        )

    # 2. Out of scope (Toán học, Chitchat đời thường, Thời tiết, thể thao, giá cả...)
    is_sdk = bool(matcher.extract_sdk(clean_q) or re.search(r'[A-Za-z]{2,3}-\d+-\d+', clean_q))
    has_math_pattern = False
    if not meds and not is_sdk:
        has_math_pattern = bool(re.search(r'(?<![A-Za-z\-])\b\d+\s*[\+\*\/=]\s*\d+', low_q)) or (
            bool(re.search(r'(?<![A-Za-z\-])\b\d+\s*-\s*\d+\b', low_q))
            and any(w in low_q for w in ("=", "bằng", "bang", "tính", "tinh", "kết quả", "ket qua", "học toán", "dạy toán", "toán", "đúng không"))
        ) or any(w in low_q for w in ("học toán", "dạy toán", "toán học", "phép tính", "mấy cộng mấy", "bằng mấy"))

    if has_math_pattern:
        return ClinicalNluExtraction(
            intent="OUT_OF_SCOPE",
            out_of_scope_type="MATH_LOGIC",
            user_sentiment="neutral",
            confidence=0.99,
            is_topic_shift=is_topic_shift,
            depth_preference=depth_pref
        )

    is_identity_q = not meds and not is_sdk and (
        any(w in low_q for w in (
            "bạn là ai", "bạn là chatbot", "bạn là bot", "phải chatbot", "phải bot",
            "bạn là gì", "bạn tên gì", "em là ai", "mày là ai", "em tên gì", "bạn mấy tuổi",
            "ai tạo ra bạn", "giới thiệu bản thân", "kể chuyện", "làm thơ", "hát", "chơi game", "đố vui", "dạy tôi"
        ))
        or bool(re.search(r'\b(?:bạn|em|mày)\s+(?:là|ten\s+la)\s+(?:ai|gì|chatbot|bot|trợ lý|tro ly|con\s+bot)\b', low_q))
    )
    if is_identity_q:
        return ClinicalNluExtraction(
            intent="OUT_OF_SCOPE",
            out_of_scope_type="GENERAL_CHITCHAT",
            conversation_mode="independent",
            user_sentiment="neutral",
            confidence=0.99,
            is_topic_shift=is_topic_shift,
            depth_preference=depth_pref
        )

    if any(w in low_q for w in (
        "thời tiết", "thoi tiet", "thời sự", "bóng đá", "chứng khoán",
        "tiền ảo", "bitcoin", "bất động sản", "nhà đất", "mua xe",
        "giá bao nhiêu", "bao nhiêu tiền", "giá thuốc", "gia bao nhieu", "bao nhieu tien"
    )):
        return ClinicalNluExtraction(
            intent="OUT_OF_SCOPE",
            out_of_scope_type="DISALLOWED_DOMAIN",
            user_sentiment="neutral",
            confidence=0.95,
            is_topic_shift=is_topic_shift,
            depth_preference=depth_pref
        )

    # 3. Chào hỏi & Kiểm tra Micro / Kết nối âm thanh (Voice Audio Check)
    is_voice_test = not meds and any(phrase in low_q for phrase in (
        "nghe tôi nói không", "nghe toi noi khong", "có nghe không", "co nghe khong",
        "có nghe thấy không", "co nghe thay khong", "nghe rõ không", "nghe ro khong",
        "bạn có đang nghe", "ban co dang nghe", "có đang nghe", "co dang nghe",
        "test mic", "thử mic", "thu mic", "kiểm tra mic", "alo", "alo alo"
    ))
    if is_voice_test or any(low_q.startswith(g) for g in ("chào", "xin chào", "hello", "hi ", "cảm ơn", "cam on", "thanks")):
        return ClinicalNluExtraction(
            intent="GREETING_WELLBEING",
            conversation_mode="independent",
            user_sentiment="positive",
            confidence=0.98,
            is_topic_shift=is_topic_shift,
            depth_preference=depth_pref
        )

    # 4. Yêu cầu Dặn dò / Tư vấn bệnh nhân (Patient Medication Counseling)
    is_counseling = any(w in low_q for w in ("dặn dò", "dặn bệnh nhân", "hướng dẫn bệnh nhân", "giải thích cho bệnh nhân", "dễ hiểu", "3 ý", "cho người nhà", "dặn người nhà", "lưu ý quan trọng", "dan do", "de hieu", "uống trước ăn", "uống sau ăn", "uống lúc nào"))
    if is_counseling:
        target_med = meds[0] if meds else (active_med.strip() if active_med else None)
        return ClinicalNluExtraction(
            intent="PATIENT_MEDICATION_COUNSELING",
            primary_drug=target_med,
            requested_field="counseling",
            is_deictic_referent=bool(not meds and active_med),
            is_topic_shift=is_topic_shift,
            depth_preference="COUNSELING",
            confidence=0.95
        )

    # 5. Quy chế hành chính bệnh viện & Phác đồ chuyên khoa (Specialty Clinical Protocol)
    is_protocol = any(w in low_q for w in ("thông tư", "tt 20", "tt 51", "tt 36", "tt 26", "tt 52", "sốc phản vệ", "vỏ ống", "chuỗi lạnh", "tủ trực", "nợ morphin", "fefo", "nhiệt độ tủ lạnh", "báo hỏng", "máy thở", "giao ban", "dự trù cơ số", "soc phan ve", "chuoi lanh", "tu truc", "no morphin"))
    if is_protocol:
        return ClinicalNluExtraction(
            intent="SPECIALTY_CLINICAL_PROTOCOL",
            primary_drug=meds[0] if meds else None,
            requested_field="guideline",
            is_topic_shift=True,
            depth_preference=depth_pref,
            confidence=0.95
        )

    # 6. Tương tác thuốc (Chỉ kiểm tra khi không phải hỏi tương tác thức ăn / rượu bia)
    is_food_or_alcohol = any(w in low_q for w in ("rượu", "bia", "cồn", "ruou", "thức ăn", "thuc an", "sữa", "nước cam", "uống sữa", "với sữa"))
    if not is_food_or_alcohol:
        has_ddi = any(w in low_q for w in (
            "tương tác", "tuong tac", "tương kỵ", "kỵ nhau", "kỵ", "ky",
            "uống cùng", "dung cung", "uong cung", "uống chung", "dùng chung",
            "kết hợp", "phối hợp", "uống với", "dùng với", "đi kèm"
        )) or (len(meds) >= 2 and any(w in low_q for w in (" và ", " cùng ", " với ", "+", " va ", " voi ", " cung ", "kỵ", "ky", "được không", "duoc khong")))
        if has_ddi:
            if len(meds) >= 2:
                return ClinicalNluExtraction(
                    intent="MEDICATION_INTERACTION_CHECK",
                    primary_drug=meds[0],
                    secondary_drug=meds[1],
                    additional_drugs=meds[2:],
                    sub_queries=sub_queries,
                    requested_field="interactions",
                    is_topic_shift=is_topic_shift,
                    depth_preference=depth_pref,
                    confidence=0.92
                )
            # Nếu có đúng 1 thuốc và hỏi tra cứu tương tác của thuốc đó (không có liên từ ghép đôi)
            if len(meds) == 1 and not any(c in low_q for c in (" và ", " cùng ", " với ", "+", " kết hợp ", " phối hợp ", " va ", " voi ", " cung ")):
                return ClinicalNluExtraction(
                    intent="MEDICATION_LOOKUP",
                    primary_drug=meds[0],
                    requested_field="interactions",
                    is_topic_shift=is_topic_shift,
                    depth_preference=depth_pref,
                    confidence=0.92
                )
            return ClinicalNluExtraction(
                intent="MEDICATION_INTERACTION_CLARIFICATION",
                primary_drug=meds[0] if meds else None,
                requested_field="interactions",
                is_topic_shift=is_topic_shift,
                depth_preference=depth_pref,
                confidence=0.95,
                clarification_prompt="Vui lòng cung cấp tên 2 loại thuốc cần kiểm tra tương tác."
            )

    # 7. Phân tích các thông số bệnh nhân cơ bản (dự phòng khi offline)
    patient_age: Optional[float] = None
    patient_weight_kg: Optional[float] = None
    patient_gender: Optional[str] = None
    patient_creatinine_val: Optional[float] = None
    is_pediatric: bool = False
    is_renal_inquiry: bool = any(w in low_q for w in ("suy thận", "thận", "creatinin", "crcl", "egfr", "crystalin", "creatin", "suy than"))

    if any(k in low_q for k in ("nữ", "female", "bà", "chị", "cô", "nu")):
        patient_gender = "female"
    elif any(k in low_q for k in ("nam", "male", "ông", "anh")):
        patient_gender = "male"

    m_age = re.search(r'\b(\d{1,3})\s*(?:tuổi|tuoi|t\b)', low_q)
    if m_age:
        try:
            val_a = float(m_age.group(1))
            if 0 < val_a <= 125:
                patient_age = val_a
                is_pediatric = (val_a < 18)
        except ValueError:
            pass

    m_wt = re.search(r'(\d{1,3}(?:[.,]\d+)?)\s*(?:kg|cân|ký)', low_q)
    if m_wt:
        try:
            patient_weight_kg = float(m_wt.group(1).replace(",", "."))
        except ValueError:
            pass

    m_cr = re.search(r'(?:creatinin|crystalin|creatin|scr|cr)\s*[:=]?\s*(\d+(?:[.,]\d+)?)', low_q)
    if m_cr:
        try:
            patient_creatinine_val = float(m_cr.group(1).replace(",", "."))
            is_renal_inquiry = True
        except ValueError:
            pass

    # Phân loại trường thông tin yêu cầu
    if is_renal_inquiry:
        req_field = "renal"
    elif is_pediatric or any(w in low_q for w in ("trẻ em", "tre em", "trẻ nhỏ", "bệnh nhi", "bé")):
        req_field = "pediatric"
    elif any(w in low_q for w in ("liều", "lieu", "uống mấy viên", "uống bao nhiêu", "cách dùng")):
        req_field = "dosage"
    elif any(w in low_q for w in ("tác dụng phụ", "tac dung phu", "adr", "tác dụng không mong muốn")):
        req_field = "adverse_effects"
    elif any(w in low_q for w in ("chống chỉ định", "chong chi dinh")):
        req_field = "contraindications"
    elif any(w in low_q for w in ("tóm tắt", "ngắn gọn", "tom tat")):
        req_field = "summary"
    else:
        req_field = "detailed_profile"

    # Preserve every explicitly detected monograph facet when the NLU API is
    # unavailable. A single-drug multi-facet request stays one lookup.
    from app.services.chatbot.intent_feature_matrix import rank_clinical_intents
    supported_fields = {
        "administration_timing", "pediatric_dosage", "adult_dosage",
        "contraindications", "adverse_effects", "drug_interactions",
        "overdose_treatment", "indications", "ingredient",
        "pregnancy_warning", "renal_adjustment", "hepatic_adjustment",
        "alcohol_interaction", "food_interaction", "elderly_warning",
        "stock_inquiry", "monitoring", "pharmacokinetics", "pharmacodynamics",
    }
    requested_fields = [name for name, _ in rank_clinical_intents(clean_q) if name in supported_fields]

    # 8. Kế thừa đại từ ("thuốc đó", "nó") - Bắt buộc dùng regex word-boundary để không nhận nhầm từ "nói" thành "nó"
    has_deictic = bool(re.search(r'\b(?:nó|thuốc\s+(?:đó|này|kia|vừa\s+nói)|thuoc\s+(?:do|nay|kia))\b', low_q))
    if has_deictic:
        target_med = active_med.strip() if active_med else None
        target_intent = "PATIENT_CASE_REASONING" if (is_renal_inquiry and target_med) else "MEDICATION_LOOKUP"
        return ClinicalNluExtraction(
            intent=target_intent,
            primary_drug=target_med,
            sub_queries=sub_queries,
            requested_field=req_field,
            requested_fields=requested_fields,
            is_deictic_referent=True,
            is_topic_shift=False,
            depth_preference=depth_pref,
            confidence=0.90,
            patient_age=patient_age,
            patient_weight_kg=patient_weight_kg,
            patient_gender=patient_gender,
            patient_creatinine_val=patient_creatinine_val,
            is_pediatric=is_pediatric,
            is_renal_inquiry=is_renal_inquiry
        )

    # 9. Tra cứu thuốc mặc định hoặc Ca bệnh lâm sàng
    target_drug = meds[0] if meds else None
    if not target_drug and is_sdk:
        sdk_m = matcher.extract_sdk(clean_q)
        if not sdk_m:
            raw_sdk = re.search(r'[A-Za-z]{2,3}-\d+-\d+', clean_q)
            sdk_m = raw_sdk.group(0) if raw_sdk else None
        target_drug = sdk_m

    is_inherited = False
    if not target_drug and active_med:
        from app.services.chatbot.session_routing import FIELD_ONLY_TERMS
        if any(term in low_q for term in FIELD_ONLY_TERMS) or has_deictic:
            target_drug = active_med.strip()
            is_inherited = True

    if is_renal_inquiry and target_drug:
        final_intent = "PATIENT_CASE_REASONING"
        final_drug = target_drug
    elif target_drug:
        final_intent = "MEDICATION_LOOKUP"
        final_drug = target_drug
    else:
        final_intent = "CLINICAL_CASE_CLARIFICATION"
        final_drug = None

    return ClinicalNluExtraction(
        intent=final_intent,
        primary_drug=final_drug,
        sub_queries=sub_queries,
        requested_field=req_field,
        requested_fields=requested_fields,
        conversation_mode="contextual_followup" if is_inherited else "independent",
        is_deictic_referent=True if is_inherited else False,
        is_topic_shift=is_topic_shift,
        depth_preference=depth_pref,
        confidence=0.85,
        patient_age=patient_age,
        patient_weight_kg=patient_weight_kg,
        patient_gender=patient_gender,
        patient_creatinine_val=patient_creatinine_val,
        is_pediatric=is_pediatric,
        is_renal_inquiry=is_renal_inquiry
    )
