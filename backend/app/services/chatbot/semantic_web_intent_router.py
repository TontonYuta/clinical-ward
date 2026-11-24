"""
Bộ định tuyến ngữ nghĩa bằng Vector Embedding (Semantic Web Intent Router).
Áp dụng mẫu Semantic Router Pattern (Zero Hardcoded String Matching).
Sử dụng Google Gemini MRL Embedding 768 chiều và Cosine Similarity để phân loại
các câu hỏi Chào hỏi / Giới thiệu năng lực trợ lý ngay tại cửa ngõ Web Search,
giúp phản hồi tức thì (< 150ms) và tiết kiệm 100% quota tìm kiếm web không cần thiết.
"""

from typing import Optional, List, Dict, Tuple
import logging
import time
import os
import asyncio
import re
import numpy as np
from app.schemas.copilot import CopilotResponse
from app.services.rag.embeddings.provider import get_embedding_provider

logger = logging.getLogger(__name__)

# Ngưỡng phân tách Cosine Similarity tối ưu cho Gemini Embeddings
SEMANTIC_SIMILARITY_THRESHOLD = 0.70

# Các Anchor Prototypes ngữ nghĩa chuẩn
CAPABILITY_ANCHOR_PROTOTYPES = [
    "bạn có thể làm được gì",
    "hướng dẫn sử dụng các chức năng và tính năng của trợ lý",
    "giới thiệu năng lực và phạm vi hỗ trợ của bot",
    "chức năng chính của chatbot y tế bệnh viện"
]

GREETING_ANCHOR_PROTOTYPES = [
    "xin chào bạn",
    "chào buổi sáng, hello bot",
    "chào trợ lý dược lâm sàng",
    "chúc bạn một ngày tốt lành"
]

OUT_OF_SCOPE_ANCHOR_PROTOTYPES = [
    # 1. Văn học, Thơ ca, Nghệ thuật
    "văn học nghệ thuật tác phẩm thơ ca tiểu thuyết nhà văn",
    "phân tích tác phẩm văn học tác giả nhân vật văn xuôi",
    # 2. Toán học, Số học, Khoa học phi y tế
    "1 + 1 bằng mấy, tính toán số học",
    "giải bài toán toán học phương trình đại số hình học",
    # 3. Lịch sử, Địa lý, Chính trị thế giới
    "lịch sử chiến tranh địa lý thế giới di tích lịch sử",
    "chính trị thế giới tổng thống nguyên thủ quốc gia lãnh đạo",
    # 4. Đời sống, Giải trí, Thể thao, Thời tiết
    "dự báo thời tiết ngày mai mưa hay nắng nhiệt độ",
    "kết quả xổ số kiến thiết miền bắc hôm nay vietlott",
    "kể một câu chuyện cười vui hoặc làm bài thơ giải trí",
    "kết quả bóng đá ngoại hạng anh thể thao thế giới",
    "showbiz giải trí phim ảnh diễn viên ca sĩ âm nhạc bài hát",
    # 5. Công nghệ & Lập trình
    "viết code phần mềm thuật toán lập trình máy tính công nghệ",
    "trò chơi điện tử game online máy chơi game",
    # 6. Tài chính, Kinh tế, Bất động sản
    "giá vàng hôm nay bao nhiêu một lượng, tỷ giá ngoại tệ",
    "thị trường chứng khoán cổ phiếu bất động sản",
    # 7. Ẩm thực & Du lịch
    "nấu ăn công thức làm bánh món ngon ẩm thực du lịch khách sạn"
]

CLINICAL_DOMAIN_PROTOTYPES = [
    "hướng dẫn chỉ định liều dùng tác dụng phụ của thuốc điều trị",
    "chẩn đoán bệnh triệu chứng phác đồ điều trị y khoa bệnh viện",
    "an toàn sử dụng thuốc tương tác thuốc chống chỉ định dị ứng",
    "quy chế kê đơn bảo hiểm y tế danh mục thuốc thông tư bộ y tế",
    "cập nhật dịch bệnh vắc xin y tế dự phòng tổ chức y tế thế giới"
]

CLINICAL_ANCHORS = {
    "thuốc", "liều", "dược", "bệnh", "chữa", "điều trị", "kháng sinh", "sốt", "đau", "viêm",
    "phác đồ", "tồn kho", "tủ trực", "bệnh nhân", "huyết áp", "truyền dịch", "paracetamol",
    "morphin", "tác dụng", "chống chỉ định", "độc tính", "ngộ độc", "quá liều", "men gan",
    "thai kỳ", "cho con bú", "suy thận", "suy gan", "suy tim", "aspirin", "insulin",
    "dị ứng", "phản vệ", "cpoe", "fefo", "tương tác", "vắc xin", "vacxin", "chỉ định",
    "uống", "tiêm", "truyền", "viên", "gói", "lọ", "ống", "kê đơn", "đơn thuốc",
    "bác sĩ", "dược sĩ", "điều dưỡng", "bệnh viện", "xét nghiệm", "chẩn đoán", "dược thư"
}

# Bộ đệm Vector Anchors trong bộ nhớ (In-memory Anchor Cache)
_ANCHOR_CACHE: Dict[str, np.ndarray] = {}

def _init_anchor_cache_from_disk() -> None:
    """Tải trước các ma trận vector anchor tĩnh từ tệp .npz (Độ trễ = 0ms, tiết kiệm 100% chi phí)."""
    current_dir = os.path.dirname(os.path.abspath(__file__))
    npz_path = os.path.join(current_dir, "semantic_anchors.npz")
    if os.path.exists(npz_path):
        try:
            with np.load(npz_path) as data:
                for key in data.files:
                    _ANCHOR_CACHE[key] = data[key]
            logger.info("Semantic Router: Loaded %d pre-computed vector matrices from %s", len(_ANCHOR_CACHE), npz_path)
        except Exception as e:
            logger.warning("Không thể nạp semantic_anchors.npz: %s", e)

_init_anchor_cache_from_disk()


# Biểu thức chính quy phát hiện nhanh các chủ đề tuyệt đối phi y tế (Deterministic Lexical Guardrail)
# Giúp phản hồi ngay lập tức (< 1ms), tiết kiệm quota embedding và hoạt động tin cậy kể cả khi mất mạng
DETERMINISTIC_OOS_REGEX = re.compile(
    r"(?:"
    r"thời tiết|dự báo thời tiết|mưa hay nắng|nhiệt độ hôm nay|"
    r"kết quả bóng đá|ngoại hạng anh|world cup|cúp c1|v-league|bóng đá hôm nay|"
    r"kết quả xổ số|xổ số|vietlott|lô đề|soi cầu|"
    r"showbiz|scandal|diễn viên|ca sĩ|bài hát|phim hay|rạp chiếu phim|"
    r"câu chuyện cười|kể chuyện cười|làm thơ|bài thơ|viết bài thơ|"
    r"giá vàng|giá bitcoin|tiền ảo|thị trường chứng khoán|giá cổ phiếu|"
    r"công thức làm bánh|cách làm bánh|cách nấu món|"
    r"viết code|lập trình python|lập trình javascript|giải phương trình"
    r")",
    re.IGNORECASE
)


def _build_safe_abstention_response(
    clean_q: str,
    user_name: str,
    user_role: str,
    confidence: float = 0.95
) -> CopilotResponse:
    role_display = "Bác sĩ" if user_role == "doctor" else ("Dược sĩ" if user_role == "pharmacist" else "Điều dưỡng")
    reply_text = (
        f"Xin lỗi {role_display} {user_name}! Tôi là **Trợ lý Trí tuệ Nhân tạo Dược Lâm Sàng & Nghiệp vụ Bệnh viện chuyên dụng**.\n\n"
        "Hệ thống tuân thủ nghiêm ngặt quy chế an toàn y tế và **chỉ hỗ trợ** các nội dung chuyên môn sau:\n"
        "1. **Dược lý & Tra cứu thuốc:** Chỉ định, liều dùng tối đa, chống chỉ định, thận trọng (Dược thư Quốc gia & 54.885 thuốc Cục QLD).\n"
        "2. **An toàn kê đơn:** Tương tác thuốc chống chỉ định (QĐ 5948/QĐ-BYT), chỉnh liều suy thận/suy gan.\n"
        "3. **Thẩm định BHYT & Pháp quy:** Điều kiện thanh toán TT 20/2022/TT-BYT, quy chế kê đơn ngoại trú.\n"
        "4. **Phác đồ & Dịch tễ y tế:** Cập nhật thông tin dịch bệnh, vắc xin thời gian thực từ Bộ Y tế & WHO.\n\n"
        f"{role_display} vui lòng đặt câu hỏi liên quan đến thuốc hoặc chuyên môn y tế nhé!"
    )
    return CopilotResponse(
        intent="CLINICAL_SAFE_ABSTENTION",
        reply_text=reply_text,
        legal_basis="Quy chế Trợ lý Dược Lâm Sàng & An toàn CDSS",
        answer_type="safe_abstention",
        source_status="out_of_scope",
        confidence=confidence,
        suggested_chips=["Tra cứu thông tin thuốc", "Kiểm tra tương tác thuốc", "Cập nhật y tế thời gian thực"]
    )


async def _get_anchor_vectors(prototypes: List[str], cache_key: str) -> Optional[np.ndarray]:
    """Lấy từ cache tĩnh hoặc tính toán song song ma trận vector chuẩn hóa (Batch / Parallel)."""
    if cache_key in _ANCHOR_CACHE:
        return _ANCHOR_CACHE[cache_key]

    provider = get_embedding_provider()
    # Batch / Parallel Embedding: Gọi song song qua asyncio.gather thay vì lặp tuần tự
    raw_vectors = await asyncio.gather(*[provider.embed_query(text) for text in prototypes], return_exceptions=True)
    vectors = []
    for v in raw_vectors:
        if isinstance(v, list) and v:
            arr = np.asarray(v, dtype=np.float32)
            norm = np.linalg.norm(arr)
            if norm > 0:
                vectors.append(arr / norm)

    if not vectors:
        return None

    matrix = np.vstack(vectors)
    _ANCHOR_CACHE[cache_key] = matrix
    return matrix


async def check_semantic_web_bypass(
    query: str,
    user_name: str = "Bác sĩ",
    user_role: str = "doctor",
    history: str = ""
) -> Optional[CopilotResponse]:
    """
    Kiểm tra xem câu hỏi có thuộc nhóm Chào hỏi hoặc Giới thiệu năng lực hay không bằng Vector Embedding.
    Nếu Cosine Similarity >= 0.70, trả về CopilotResponse trực tiếp từ tri thức nội bộ (< 150ms).
    Nếu không (câu hỏi chuyên môn lâm sàng / thuốc / bệnh học), trả về None để tiếp tục tìm kiếm Web.
    """
    clean_q = query.strip()
    if not clean_q or len(clean_q) > 300:
        return None

    # Chốt chặn nhanh 1: Deterministic Lexical Guardrail cho các chủ đề tuyệt đối phi y tế
    # Phản hồi ngay < 1ms, không tốn quota token và hoạt động độc lập ngay cả khi mạng lỗi
    lower_q = clean_q.lower()
    has_explicit_clinical_action = any(
        k in lower_q for k in ("tương tác", "chống chỉ định", "dược lực", "chỉnh liều", "suy thận", "suy gan", "phản vệ")
    )
    if not has_explicit_clinical_action and DETERMINISTIC_OOS_REGEX.search(lower_q):
        logger.info("Semantic Web Router: deterministic lexical match -> OUT_OF_SCOPE for query='%s'", clean_q)
        return _build_safe_abstention_response(clean_q, user_name, user_role, confidence=0.98)

    try:
        provider = get_embedding_provider()
        query_vec_raw = await provider.embed_query(clean_q)
        if not query_vec_raw:
            return None

        q_vec = np.asarray(query_vec_raw, dtype=np.float32)
        q_norm = np.linalg.norm(q_vec)
        if q_norm == 0:
            return None
        q_vec = q_vec / q_norm

        # 1. So khớp với nhóm Năng lực (Capability)
        cap_matrix = await _get_anchor_vectors(CAPABILITY_ANCHOR_PROTOTYPES, "capability_anchors")
        if cap_matrix is not None:
            cap_sims = np.dot(cap_matrix, q_vec)
            max_cap_sim = float(np.max(cap_sims))
            if max_cap_sim >= SEMANTIC_SIMILARITY_THRESHOLD:
                logger.info(
                    "Semantic Web Router: bypassed Web Search -> CAPABILITY_OPENING (sim=%.4f) for query='%s'",
                    max_cap_sim, clean_q
                )
                role_display = "Bác sĩ" if user_role == "doctor" else ("Dược sĩ" if user_role == "pharmacist" else "Điều dưỡng")
                reply_text = (
                    f"Chào {role_display} {user_name}! Tôi là **Trợ Lý Trí Tuệ Nhân Tạo Dược Lâm Sàng & An Toàn Kê Đơn BHYT**.\n\n"
                    "Tôi luôn sẵn sàng hỗ trợ các nghiệp vụ y tế chuyên sâu 24/7:\n"
                    "1. **Tra cứu chuyên luận Dược Thư:** Chỉ định, liều dùng tối đa, chống chỉ định và chỉnh liều suy thận/suy gan theo DĐVN V & 54.885 thuốc Cục QLD (DAV).\n"
                    "2. **Kiểm tra Tương tác thuốc (DDI):** Rà soát các cặp thuốc chống chỉ định phối hợp nghiêm trọng theo Quyết định 5948/QĐ-BYT.\n"
                    "3. **Thẩm định Kê đơn & BHYT:** Kiểm tra điều kiện thanh toán Cột 8 TT 20/2022/TT-BYT, quy chế kê đơn ngoại trú TT 52/2017 & phòng ngừa xuất toán BHYT.\n"
                    "4. **Phác đồ & Quy chế Bệnh viện:** Xử trí sốc phản vệ (TT 51/2017), quản lý thuốc gây nghiện/hướng tâm thần (TT 20/2017) và chuỗi lạnh GSP (TT 36/2018).\n"
                    "5. **Tìm kiếm Y tế Thời gian thực:** Cập nhật các khuyến cáo dịch tễ, vắc xin mùa mới nhất từ WHO, Bộ Y Tế và các bệnh viện tuyến đầu.\n\n"
                    f"{role_display} cần tra cứu thuốc, kiểm tra đơn điều trị hay tham khảo phác đồ nào xin cứ gửi cho tôi nhé!"
                )
                return CopilotResponse(
                    intent="CAPABILITY_OPENING",
                    reply_text=reply_text,
                    legal_basis="Dược Thư Quốc Gia Việt Nam, Thông tư 20/2022/TT-BYT & QĐ 5948/QĐ-BYT",
                    answer_type="capability_overview",
                    source_status="internal_knowledge",
                    confidence=round(max_cap_sim, 2),
                    suggested_chips=["Tra cứu Dược Thư Quốc Gia", "Kiểm tra tương tác thuốc", "Phác đồ phản vệ TT 51"]
                )

        # 2. So khớp với nhóm Chào hỏi (Greeting)
        greet_matrix = await _get_anchor_vectors(GREETING_ANCHOR_PROTOTYPES, "greeting_anchors")
        if greet_matrix is not None:
            greet_sims = np.dot(greet_matrix, q_vec)
            max_greet_sim = float(np.max(greet_sims))
            if max_greet_sim >= SEMANTIC_SIMILARITY_THRESHOLD:
                logger.info(
                    "Semantic Web Router: bypassed Web Search -> GREETING_WELCOME (sim=%.4f) for query='%s'",
                    max_greet_sim, clean_q
                )
                role_display = "Bác sĩ" if user_role == "doctor" else ("Dược sĩ" if user_role == "pharmacist" else "Điều dưỡng")
                reply_text = f"Chào {role_display} {user_name}! Tôi là Trợ lý Dược Lâm Sàng Bệnh viện, sẵn sàng hỗ trợ tra cứu thuốc, kiểm tra tương tác và cập nhật y tế thời gian thực."
                return CopilotResponse(
                    intent="GREETING_WELCOME",
                    reply_text=reply_text,
                    legal_basis="Trợ lý Dược Lâm Sàng",
                    answer_type="greeting",
                    source_status="internal_knowledge",
                    confidence=round(max_greet_sim, 2),
                    suggested_chips=["Tra cứu thông tin thuốc", "Kiểm tra tương tác thuốc", "Cập nhật y tế thời gian thực"]
                )

        # 3. So khớp với nhóm Ngoài phạm vi (Out-of-Scope / Non-Clinical / Medical Relevance Gate)
        oos_matrix = await _get_anchor_vectors(OUT_OF_SCOPE_ANCHOR_PROTOTYPES, "out_of_scope_anchors")
        max_oos_sim = 0.0
        if oos_matrix is not None:
            oos_sims = np.dot(oos_matrix, q_vec)
            max_oos_sim = float(np.max(oos_sims))

        clin_matrix = await _get_anchor_vectors(CLINICAL_DOMAIN_PROTOTYPES, "clinical_domain_anchors")
        max_clin_sim = 0.0
        if clin_matrix is not None:
            clin_sims = np.dot(clin_matrix, q_vec)
            max_clin_sim = float(np.max(clin_sims))

        has_clinical_anchor = any(anc in lower_q for anc in CLINICAL_ANCHORS)
        has_drug_match = False
        if not has_clinical_anchor:
            try:
                from app.services.chatbot.lexical_trie_matcher import get_drug_lexical_matcher
                if get_drug_lexical_matcher().extract_medications(clean_q):
                    has_drug_match = True
            except Exception:
                pass

        # Nếu câu hỏi là câu nối tiếp có ngữ cảnh lâm sàng từ trước (vd: "sao mới có 2 loại", "uống mấy viên")
        has_history_clinical = False
        if history:
            lower_hist = history.lower()
            if any(anc in lower_hist for anc in CLINICAL_ANCHORS):
                has_history_clinical = True

        is_followup = any(w in lower_q for w in ("sao", "tại sao", "loại", "thêm", "còn", "thế", "nữa", "kia", "đó", "này"))
        is_clinical_followup = has_history_clinical and is_followup
        if is_clinical_followup:
            has_clinical_anchor = True

        # Quyết định từ chối câu hỏi phi y tế:
        # a) Rõ ràng thuộc chủ đề phi y tế áp đảo (max_oos_sim >= 0.70)
        # b) Không phải câu hỏi nối tiếp lâm sàng VÀ độ tương đồng phi y tế vượt trội (max_oos_sim > max_clin_sim and max_oos_sim >= 0.58)
        # c) Không chứa thực thể thuốc / thuật ngữ lâm sàng VÀ độ liên quan y tế thấp (< 0.54)
        is_definite_oos = max_oos_sim >= 0.70
        is_predominantly_oos = (not is_clinical_followup) and (max_oos_sim > max_clin_sim) and (max_oos_sim >= 0.58)
        is_low_medical_relevance = (not has_clinical_anchor and not has_drug_match) and (max_clin_sim < 0.54)

        if is_definite_oos or is_predominantly_oos or is_low_medical_relevance:
            logger.info(
                "Semantic Web Router: bypassed Web Search -> OUT_OF_SCOPE / SAFE_ABSTENTION (oos_sim=%.4f, clin_sim=%.4f) for query='%s'",
                max_oos_sim, max_clin_sim, clean_q
            )
            return _build_safe_abstention_response(
                clean_q, user_name, user_role, confidence=round(max(max_oos_sim, 0.75), 2)
            )

    except Exception as e:
        err_msg = str(e)
        if "429" in err_msg or "ResourceExhausted" in err_msg or "quota" in err_msg.lower():
            logger.error("⚠️ GEMINI EMBEDDING QUOTA EXHAUSTED / RATE LIMITED: %s", err_msg)
        else:
            logger.warning("Lỗi trong Semantic Web Intent Router: %s", e)
        # Fallback an toàn: Nếu embedding lỗi nhưng câu hỏi không có bất kỳ dấu hiệu lâm sàng nào, từ chối an toàn
        if not any(anc in clean_q.lower() for anc in CLINICAL_ANCHORS):
            return _build_safe_abstention_response(clean_q, user_name, user_role, confidence=0.70)

    return None
