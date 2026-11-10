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
        query="Báo hỏng máy thở Bennett phòng mổ 2",
        image_base64=DUMMY_PNG_B64,
        image_mime_type="image/png"
    )
    assert q.image_base64 == DUMMY_PNG_B64
    assert q.image_mime_type == "image/png"
    assert q.user_role == "nurse"

@pytest.mark.asyncio
async def test_copilot_chat_endpoint_with_image_mock():
    """Kiểm tra endpoint /api/v1/copilot/chat xử lý ảnh đính kèm và trả về MULTIMODAL_CLINICAL_VISION."""
    mock_vision_res = {
        "is_clinical": True,
        "category": "EQUIPMENT",
        "reply_markdown": "### Báo Hỏng Thiết Bị Y Tế\n\nPhát hiện dây thở máy thở Puritan Bennett bị rách 2cm.",
        "legal_basis": "Nghị định 98/2021/NĐ-CP & Thông tư 05/2022/TT-BYT",
        "suggested_chips": ["Lập phiếu báo hỏng", "Kiểm tra máy dự phòng"],
        "card": {
            "card_type": "incident_confirm",
            "title": "Phiếu Báo Hỏng Thiết Bị Y Tế",
            "summary": "Puritan Bennett 840 rách dây thở",
            "data": {"device": "Puritan Bennett 840", "room": "Phòng mổ 2"}
        }
    }

    with patch("app.services.llm_provider.query_clinical_multimodal_chat", new=AsyncMock(return_value=mock_vision_res)):
        res = client.post(
            "/api/v1/copilot/chat",
            json={
                "query": "Báo hỏng dây thở máy thở Bennett phòng mổ 2 kèm ảnh hiện trường",
                "image_base64": DUMMY_PNG_B64,
                "image_mime_type": "image/png",
                "user_role": "nurse",
                "user_name": "ĐD. Lê Thị Thu"
            }
        )
        assert res.status_code == 200
        data = res.json()
        assert data["intent"] == "MULTIMODAL_CLINICAL_VISION"
        assert "Puritan Bennett" in data["reply_text"]
        assert data["legal_basis"] == "Nghị định 98/2021/NĐ-CP & Thông tư 05/2022/TT-BYT"
        assert data["card"] is not None
        assert data["card"]["card_type"] == "incident_confirm"

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
