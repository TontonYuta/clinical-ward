"""
Bộ điều phối Kịch bản Lâm sàng Chuyên sâu (Scenario Registry & Dispatcher)
Tập hợp các Scenario Handlers độc lập và quản lý bộ nhớ ngữ cảnh nhiều lượt (AMIE Multi-turn Context).
"""

from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.patient import PatientProfile
from app.models.cpoe import CpoePrescription
from app.schemas.copilot import CopilotResponse
from app.services.session_context import get_or_create_session
from app.services.scenarios.context import ClinicalContext
from app.services.scenarios.base import BaseScenario
from app.services.scenarios.case_ceftriaxone_calcium import CeftriaxoneCalciumScenario
from app.services.scenarios.case_red_man import RedManScenario
from app.services.scenarios.case_statin_food import StatinFoodScenario
from app.services.scenarios.case_high_alert_kcl import HighAlertKclScenario
from app.services.scenarios.case_opioid_mme import OpioidMmeScenario
from app.services.scenarios.case_anaphylaxis import AnaphylaxisScenario
from app.services.scenarios.case_allergy_cdss import AllergyCdssScenario
from app.services.scenarios.case_renal_dosing import RenalDosingScenario
from app.services.scenarios.case_inventory_check import InventoryCheckScenario
from app.services.scenarios.case_prescription_inquiry import PrescriptionInquiryScenario
from app.services.scenarios.case_coldchain_quarantine import ColdChainQuarantineScenario
from app.services.scenarios.case_adr import AdrReportingScenario

# Danh sách toàn bộ 12 kịch bản lâm sàng được tách file độc lập
SCENARIOS: List[BaseScenario] = [
    CeftriaxoneCalciumScenario(),
    RedManScenario(),
    StatinFoodScenario(),
    HighAlertKclScenario(),
    OpioidMmeScenario(),
    AnaphylaxisScenario(),
    AllergyCdssScenario(),
    RenalDosingScenario(),
    InventoryCheckScenario(),
    PrescriptionInquiryScenario(),
    ColdChainQuarantineScenario(),
    AdrReportingScenario(),
]

async def dispatch_clinical_scenario(
    query: str,
    lower_query: str,
    user_name: str,
    user_role: str,
    session_id: Optional[str],
    db: AsyncSession
) -> Optional[CopilotResponse]:
    # 1. Nạp session và kiểm tra ngữ cảnh đa lượt (AMIE Multi-turn context)
    session = get_or_create_session(session_id, user_name, user_role)
    
    # 2. Tra cứu danh sách bệnh nhân và đơn thuốc
    res = await db.execute(select(PatientProfile))
    all_patients = res.scalars().all()
    
    rx_res = await db.execute(select(CpoePrescription))
    all_rxs = rx_res.scalars().all()
    
    # 3. Định danh bệnh nhân trong câu truy vấn (Tránh nhầm 'trí' trong 'xử trí')
    detected_patient = None
    for p in all_patients:
        last_word = p.full_name.split()[-1].lower()
        if (
            p.full_name.lower() in lower_query
            or p.id.lower() in lower_query
            or f"bệnh nhân {last_word}" in lower_query
            or f"bn {last_word}" in lower_query
            or f"bn. {last_word}" in lower_query
        ):
            detected_patient = p
            break

    # Nếu người dùng đổi bệnh nhân hoặc chỉ định bệnh nhân mới -> Cập nhật session
    is_follow_up = False
    if detected_patient:
        session.set_active_patient(detected_patient.id, detected_patient.full_name)
    else:
        # Kiểm tra danh sách bệnh nhân có trong đơn thuốc CPOE
        for rx in all_rxs:
            last_word = rx.patient_name.split()[-1].lower()
            if (
                rx.patient_name.lower() in lower_query
                or f"bệnh nhân {last_word}" in lower_query
                or f"bn {last_word}" in lower_query
                or f"bn. {last_word}" in lower_query
            ):
                session.set_active_patient(rx.patient_id or rx.id, rx.patient_name)
                break

    if not detected_patient and session.active_patient_id:
        # Tự động kế thừa bệnh nhân từ câu hỏi trước trong cùng phiên
        for p in all_patients:
            if p.id == session.active_patient_id:
                detected_patient = p
                is_follow_up = True
                break
        if not detected_patient:
            is_follow_up = True

    # 4. Khởi tạo ClinicalContext hoàn chỉnh
    ctx = ClinicalContext(
        query=query,
        lower_query=lower_query,
        user_name=user_name,
        user_role=user_role,
        session_id=session.session_id,
        patient=detected_patient,
        all_patients=all_patients,
        is_follow_up=is_follow_up
    )

    # 5. Duyệt qua từng Kịch bản đăng ký để tìm handler phù hợp
    for scenario in SCENARIOS:
        if scenario.can_handle(query, lower_query, ctx):
            resp = await scenario.handle(query, lower_query, ctx, db)
            if resp:
                resp.session_id = session.session_id
                resp.active_patient_id = session.active_patient_id
                resp.active_patient_name = session.active_patient_name
                session.last_intent = resp.intent
                return resp

    return None
