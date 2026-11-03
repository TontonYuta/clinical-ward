from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas.copilot import CopilotResponse
from app.services.scenarios.base import BaseScenario
from app.services.scenarios.context_builder import build_scenario_context

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
from app.services.scenarios.case_patient_inquiry import PatientInquiryScenario
from app.services.scenarios.case_prescription_inquiry import PrescriptionInquiryScenario
from app.services.scenarios.case_coldchain_telemetry import ColdChainTelemetryScenario
from app.services.scenarios.case_coldchain_quarantine import ColdChainQuarantineScenario
from app.services.scenarios.case_adr import AdrReportingScenario
from app.services.scenarios.case_fever_triage import FeverTriageScenario
from app.services.scenarios.case_headache_pain import HeadachePainScenario
from app.services.scenarios.case_gastroenteritis_dehydration import GastroenteritisDehydrationScenario
from app.services.scenarios.case_oncology_specialty import OncologySpecialtyScenario
from app.services.clinical_ddi_engine.drug_registry import DRUG_REGISTRY

SCENARIOS: List[BaseScenario] = [
    MedicationDeicticFollowupScenario(),
    FeverTriageScenario(),
    HeadachePainScenario(),
    GastroenteritisDehydrationScenario(),
    OncologySpecialtyScenario(),
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
    ctx, session = await build_scenario_context(query, lower_query, user_name, user_role, session_id, db)

    if any(term in lower_query for term in ("sốt", "hạ sốt", "thân nhiệt", "nhiệt độ cơ thể")):
        fever_scenario = next(s for s in SCENARIOS if s.scenario_id == "fever_triage")
        if fever_scenario.can_handle(query, lower_query, ctx):
            resp = await fever_scenario.handle(query, lower_query, ctx, db)
            if resp:
                _attach_session_state(resp, session)
                return resp

    for scenario in SCENARIOS:
        if scenario.scenario_id == "medication_deictic_followup" and session.active_medication_name:
            explicit_drug = any(
                len(alias) >= 4 and alias.casefold() in lower_query
                for entry in DRUG_REGISTRY.values() for alias in entry.get("aliases", [])
            )
            if explicit_drug:
                continue
        if scenario.can_handle(query, lower_query, ctx):
            resp = await scenario.handle(query, lower_query, ctx, db)
            if resp:
                _attach_session_state(resp, session)
                return resp

    return None

def _attach_session_state(resp: CopilotResponse, session) -> None:
    resp.session_id = session.session_id
    resp.active_patient_id = session.active_patient_id
    resp.active_patient_name = session.active_patient_name
    resp.active_medication_name = session.active_medication_name
    resp.active_medication_stock = session.active_medication_stock
    resp.active_medication_location = session.active_medication_location
    session.last_intent = resp.intent
