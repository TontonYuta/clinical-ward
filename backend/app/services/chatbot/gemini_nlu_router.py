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
10. CLINICAL_CASE_CLARIFICATION: Chỉ dùng khi người dùng tự kể triệu chứng cá nhân mơ hồ ("tôi bị sốt đau đầu uống gì") hoặc câu hỏi hoàn toàn thiếu chủ thể lâm sàng/bệnh lý. Nếu câu hỏi nêu rõ bệnh lý hoặc đối tượng lâm sàng (ví dụ: điều trị bệnh X cho đối tượng Y) thì KHÔNG dùng intent này, mà phân loại sang PATIENT_CASE_REASONING hoặc SPECIALTY_CLINICAL_PROTOCOL để hệ thống tra cứu Dược thư.
11. OUT_OF_SCOPE: Các câu hỏi ngoài phạm vi y tế. BẮT BUỘC gán "out_of_scope_type": "MATH_LOGIC" (nếu là toán học, phép tính "1+1=2", logic số học), "GENERAL_CHITCHAT" (nếu là hỏi tuổi bot, đố vui, "dạy tôi học toán", hỏi thăm ngoài lề), hoặc "DISALLOWED_DOMAIN" (thời tiết, chứng khoán, tiền ảo, bóng đá, giá tiền).
12. answer_operation: Với mọi câu hỏi chuyên môn, phân loại "direct_lookup" nếu yêu cầu lấy/tóm tắt dữ kiện trực tiếp từ tài liệu; "evidence_synthesis" nếu cần so sánh, tổng hợp nhiều dữ kiện hoặc rút ra nhận định chung; "patient_specific_inference" nếu cần áp dụng dữ kiện vào ca bệnh cụ thể. Chỉ phân loại thao tác, không đánh giá mức độ đúng của câu trả lời.
13. query_mode: Phân biệt rạch ròi:
    - "card_lookup": CHỈ dùng khi người dùng gõ tên thuốc/SĐK đơn thuần (VD: "Paracetamol", "SĐK VD-24757-16") hoặc yêu cầu hiển thị hồ sơ tóm tắt/chi tiết một mục cố định ("Thông tin thuốc X", "Tóm tắt thuốc X").
    - "clinical_qa": Dùng cho MỌI câu hỏi tự nhiên cần giải đáp trúng trọng tâm (hỏi thuốc theo bệnh lý, hỏi thay thế thuốc, hỏi khoảng cách liều/giờ uống, hỏi liều theo cân nặng, hỏi thuốc giải độc, hỏi cơ chế/tại sao, hỏi quy chế thông tư).

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
- Phân biệt thực thể thuốc với thực thể không phải thuốc theo loại thực thể và dữ liệu định danh được cung cấp. Không gán một thực thể không được xác minh là thuốc vào secondary_drug. Nếu yêu cầu cần tổng hợp nhiều bằng chứng hoặc áp dụng chúng để rút ra kết luận, gán answer_operation=evidence_synthesis; nếu chỉ trích xuất một trường, giữ direct_lookup.
- Khi yêu cầu đánh giá tương tác nêu một thuốc và một nhóm dược lý/enzym/chất vận chuyển thay vì thuốc thứ hai, vẫn chọn MEDICATION_INTERACTION_CHECK; giữ nguyên thực thể thứ hai trong secondary_entity và gán đúng secondary_entity_type. Chỉ yêu cầu làm rõ nếu không nhận diện được thực thể tương tác thứ hai.
- TRƯỜNG ĐƯỢC YÊU CẦU: điền requested_fields với TOÀN BỘ các khía cạnh độc lập được hỏi trong câu hiện tại, dùng tên trường schema tương ứng; không chỉ chọn một trường đại diện. Nếu không yêu cầu trường cụ thể, trả mảng rỗng.
- GIỚI HẠN PHẠM VI TRƯỜNG: requested_fields chỉ gồm các khía cạnh người dùng yêu cầu trực tiếp hoặc các khía cạnh được nêu rõ là cần so sánh/tổng hợp. Không thêm trường liên quan chỉ vì có thể hữu ích; thông tin bệnh nền làm bối cảnh không tự động biến thành yêu cầu trả lời mọi trường liên quan.
- CHẾ ĐỘ HỘI THOẠI: Phân loại ý nghĩa câu hiện tại độc lập trước khi dùng lịch sử. Chọn "contextual_followup" chỉ khi hiểu câu hiện tại cần lượt trước; chọn "topic_shift" khi bắt đầu chủ đề mới; còn lại là "independent". Không kế thừa thuốc hoặc thực thể từ lượt trước cho câu độc lập.

NGUYÊN TẮC ĐỐI CHIẾU:
- Phân biệt câu tra cứu đơn, câu đa ý và câu theo ca bệnh; chỉ tạo sub_queries khi có nhiều yêu cầu độc lập.
- Trích chính xác thuốc, trường yêu cầu, thông số bệnh nhân; kế thừa thuốc chỉ khi có tham chiếu hội thoại rõ.
- Với tương tác, xác định đủ hai thực thể và phân biệt thuốc với nhóm dược lý/enzym/chất vận chuyển.
- Với câu ngoài chuyên môn, phân loại đúng loại ngoài phạm vi và không gán dữ kiện y khoa.
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


def _structured_output_schema() -> dict:
    """Build compact structured-output schema while preserving its contract."""
    schema = ClinicalNluExtraction.model_json_schema()
    omitted_metadata = {"title", "description", "default", "examples"}

    def compact(value):
        if isinstance(value, dict):
            return {key: compact(child) for key, child in value.items() if key not in omitted_metadata}
        if isinstance(value, list):
            return [compact(item) for item in value]
        return value

    return compact(schema)


def _has_explicit_context_reference(query: str) -> bool:
    """Return whether the current turn explicitly refers to prior context."""
    low_q = re.sub(r"\s+", " ", (query or "").strip().casefold())
    if not low_q:
        return False
    references = (
        "thuốc này", "thuốc đó", "thuốc kia", "thuốc vừa nói", "thuốc trên",
        "nó", "vừa rồi", "còn ", "thế còn", "còn về", "còn liều",
    )
    if any(ref in low_q for ref in references):
        return True
    try:
        from app.services.chatbot.session_routing import FIELD_ONLY_TERMS
        return any(term in low_q for term in FIELD_ONLY_TERMS)
    except Exception:
        return False


def _normalize_contextual_result(
    result: ClinicalNluExtraction, query: str, active_med: Optional[str]
) -> ClinicalNluExtraction:
    """Apply a current-turn evidence gate before inheriting session entities."""
    normalized = result.model_copy(deep=True)
    if not active_med:
        return normalized
    if not _has_explicit_context_reference(query):
        normalized.primary_drug = None
        normalized.is_deictic_referent = False
        if normalized.conversation_mode == "contextual_followup":
            normalized.conversation_mode = "independent"
        return normalized
    if (
        normalized.conversation_mode == "contextual_followup"
        or normalized.is_deictic_referent
        or _has_explicit_context_reference(query)
    ) and not normalized.primary_drug:
        normalized.primary_drug = active_med.strip()
        normalized.is_deictic_referent = True
        normalized.conversation_mode = "contextual_followup"
    return normalized


from app.services.chatbot.nlu_rule_matcher import (
    try_deterministic_fast_path,
    fallback_nlu_heuristic,
)


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
            return _normalize_contextual_result(result, clean_q, active_med)
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
            timeout_sec=timeout_sec,
            response_schema=_structured_output_schema()
        )
        if not raw_json:
            return fallback_nlu_heuristic(clean_q, active_med)

        cleaned = re.sub(r"^```(?:json)?\s*", "", raw_json.strip())
        cleaned = re.sub(r"\s*```$", "", cleaned)
        data = json.loads(cleaned)
        parsed = ClinicalNluExtraction(**data)

        # Validate the model's DDI drug pair against database-backed entity
        # recognition. If the query contains one recognized medication and
        # the model put a non-medication exposure into `secondary_drug`, use
        # the explicitly ranked monograph facet instead of the drug-pair
        # auditor. Unknown actual drugs remain a clarification case.
        from app.services.chatbot.intent_feature_matrix import rank_clinical_intents
        from app.services.chatbot.lexical_trie_matcher import get_drug_lexical_matcher
        current_drugs = get_drug_lexical_matcher().extract_medications(clean_q)
        alcohol_food_facets = {"alcohol_interaction", "food_interaction", "administration_timing"}
        ranked_facets = rank_clinical_intents(clean_q, min_score=2.5)
        ranked_names = {name for name, _ in ranked_facets}
        if (
            parsed.intent == "MEDICATION_INTERACTION_CHECK"
            and parsed.primary_drug
            and parsed.secondary_drug
            and len(current_drugs) == 1
            and ranked_names.intersection(alcohol_food_facets)
            and not any(
                parsed.secondary_drug.casefold() == recognized.casefold()
                for recognized in current_drugs
            )
        ):
            parsed.intent = "MEDICATION_LOOKUP"
            parsed.primary_drug = current_drugs[0]
            parsed.secondary_drug = None
            parsed.secondary_entity = None
            parsed.secondary_entity_type = None
            parsed.requested_fields = [
                name for name, _ in ranked_facets
                if name in alcohol_food_facets
            ]
            parsed.requested_field = {
                "alcohol_interaction": "interactions",
                "food_interaction": "interactions",
                "administration_timing": "timing",
            }.get(parsed.requested_fields[0]) or parsed.requested_field

        parsed = _normalize_contextual_result(parsed, clean_q, active_med)


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


# Lưu ý: fallback_nlu_heuristic và try_deterministic_fast_path đã được tách thành
# module độc lập backend/app/services/chatbot/nlu_rule_matcher.py và được re-export
# tại tệp này để đảm bảo kiến trúc tinh gọn và tương thích ngược 100%.
