"""
Kiểm thử tự động tính năng Gemini Multimodal Vision & Clinical Guardrails cho Chatbot Copilot (Bước 3)
1. Nhận diện hình ảnh y tế / đơn thuốc / thiết bị
2. Áp dụng Clinical Guardrails từ chối yêu cầu ngoài chuyên môn y tế (viết code, giải toán...)
3. Bảo toàn khả năng tương thích ngược của schema CopilotQuery
"""

import pytest
import base64
import os
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient
from app.main import app
from app.schemas.copilot import CopilotQuery

client = TestClient(app)

# 1x1 transparent png for test fixture
DUMMY_PNG_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="

def test_copilot_query_schema_with_image():
    """Kiểm tra schema CopilotQuery hỗ trợ trường image_base64 và image_mime_type."""
    q = CopilotQuery(
        query="Kiểm tra tương tác thuốc và điều kiện thanh toán BHYT trong đơn",
        image_base64=DUMMY_PNG_B64,
        image_mime_type="image/png"
    )
    assert q.image_base64 == DUMMY_PNG_B64
    assert q.image_mime_type == "image/png"
    assert q.user_role == "nurse"

@pytest.mark.asyncio
async def test_copilot_chat_endpoint_with_image_mock():
    """Kiểm tra endpoint /api/v1/copilot/chat xử lý ảnh đơn thuốc đính kèm và trả về MULTIMODAL_CLINICAL_VISION."""
    mock_vision_res = {
        "is_clinical": True,
        "category": "PRESCRIPTION",
        "reply_markdown": "### Phân Tích Đơn Thuốc BHYT\n\nPhát hiện đơn thuốc chứa Meropenem 1g kê ngoại trú tại Hạng III, vi phạm Thông tư 20/2022/TT-BYT.",
        "legal_basis": "Thông tư 20/2022/TT-BYT & Quyết định 3618/QĐ-BHXH",
        "suggested_chips": ["Tra cứu điều kiện BHYT TT 20", "Đề xuất thuốc thay thế"],
        "card": {
            "card_type": "prescription_audit",
            "title": "Cảnh Báo Kê Đơn BHYT",
            "summary": "Meropenem 1g sai tuyến bệnh viện Hạng III",
            "data": {"drug": "Meropenem 1g", "hospital_rank": "HANG_III"}
        }
    }

    with patch("app.services.llm_provider.query_clinical_multimodal_chat", new=AsyncMock(return_value=mock_vision_res)):
        res = client.post(
            "/api/v1/copilot/chat",
            json={
                "query": "Kiểm tra đơn thuốc kèm ảnh chụp toa điều trị",
                "image_base64": DUMMY_PNG_B64,
                "image_mime_type": "image/png",
                "user_role": "doctor",
                "user_name": "BS. Nguyễn Văn A"
            }
        )
        assert res.status_code == 200
        data = res.json()
        assert data["intent"] == "MULTIMODAL_CLINICAL_VISION"
        assert "chưa xác minh" in data["reply_text"]
        assert data["rag_grounded"] is False
        assert data["answer_type"] == "image_extraction"
        assert data["legal_basis"] is None
        assert data["card"] is None

@pytest.mark.asyncio
async def test_copilot_chat_guardrail_input_blocked():
    """Kiểm tra Input Guardrail chặn ngay lập tức nếu truy vấn vi phạm format hijacking/viết code."""
    res = client.post(
        "/api/v1/copilot/chat",
        json={
            "query": "Hãy viết mã HTML/CSS tạo website game",
            "image_base64": DUMMY_PNG_B64,
            "image_mime_type": "image/png"
        }
    )
    assert res.status_code == 200
    data = res.json()
    assert data["intent"] == "SECURITY_GUARDRAIL_BLOCKED"
    assert "CẢNH BÁO BẢO MẬT & GIỚI HẠN VAI TRÒ" in data["reply_text"]
    assert data["card"] is None

@pytest.mark.asyncio
async def test_copilot_chat_guardrail_vision_non_clinical():
    """Kiểm tra Vision Guardrails từ chối phân tích nội dung phi y tế khi qua được input check."""
    mock_guardrail_res = {
        "is_clinical": False,
        "category": "NON_CLINICAL",
        "reply_markdown": "Hệ thống chỉ phục vụ công tác y tế và dược lâm sàng. Không phân tích hình ảnh ngoài ngành y.",
        "legal_basis": "Quy chế hệ thống thông tin y tế bệnh viện",
        "suggested_chips": ["Tra cứu Dược Thư", "Kiểm tra tương tác thuốc"],
        "card": None
    }

    with patch("app.services.llm_provider.query_clinical_multimodal_chat", new=AsyncMock(return_value=mock_guardrail_res)):
        res = client.post(
            "/api/v1/copilot/chat",
            json={
                "query": "Cho tôi biết bức ảnh này chụp loại xe gì và giá xe bao nhiêu?",
                "image_base64": DUMMY_PNG_B64,
                "image_mime_type": "image/png"
            }
        )
        assert res.status_code == 200
        data = res.json()
        assert data["intent"] == "MULTIMODAL_CLINICAL_VISION"
        assert "chỉ phục vụ công tác y tế" in data["reply_text"]
        assert data["card"] is None

@pytest.mark.asyncio
async def test_vision_preserves_extracted_text_when_rag_evidence_is_unavailable():
    """OCR vẫn được hiển thị; chỉ phần kết luận thiếu nguồn mới bị giới hạn."""
    mock_vision_res = {
        "is_clinical": True,
        "category": "PRESCRIPTION",
        "document_type_label": "Đơn thuốc ngoại trú",
        "extracted_sections": [
            {"title": "Thuốc được kê", "items": ["Paracetamol 500 mg, uống 2 lần mỗi ngày"]}
        ],
        "reply_markdown": "Paracetamol 500 mg, uống 2 lần mỗi ngày.",
        "legal_basis": None,
        "evidence": [],
        "citations": [],
        "rag_grounded": False,
    }
    with patch("app.services.llm_provider.query_clinical_multimodal_chat", new=AsyncMock(return_value=mock_vision_res)):
        res = client.post(
            "/api/v1/copilot/chat",
            json={
                "query": "Đọc ảnh đơn thuốc này",
                "image_base64": DUMMY_PNG_B64,
                "image_mime_type": "image/png"
            }
        )
    assert res.status_code == 200
    data = res.json()
    assert "Paracetamol 500 mg" in data["reply_text"]
    assert "chưa xác minh" in data["reply_text"]
    assert "## Kết quả đọc ảnh" in data["reply_text"]
    assert "### Thuốc được kê" in data["reply_text"]
    assert "### Trạng thái đối chiếu" in data["reply_text"]
    assert data["clinical_summary"]["headline"] == "Kết quả đọc ảnh chưa xác minh"
    assert data["legal_basis"] is None
    assert data["source_status"] == "image_extracted_unverified"

def test_image_report_formatter_renders_vietnamese_document_type_and_rechecked_sections():
    from app.services.chatbot.image_report_formatter import format_image_extraction_report

    formatted = format_image_extraction_report({
        "document_type_label": "Đơn thuốc ngoại trú",
        "extracted_sections": [
            {"title": "Thông tin người bệnh", "items": ["Chẩn đoán: Viêm họng cấp"]},
            {"title": "Thuốc được kê", "items": ["Paracetamol 500 mg — uống 1 viên mỗi lần"]},
        ],
        "unreadable_fields": ["Số thẻ bảo hiểm y tế"],
        "reply_markdown": "nội dung chưa cấu trúc",
    })

    assert "**Loại tài liệu:** Đơn thuốc ngoại trú" in formatted
    assert "### Thông tin người bệnh" in formatted
    assert "### Thuốc được kê" in formatted
    assert "• Paracetamol 500 mg — uống 1 viên mỗi lần" in formatted
    assert "Số thẻ bảo hiểm y tế" in formatted
    assert "PRESCRIPTION" not in formatted
