"""
Bộ nhận diện Ý định theo Quy tắc & Heuristic Lâm sàng (NLU Rule & Heuristic Matcher).
Tách từ gemini_nlu_router.py nhằm phân định ranh giới giữa AI Model và Rule Engine:
- Fast-Path định danh tức thì (< 5ms, 0 tokens) cho câu hỏi đơn giản/năng lực/chào hỏi.
- Heuristic Fallback ngoại tuyến an toàn (< 0.1ms) khi Gemini API ngắt kết nối hoặc timeout.
"""
import re
from typing import Optional
from app.schemas.clinical_nlu import ClinicalNluExtraction


def try_deterministic_fast_path(clean_q: str, active_med: Optional[str] = None) -> Optional[ClinicalNluExtraction]:
    """Phân loại tức thì (< 5ms, 0 tokens) cho các truy vấn đơn giản, rõ ràng."""
    from app.services.chatbot.lexical_trie_matcher import get_drug_lexical_matcher
    matcher = get_drug_lexical_matcher()
    low_q = clean_q.lower().strip()
    local_result = fallback_nlu_heuristic(clean_q, active_med, matcher=matcher)

    # 0. Năng lực trợ lý & Chào hỏi thiện chí
    if any(c in low_q for c in (
        "bạn có thể làm gì", "ban co the lam gi", "bạn làm được gì", "ban lam duoc gi",
        "bạn làm gì được", "ban lam gi duoc", "bạn giúp được gì", "ban giup duoc gi",
        "khả năng của bạn", "kha nang cua ban", "năng lực của bạn", "nang luc cua ban",
        "chức năng của bạn", "chuc nang cua ban", "giới thiệu bản thân", "gioi thieu ban than",
        "hướng dẫn sử dụng", "huong dan su dung"
    )):
        return ClinicalNluExtraction(
            intent="CAPABILITY_OPENING",
            user_sentiment="neutral",
            confidence=1.0,
            is_topic_shift=False
        )

    # 1. Chào hỏi, cảm ơn đơn giản
    if any(low_q == g or low_q.startswith(g + " ") for g in ("xin chào", "chào", "hello", "hi", "cảm ơn", "cam on", "thanks")):
        return local_result

    if local_result and local_result.intent in {
        "OUT_OF_SCOPE", "MEDICATION_LOOKUP_GUIDE",
    }:
        return local_result

    # 2. Cổng tra cứu Dược thư Quốc gia
    if any(p in low_q for p in ("tra cứu dược thư", "cổng tra cứu", "dược thư quốc gia 2015", "tra cứu dđvn")):
        res = local_result.model_copy(deep=True)
        res.intent = "MEDICATION_LOOKUP_GUIDE"
        return res

    # 3. Tra cứu trực tiếp theo SĐK (Số đăng ký)
    sdk = matcher.extract_sdk(clean_q)
    if sdk and len(clean_q.split()) <= 4:
        res = local_result.model_copy(deep=True)
        res.primary_drug = sdk
        res.intent = "MEDICATION_LOOKUP"
        return res

    # A named pair of database-resolved medications with an explicit interaction
    # request is a structured lookup task; it does not need remote intent parsing.
    if len(matcher.extract_medications(clean_q)) >= 2 and any(
        term in low_q for term in ("tương tác", "tuong tac", "tương kỵ", "tuong ky")
    ):
        if (
            local_result.intent == "MEDICATION_INTERACTION_CHECK"
            and local_result.primary_drug
            and local_result.secondary_drug
            and not local_result.sub_queries
        ):
            return local_result

    meds = matcher.extract_medications(clean_q)
    ranked_facets = []
    if len(meds) == 1:
        ranked_facets = [(name, 0.0) for name in local_result.requested_fields]
        if (
            local_result.intent == "MEDICATION_LOOKUP"
            and local_result.answer_operation == "direct_lookup"
            and not local_result.sub_queries
        ):
            local_result.primary_drug = meds[0]
            return local_result
    renal_lookup_only = (
        len(meds) == 1
        and any(name == "renal_adjustment" for name, _ in ranked_facets)
        and not re.search(r"(?:creatinin|crystalin|creatin|scr|crcl|egfr)\s*[:=]?\s*\d+|\b\d+(?:[.,]\d+)?\s*(?:tuổi|tuoi|kg|ml/min|ml/phút|umol/l|µmol/l|mg/dl)\b", low_q)
        and not any(term in low_q for term in ("bệnh nhân này", "ca bệnh", "tính liều", "tính giúp", "cụ thể"))
    )
    if renal_lookup_only:
        if local_result.primary_drug and "renal_adjustment" in local_result.requested_fields:
            local_result.intent = "MEDICATION_LOOKUP"
            local_result.answer_operation = "direct_lookup"
            return local_result

    # 4. Tra cứu thông tin thuốc đơn chất chuẩn mực
    if len(meds) == 1:
        complex_signals = (
            "suy thận", "creatinin", "độ thanh thải", "clcr", "kèm theo", "bệnh nền",
            "dị ứng", "chuyển sang", "đổi sang", "tại sao", "cơ chế"
        )
        if not any(sig in low_q for sig in complex_signals):
            # A single, confidently identified facet is a direct database
            # lookup even when the phrasing is longer than a short query.
            # The feature matrix defines facets; this adds no clinical facts.
            from app.services.chatbot.intent_feature_matrix import rank_clinical_intents
            ranked_facets = rank_clinical_intents(clean_q, min_score=2.5)
            if len(ranked_facets) == 1:
                return local_result
            simple_prefixes = (
                "tra cứu thuốc", "thông tin thuốc", "thông tin", "thuốc",
                "liều dùng", "liều", "chỉ định", "chống chỉ định", "tác dụng phụ",
                "cách dùng", "thời điểm uống"
            )
            if (
                len(clean_q.split()) <= 6
                or any(low_q.startswith(p) for p in simple_prefixes)
                or any(w in low_q for w in ("trẻ em", "trẻ nhỏ", "bệnh nhi", "bé", "sơ sinh", "cháu"))
            ):
                return local_result

    return None


def fallback_nlu_heuristic(
    query: str,
    active_med: Optional[str] = None,
    *,
    matcher=None,
    user_name: str = "Đồng nghiệp",
    user_role: str = "doctor",
) -> ClinicalNluExtraction:
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
    if matcher is None:
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
        any(c in low_q for c in (
            "bạn có thể làm gì", "ban co the lam gi", "bạn làm được gì", "ban lam duoc gi",
            "bạn làm gì được", "ban lam gi duoc", "bạn giúp được gì", "ban giup duoc gi",
            "khả năng của bạn", "kha nang cua ban", "năng lực của bạn", "nang luc cua ban",
            "chức năng của bạn", "chuc nang cua ban"
        ))
        or (
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
    conv_check = handle_greeting_and_acknowledgment(low_q, user_name, user_role)
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
                    requested_fields=["drug_interactions"],
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
    is_renal_inquiry: bool = any(w in low_q for w in ("suy thận", "thận", "creatinin", "crcl", "egfr", "crystalin", "creatin", "suy than", "chức năng thận"))

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
    elif is_pediatric or any(w in low_q for w in ("trẻ em", "tre em", "trẻ nhỏ", "bệnh nhi", "bé", "sơ sinh", "cháu")):
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
    is_pediatric = bool(
        is_pediatric
        or re.search(r"\b(?:trẻ|tre|bé|be|cháu|chau|sơ sinh|so sinh|bệnh nhi|benh nhi)\b", low_q)
    )
    requested_fields = [
        name for name, _ in rank_clinical_intents(clean_q, min_score=2.5)
        if name in supported_fields
    ]
    if any(term in low_q for term in ("tương tác", "tuong tac", "tương kỵ", "tuong ky")) and len(meds) >= 2:
        if "drug_interactions" not in requested_fields:
            requested_fields.append("drug_interactions")
    if is_pediatric and "pediatric_dosage" not in requested_fields:
        requested_fields.append("pediatric_dosage")
    if is_pediatric and req_field == "dosage":
        req_field = "pediatric"
    if is_renal_inquiry and "renal_adjustment" not in requested_fields:
        requested_fields.append("renal_adjustment")

    has_patient_case_data = bool(
        patient_creatinine_val is not None
        or (patient_age is not None and patient_weight_kg is not None)
        or re.search(r"\b(?:bệnh nhân|bn|ca bệnh|người bệnh|nhiễm toan)\b", low_q)
    )

    # 8. Kế thừa đại từ ("thuốc đó", "nó") - Bắt buộc dùng regex word-boundary để không nhận nhầm từ "nói" thành "nó"
    has_deictic = bool(re.search(r'\b(?:nó|thuốc\s+(?:đó|này|kia|vừa\s+nói)|thuoc\s+(?:do|nay|kia))\b', low_q))
    if has_deictic:
        target_med = active_med.strip() if active_med else None
        target_intent = "PATIENT_CASE_REASONING" if (is_renal_inquiry and target_med and has_patient_case_data) else "MEDICATION_LOOKUP"
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
        final_intent = "PATIENT_CASE_REASONING" if has_patient_case_data else "MEDICATION_LOOKUP"
        final_drug = target_drug
    elif target_drug:
        final_intent = "MEDICATION_LOOKUP"
        final_drug = target_drug
    else:
        final_intent = "CLINICAL_CASE_CLARIFICATION"
        final_drug = None

    comparison_cues = (
        "so sánh", "so sanh", "khác nhau", "khac nhau",
        "nguy cơ", "ảnh hưởng", "anh huong", "liên quan thế nào",
    )
    answer_operation = (
        "evidence_synthesis"
        if any(cue in low_q for cue in comparison_cues)
        else "direct_lookup"
    )

    return ClinicalNluExtraction(
        intent=final_intent,
        primary_drug=final_drug,
        sub_queries=sub_queries,
        requested_field=req_field,
        requested_fields=requested_fields,
        answer_operation=answer_operation,
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
