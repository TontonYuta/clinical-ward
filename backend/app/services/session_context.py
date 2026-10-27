"""
Quản lý bộ nhớ ngữ cảnh nhiều lượt (Multi-turn Context Buffer) theo chuẩn Google AMIE.
Giữ phiên làm việc của bác sĩ/điều dưỡng với active_patient_id, active_prescription_id và lịch sử câu hỏi.
"""

import time
from typing import Optional, Dict, Any

class SessionState:
    def __init__(self, session_id: str, user_name: str, user_role: str):
        self.session_id = session_id
        self.user_name = user_name
        self.user_role = user_role
        self.active_patient_id: Optional[str] = None
        self.active_patient_name: Optional[str] = None
        self.active_prescription_id: Optional[str] = None
        self.last_query: Optional[str] = None
        self.last_intent: Optional[str] = None
        self.last_updated: float = time.time()
        self.turn_count: int = 0

    def touch(self):
        self.last_updated = time.time()
        self.turn_count += 1

    def set_active_patient(self, patient_id: str, patient_name: str):
        self.active_patient_id = patient_id
        self.active_patient_name = patient_name
        self.touch()

    def clear_active_patient(self):
        self.active_patient_id = None
        self.active_patient_name = None
        self.touch()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "session_id": self.session_id,
            "active_patient_id": self.active_patient_id,
            "active_patient_name": self.active_patient_name,
            "active_prescription_id": self.active_prescription_id,
            "turn_count": self.turn_count
        }

_SESSIONS: Dict[str, SessionState] = {}
SESSION_TTL_SECONDS = 1800  # 30 phút

def get_or_create_session(session_id: Optional[str], user_name: str = "Nhân viên y tế", user_role: str = "nurse") -> SessionState:
    key = (session_id or user_name or "default_session").strip()
    now = time.time()
    
    # Dọn dẹp session quá hạn
    expired_keys = [k for k, s in _SESSIONS.items() if now - s.last_updated > SESSION_TTL_SECONDS]
    for k in expired_keys:
        _SESSIONS.pop(k, None)

    if key not in _SESSIONS:
        _SESSIONS[key] = SessionState(session_id=key, user_name=user_name, user_role=user_role)
    else:
        _SESSIONS[key].touch()

    return _SESSIONS[key]

def clear_session(session_id: Optional[str]):
    key = (session_id or "default_session").strip()
    _SESSIONS.pop(key, None)
