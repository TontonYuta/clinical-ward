"""Read recorded allergies only after exact patient identity resolution."""
import re
import unicodedata
from sqlalchemy import select
from app.models.patient import PatientProfile
from app.schemas.copilot import CopilotResponse


def _identity(value: str) -> str:
    return " ".join(unicodedata.normalize("NFKC", value).casefold().split())


async def handle_patient_allergy_reference(query: str, db, session) -> CopilotResponse | None:
    lower = query.casefold()
    if "dị ứng" not in lower or not any(term in lower for term in ("bệnh nhân", "người bệnh", "bn-", "hồ sơ", "đơn thuốc")):
        return None
    patients = (await db.execute(select(PatientProfile))).scalars().all()
    ids = [patient for patient in patients if re.search(r"(?<![\w-])" + re.escape(patient.id.casefold()) + r"(?![\w-])", lower)]
    name_match = re.search(r"(?:bệnh nhân|người bệnh|bn)\s+([^,;?!]+)", query, re.IGNORECASE)
    requested_name = _identity(name_match.group(1).strip()) if name_match else ""
    names = [patient for patient in patients if _identity(patient.full_name) == requested_name]
    matches = ids if ids else names
    if len(matches) != 1 or (ids and names and ids[0].id != names[0].id):
        session.clear_active_patient()
        return CopilotResponse(
            intent="CLINICAL_CASE_CLARIFICATION", reply_text="Chưa xác định duy nhất hồ sơ người bệnh. Vui lòng cung cấp mã người bệnh hoặc họ tên đầy đủ khớp chính xác; không chọn hồ sơ theo tên gần giống hoặc tên gọi cuối.",
            answer_type="clarification", source_status="missing_unique_patient_context", rag_grounded=False, confidence=1.0,
        )
    patient = matches[0]
    session.set_active_patient(patient.id, patient.full_name)
    return CopilotResponse(
        intent="CLINICAL_ALLERGY_CDSS",
        reply_text=f"Hồ sơ người bệnh: {patient.full_name} ({patient.id}). Tiền sử dị ứng đã ghi nhận: {patient.allergies or 'Chưa có dữ liệu'}. "
                   "Đây chỉ là thông tin hồ sơ, chưa phải kết quả thẩm định an toàn đơn thuốc. Vui lòng cung cấp mã đơn thuốc và danh sách thuốc cần rà soát; chưa xác nhận an toàn hoặc đề xuất thay thuốc.",
        answer_type="patient_record_reference", source_status="patient_record_only", rag_grounded=False,
        confidence=1.0, active_patient_id=patient.id, active_patient_name=patient.full_name,
    )
