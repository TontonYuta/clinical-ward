"""
Bộ điều phối Kịch bản Lâm sàng Chuyên sâu (Scenario Registry & Dispatcher)
Tập hợp các Scenario Handlers độc lập và quản lý bộ nhớ ngữ cảnh nhiều lượt (AMIE Multi-turn Context & Entity State Tracking).
"""

from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.patient import PatientProfile
from app.models.cpoe import CpoePrescription
from app.models.inventory import InventoryBatch
from app.schemas.copilot import CopilotResponse
from app.services.session_context import get_or_create_session
from app.services.scenarios.context import ClinicalContext
from app.services.scenarios.base import BaseScenario

# Danh sách Kịch bản Lâm sàng
from app.services.scenarios.case_medication_deictic_followup import MedicationDeicticFollowupScenario
from app.services.scenarios.case_ceftriaxone_calcium import CeftriaxoneCalciumScenario
from app.services.scenarios.case_red_man import RedManScenario
from app.services.scenarios.case_statin_food import StatinFoodScenario
from app.services.scenarios.case_high_alert_kcl import HighAlertKclScenario
from app.services.scenarios.case_opioid_mme import OpioidMmeScenario
from app.services.scenarios.case_anaphylaxis import AnaphylaxisScenario
from app.services.scenarios.case_allergy_cdss import AllergyCdssScenario
from app.services.scenarios.case_renal_dosing import RenalDosingScenario
from app.services.scenarios.case_inventory_check import InventoryCheckScenario
from app.services.scenarios.case_amiodarone_qt import AmiodaroneQtScenario
from app.services.scenarios.case_noradrenalin_shock import NoradrenalinShockScenario
from app.services.scenarios.case_diazepam_seizure import DiazepamSeizureScenario
from app.services.scenarios.case_salbutamol_asthma import SalbutamolAsthmaScenario
from app.services.scenarios.case_esomeprazole_ulcer import EsomeprazoleUlcerScenario
from app.services.scenarios.case_fever_triage import FeverTriageScenario
from app.services.scenarios.case_headache_pain import HeadachePainScenario
from app.services.scenarios.case_oncology_specialty import OncologySpecialtyScenario
from app.services.scenarios.case_patient_inquiry import PatientInquiryScenario
from app.services.scenarios.case_prescription_inquiry import PrescriptionInquiryScenario
from app.services.scenarios.case_coldchain_telemetry import ColdChainTelemetryScenario
from app.services.scenarios.case_coldchain_quarantine import ColdChainQuarantineScenario
from app.services.scenarios.case_adr import AdrReportingScenario

SCENARIOS: List[BaseScenario] = [
    MedicationDeicticFollowupScenario(), # Bắt các câu hỏi anaphora "thuốc này", "nó"
    CeftriaxoneCalciumScenario(),
    RedManScenario(),
    StatinFoodScenario(),
    HighAlertKclScenario(),
    OpioidMmeScenario(),
    AnaphylaxisScenario(),
    AllergyCdssScenario(),
    RenalDosingScenario(),
    AmiodaroneQtScenario(),
    NoradrenalinShockScenario(),
    DiazepamSeizureScenario(),
    SalbutamolAsthmaScenario(),
    EsomeprazoleUlcerScenario(),
    FeverTriageScenario(),
    HeadachePainScenario(),
    OncologySpecialtyScenario(),
    PatientInquiryScenario(),
    InventoryCheckScenario(),
    PrescriptionInquiryScenario(),
    ColdChainTelemetryScenario(),
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
    
    # 2. Tra cứu danh sách bệnh nhân, đơn thuốc và kho dược
    res = await db.execute(select(PatientProfile))
    all_patients = res.scalars().all()
    
    rx_res = await db.execute(select(CpoePrescription))
    all_rxs = rx_res.scalars().all()

    batch_res = await db.execute(select(InventoryBatch))
    all_batches = batch_res.scalars().all()
    
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

    is_follow_up = False
    if detected_patient:
        session.set_active_patient(detected_patient.id, detected_patient.full_name)
    else:
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
        for p in all_patients:
            if p.id == session.active_patient_id:
                detected_patient = p
                is_follow_up = True
                break
        if not detected_patient:
            is_follow_up = True

    # 4. Ghi nhận thuốc trong câu truy vấn vào Active Medication Slot
    detected_batch = None
    for b in all_batches:
        drug_name_lower = b.item_name.lower()
        active_ing_lower = (b.active_ingredient or "").lower()
        # Tìm kiếm theo tên biệt dược hoặc hoạt chất (ít nhất 4 ký tự)
        if (len(drug_name_lower) >= 4 and drug_name_lower in lower_query) or (
            len(active_ing_lower) >= 4 and active_ing_lower in lower_query
        ):
            detected_batch = b
            break

    if detected_batch:
        session.set_active_medication(
            name=detected_batch.item_name,
            ingredient=detected_batch.active_ingredient or detected_batch.item_name,
            batch=detected_batch.batch_number,
            stock=f"{detected_batch.current_stock} {detected_batch.unit}",
            location=detected_batch.warehouse_location,
            sdk=detected_batch.registration_number or detected_batch.national_code
        )

    # Nhận diện câu hỏi chỉ định tiếp diễn về thuốc ("thuốc này", "nó", "thuốc vừa nói")
    is_med_follow_up = any(w in lower_query for w in [
        "thuốc này", "thuốc đó", "nó", "thuốc vừa nói", "thuốc vừa gợi ý",
        "viên này", "lọ này", "ống này", "thuốc trên", "thuốc đang hỏi"
    ])

    # 5. Khởi tạo ClinicalContext hoàn chỉnh
    ctx = ClinicalContext(
        query=query,
        lower_query=lower_query,
        user_name=user_name,
        user_role=user_role,
        session=session,
        patient=detected_patient,
        all_patients=all_patients,
        all_batches=all_batches,
        is_follow_up=is_follow_up,
        is_med_follow_up=is_med_follow_up
    )

    # 6. Duyệt qua từng Kịch bản đăng ký để tìm handler phù hợp
    for scenario in SCENARIOS:
        if scenario.can_handle(query, lower_query, ctx):
            resp = await scenario.handle(query, lower_query, ctx, db)
            if resp:
                resp.session_id = session.session_id
                resp.active_patient_id = session.active_patient_id
                resp.active_patient_name = session.active_patient_name
                resp.active_medication_name = session.active_medication_name
                resp.active_medication_stock = session.active_medication_stock
                resp.active_medication_location = session.active_medication_location
                session.last_intent = resp.intent
                return resp

    return None
