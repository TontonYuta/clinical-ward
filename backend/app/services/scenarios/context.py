"""
Ngữ cảnh lâm sàng cho Bộ điều phối Kịch bản (Clinical Context)
Lưu thông tin bệnh nhân đang kích hoạt, phiên làm việc và lịch sử hội thoại (AMIE multi-turn context).
"""

from typing import Optional, List
from app.models.patient import PatientProfile

class ClinicalContext:
    def __init__(
        self,
        query: str,
        lower_query: str,
        user_name: str = "Nhân viên y tế",
        user_role: str = "nurse",
        session_id: Optional[str] = None,
        patient: Optional[PatientProfile] = None,
        all_patients: Optional[List[PatientProfile]] = None,
        is_follow_up: bool = False
    ):
        self.query = query
        self.lower_query = lower_query
        self.user_name = user_name
        self.user_role = user_role
        self.session_id = session_id
        self.patient = patient
        self.all_patients = all_patients or []
        self.is_follow_up = is_follow_up

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
