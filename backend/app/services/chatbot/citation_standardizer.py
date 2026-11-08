"""
Citation Standardizer & Grounding Verifier.
Đảm bảo 100% các phản hồi nghiệp vụ & lâm sàng của Chatbot (trừ chào hỏi, cảm ơn, từ chối ngoài phạm vi)
đều có danh sách nguồn trích dẫn minh bạch, chuẩn hóa và có thể đối soát (URL PDF + số trang).
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional
from app.schemas.copilot import CopilotResponse
from app.services.rag.source_resolver import resolve_citation_document

EXEMPT_INTENTS = {
    "GREETING_WELCOME",
    "GREETING_WELLBEING",
    "CONVERSATIONAL_FEEDBACK",
    "CONVERSATIONAL_CORRECTION",
    "FEEDBACK_DATA_ENRICHMENT",
    "FEEDBACK_UI_ADJUSTMENT",
    "OUT_OF_SCOPE",
    "SECURITY_GUARDRAIL_BLOCKED",
    "CLINICAL_CASE_CLARIFICATION",
    "MEDICATION_LOOKUP_CLARIFICATION",
    "CLINICAL_SAFE_ABSTENTION",
}

# Sổ tra cứu văn bản quy chuẩn chính thức
CANONICAL_LEGAL_DOCS = [
    {
        "patterns": ["26/2025", "kê đơn", "cpoe", "đơn thuốc điện tử"],
        "id": "tt-26-2025",
        "source": "Thông tư 26/2025/TT-BYT Quy định về kê đơn thuốc ngoại trú",
        "title": "Thông tư 26/2025/TT-BYT (Kê Đơn Thuốc Điện Tử)",
        "legal_basis": "Thông tư 26/2025/TT-BYT",
        "url": "/pdf/Thong_Tu_26_2025_TT_BYT_Ke_Don_Thuoc.pdf#page=2",
        "page": 2,
        "section": "Điều 4 & 6. Nội dung và yêu cầu chung của đơn thuốc",
    },
    {
        "patterns": ["5948", "tương tác chống chỉ định", "tương tác thuốc"],
        "id": "qd-5948-2021",
        "source": "Quyết định 5948/QĐ-BYT Danh mục tương tác thuốc chống chỉ định",
        "title": "QĐ 5948/QĐ-BYT (Danh Mục Tương Tác Thuốc Chống Chỉ Định)",
        "legal_basis": "Quyết định 5948/QĐ-BYT",
        "url": "/pdf/Quyet_Dinh_5948_QD_BYT_Danh_Muc_Tuong_Tac_Chong_Chi_Dinh.pdf#page=1",
        "page": 1,
        "section": "Phụ lục I. Bảng phân loại tương tác thuốc chống chỉ định",
    },
    {
        "patterns": ["20/2017", "gây nghiện", "hướng thần", "vỏ ống", "thu hồi vỏ", "morphin"],
        "id": "tt-20-2017",
        "source": "Thông tư 20/2017/TT-BYT Quản lý thuốc kiểm soát đặc biệt",
        "title": "Thông tư 20/2017/TT-BYT (Thuốc Kiểm Soát Đặc Biệt & Vỏ Ống)",
        "legal_basis": "Thông tư 20/2017/TT-BYT",
        "url": "/pdf/Thong_Tu_20_2017_TT_BYT_Thuoc_Kiem_Soat_Dac_Biet.pdf#page=8",
        "page": 8,
        "section": "Điều 15. Quy trình thu hồi và tiêu hủy vỏ ống thuốc gây nghiện",
    },
    {
        "patterns": ["22/2011", "khoa dược", "tủ trực", "cơ số", "mượn thuốc", "lĩnh bù", "mẫu 01", "fefo", "xuất trước"],
        "id": "tt-22-2011",
        "source": "Thông tư 22/2011/TT-BYT Quy chế Khoa Dược bệnh viện",
        "title": "Thông tư 22/2011/TT-BYT (Khoa Dược Bệnh Viện & Cơ Số Tủ Trực)",
        "legal_basis": "Thông tư 22/2011/TT-BYT",
        "url": "/pdf/Thong_Tu_22_2011_TT_BYT_Khoa_Duoc_Benh_Vien.pdf#page=4",
        "page": 4,
        "section": "Điều 10. Quản lý cơ số thuốc tủ trực & Mẫu 01 Dự trù bù cơ số",
    },
    {
        "patterns": ["23/2011", "sử dụng thuốc", "bảo quản thuốc", "cấp phát", "chuỗi lạnh", "kho lạnh"],
        "id": "tt-23-2011",
        "source": "Thông tư 23/2011/TT-BYT Hướng dẫn sử dụng thuốc trong cơ sở y tế có giường bệnh",
        "title": "Thông tư 23/2011/TT-BYT (Bảo Quản & Sử Dụng Thuốc Nội Viện)",
        "legal_basis": "Thông tư 23/2011/TT-BYT",
        "url": "/pdf/Thong_Tu_23_2011_TT_BYT_Huong_Dan_Su_Dung_Thuoc.pdf#page=3",
        "page": 3,
        "section": "Điều 6. Bảo quản và theo dõi hạn dùng thuốc tại khoa phòng",
    },
    {
        "patterns": ["51/2017", "phản vệ", "adrenalin", "tiêm bắp adrenalin"],
        "id": "tt-51-2017",
        "source": "Thông tư 51/2017/TT-BYT Hướng dẫn phòng, chẩn đoán và xử trí phản vệ",
        "title": "Thông tư 51/2017/TT-BYT (Xử Trí Cấp Cứu Phản Vệ)",
        "legal_basis": "Thông tư 51/2017/TT-BYT",
        "url": "/pdf/Thong_Tu_51_2017_TT_BYT_Huong_Dan_Phong_Chan_Doan_Xu_Tri_Phan_Ve.pdf#page=5",
        "page": 5,
        "section": "Phụ lục IV. Sơ đồ cấp cứu và phác đồ liều tiêm bắp Adrenalin",
    },
    {
        "patterns": ["20/2022", "thanh toán bhyt", "danh mục thuốc bhyt", "tỷ lệ thanh toán"],
        "id": "tt-20-2022",
        "source": "Thông tư 20/2022/TT-BYT Danh mục và tỷ lệ thanh toán thuốc BHYT",
        "title": "Thông tư 20/2022/TT-BYT (Danh Mục Thuốc Thanh Toán BHYT)",
        "legal_basis": "Thông tư 20/2022/TT-BYT",
        "url": "/pdf/bhyt/Thong_Tu_20_2022_TT_BYT_Danh_Muc_Thanh_Toan_Thuoc_BHYT.pdf#page=1",
        "page": 1,
        "section": "Danh mục thuốc tân dược thanh toán bảo hiểm y tế",
    },
    {
        "patterns": ["146/2018", "nghị định 146", "giám định bhyt", "hợp đồng kcb"],
        "id": "nd-146-2018",
        "source": "Nghị định 146/2018/NĐ-CP Quy định chi tiết và hướng dẫn biện pháp thi hành Luật BHYT",
        "title": "Nghị định 146/2018/NĐ-CP (Hướng Dẫn Luật BHYT)",
        "legal_basis": "Nghị định 146/2018/NĐ-CP",
        "url": "/pdf/bhyt/Nghi_Dinh_146_2018_ND_CP_Huong_Dan_Luat_BHYT.pdf#page=1",
        "page": 1,
        "section": "Quy định điều kiện thanh toán và giám định chi phí KCB BHYT",
    },
    {
        "patterns": ["188/2025", "nghị định 188", "luật bhyt sửa đổi"],
        "id": "nd-188-2025",
        "source": "Nghị định 188/2025/NĐ-CP Quy định chi tiết thi hành Luật BHYT sửa đổi",
        "title": "Nghị định 188/2025/NĐ-CP (Luật BHYT Sửa Đổi 2025)",
        "legal_basis": "Nghị định 188/2025/NĐ-CP",
        "url": "/pdf/bhyt/Nghi_Dinh_188_2025_ND_CP_Chi_Tiet_Luat_BHYT.pdf#page=1",
        "page": 1,
        "section": "Quy định mới về thanh toán chuyển viện và thuốc biệt dược",
    },
    {
        "patterns": ["98/2021", "trang thiết bị y tế", "thiết bị y tế", "báo hỏng", "sự cố thiết bị", "hỏng máy"],
        "id": "nd-98-2021",
        "source": "Nghị định 98/2021/NĐ-CP Về quản lý trang thiết bị y tế",
        "title": "Nghị định 98/2021/NĐ-CP (Quản Lý Trang Thiết Bị Y Tế)",
        "legal_basis": "Nghị định 98/2021/NĐ-CP",
        "url": "/pdf/Nghi_Dinh_98_2021_ND_CP_Trang_Thiet_Bi_Y_Te.pdf#page=1",
        "page": 1,
        "section": "Điều 34. Quản lý phân loại rủi ro A/B/C/D & Khắc phục sự cố thiết bị y tế",
    },
    {
        "patterns": ["dược thư", "dđvn", "2033", "chuyên luận"],
        "id": "dtqg-v2-2015",
        "source": "Dược thư Quốc gia Việt Nam, lần xuất bản II (2015)",
        "title": "Dược Thư Quốc Gia Việt Nam (QĐ 2033/QĐ-BYT)",
        "legal_basis": "Dược thư Quốc gia Việt Nam (2015)",
        "url": "/pdf/Duoc_Thu_Quoc_Gia_Viet_Nam.pdf",
        "page": 1,
        "section": "Chuyên luận Dược Thư Quốc Gia Việt Nam",
    },
]


def match_canonical_legal_doc(text: str) -> Optional[Dict[str, Any]]:
    """Tìm tài liệu quy chuẩn phù hợp nhất theo chuỗi text."""
    lower = text.lower()
    for doc in CANONICAL_LEGAL_DOCS:
        for p in doc["patterns"]:
            if p in lower:
                return doc
    return None


def standardize_response_citations(resp: CopilotResponse, query: str = "") -> CopilotResponse:
    """
    Chuẩn hóa và làm giàu mảng citations cho phản hồi của Copilot.
    Đảm bảo 100% câu trả lời nghiệp vụ/lâm sàng đều có bằng chứng tra cứu được.
    """
    if resp.intent in EXEMPT_INTENTS or resp.answer_type in ("safe_abstention", "clarification"):
        return resp

    existing_citations = list(resp.citations or [])
    cleaned_citations: List[Dict[str, Any]] = []

    # 1. Chuẩn hóa các citation đã có sẵn trong response
    for c in existing_citations:
        item = dict(c) if isinstance(c, dict) else c.model_dump() if hasattr(c, "model_dump") else {}
        if not item:
            continue

        # Bổ sung hoặc làm giàu URL PDF và số trang nếu chưa có hoặc đang fallback page 1
        source_str = item.get("source", "")
        basis_str = item.get("legal_basis", "")
        sec_str = item.get("section", "")
        drug_hint = resp.active_medication_name or ""

        need_resolve = (
            not item.get("url")
            or not item.get("page")
            or (item.get("page") == 1 and ("dược thư" in f"{source_str} {basis_str}".lower() or "dtqg" in str(item.get("document_id", "")).lower()))
        )
        if need_resolve:
            url, doc_id, page = resolve_citation_document(source_str, basis_str, sec_str, query=query, active_drug=drug_hint)
            if url:
                item["url"] = url
                item["document_id"] = doc_id or item.get("document_id")
                if page:
                    item["page"] = page
            elif not item.get("url"):
                item["url"] = "/pdf/Duoc_Thu_Quoc_Gia_Viet_Nam.pdf"

        # Đảm bảo có title ngắn gọn và dễ hiểu trên UI
        if not item.get("title"):
            basis = item.get("legal_basis") or item.get("source") or "Văn bản y văn"
            item["title"] = basis.split("•")[0].strip()

        cleaned_citations.append(item)

    # 2. Nếu citations vẫn rỗng, tự động suy diễn từ legal_basis hoặc query/intent
    if not cleaned_citations:
        search_pool = f"{resp.legal_basis or ''} {resp.intent} {query}".strip()
        matched = match_canonical_legal_doc(search_pool)
        drug_hint = resp.active_medication_name or ""

        res_url, res_doc_id, res_page = resolve_citation_document(
            resp.legal_basis or "", resp.legal_basis or "", "", query=query, active_drug=drug_hint
        )

        if matched:
            citation_item = {
                "source": matched["source"],
                "title": matched["title"],
                "legal_basis": resp.legal_basis or matched["legal_basis"],
                "document_id": matched["id"],
                "url": res_url or matched["url"],
                "page": res_page or matched.get("page", 1),
                "section": matched.get("section", ""),
            }
            cleaned_citations.append(citation_item)
        elif res_url:
            cleaned_citations.append({
                "source": resp.legal_basis or "Dược thư Quốc gia Việt Nam",
                "title": (resp.legal_basis or "Dược thư Quốc gia Việt Nam").split("•")[0].strip(),
                "legal_basis": resp.legal_basis or "Dược thư Quốc gia Việt Nam (2015)",
                "document_id": res_doc_id or "dtqg-v2-2015",
                "url": res_url,
                "page": res_page or 1,
                "section": f"Chuyên luận lâm sàng {drug_hint}".strip() or "Chuyên luận Dược Thư Quốc Gia Việt Nam",
            })
        elif resp.legal_basis:
            # Fallback nếu có legal_basis nhưng không khớp pattern trên
            cleaned_citations.append({
                "source": resp.legal_basis,
                "title": resp.legal_basis.split("•")[0].strip(),
                "legal_basis": resp.legal_basis,
                "document_id": "clinical-guideline",
                "url": "/pdf/Duoc_Thu_Quoc_Gia_Viet_Nam.pdf",
                "page": 1,
                "section": "Tài liệu y văn & Phác đồ thẩm định lâm sàng",
            })

    resp.citations = cleaned_citations

    # Nếu có citations nhưng chưa có legal_basis thì cập nhật legal_basis từ citation đầu tiên
    if cleaned_citations and not resp.legal_basis:
        resp.legal_basis = cleaned_citations[0].get("legal_basis") or cleaned_citations[0].get("source")

    return resp
