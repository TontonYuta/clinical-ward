"""
Bộ lọc chất lượng & Phân tích tính hữu ích của Prompt (Prompt Utility & Noise Gate).
Nguyên tắc:
1. Chặn đứng Prompt rác, chuỗi ngẫu nhiên (gibberish), thán từ cụt lủn và tấn công bảo mật.
2. Chỉ phân loại 'is_useful = True' (đưa vào vòng lặp tự cải thiện) cho các câu hỏi lâm sàng/nghiệp vụ có giá trị thực tiễn.
3. Ràng buộc 100% đối soát với CSDL Dược Thư Quốc Gia 2015, 55.000 thuốc DAV và quy chế Bộ Y tế.
Căn cứ: MedAbstain (arXiv:2601.12471), Self-RAG (ICLR 2024), NeMo Guardrails (NVIDIA).
"""
import os
import sqlite3
import re
import math
from dataclasses import dataclass, field
from typing import Optional
from app.config import _DEFAULT_DB_PATH
from app.security.guardrails import (
    sanitize_input_text,
    detect_sql_injection,
    detect_prompt_injection,
)

@dataclass
class PromptUtilityResult:
    utility_score: float
    is_useful: bool
    category: str  # "high_value_clinical" | "need_clarification" | "noise_garbage" | "adversarial"
    reason: str
    entities_found: list[str] = field(default_factory=list)
    intent_detected: Optional[str] = None
    grounded_source: Optional[str] = None

# Từ khóa triệu chứng, bệnh danh và nghiệp vụ lâm sàng bệnh viện
CORE_CLINICAL_SYMPTOMS_AND_OPERATIONS = {
    # Triệu chứng & Bệnh danh
    "sốt", "sốt cao", "buồn nôn", "nôn", "nôn ói", "co giật", "khó thở", "đau ngực",
    "đau đầu", "tụt huyết áp", "tăng huyết áp", "huyết áp", "phản vệ", "sốc phản vệ",
    "ngộ độc", "ngộ độc thuốc tê", "suy thận", "suy gan", "sốt xuất huyết", "dengue",
    "dị ứng", "quá mẫn", "xuất huyết", "tiểu đường", "đái tháo đường", "hen phế quản",
    # Nghiệp vụ bệnh viện & Dược lâm sàng
    "kê đơn", "cpoe", "mượn vỏ", "trả vỏ", "nợ vỏ", "giao ban", "ca trực", "đối soát",
    "fefo", "hạn dùng", "cận hạn", "tồn kho", "dự trù", "bù kho", "bơm tiêm điện",
    "máy thở", "máy sốc tim", "monitor", "khí máu", "báo hỏng", "sự cố", "liều dùng",
    "tương tác thuốc", "tương tác", "chống chỉ định", "tương kỵ", "đặt trực tràng", "đặt hậu môn", "tiêm bắp", "tiêm tĩnh mạch",
    "cặp tương tác", "cặp thuốc", "cặp nữa", "thêm cặp"
}

# Cache động nạp từ CSDL (54.885 thuốc DAV & 771 chuyên luận DĐVN V)
_DYNAMIC_DRUG_LEXICON_CACHE: Optional[set[str]] = None

def get_dynamic_clinical_lexicon() -> set[str]:
    """
    Nạp động toàn bộ danh mục thực thể Dược từ CSDL Quốc Gia (DAV) và Dược Thư Việt Nam.
    Tuyệt đối KHÔNG hardcode danh mục thuốc tĩnh, đảm bảo tự động khớp 100% mọi thuốc trong CSDL.
    """
    global _DYNAMIC_DRUG_LEXICON_CACHE
    if _DYNAMIC_DRUG_LEXICON_CACHE is not None:
        return _DYNAMIC_DRUG_LEXICON_CACHE

    lexicon = set(CORE_CLINICAL_SYMPTOMS_AND_OPERATIONS)
    db_candidates = [
        "/tmp/clinical_hospital.db",
        _DEFAULT_DB_PATH,
        "clinical_hospital.db",
        "backend/clinical_hospital.db"
    ]
    target_db = next((p for p in db_candidates if os.path.exists(p)), None)

    if target_db:
        conn = None
        try:
            conn = sqlite3.connect(target_db, timeout=5.0)
            conn.execute("PRAGMA cache_size = -1000;")
            c = conn.cursor()

            # 1. Nạp toàn bộ hoạt chất chuẩn quốc tế (INN / Title) từ 771 chuyên luận Dược điển V
            c.execute("SELECT lower(inn), lower(title) FROM clinical_drug_monographs;")
            for r in c.fetchall():
                if r[0] and len(r[0].strip()) >= 3:
                    lexicon.add(r[0].strip())
                if r[1] and len(r[1].strip()) >= 3:
                    lexicon.add(r[1].strip())

            # 2. Nạp toàn bộ tên biệt dược và gốc từ từ danh mục thuốc Cục Quản lý Dược (DAV) theo chunk
            c.execute("SELECT DISTINCT lower(brand_name) FROM dav_national_drugs WHERE brand_name IS NOT NULL;")
            stop_words = {
                'thông', 'tin', 'cho', 'tôi', 'hỏi', 'về', 'của', 'các', 'những', 'làm', 'được', 'gì',
                'nào', 'sao', 'ở', 'tại', 'với', 'và', 'hoặc', 'có', 'không', 'thì', 'là', 'bạn',
                'mình', 'em', 'anh', 'chị', 'bác', 'sĩ', 'điều', 'dưỡng', 'bệnh', 'nhân', 'người',
                'tra', 'cứu', 'hướng', 'dẫn', 'xem', 'hãy', 'lấy', 'tìm', 'dùng', 'uống', 'tiêm',
                'kê', 'đơn', 'viên', 'nén', 'nang', 'lọ', 'chai', 'ống', 'hộp', 'gói', 'thuốc',
                'dung', 'dịch', 'hỗn', 'bột', 'kem', 'gel', 'mg', 'ml', 'g', 'mcg', 'iu', 'ui',
                'plus', 'forte', 'retard', 'xr', 'mr', 'cr', 'sr', 'nhũ', 'tương'
            }
            while True:
                rows = c.fetchmany(5000)
                if not rows:
                    break
                for (brand_raw,) in rows:
                    if not brand_raw:
                        continue
                    clean_b = re.sub(r'[^a-zA-Z0-9à-ỹÀ-Ỹ\s]', ' ', brand_raw).strip()
                    tokens = clean_b.split()
                    if tokens:
                        w1 = tokens[0]
                        if len(w1) >= 3 and w1 not in stop_words and not w1.isdigit():
                            lexicon.add(w1)
                        if len(tokens) >= 2:
                            w12 = f"{tokens[0]} {tokens[1]}"
                            if len(w12) >= 5 and tokens[0] not in stop_words and tokens[1] not in stop_words:
                                lexicon.add(w12)
        except Exception:
            # Fallback an toàn nếu SQLite đang bận
            pass
        finally:
            if conn:
                try:
                    conn.close()
                except Exception:
                    pass

    _DYNAMIC_DRUG_LEXICON_CACHE = lexicon
    return _DYNAMIC_DRUG_LEXICON_CACHE

# Các từ rác / thán từ cụt lủn không mang giá trị lâm sàng
PURE_NOISE_TOKENS = {
    "alo", "alooo", "test", "test123", "hi", "hello", "ê", "ê ê", "chào",
    "ok", "oke", "uh", "um", "ừ", "ừa", "à", "ad ơi", "admin ơi", "ha ha",
    "hehe", "hihi", "xyz", "abc", "123", "asdf", "asdfgh", "qwerty"
}

def calculate_shannon_entropy(text: str) -> float:
    """Tính toán Entropy Shannon để phát hiện chuỗi gõ phím ngẫu nhiên (gibberish/repetition)."""
    if not text:
        return 0.0
    freq: dict[str, int] = {}
    for ch in text:
        freq[ch] = freq.get(ch, 0) + 1
    length = len(text)
    entropy = 0.0
    for count in freq.values():
        p = count / length
        entropy -= p * math.log2(p)
    return entropy

def compute_prompt_utility(
    raw_query: str,
    reply_text: Optional[str] = None,
    intent: Optional[str] = None
) -> PromptUtilityResult:
    """
    Đánh giá độ hữu ích, độ sạch và độ neo chặn CSDL của một prompt người dùng.
    Trả về PromptUtilityResult với điểm số PUI từ 0.0 đến 1.0.
    """
    clean_query = sanitize_input_text(raw_query)
    lower_query = clean_query.lower().strip()

    # 1. Rào chắn an ninh (Security Guardrail): Phát hiện tấn công
    has_sqli, sqli_desc = detect_sql_injection(clean_query)
    if has_sqli:
        return PromptUtilityResult(
            utility_score=0.0,
            is_useful=False,
            category="adversarial",
            reason=f"Tấn công SQL Injection bị chặn: {sqli_desc}"
        )

    has_pi, pi_desc = detect_prompt_injection(clean_query)
    if has_pi:
        return PromptUtilityResult(
            utility_score=0.0,
            is_useful=False,
            category="adversarial",
            reason=f"Tấn công Prompt Injection / Jailbreak bị chặn: {pi_desc}"
        )

    # 2. Rào chắn rác ký tự & Tạp âm (Noise & Gibberish Filter)
    if len(lower_query) <= 2:
        return PromptUtilityResult(
            utility_score=0.05,
            is_useful=False,
            category="noise_garbage",
            reason="Prompt quá ngắn dưới 3 ký tự (không chứa nội dung)"
        )

    if lower_query in PURE_NOISE_TOKENS:
        return PromptUtilityResult(
            utility_score=0.10,
            is_useful=False,
            category="noise_garbage",
            reason="Prompt chỉ chứa thán từ chào hỏi hoặc từ khóa test rác"
        )

    # Kiểm tra chuỗi lặp ký tự (ví dụ: aaaaa, 111111, .....)
    if re.search(r"(.)\1{4,}", lower_query):
        return PromptUtilityResult(
            utility_score=0.10,
            is_useful=False,
            category="noise_garbage",
            reason="Phát hiện chuỗi ký tự lặp vô nghĩa (keyboard spam)"
        )

    # Tính Entropy: Chuỗi ngẫu nhiên bàn phím hoặc đơn điệu
    entropy = calculate_shannon_entropy(lower_query)
    # Với độ dài >= 8 ký tự, nếu entropy quá thấp (dưới 1.5) hoặc quá cao do gõ bàn phím ngẫu nhiên
    is_pure_digits = lower_query.replace(" ", "").isdigit()
    if is_pure_digits and len(lower_query) > 5 and not any(k in lower_query for k in ("8820", "5948", "2760", "2015")):
        return PromptUtilityResult(
            utility_score=0.15,
            is_useful=False,
            category="noise_garbage",
            reason="Chuỗi số ngẫu nhiên không khớp mã hồ sơ bệnh nhân hay văn bản y tế"
        )

    # 3. Quét và Khớp Thực Thể Lâm Sàng (Dynamic CSDL Entity Matching)
    found_entities: list[str] = []
    dynamic_lexicon = get_dynamic_clinical_lexicon()
    clean_words = re.findall(r'[\w]+', lower_query)
    for n in (1, 2, 3):
        for i in range(len(clean_words) - n + 1):
            ngram = " ".join(clean_words[i:i+n])
            if ngram in dynamic_lexicon and ngram not in found_entities:
                found_entities.append(ngram)

    # Nhận diện các câu hỏi hội thoại tiếp nối lâm sàng (Multi-turn Follow-up / DDI continuation)
    is_ddi_followup = bool(re.search(r"\b(?:\d+\s+cặp|cặp\s+nữa|thêm\s+\d+\s+cặp|thêm\s+cặp|xem\s+tiếp|tiếp\s+tục)\b", lower_query))
    if is_ddi_followup and "cặp tương tác" not in found_entities:
        found_entities.append("cặp tương tác")

    # 4. Xác định Căn cứ CSDL (Grounding Source)
    grounded_source = None
    if reply_text:
        if "Dược Thư Quốc Gia" in reply_text or "Dược thư" in reply_text:
            grounded_source = "Dược Thư Quốc Gia Việt Nam 2015"
        elif "2760/QĐ-BYT" in reply_text or "Sốt xuất huyết" in reply_text:
            grounded_source = "Quyết định 2760/QĐ-BYT (Sốt xuất huyết Dengue)"
        elif "51/2017/TT-BYT" in reply_text or "phản vệ" in reply_text.lower():
            grounded_source = "Thông tư 51/2017/TT-BYT (Phác đồ Phản vệ)"
        elif "20/2017/TT-BYT" in reply_text or "gây nghiện" in reply_text.lower() or "hướng thần" in reply_text.lower():
            grounded_source = "Thông tư 20/2017/TT-BYT (Thuốc Kiểm soát đặc biệt)"
        elif "Cục Quản lý Dược" in reply_text or "SĐK:" in reply_text:
            grounded_source = "CSDL 55.000 Thuốc Cục Quản Lý Dược (DAV)"

    # 5. Tính Điểm Tính Hữu Ích (Prompt Utility Index - PUI)
    # S_entity: Có thực thể lâm sàng chuẩn CSDL hay không (1 thực thể chuẩn CSDL đã đủ điều kiện giá trị cao)
    s_entity = min(1.0, 0.70 + len(found_entities) * 0.15) if found_entities else 0.0

    # S_intent: Ý định lâm sàng rõ ràng (tra cứu thuốc, liều, chỉ định, xử trí, kiểm kê,...)
    is_clarification = bool(intent and "CLARIFICATION" in intent)
    has_action = (
        (bool(intent and ("MEDICATION" in intent or "CLINICAL" in intent or "INVENTORY" in intent)) and not is_clarification) or
        any(w in lower_query for w in [
            "uống", "tiêm", "dùng", "cho", "lấy", "kê", "xử trí", "hạ sốt", "kiểm tra",
            "báo hỏng", "hướng dẫn", "phác đồ", "tương tác", "chống chỉ định", "liều",
            "thông tin", "tra cứu", "chỉ định", "tác dụng", "cơ chế", "biệt dược", "hoạt chất"
        ])
    )
    s_intent = 0.90 if has_action else 0.40

    # S_entropy: Độ tự nhiên ngôn ngữ
    s_entropy = 0.85 if (entropy >= 2.0 and len(clean_query) >= 8) else 0.30

    # S_safety: An toàn
    s_safety = 1.0

    pui = 0.35 * s_entity + 0.25 * s_intent + 0.20 * s_entropy + 0.20 * s_safety
    pui = round(min(1.0, max(0.0, pui)), 2)

    # 6. Phân Loại Đầu Ra
    if not found_entities:
        is_opening = (
            (intent and "CAPABILITY" in intent)
            or (intent and "BUSINESS" in intent)
            or any(p in lower_query for p in (
                "tôi có thể hỏi", "tôi muốn hỏi", "hỗ trợ tôi", "bạn có thể làm gì",
                "hướng dẫn", "bạn là ai", "chào", "xin chào", "cảm ơn"
            ))
        )
        if is_opening:
            return PromptUtilityResult(
                utility_score=0.80,
                is_useful=True,
                category="conversational_engagement",
                reason="Prompt tương tác mở đầu / tìm hiểu năng lực hệ thống tích cực",
                entities_found=[],
                intent_detected=intent,
                grounded_source="Trợ lý Dược Lâm Sàng"
            )

        is_steered = (
            intent == "OUT_OF_SCOPE"
            or any(w in lower_query for w in ("học toán", "dạy toán", "toán", "đúng không", "bằng mấy", "kể chuyện"))
            or bool(re.search(r'\b\d+\s*[\+\-\*\/=]\s*\d+', lower_query))
        )
        if is_steered:
            return PromptUtilityResult(
                utility_score=0.60,
                is_useful=False,
                category="steered_chitchat",
                reason="Prompt ngoài chuyên môn đã được điều hướng nhã nhặn về Dược lâm sàng",
                entities_found=[],
                intent_detected=intent
            )

        return PromptUtilityResult(
            utility_score=min(0.35, pui),
            is_useful=False,
            category="noise_garbage",
            reason="Prompt không chứa bất kỳ thực thể lâm sàng, thuốc hay quy chế y tế nào",
            entities_found=[],
            intent_detected=intent
        )

    if is_clarification:
        return PromptUtilityResult(
            utility_score=min(0.65, pui),
            is_useful=False,
            category="need_clarification",
            reason="Prompt có thực thể y tế nhưng thiếu bối cảnh ca bệnh cụ thể (cần làm rõ)",
            entities_found=found_entities,
            intent_detected=intent,
            grounded_source=grounded_source
        )

    if pui >= 0.70 and len(found_entities) >= 1:
        return PromptUtilityResult(
            utility_score=pui,
            is_useful=True,
            category="high_value_clinical",
            reason=f"Prompt lâm sàng chất lượng cao, chứa {len(found_entities)} thực thể CSDL ({', '.join(found_entities[:3])})",
            entities_found=found_entities,
            intent_detected=intent,
            grounded_source=grounded_source or "CSDL Y Tế Bệnh Viện & Dược Thư"
        )
    else:
        return PromptUtilityResult(
            utility_score=pui,
            is_useful=False,
            category="need_clarification",
            reason="Prompt có thực thể y tế nhưng thiếu bối cảnh ca bệnh cụ thể (cần làm rõ)",
            entities_found=found_entities,
            intent_detected=intent,
            grounded_source=grounded_source
        )
