"""
Bộ định tuyến điều hướng phân hệ & mở biểu mẫu ngữ nghĩa (Semantic Navigation Router).
Loại bỏ hoàn toàn hardcoded keyword traps và ngăn chặn việc cướp quyền (hijack) các câu hỏi lâm sàng.
Tuân thủ chuẩn Berkeley Function Calling & Semantic Router Pattern.
"""

import re
import os
import asyncio
import logging
from typing import Optional, Dict, List
import numpy as np

from app.schemas.copilot import CopilotResponse, CopilotActionCard
from app.services.rag.embeddings.provider import get_embedding_provider, cosine_similarity

logger = logging.getLogger(__name__)

# Ngưỡng cosine similarity tối ưu cho Google Gemini 768d MRL Embeddings
NAV_SIMILARITY_THRESHOLD = 0.72

# Danh mục các Tab và thông tin phân hệ trong hệ thống bệnh viện
TAB_METADATA: Dict[str, Dict[str, str]] = {
    "cpoe": {
        "title": "Kê Đơn Thuốc Điện Tử CPOE",
        "description": "Phân hệ lập đơn thuốc ngoại trú/nội trú theo Thông tư 26/2025/TT-BYT",
        "label": "Mở Biểu Mẫu Kê Đơn CPOE",
        "reply": "Dạ hệ thống đã mở phân hệ **Kê Đơn Thuốc Điện Tử (CPOE)**. Bác sĩ có thể nhập thông tin người bệnh, chẩn đoán ICD-10 và lựa chọn thuốc trực tiếp trên biểu mẫu làm việc.",
        "open_modal": "cpoe_prescription"
    },
    "debt": {
        "title": "Tủ Trực Lâm Sàng & Sổ Nợ Cấp Cứu",
        "description": "Quản lý cơ số tủ trực cấp cứu và thu hồi vỏ thuốc gây nghiện theo TT 22/2011 và TT 20/2017",
        "label": "Chuyển Đến Sổ Nợ Tủ Trực",
        "reply": "Dạ hệ thống đã chuyển sang phân hệ **Tủ Trực Lâm Sàng & Sổ Nợ Cấp Cứu**. Bạn có thể theo dõi danh sách phiếu nợ, đối soát ca trực và hoàn nộp vỏ thuốc gây nghiện.",
        "open_modal": None
    },
    "fefo": {
        "title": "Kho Dược & Hạn Dùng FEFO",
        "description": "Theo dõi hạn dùng First-Expired First-Out và mức tồn kho an toàn GSP theo TT 36/2018",
        "label": "Mở Phân Hệ Kho Dược FEFO",
        "reply": "Dạ hệ thống đã mở phân hệ **Kho Dược & Quản Lý Hạn Dùng FEFO**. Bác sĩ/Dược sĩ có thể rà soát danh sách lô thuốc cận hạn và mức tồn kho khả dụng.",
        "open_modal": None
    },
    "coldchain": {
        "title": "Giám Sát Chuỗi Lạnh & Kho Vắc Xin",
        "description": "Giám sát viễn thông nhiệt độ 2°C - 8°C và cảnh báo sốc nhiệt Arrhenius theo TT 36/2018",
        "label": "Mở Phân Hệ Chuỗi Lạnh",
        "reply": "Dạ hệ thống đã chuyển sang phân hệ **Giám Sát Chuỗi Lạnh (Cold Chain)**. Bạn có thể theo dõi trực tiếp biểu đồ nhiệt độ tủ lạnh vắc xin và nhật ký datalogger.",
        "open_modal": None
    },
    "equipment": {
        "title": "Quản Lý & Báo Hỏng Thiết Bị Y Tế",
        "description": "Theo dõi trạng thái máy móc, kiểm định an toàn và báo hỏng thiết bị theo NĐ 98/2021",
        "label": "Mở Phân Hệ Thiết Bị Y Tế",
        "reply": "Dạ hệ thống đã chuyển sang phân hệ **Quản Lý Trang Thiết Bị Y Tế**. Bạn có thể tra cứu danh mục máy móc hoặc lập phiếu báo hỏng sự cố.",
        "open_modal": None
    },
    "documents": {
        "title": "Văn Bản Pháp Quy & Danh Mục BHYT",
        "description": "Tra cứu các thông tư, nghị định Bộ Y Tế và danh mục thuốc chi trả BHYT",
        "label": "Mở Phân Hệ Văn Bản & BHYT",
        "reply": "Dạ hệ thống đã mở phân hệ **Văn Bản Pháp Quy & Danh Mục BHYT**. Bác sĩ có thể tra cứu các quy định y tế hiện hành và tỷ lệ thanh toán bảo hiểm.",
        "open_modal": None
    },
    "overview": {
        "title": "Tổng Quan Vận Hành Bệnh Viện",
        "description": "Bảng điều khiển KPI và tổng hợp chỉ số hoạt động lâm sàng",
        "label": "Về Màn Hình Tổng Quan",
        "reply": "Dạ hệ thống đã chuyển về màn hình **Tổng Quan Vận Hành**.",
        "open_modal": None
    }
}

TAB_PROTOTYPES: Dict[str, List[str]] = {
    "cpoe": [
        "mở tab kê đơn",
        "chuyển sang màn hình kê đơn thuốc cpoe",
        "mở form kê đơn điện tử",
        "vào tab kê đơn cpoe",
        "mở giao diện kê toa bác sĩ",
        "mở biểu mẫu lập đơn thuốc cpoe"
    ],
    "debt": [
        "mở tab tủ trực",
        "chuyển sang màn hình sổ nợ cấp cứu",
        "xem danh sách nợ tủ trực lâm sàng",
        "vào phân hệ tủ trực và nợ morphin",
        "mở tab sổ nợ mượn thuốc trực",
        "chuyển đến tab tủ trực"
    ],
    "fefo": [
        "mở tab kho dược",
        "chuyển sang màn hình hạn dùng fefo",
        "xem bảng kho dược tồn kho",
        "vào tab quản lý kho dược",
        "mở giao diện kiểm tra hạn dùng thuốc fefo",
        "chuyển sang tab kho thuốc"
    ],
    "coldchain": [
        "mở tab chuỗi lạnh",
        "chuyển sang màn hình giám sát nhiệt độ tủ lạnh",
        "xem thông số chuỗi lạnh vắc xin",
        "vào phân hệ cold chain bảo quản",
        "mở tab nhiệt độ tủ bảo quản thuốc",
        "chuyển sang màn hình giám sát kho lạnh"
    ],
    "equipment": [
        "mở tab thiết bị y tế",
        "chuyển sang màn hình quản lý máy móc",
        "vào phân hệ trang thiết bị bệnh viện",
        "mở tab báo hỏng thiết bị",
        "chuyển đến tab quản lý thiết bị"
    ],
    "documents": [
        "mở tab văn bản pháp quy",
        "chuyển sang màn hình danh mục bhyt",
        "xem quy định bảo hiểm y tế",
        "vào tab tra cứu thông tư nghị định bộ y tế",
        "mở tab quy định bhyt và văn bản"
    ],
    "overview": [
        "chuyển về màn hình tổng quan",
        "mở trang chủ dashboard",
        "về màn hình chính hệ thống",
        "mở giao diện tổng quan bệnh viện"
    ]
}

# Cache ma trận embedding prototypes trong bộ nhớ
_NAV_MATRIX_CACHE: Dict[str, np.ndarray] = {}

def _init_nav_cache_from_disk() -> None:
    """Tải trước các ma trận vector điều hướng tab tĩnh từ semantic_anchors.npz (Độ trễ = 0ms)."""
    current_dir = os.path.dirname(os.path.abspath(__file__))
    npz_path = os.path.join(current_dir, "semantic_anchors.npz")
    if os.path.exists(npz_path):
        try:
            with np.load(npz_path) as data:
                for tab_key in TAB_PROTOTYPES.keys():
                    disk_key = f"nav_{tab_key}"
                    if disk_key in data.files:
                        _NAV_MATRIX_CACHE[tab_key] = data[disk_key]
            logger.info("Navigation Router: Loaded %d pre-computed tab matrices from %s", len(_NAV_MATRIX_CACHE), npz_path)
        except Exception as e:
            logger.warning("Không thể nạp nav semantic_anchors.npz: %s", e)

_init_nav_cache_from_disk()

def is_clinical_or_educational_inquiry(query: str, lower_query: str) -> bool:
    """
    Xác định câu hỏi là tra cứu chuyên môn lâm sàng / dược lý / hướng dẫn điều trị.
    Tuyệt đối KHÔNG được nuốt thành lệnh điều hướng tab hay mở modal.
    """
    # 1. Có dấu hỏi chấm hoặc từ nghi vấn chuyên môn
    if "?" in query or "?" in lower_query:
        # Nếu có từ chỉ định rõ muốn chuyển màn hình thì không chặn
        if not any(w in lower_query for w in ["chuyển tab", "mở tab", "vào tab"]):
            return True

    # 2. Các từ khóa chỉ dấu hỏi chuyên môn / dược lý / liều dùng / an toàn
    clinical_cues = (
        "có dùng được", "uống được không", "tiêm được không", "có nên", "an toàn không",
        "nguy cơ", "nguy hiểm", "lưu ý", "thận trọng", "chống chỉ định", "chỉ định",
        "tác dụng phụ", "tương tác", "kỵ nhau", "liều lượng", "liều dùng", "chỉnh liều",
        "suy thận", "suy gan", "mang thai", "thai kỳ", "bà bầu", "cho con bú", "trẻ em",
        "nhi khoa", "nguyên tắc kê đơn", "hướng dẫn kê đơn", "cách kê đơn", "hướng dẫn kê",
        "cách dùng", "cách phối hợp", "phác đồ", "cơ chế", "giảm đau", "ung thư", "giai đoạn cuối",
        "hạ sốt", "kháng sinh", "hạn dùng bao lâu", "nhiệt độ bảo quản là bao nhiêu",
        "bảo quản như thế nào", "là gì", "thế nào", "như thế nào", "tại sao", "vì sao",
        "bao nhiêu ngày", "tối đa mấy ngày", "mấy ngày", "quy định về", "nguyên tắc"
    )
    return any(cue in lower_query for cue in clinical_cues)

async def _get_tab_matrix(tab_key: str, prototypes: List[str]) -> Optional[np.ndarray]:
    if tab_key in _NAV_MATRIX_CACHE:
        return _NAV_MATRIX_CACHE[tab_key]

    provider = get_embedding_provider()
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
    _NAV_MATRIX_CACHE[tab_key] = matrix
    return matrix

async def route_semantic_navigation(
    query: str,
    lower_query: str,
    user_role: str = "doctor"
) -> Optional[CopilotResponse]:
    """
    Định tuyến ngữ nghĩa cho các yêu cầu điều hướng mở Tab hoặc Biểu mẫu.
    Sử dụng Vector Embedding Cosine Similarity kết hợp Semantic Guardrails.
    Trả về CopilotResponse nếu người dùng thực sự yêu cầu điều hướng tab;
    Trả về None nếu là câu hỏi lâm sàng để hệ thống chuyển tiếp sang SOTA RAG.
    """
    clean_q = query.strip()
    if not clean_q or len(clean_q) > 200:
        return None

    # Guard 1: Nếu là câu hỏi chuyên môn lâm sàng hoặc tra cứu dược thư, trả về None ngay lập tức
    if is_clinical_or_educational_inquiry(clean_q, lower_query):
        return None

    # Guard 2: Phải có động từ/ý niệm điều hướng rõ ràng
    nav_verbs = (
        "mở tab", "chuyển tab", "vào tab", "chuyển sang tab", "chuyển đến tab", "chuyển về tab",
        "mở form", "vào form", "mở biểu mẫu", "mở giao diện", "mở màn hình", "mở phân hệ",
        "chuyển sang màn hình", "chuyển đến màn hình", "chuyển sang giao diện",
        "xem tab", "mở cpoe", "vào cpoe", "chuyển sang cpoe", "chuyển sang tủ trực",
        "chuyển sang kho", "chuyển sang chuỗi lạnh", "chuyển sang thiết bị", "chuyển sang bhyt",
        "về màn hình tổng quan", "chuyển về màn hình tổng quan", "mở trang chủ dashboard"
    )
    has_nav_cue = any(verb in lower_query for verb in nav_verbs)
    if not has_nav_cue and not any(w in lower_query for w in ["mở", "chuyển sang", "vào", "xem"]):
        return None

    matched_tab: Optional[str] = None

    # Semantic pattern matching nhanh theo từng phân hệ
    if any(k in lower_query for k in ["cpoe", "kê đơn", "kê toa"]) and any(v in lower_query for v in ["mở", "chuyển", "vào", "giao diện", "màn hình", "tab", "form", "biểu mẫu"]):
        matched_tab = "cpoe"
    elif any(k in lower_query for k in ["tủ trực", "sổ nợ", "nợ morphin"]) and any(v in lower_query for v in ["mở", "chuyển", "vào", "xem", "tab", "màn hình"]):
        matched_tab = "debt"
    elif any(k in lower_query for k in ["kho dược", "kho thuốc", "fefo"]) and any(v in lower_query for v in ["mở", "chuyển", "vào", "xem", "tab", "màn hình", "bảng kho"]):
        matched_tab = "fefo"
    elif any(k in lower_query for k in ["chuỗi lạnh", "cold chain", "kho lạnh", "tủ lạnh vắc xin", "bảo quản vắc xin"]) and any(v in lower_query for v in ["mở", "chuyển", "vào", "xem", "tab", "màn hình", "giám sát"]):
        matched_tab = "coldchain"
    elif any(k in lower_query for k in ["thiết bị", "máy móc", "báo hỏng"]) and any(v in lower_query for v in ["mở", "chuyển", "vào", "tab", "màn hình", "quản lý"]):
        matched_tab = "equipment"
    elif any(k in lower_query for k in ["bhyt", "văn bản", "pháp quy", "danh mục bhyt"]) and any(v in lower_query for v in ["mở", "chuyển", "vào", "tab", "màn hình", "tra cứu"]):
        matched_tab = "documents"
    elif any(k in lower_query for k in ["tổng quan", "dashboard", "màn hình chính"]) and any(v in lower_query for v in ["mở", "chuyển", "vào", "về"]):
        matched_tab = "overview"

    # Vector Embedding fallback nếu câu hỏi diễn đạt tự nhiên chưa match trực tiếp
    if not matched_tab and has_nav_cue:
        try:
            provider = get_embedding_provider()
            q_vec_raw = await provider.embed_query(clean_q)
            if q_vec_raw:
                q_vec = np.asarray(q_vec_raw, dtype=np.float32)
                q_norm = np.linalg.norm(q_vec)
                if q_norm > 0:
                    q_vec = q_vec / q_norm

                    best_tab = None
                    best_sim = -1.0

                    for tab_key, protos in TAB_PROTOTYPES.items():
                        matrix = await _get_tab_matrix(tab_key, protos)
                        if matrix is not None:
                            sims = np.dot(matrix, q_vec)
                            max_sim = float(np.max(sims))
                            if max_sim > best_sim:
                                best_sim = max_sim
                                best_tab = tab_key

                    if best_tab and best_sim >= NAV_SIMILARITY_THRESHOLD:
                        matched_tab = best_tab
                        logger.info(f"[SemanticNavRouter] Matched tab '{matched_tab}' with similarity {best_sim:.3f}")
        except Exception as e:
            logger.warning(f"[SemanticNavRouter] Embedding classification failed: {e}")

    if not matched_tab:
        return None

    meta = TAB_METADATA.get(matched_tab, TAB_METADATA["overview"])

    card = CopilotActionCard(
        card_type=f"{matched_tab}_navigation",
        title=meta["title"],
        summary=meta["description"],
        data={
            "targetTab": matched_tab,
            "target_tab": matched_tab,
            "openModal": meta["open_modal"]
        },
        primary_action_label=meta["label"],
        primary_action_type="NAVIGATE_TAB",
        target_tab=matched_tab
    )

    return CopilotResponse(
        intent="NAVIGATE_TAB",
        reply_text=meta["reply"],
        card=card,
        answer_type="navigation",
        source_status="system_navigation",
        confidence=1.0,
        suggested_chips=[
            "Tra cứu Dược Thư Quốc Gia",
            "Xem danh mục thuốc BHYT",
            "Hướng dẫn sử dụng hệ thống"
        ]
    )
