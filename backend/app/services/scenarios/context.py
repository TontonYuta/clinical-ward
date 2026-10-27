"""
Ngữ cảnh lâm sàng cho Bộ điều phối Kịch bản (Clinical Context)
Lưu thông tin bệnh nhân, đơn thuốc và thuốc đang kích hoạt (AMIE & SGD multi-turn context).
"""

from typing import Optional, List
from app.models.patient import PatientProfile
from app.models.inventory import InventoryBatch
from app.services.session_context import SessionState

class ClinicalContext:
    def __init__(
        self,
        query: str,
        lower_query: str,
        user_name: str = "Nhân viên y tế",
        user_role: str = "nurse",
        session: Optional[SessionState] = None,
        patient: Optional[PatientProfile] = None,
        all_patients: Optional[List[PatientProfile]] = None,
        all_batches: Optional[List[InventoryBatch]] = None,
        is_follow_up: bool = False,
        is_med_follow_up: bool = False
    ):
        self.query = query
        self.lower_query = lower_query
        self.user_name = user_name
        self.user_role = user_role
        self.session = session
        self.session_id = session.session_id if session else None
        self.patient = patient
        self.all_patients = all_patients or []
        self.all_batches = all_batches or []
        self.is_follow_up = is_follow_up
        self.is_med_follow_up = is_med_follow_up

    @property
    def active_medication_name(self) -> Optional[str]:
        return self.session.active_medication_name if self.session else None

    @property
    def active_medication_ingredient(self) -> Optional[str]:
        return self.session.active_medication_ingredient if self.session else None

    @property
    def patient_context_str(self) -> str:
        if not self.patient:
            return ""
        return (
            f"\n[HỒ SƠ BỆNH NHÂN TRONG CSDL:\n"
            f"- Mã BN: {self.patient.id} - Họ tên: {self.patient.full_name} ({self.patient.age}t, {self.patient.gender})\n"
            f"- Tiền sử bệnh nền: {self.patient.chronic_conditions}\n"
            f"- Tiền sử DỊ ỨNG: {self.patient.allergies}\n"
            f"- Chức năng thận: eGFR {self.patient.egfr} mL/min, Creatinine {self.patient.creatinine} umol/L, Nặng {self.patient.weight_kg}kg]\n"
        )
