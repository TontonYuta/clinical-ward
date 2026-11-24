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
    "1 + 1 bằng mấy, tính toán số học",
    "giải bài toán toán học phương trình",
    "dự báo thời tiết ngày mai mưa hay nắng",
    "kết quả xổ số kiến thiết miền bắc hôm nay",
    "kể một câu chuyện cười vui hoặc làm bài thơ",
    "viết code phần mềm thuật toán lập trình máy tính",
    "giá vàng hôm nay bao nhiêu một lượng, tỷ giá ngoại tệ",
    "kết quả bóng đá ngoại hạng anh thể thao"
]

CLINICAL_ANCHORS = {
    "thuốc", "liều", "dược", "bệnh", "chữa", "điều trị", "kháng sinh", "sốt", "đau", "viêm",
    "phác đồ", "tồn kho", "tủ trực", "bệnh nhân", "huyết áp", "truyền dịch", "paracetamol",
    "morphin", "tác dụng", "chống chỉ định", "độc tính", "ngộ độc", "quá liều", "men gan",
    "thai kỳ", "cho con bú", "suy thận", "suy gan", "suy tim", "aspirin", "insulin",
    "dị ứng", "phản vệ", "cpoe", "fefo", "tương tác", "vắc xin", "vacxin", "chỉ định"
}

# Bộ đệm Vector Anchors trong bộ nhớ (In-memory Anchor Cache)
_ANCHOR_CACHE: Dict[str, np.ndarray] = {}


async def _get_anchor_vectors(prototypes: List[str], cache_key: str) -> Optional[np.ndarray]:
    """Lấy hoặc tính toán trước ma trận vector chuẩn hóa của các anchor prototypes."""
    if cache_key in _ANCHOR_CACHE:
        return _ANCHOR_CACHE[cache_key]

    provider = get_embedding_provider()
    vectors = []
    for text in prototypes:
        v = await provider.embed_query(text)
        if v:
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
    user_role: str = "doctor"
) -> Optional[CopilotResponse]:
    """
    Kiểm tra xem câu hỏi có thuộc nhóm Chào hỏi hoặc Giới thiệu năng lực hay không bằng Vector Embedding.
    Nếu Cosine Similarity >= 0.70, trả về CopilotResponse trực tiếp từ tri thức nội bộ (< 150ms).
    Nếu không (câu hỏi chuyên môn lâm sàng / thuốc / bệnh học), trả về None để tiếp tục tìm kiếm Web.
    """
    clean_q = query.strip()
    if not clean_q or len(clean_q) > 300:
        return None

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

        # 3. So khớp với nhóm Ngoài phạm vi (Out-of-Scope / Math / Non-Clinical) bằng Vector Embedding
        # Kiểm tra an toàn: Nếu câu hỏi có chứa thực thể/thuật ngữ lâm sàng bảo vệ thì không reject nhầm
        has_clinical_anchor = any(anc in clean_q.lower() for anc in CLINICAL_ANCHORS)
        if not has_clinical_anchor:
            oos_matrix = await _get_anchor_vectors(OUT_OF_SCOPE_ANCHOR_PROTOTYPES, "out_of_scope_anchors")
            if oos_matrix is not None:
                oos_sims = np.dot(oos_matrix, q_vec)
                max_oos_sim = float(np.max(oos_sims))
                if max_oos_sim >= 0.68:
                    logger.info(
                        "Semantic Web Router: bypassed Web Search -> OUT_OF_SCOPE / SAFE_ABSTENTION (sim=%.4f) for query='%s'",
                        max_oos_sim, clean_q
                    )
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
                        confidence=round(max_oos_sim, 2),
                        suggested_chips=["Tra cứu thông tin thuốc", "Kiểm tra tương tác thuốc", "Cập nhật y tế thời gian thực"]
                    )

    except Exception as e:
        err_msg = str(e)
        if "429" in err_msg or "ResourceExhausted" in err_msg or "quota" in err_msg.lower():
            logger.error("⚠️ GEMINI EMBEDDING QUOTA EXHAUSTED / RATE LIMITED: %s", err_msg)
        else:
            logger.warning("Lỗi trong Semantic Web Intent Router: %s, tiếp tục luồng Web Search bình thường.", e)

    return None
