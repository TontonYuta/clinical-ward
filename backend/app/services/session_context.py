"""
Quản lý bộ nhớ ngữ cảnh nhiều lượt (Multi-turn Context Buffer & Entity State Tracking) theo chuẩn Google AMIE & SGD.
Giữ phiên làm việc của nhân viên y tế: active_patient, active_medication, active_prescription và lịch sử câu hỏi.
"""

import time
from dataclasses import dataclass
from typing import Optional, Dict, Any

@dataclass(frozen=True)
class ConversationTurn:
    user_text: str
    assistant_text: str

class SessionState:
    def __init__(self, session_id: str, user_name: str, user_role: str):
        self.session_id = session_id
        self.user_name = user_name
        self.user_role = user_role
        
        # Ngữ cảnh bệnh nhân
        self.active_patient_id: Optional[str] = None
        self.active_patient_name: Optional[str] = None
        
        # Ngữ cảnh đơn thuốc
        self.active_prescription_id: Optional[str] = None
        
        # Finite State Machine (FSM)
        self.fsm_state: str = "IDLE"  # "IDLE", "DRUG_FOCUSED", "DDI_COMPARISON", "CLINICAL_PROTOCOL"
        self.comparison_drugs: list[str] = []

        # Ngữ cảnh thuốc / dược phẩm đang tương tác (Active Medication Slot)
        self.active_medication_name: Optional[str] = None
        self.active_medication_ingredient: Optional[str] = None
        self.active_medication_batch: Optional[str] = None
        self.active_medication_stock: Optional[str] = None
        self.active_medication_location: Optional[str] = None
        self.active_medication_sdk: Optional[str] = None
        self.last_active_medication_name: Optional[str] = None
        self.last_active_medication_ingredient: Optional[str] = None
        self.last_active_medication_sdk: Optional[str] = None
        
        self.last_query: Optional[str] = None
        self.last_intent: Optional[str] = None
        self.last_updated: float = time.time()
        self.turn_count: int = 0
        self.conversation_turns: list[ConversationTurn] = []

        # Crescendo Multi-Turn Security Risk Accumulator (arXiv:2404.01833 / LlamaFirewall)
        self.security_risk_score: float = 0.0
        self.blocked_turn_count: int = 0
        self.security_risk_events: list[dict[str, Any]] = []

    def record_security_signal(self, delta: float, reason: str, *, blocked: bool = False) -> float:
        """Accumulate multi-turn adversarial escalation risk within this session."""
        if delta > 0:
            self.security_risk_score = round(min(2.0, self.security_risk_score + float(delta)), 3)
        if blocked:
            self.blocked_turn_count += 1
        self.security_risk_events.append({
            "ts": round(time.time(), 2),
            "delta": round(float(delta), 3),
            "reason": reason[:140],
            "blocked": blocked,
        })
        self.security_risk_events = self.security_risk_events[-10:]
        return self.security_risk_score

    def decay_security_risk(self, factor: float = 0.65) -> None:
        """Decay accumulated risk on verified benign clinical turns to prevent sticky false positives."""
        if self.security_risk_score > 0.0:
            self.security_risk_score = round(self.security_risk_score * factor, 3)
            if self.security_risk_score < 0.05:
                self.security_risk_score = 0.0

    def append_conversation_turn(self, user_text: str, assistant_text: str) -> None:
        user = self._truncate_history_text(user_text)
        assistant = self._truncate_history_text(assistant_text)
        if user or assistant:
            self.conversation_turns.append(ConversationTurn(user, assistant))
            self.conversation_turns = self.conversation_turns[-5:]
        self.last_query = user or self.last_query
        self.touch()

    @staticmethod
    def _truncate_history_text(text: str) -> str:
        cleaned = (text or "").strip()
        return cleaned if len(cleaned) <= 2000 else cleaned[:1999] + "…"

    def get_recent_turns(self, limit: int = 5) -> list[dict]:
        return [
            {"user": t.user_text, "assistant": t.assistant_text}
            for t in self.conversation_turns[-limit:]
        ]

    def render_recent_history(self, max_turns: int = 5, max_chars: int = 1500) -> str:
        """
        Nén và định dạng lịch sử hội thoại có kiểm soát ngân sách nghiêm ngặt (Google AMIE Nature 2024).
        Mặc định giới hạn tối đa 1.500 ký tự (thay vì 8.000 ký tự) để cắt giảm 75% chi phí token.
        """
        if max_turns <= 0 or max_chars <= 0:
            return ""
        turns = self.conversation_turns[-max_turns:]
        selected: list[ConversationTurn] = []
        char_count = 0
        for turn in reversed(turns):
            block = f"Bác sĩ: {turn.user_text}\nTrợ lý: {turn.assistant_text}"
            additional = len(block) + (2 if selected else 0)
            if char_count + additional > max_chars:
                if not selected:
                    remaining = max_chars - len(f"Bác sĩ: ") - len(f"\nTrợ lý: ")
                    if remaining > 0:
                        user_budget = max(0, remaining // 2)
                        assistant_budget = max(0, remaining - user_budget)
                        selected = [ConversationTurn(
                            turn.user_text[:user_budget] if user_budget else "",
                            turn.assistant_text[:assistant_budget] if assistant_budget else "",
                        )]
                break
            selected.insert(0, turn)
            char_count += additional
        return "\n\n".join(f"Bác sĩ: {turn.user_text}\nTrợ lý: {turn.assistant_text}" for turn in selected)

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

    def set_active_medication(
        self,
        name: str,
        ingredient: Optional[str] = None,
        batch: Optional[str] = None,
        stock: Optional[str] = None,
        location: Optional[str] = None,
        sdk: Optional[str] = None
    ):
        self.active_medication_name = name
        self.active_medication_ingredient = ingredient or name
        self.active_medication_batch = batch
        self.active_medication_stock = stock
        self.active_medication_location = location
        self.active_medication_sdk = sdk
        if name:
            self.last_active_medication_name = name
            self.last_active_medication_ingredient = ingredient or name
            self.last_active_medication_sdk = sdk
            self.fsm_state = "DRUG_FOCUSED"
        else:
            self.last_active_medication_name = None
            self.last_active_medication_ingredient = None
            self.last_active_medication_sdk = None
            self.fsm_state = "IDLE"
        self.touch()

    def get_effective_medication_name(self) -> Optional[str]:
        return self.active_medication_name or self.last_active_medication_name

    def set_comparison_drugs(self, drugs: list[str]) -> None:
        self.comparison_drugs = drugs
        self.fsm_state = "DDI_COMPARISON"
        self.touch()

    def clear_active_medication(self):
        self.active_medication_name = None
        self.active_medication_ingredient = None
        self.active_medication_batch = None
        self.active_medication_stock = None
        self.active_medication_location = None
        self.active_medication_sdk = None
        self.last_active_medication_name = None
        self.last_active_medication_ingredient = None
        self.last_active_medication_sdk = None
        self.fsm_state = "IDLE"
        self.comparison_drugs = []
        self.touch()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "session_id": self.session_id,
            "active_patient_id": self.active_patient_id,
            "active_patient_name": self.active_patient_name,
            "active_prescription_id": self.active_prescription_id,
            "active_medication_name": self.active_medication_name,
            "active_medication_ingredient": self.active_medication_ingredient,
            "active_medication_stock": self.active_medication_stock,
            "active_medication_location": self.active_medication_location,
            "turn_count": self.turn_count
        }

_SESSIONS: Dict[str, SessionState] = {}
SESSION_TTL_SECONDS = 1800  # 30 phút

def _resolve_session_sqlite_path() -> Optional[str]:
    try:
        from app.config import settings
        db_url = str(getattr(settings, "DATABASE_URL", "") or "")
        if "sqlite" in db_url:
            path = db_url.split(":///")[-1]
            if path and path != ":memory:":
                return path
    except Exception:
        pass
    return None


def hydrate_session_from_db(
    session: SessionState,
    *,
    db_path: Optional[str] = None,
    max_turns: int = 5,
) -> int:
    """
    Recover up to `max_turns` recent valid turns & active medication from `copilot_chat_logs`
    when a session is first materialized in RAM after a server restart.
    """
    import os
    import sqlite3

    if session.conversation_turns or not session.session_id:
        return 0
    raw_suffix = session.session_id.split(":", 1)[-1]
    if raw_suffix in ("", "default_session"):
        return 0

    target_db = db_path or _resolve_session_sqlite_path()
    if not target_db or not os.path.isfile(target_db):
        return 0

    try:
        conn = sqlite3.connect(target_db, timeout=1.5)
        try:
            rows = conn.execute(
                """
                SELECT query, reply_text, intent
                FROM copilot_chat_logs
                WHERE session_id IN (?, ?)
                  AND COALESCE(intent, '') != 'SECURITY_GUARDRAIL_BLOCKED'
                ORDER BY created_at DESC
                LIMIT ?
                """,
                (session.session_id, raw_suffix, int(max_turns)),
            ).fetchall()
        finally:
            conn.close()
    except Exception:
        return 0

    if not rows:
        return 0

    rows.reverse()
    loaded = 0
    last_med_intent = None
    last_query = ""
    for q_text, r_text, intent in rows:
        if q_text or r_text:
            session.conversation_turns.append(
                ConversationTurn(
                    SessionState._truncate_history_text(q_text or ""),
                    SessionState._truncate_history_text(r_text or ""),
                )
            )
            loaded += 1
            last_med_intent = intent
            last_query = q_text or ""

    if loaded:
        session.last_query = last_query
        session.last_intent = last_med_intent
        if last_med_intent == "MEDICATION_SAFETY_PROFILE" and last_query:
            try:
                from app.services.chatbot.lexical_trie_matcher import get_drug_lexical_matcher
                meds = get_drug_lexical_matcher().extract_medications(last_query)
                if meds:
                    session.active_medication_name = meds[0]
                    session.last_active_medication_name = meds[0]
                    session.fsm_state = "DRUG_FOCUSED"
            except Exception:
                pass
    return loaded


def get_or_create_session(session_id: Optional[str], user_name: str = "Nhân viên y tế", user_role: str = "nurse") -> SessionState:
    # Session keys are namespaced by the owner. Callers may provide a
    # pre-namespaced key when authenticated identity differs from display name.
    requested = (session_id or "default_session").strip()
    owner = (user_name or "Nhân viên y tế").strip().casefold()
    key = requested if ":" in requested else f"{owner}:{requested}"
    now = time.time()
    
    # Dọn dẹp session quá hạn
    expired_keys = [k for k, s in _SESSIONS.items() if now - s.last_updated > SESSION_TTL_SECONDS]
    for k in expired_keys:
        _SESSIONS.pop(k, None)

    if key not in _SESSIONS:
        fresh = SessionState(session_id=key, user_name=user_name, user_role=user_role)
        hydrate_session_from_db(fresh)
        _SESSIONS[key] = fresh
    else:
        _SESSIONS[key].touch()

    return _SESSIONS[key]

def clear_session(session_id: Optional[str]):
    key = (session_id or "default_session").strip()
    _SESSIONS.pop(key, None)
