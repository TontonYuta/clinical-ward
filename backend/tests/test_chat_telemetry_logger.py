"""
Kiểm thử dịch vụ Ghi nhận Telemetry & Đồng bộ Token (chat_telemetry_logger.py).
"""
import pytest
from app.database import AsyncSessionLocal
from app.schemas.copilot import CopilotQuery, CopilotResponse
from app.services.chatbot.chat_telemetry_logger import (
    reconcile_copilot_telemetry,
    record_chat_telemetry_log,
)


def test_reconcile_copilot_telemetry_with_tokens():
    resp = CopilotResponse(
        intent="MEDICATION_SAFETY_PROFILE",
        reply_text="Liều dùng Paracetamol 500mg...",
        answer_type="medication_field",
        legal_basis="Dược Thư Quốc Gia",
        suggested_chips=[]
    )
    last_exec = {
        "model": "gemini-3.5-flash-lite",
        "provider": "gemini",
        "prompt_tokens": 1250,
        "completion_tokens": 280,
        "model_call_count": 1,
        "provider_call_count": 1,
        "usage_source": "provider",
        "cache_hits": 0,
    }
    p, c, tot = reconcile_copilot_telemetry(resp, last_exec=last_exec, cached_resp=False)
    assert p == 1250
    assert c == 280
    assert tot == 1530
    assert resp.prompt_tokens == 1250
    assert resp.completion_tokens == 280
    assert resp.total_tokens == 1530
    assert resp.model_name == "gemini-3.5-flash-lite"
    assert resp.provider == "gemini"
    assert resp.availability_mode == "online_ai"


@pytest.mark.asyncio
async def test_record_chat_telemetry_log_persisted():
    async with AsyncSessionLocal() as db:
        payload = CopilotQuery(
            query="Kiểm tra liều dùng Paracetamol",
            user_name="Ban Giám Đốc",
            user_role="director",
            session_id="test_telemetry_session_01"
        )
        resp = CopilotResponse(
            intent="MEDICATION_SAFETY_PROFILE",
            reply_text="Liều dùng người lớn: 500 - 1000 mg/lần.",
            answer_type="medication_field",
            prompt_tokens=850,
            completion_tokens=120,
            total_tokens=970,
            usage_source="provider",
            model_call_count=1,
            model_name="gemini-3.5-flash-lite",
            provider="gemini",
            legal_basis="Dược Thư Quốc Gia",
            suggested_chips=[]
        )
        log_entry = await record_chat_telemetry_log(
            db,
            payload=payload,
            response=resp,
            session_id="test_telemetry_session_01",
            user_name="Ban Giám Đốc",
            user_role="director",
            latency_ms=120.5,
        )
        assert log_entry is not None
        assert log_entry.prompt_tokens == 850
        assert log_entry.completion_tokens == 120
        assert log_entry.total_tokens == 970
        assert log_entry.model_name == "gemini-3.5-flash-lite"
        assert log_entry.user_name == "Ban Giám Đốc"
        assert log_entry.user_role == "director"
