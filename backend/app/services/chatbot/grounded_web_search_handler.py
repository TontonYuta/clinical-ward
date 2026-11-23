"""
Module xử lý luồng Hỏi đáp Tìm kiếm Web Thời gian thực (Grounded Web Search Turn Handler).
Được kích hoạt khi người dùng bật công tắc tìm kiếm Web trên giao diện (enable_web_search = True).
Kết hợp Serper (Google Search), Cache RAM, DuckDuckGo fallback, kiểm tra link sống và chống link ảo.
"""

from typing import Optional, List, Dict, Any
import logging
import os
from app.schemas.copilot import CopilotQuery, CopilotResponse
from app.services.chatbot.web_search_engine import (
    search_and_verify_web,
    format_web_search_context,
    sanitize_ai_response_urls,
    WebSearchResult
)

logger = logging.getLogger(__name__)

# Các từ khóa nghiệp vụ nội bộ bệnh viện nên ưu tiên hệ thống quản trị thay vì search web
INTERNAL_OPERATIONAL_KEYWORDS = [
    "bàn giao ca", "giao ban", "nợ ca", "vỏ morphin", "sự cố máy", 
    "tủ vắc xin", "khoa phòng", "phiếu lĩnh", "tồn kho khoa"
]


def is_internal_operational_query(query: str) -> bool:
    q = query.lower()
    return any(k in q for k in INTERNAL_OPERATIONAL_KEYWORDS)


async def handle_grounded_web_search_turn(
    payload: CopilotQuery,
    user_role: str = "doctor"
) -> Optional[CopilotResponse]:
    """
    Xử lý truy vấn khi người dùng BẬT công tắc Web Search.
    Nếu là thao tác nội bộ bệnh viện (ca trực, tủ lạnh), trả về None để hệ thống nội bộ xử lý.
    Nếu là thông tin y tế, dược phẩm, phác đồ, tin tức thời gian thực -> tìm kiếm web và trả về CopilotResponse.
    """
    if not payload.enable_web_search:
        return None

    query = payload.query.strip()
    if not query:
        return None

    # Nếu câu hỏi là nghiệp vụ ca trực nội bộ, nhường quyền cho DB nội bộ
    if is_internal_operational_query(query):
        logger.info("Web search đang bật nhưng query mang tính nghiệp vụ ca trực nội viện, bỏ qua search web.")
        return None

    # 1. Thực hiện tìm kiếm web và xác minh link sống
    results, source_used = await search_and_verify_web(query, max_results=5)

    if not results:
        return CopilotResponse(
            intent="GROUNDED_WEB_SEARCH",
            reply_text=(
                f"🌐 **Kết quả tìm kiếm Web thời gian thực**\n\n"
                f"Hệ thống không tìm thấy tài liệu phù hợp trên Internet cho câu hỏi: *\"{query}\"*.\n"
                f"Vui lòng thử lại với từ khóa cụ thể hơn hoặc tắt nút tìm kiếm Web để tra cứu trong Dược Thư Quốc Gia nội bộ."
            ),
            legal_basis="Tìm kiếm Internet trực tiếp",
            answer_type="grounded_web_reference",
            source_status="no_search_results",
            confidence=0.5,
            suggested_chips=["Tra cứu Dược Thư Quốc Gia", "Phác đồ điều trị Bộ Y Tế", "Hướng dẫn sử dụng"]
        )

    # 2. Xây dựng prompt kèm ngữ cảnh từ kết quả tìm kiếm đã xác minh
    context_text = format_web_search_context(results)
    allowed_urls = {r.url for r in results}

    system_instruction = (
        "Bạn là Trợ lý AI Y Tế & Dược Lâm Sàng Thông Minh với tính năng Tìm kiếm Web Thời Gian Thực.\n"
        "Nhiệm vụ của bạn là đọc kỹ dữ liệu tìm kiếm Internet đã được xác minh dưới đây và trả lời câu hỏi của người dùng một cách chính xác, khách quan, súc tích và có trích dẫn rõ ràng.\n"
        "QUY TẮC BẮT BUỘC:\n"
        "1. CHỈ sử dụng thông tin và đường dẫn URL có trong danh sách tìm kiếm được cung cấp. Tuyệt đối không tự bịa đặt hay suy đoán URL khác.\n"
        "2. Định dạng nguồn tham khảo ở cuối câu trả lời theo chuẩn Markdown: [Tên nguồn/Tiêu đề](URL).\n"
        "3. Kết thúc câu trả lời bằng lưu ý an toàn y khoa ngắn gọn: '⚠️ *Lưu ý: Thông tin tìm kiếm từ Internet mang tính chất tham khảo, không thay thế chỉ định chuyên môn của bác sĩ.*'"
    )

    prompt = (
        f"{context_text}\n\n"
        f"CÂU HỎI CỦA NGƯỜI DÙNG: {query}\n\n"
        f"Hãy tổng hợp câu trả lời theo đúng các quy tắc trên."
    )

    # 3. Gọi Gemini LLM để tổng hợp
    from app.services.llm_provider import query_clinical_llm
    from app.services.admin_key_vault import get_active_api_key
    from app.config import settings

    api_key = get_active_api_key(provider="gemini") or settings.GEMINI_API_KEY
    raw_ai_text = await query_clinical_llm(
        prompt=prompt,
        system_instruction=system_instruction,
        api_key=api_key or "",
        temperature=0.2,
        max_output_tokens=1000,
        timeout_sec=12.0
    )

    # Nếu LLM không khả dụng (offline / hết quota), hiển thị kết quả tìm kiếm thô có cấu trúc
    if not raw_ai_text:
        summary_lines = [
            f"🌐 **Kết quả tìm kiếm Internet cho \"{query}\" (Nguồn: {source_used.upper()}):**\n"
        ]
        for idx, item in enumerate(results, 1):
            summary_lines.append(f"**{idx}. [{item.title}]({item.url})**  \n*{item.source_domain}*  \n{item.snippet}\n")
        summary_lines.append("\n⚠️ *Lưu ý: Thông tin tìm kiếm từ Internet mang tính chất tham khảo.*")
        final_text = "\n".join(summary_lines)
    else:
        # 4. Hậu kiểm chống link ảo (Anti-hallucination URL Sanitization)
        final_text = sanitize_ai_response_urls(raw_ai_text, allowed_urls)

    # 5. Xây dựng danh sách citations
    citations: List[Dict[str, Any]] = [
        {
            "title": r.title,
            "url": r.url,
            "domain": r.source_domain,
            "snippet": r.snippet[:160],
            "verified_live": r.is_live
        }
        for r in results
    ]

    source_label = "Google Search (Serper)" if source_used == "serper" else ("DuckDuckGo" if source_used == "duckduckgo" else "Cache")

    return CopilotResponse(
        intent="GROUNDED_WEB_SEARCH",
        reply_text=final_text,
        legal_basis=f"Tìm kiếm thời gian thực qua {source_label} & Kiểm tra link sống",
        answer_type="grounded_web_reference",
        source_status="grounded_web_search",
        confidence=0.92,
        citations=citations,
        suggested_chips=["Cập nhật phác đồ mới nhất", "Xem thêm nguồn khác", "Tra cứu Dược Thư"]
    )
