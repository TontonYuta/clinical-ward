"""
Bộ Điều Phối Kịch Bản Lâm Sàng Chuyên Sâu Tích Hợp Gemini AI & CSDL Bệnh Viện Thực Tế
Toàn bộ kịch bản đã được tách thành các module độc lập và điều phối bởi Agentic NLU Router (Zero Hardcoded Keywords).
Tuân thủ chuẩn Google AMIE (Multi-turn Context Buffer) và Nguyên tắc Trách Nhiệm Đơn Lẻ (SRP).
"""

from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas.copilot import CopilotResponse
from app.services.scenarios.registry import dispatch_clinical_scenario
from app.services.chatbot.agentic_router import route_clinical_intent, ClinicalIntent
from app.services.chatbot import agentic_tools

async def detect_and_handle_gemini_clinical_scenario(
    query: str,
    lower_query: str,
    user_name: str,
    db: AsyncSession,
    user_role: str = "nurse",
    session_id: Optional[str] = None
) -> Optional[CopilotResponse]:
    # 1. Zero-Hardcoded Agentic NLU & Real Database Tools
    agentic_intent = await route_clinical_intent(query, user_role=user_role)

    if agentic_intent.intent == ClinicalIntent.DISPENSE_MEDICATION:
        return await agentic_tools.execute_dispense_tool(db, agentic_intent, user_name, user_role)

    if agentic_intent.intent == ClinicalIntent.REPORT_EQUIPMENT_INCIDENT:
        return await agentic_tools.execute_equipment_tool(db, agentic_intent, user_name, user_role)

    if agentic_intent.intent == ClinicalIntent.FEFO_INVENTORY_CHECK:
        return await agentic_tools.execute_fefo_tool(db, threshold_days=agentic_intent.threshold_days)

    if agentic_intent.intent == ClinicalIntent.RESTOCK_PROPOSAL:
        return await agentic_tools.execute_restock_tool(db)

    if agentic_intent.intent == ClinicalIntent.SHIFT_HANDOVER_AUDIT:
        return await agentic_tools.execute_shift_handover_tool(db, user_name, user_role)

    if agentic_intent.intent == ClinicalIntent.COLDCHAIN_CHECK:
        return await agentic_tools.execute_coldchain_tool(db, query=query)

    # 2. Phân phối các kịch bản lâm sàng hiện hữu
    return await dispatch_clinical_scenario(
        query=query,
        lower_query=lower_query,
        user_name=user_name,
        user_role=user_role,
        session_id=session_id,
        db=db
    )
