from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.patient import PatientProfile
from app.models.cpoe import CpoePrescription
from app.models.inventory import InventoryBatch
from app.services.session_context import get_or_create_session
from app.services.scenarios.context import ClinicalContext
from app.services.clinical_ddi_engine.drug_registry import DRUG_REGISTRY

async def build_scenario_context(
    query: str,
    lower_query: str,
    user_name: str,
    user_role: str,
    session_id: Optional[str],
    db: AsyncSession
) -> tuple[ClinicalContext, any]:
    session = get_or_create_session(session_id, user_name, user_role)
    lower = lower_query
    needs_patients = any(term in lower for term in ("bệnh nhân", "bn ", "hồ sơ", "bệnh án", "dị ứng", "tiền sử", "creatinin", "egfr", "chức năng thận", "đơn thuốc của", "patient", "medication of"))
    needs_inventory = any(term in lower for term in ("tồn kho", "còn bao nhiêu", "lô thuốc", "hạn dùng", "fefo", "vị trí kho", "kệ nào", "tủ nào"))
    all_patients = []
    all_rxs = []
    all_batches = []
    if needs_patients:
        res = await db.execute(select(PatientProfile))
        all_patients = res.scalars().all()
        if any(term in lower for term in ("đơn thuốc", "đơn của", "kê đơn", "prescription")):
            rx_res = await db.execute(select(CpoePrescription))
            all_rxs = rx_res.scalars().all()
    if needs_inventory:
        batch_res = await db.execute(select(InventoryBatch))
        all_batches = batch_res.scalars().all()

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

    has_patient_deictic = any(w in lower_query for w in [
        "ông ấy", "bà ấy", "bệnh nhân này", "bệnh nhân đó", "người này", "bệnh nhân", "người bệnh", "ca này",
        "tiền sử", "dị ứng của", "chức năng thận", "hồ sơ", "bệnh án", "đơn thuốc của"
    ])
    has_general_drug_or_system_query = any(w in lower_query for w in [
        "thuốc", "các loại thuốc", "nhóm thuốc", "dược phẩm", "hoạt chất", "biệt dược",
        "hạ sốt", "giảm đau", "kháng sinh", "chuỗi lạnh", "tủ lạnh", "mất điện",
        "fefo", "hạn dùng", "tồn kho", "báo hỏng", "sự cố máy"
    ]) and not any(w in lower_query for w in ["ông ấy", "bà ấy", "bệnh nhân này", "bệnh nhân đó", "người này", "bệnh nhân"])

    if not detected_patient and session.active_patient_id and has_patient_deictic and not has_general_drug_or_system_query:
        for p in all_patients:
            if p.id == session.active_patient_id:
                detected_patient = p
                is_follow_up = True
                break
        if not detected_patient:
            is_follow_up = True

    detected_batch = None
    for b in all_batches:
        drug_name_lower = b.item_name.lower()
        active_ing_lower = (b.active_ingredient or "").lower()
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

    if not detected_batch and session.active_medication_name:
        explicit_entity = any(
            len(alias) >= 4 and alias.casefold() in lower_query
            for entry in DRUG_REGISTRY.values() for alias in entry.get("aliases", [])
        )
        if not explicit_entity and any(term in lower_query for term in (
            "liều tối đa", "còn liều", "sáng hay tối", "uống sáng", "uống tối",
            "lúc đói", "lúc no", "trước ăn", "sau ăn", "bao lâu thì tiêm",
            "tiêm nhắc lại", "tần suất", "mỗi bao lâu", "đường dùng", "cách pha",
        )):
            session.set_active_medication(
                name=session.active_medication_name, ingredient=session.active_medication_ingredient,
                batch=session.active_medication_batch, stock=session.active_medication_stock,
                location=session.active_medication_location, sdk=session.active_medication_sdk,
            )

    is_med_follow_up = any(w in lower_query for w in [
        "thuốc này", "thuốc đó", "nó", "thuốc vừa nói", "thuốc vừa gợi ý",
        "viên này", "lọ này", "ống này", "thuốc trên", "thuốc đang hỏi"
    ])

    ctx = ClinicalContext(
        query=query, lower_query=lower_query, user_name=user_name, user_role=user_role,
        session=session, patient=detected_patient, all_patients=all_patients,
        all_batches=all_batches, is_follow_up=is_follow_up, is_med_follow_up=is_med_follow_up
    )
    return ctx, session
