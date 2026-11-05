"""Kiểm thử Hệ thống Suy Luận Nhân Khẩu Học Lâm Sàng & Khử Emoji Chatbot (Pediatric Demographic Slot Reasoning)."""

import pytest
import re
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.services.clinical_reasoning.pediatric_dosage_reasoner import (
    extract_demographic_slots,
    reason_pediatric_dosage,
    is_pediatric_query
)

EMOJI_PATTERN = re.compile(r"[\U00010000-\U0010ffff]|[\u2600-\u27bf]|[\u2300-\u23ff]")

def test_extract_demographic_slots():
    """Kiểm thử bóc tách slot tuổi, cân nặng và đường dùng."""
    # 1. Tuổi 12
    s1 = extract_demographic_slots("trẻ 12 tuổi uống paracetamol như thế nào")
    assert s1["age_years"] == 12.0
    assert s1["is_pediatric"] is True
    assert s1["route_preference"] == "oral"

    # 2. Tuổi tháng
    s2 = extract_demographic_slots("bé 6 tháng tuổi sốt uống liều bao nhiêu")
    assert s2["age_months"] == 6
    assert s2["is_pediatric"] is True

    # 3. Kèm cân nặng
    s3 = extract_demographic_slots("trẻ 12 tuổi 38kg dùng thuốc hạ sốt gì")
    assert s3["age_years"] == 12.0
    assert s3["weight_kg"] == 38.0
    assert s3["is_pediatric"] is True

    # 4. Sơ sinh
    s4 = extract_demographic_slots("bé sơ sinh non tháng")
    assert s4["is_neonate"] is True
    assert s4["is_pediatric"] is True


def test_reason_pediatric_dosage_12yo():
    """Kiểm thử suy luận liều đích cho trẻ 12 tuổi: Liều 500mg, không dump sơ sinh, không emoji."""
    query = "trẻ 12 tuổi uống paracetamol như thế nào"
    slots = extract_demographic_slots(query)
    raw_mono = (
        "Đau, sốt: Uống: Sơ sinh 28 - 32 tuần chỉnh theo tuổi thai: 20 mg/kg... "
        "Trẻ em 10 12 tuổi: 480 - 500 mg; Trẻ em 12 - 16 tuổi: 480 - 750 mg..."
    )
    res = reason_pediatric_dosage("Paracetamol", "paracetamol", raw_mono, query, slots)
    assert res is not None

    # Khẳng định có liều chuẩn cho trẻ 12 tuổi
    assert "500 mg" in res
    assert "4 – 6 giờ" in res
    assert "4 lần / 24 giờ" in res
    assert "10 – 15 mg/kg" in res

    # Khẳng định KHÔNG dump chuỗi sơ sinh
    assert "28 - 32 tuần" not in res
    assert "Sơ sinh" not in res or "sơ sinh" not in res.lower().split("[liều dùng khuyến cáo cho trẻ 12 tuổi]")[1]

    # Khẳng định ZERO emoji
    emojis = EMOJI_PATTERN.findall(res)
    assert len(emojis) == 0, f"Phát hiện emoji trong câu trả lời: {emojis}"


def test_reason_pediatric_dosage_with_weight():
    """Kiểm thử suy luận khi có cân nặng cụ thể (40kg)."""
    query = "trẻ 12 tuổi nặng 40kg dùng paracetamol thế nào"
    slots = extract_demographic_slots(query)
    res = reason_pediatric_dosage("Paracetamol", "paracetamol", "", query, slots)
    assert res is not None

    # Kiểm tra tính toán 40kg * 10 - 15 = 400 - 600mg
    assert "400 – 600 mg/lần" in res
    assert "2400 mg/ngày" in res


@pytest.mark.asyncio
async def test_api_copilot_chat_pediatric_12yo_integration():
    """Kiểm thử API tích hợp: Chatbot phản hồi đúng liều 12 tuổi và không chứa emoji tiêu đề/body."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/api/v1/copilot/chat",
            json={
                "query": "trẻ 12 tuổi uống paracetamol như thế nào",
                "session_id": "test_pediatric_reasoning_suite"
            }
        )
        assert resp.status_code == 200
        data = resp.json()
        reply = data.get("reply_text", "")

        # Kiểm tra nội dung suy luận đích
        assert "trẻ 12 tuổi" in reply.lower()
        assert "500 mg" in reply
        assert "4 – 6 giờ" in reply

        # Kiểm tra KHÔNG đổ toàn bộ monograph sơ sinh
        assert "28 - 32 tuần" not in reply

        # Kiểm tra KHÔNG có emoji
        emojis = EMOJI_PATTERN.findall(reply)
        assert len(emojis) == 0, f"Phát hiện emoji trong phản hồi chatbot API: {emojis}"
