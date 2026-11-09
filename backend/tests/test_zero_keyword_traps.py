"""
Test Suite chuyên biệt: Kiểm chứng triệt tiêu hoàn toàn các bẫy từ khóa (Keyword Trapping).
Đảm bảo các câu hỏi y khoa chứa từ khóa nhạy cảm ("máy", "nhiệt độ", "hết thuốc", "ca trực", "dặn uống", "sốc")
đều được chuyển tới SOTA Vector RAG / Clinical Reasoning, tuyệt đối không bị cướp quyền (hijacked)
thành các Action Card quản trị kho / thiết bị / giao ban sai ngữ cảnh.
"""
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.services.chatbot.hospital_business_dispatcher import is_inquiry_or_clinical_question


def test_is_inquiry_or_clinical_question_helper():
    """Kiểm tra độ nhạy của bộ lọc phát hiện câu hỏi y khoa / thắc mắc lâm sàng."""
    assert is_inquiry_or_clinical_question(
        "Bệnh nhân suy thận dùng máy lọc máu có uống được Paracetamol không?",
        "bệnh nhân suy thận dùng máy lọc máu có uống được paracetamol không?"
    ) is True

    assert is_inquiry_or_clinical_question(
        "Bệnh nhân sốt cao nhiệt độ 39.5 độ C thì dùng Paracetamol liều bao nhiêu?",
        "bệnh nhân sốt cao nhiệt độ 39.5 độ c thì dùng paracetamol liều bao nhiêu?"
    ) is True

    assert is_inquiry_or_clinical_question(
        "Hết thuốc Paracetamol thì có thể thay bằng thuốc gì?",
        "hết thuốc paracetamol thì có thể thay bằng thuốc gì?"
    ) is True

    assert is_inquiry_or_clinical_question(
        "Bác sĩ dặn uống Paracetamol cách nhau mấy tiếng?",
        "bác sĩ dặn uống paracetamol cách nhau mấy tiếng?"
    ) is True

    # Lệnh hành động thuần túy không được coi là câu hỏi
    assert is_inquiry_or_clinical_question(
        "Báo hỏng máy thở PB840 phòng mổ 2",
        "báo hỏng máy thở pb840 phòng mổ 2"
    ) is False

    assert is_inquiry_or_clinical_question(
        "Lập phiếu dự trù bù thuốc Mẫu 01",
        "lập phiếu dự trù bù thuốc mẫu 01"
    ) is False


@pytest.mark.asyncio
async def test_trap_dialysis_machine_does_not_trigger_equipment_incident():
    """Bẫy 'máy': Hỏi về máy lọc máu + Paracetamol không được sinh Card báo hỏng máy thở PB840."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/api/v1/copilot/chat",
            json={
                "query": "Bệnh nhân suy thận dùng máy lọc máu có uống được Paracetamol không?",
                "user_role": "doctor"
            }
        )
        assert resp.status_code == 200
        data = resp.json()
        # Không được cướp thành báo hỏng thiết bị
        assert data.get("intent") != "REPORT_EQUIPMENT_INCIDENT"
        card = data.get("card")
        if card:
            assert card.get("card_type") != "incident_confirm"
        # Phải tra cứu thông tin Paracetamol
        assert "Paracetamol" in data.get("reply_text", "") or "paracetamol" in data.get("reply_text", "").lower()


@pytest.mark.asyncio
async def test_trap_temperature_does_not_trigger_cold_chain_card():
    """Bẫy 'nhiệt độ': Hỏi về sốt nhiệt độ 39.5 độ C không được sinh Card buồng lạnh vắc xin 4.5°C."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/api/v1/copilot/chat",
            json={
                "query": "Bệnh nhân sốt cao nhiệt độ 39.5 độ C thì dùng Paracetamol liều bao nhiêu?",
                "user_role": "doctor"
            }
        )
        assert resp.status_code == 200
        data = resp.json()
        card = data.get("card")
        if card:
            assert card.get("card_type") != "coldchain_status"
        assert "Paracetamol" in data.get("reply_text", "") or "paracetamol" in data.get("reply_text", "").lower()


@pytest.mark.asyncio
async def test_trap_out_of_stock_does_not_trigger_restock_report():
    """Bẫy 'hết thuốc': Hỏi thuốc thay thế khi hết thuốc không được biến thành Phiếu dự trù Mẫu 01."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/api/v1/copilot/chat",
            json={
                "query": "Hết thuốc Paracetamol thì có thể thay thế bằng thuốc gì cho bệnh nhân?",
                "user_role": "doctor"
            }
        )
        assert resp.status_code == 200
        data = resp.json()
        card = data.get("card")
        if card:
            assert card.get("card_type") != "low_stock_report"


@pytest.mark.asyncio
async def test_trap_night_shift_does_not_trigger_shift_handover():
    """Bẫy 'ca trực': Hỏi dùng thuốc trong ca trực đêm không được sinh Biên bản đối soát ca trực 07:00 AM."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/api/v1/copilot/chat",
            json={
                "query": "Bệnh nhân vào viện trong ca trực đêm bị sốt có dùng được Paracetamol không?",
                "user_role": "doctor"
            }
        )
        assert resp.status_code == 200
        data = resp.json()
        card = data.get("card")
        if card:
            assert card.get("card_type") != "shift_handover_report"
        assert "Paracetamol" in data.get("reply_text", "") or "paracetamol" in data.get("reply_text", "").lower()


@pytest.mark.asyncio
async def test_trap_doctor_advice_does_not_trigger_email_sms_modal():
    """Bẫy 'dặn uống': Hỏi khoảng cách liều không được sinh form gửi email/sms."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/api/v1/copilot/chat",
            json={
                "query": "Bác sĩ dặn uống Paracetamol cách nhau mấy tiếng?",
                "user_role": "doctor"
            }
        )
        assert resp.status_code == 200
        data = resp.json()
        card = data.get("card")
        if card:
            assert card.get("card_type") != "prescription_advice_navigation"
        assert "tiếng" in data.get("reply_text", "") or "giờ" in data.get("reply_text", "") or "Paracetamol" in data.get("reply_text", "")


@pytest.mark.asyncio
async def test_trap_pregnancy_three_months_does_not_create_debt_card():
    """Bẫy '3 tháng đầu' + 'dùng': Khẳng định lại câu hỏi thai kỳ không bao giờ sinh phiếu nợ mượn khẩn."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/api/v1/copilot/chat",
            json={
                "query": "Phụ nữ mang thai 3 tháng đầu bị sốt có dùng được Paracetamol không?",
                "user_role": "doctor"
            }
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("card") is None
        assert data.get("intent") == "MEDICATION_SAFETY_PROFILE"
        assert "mang thai" in data.get("reply_text", "").lower()
