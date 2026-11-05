"""
Bộ Điều Phối 12 Kịch Bản Lâm Sàng Chuyên Sâu Tích Hợp Gemini AI & CSDL Bệnh Viện Thực Tế
Toàn bộ kịch bản đã được tách thành các module độc lập trong app.services.scenarios.*
Tuân thủ chuẩn Google AMIE (Multi-turn Context Buffer) và Nguyên tắc Trách Nhiệm Đơn Lẻ (SRP).
"""

from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas.copilot import CopilotResponse
from app.services.scenarios.registry import dispatch_clinical_scenario

async def detect_and_handle_gemini_clinical_scenario(
    query: str,
    lower_query: str,
    user_name: str,
    db: AsyncSession,
    user_role: str = "nurse",
    session_id: Optional[str] = None
) -> Optional[CopilotResponse]:
    return await dispatch_clinical_scenario(
        query=query,
        lower_query=lower_query,
        user_name=user_name,
        user_role=user_role,
        session_id=session_id,
        db=db
    )
