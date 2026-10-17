from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.equipment import EquipmentTicket
from app.schemas.equipment import EquipmentResponse, IncidentCreate, HandoverRequest
from app.services.audit_service import record_audit_event

router = APIRouter(prefix="/equipment", tags=["Sự Cố & Kiểm Định Thiết Bị Y Tế (NĐ 98 & TT 05)"])

@router.get("", response_model=list[EquipmentResponse])
async def get_equipment_tickets(
    urgency: str | None = Query(None, description="urgent hoặc routine"),
    status: str | None = Query(None, description="reported, in_repair, resolved"),
    search: str | None = Query(None, description="Tìm tên máy hoặc serial"),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(EquipmentTicket).order_by(EquipmentTicket.created_at.desc())
    res = await db.execute(stmt)
    tickets = res.scalars().all()

    filtered = []
    for t in tickets:
        if urgency and t.urgency != urgency:
            continue
        if status and t.status != status:
            continue
        if search:
            q = search.lower()
            if q not in t.device_name.lower() and q not in t.serial_number.lower() and q not in t.location.lower():
                continue
        filtered.append(t)
    return filtered

@router.post("/incidents", response_model=EquipmentResponse, status_code=status.HTTP_201_CREATED)
async def report_incident(
    payload: IncidentCreate,
    db: AsyncSession = Depends(get_db)
):
    import uuid
    stmt = select(EquipmentTicket)
    res = await db.execute(stmt)
    count = len(res.scalars().all())
    code = f"SC-2026-{count + 50:03d}"
    now_str = datetime.now().strftime("%I:%M %p")
    record_id = f"eq-{uuid.uuid4().hex[:8]}"

    ticket = EquipmentTicket(
        id=record_id,
        code=code,
        device_name=payload.device_name,
        device_model=payload.device_model,
        serial_number=payload.serial_number,
        risk_class=payload.risk_class,
        location=payload.location,
        accessory_issue=payload.accessory_issue,
        urgency=payload.urgency,
        status="reported",
        assigned_engineer=payload.assigned_engineer,
        next_inspection_due="30/12/2026",
        inspection_unit="Trung tâm Kỹ thuật Tiêu chuẩn Đo lường Chất lượng (Quatest)",
        legal_basis=f"Nghị định 98/2021/NĐ-CP - Thiết bị loại {payload.risk_class}",
        action_log=[f"{now_str}: Lập phiếu báo hỏng từ {payload.location}: {payload.accessory_issue}"]
    )
    db.add(ticket)
    await db.commit()
    await db.refresh(ticket)

    # Record Audit Trail
    await record_audit_event(
        db=db,
        action_type="CREATE_INCIDENT",
        action_title=f"Lập phiếu báo hỏng {payload.device_name} ({code})",
        target_item=f"{payload.device_name} - {payload.location}",
        legal_basis="Điều 34 Nghị định 98/2021/NĐ-CP",
        signer_name="ĐD. Lê Thị Thu",
        signer_certificate="004812/HN-CCHN",
        auth_method="PIN",
        payload_data={
            "code": code,
            "device_name": payload.device_name,
            "location": payload.location,
            "issue": payload.accessory_issue
        }
    )

    return ticket

@router.put("/{ticket_id}/handover", response_model=EquipmentResponse)
async def handover_equipment(
    ticket_id: str,
    payload: HandoverRequest,
    db: AsyncSession = Depends(get_db)
):
    stmt = select(EquipmentTicket).where(EquipmentTicket.id == ticket_id)
    res = await db.execute(stmt)
    ticket = res.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Không tìm thấy ticket thiết bị")

    now_str = datetime.now().strftime("%I:%M %p")
    ticket.status = "resolved"
    ticket.resolved_at = datetime.now()
    ticket.handover_engineer = payload.assigned_engineer
    ticket.handover_receiver = payload.clinical_receiver
    
    current_log = list(ticket.action_log or [])
    current_log.append(f"{now_str}: {payload.assigned_engineer} và {payload.clinical_receiver} đã nghiệm thu thử tải bàn giao ({payload.test_result})")
    ticket.action_log = current_log

    await db.commit()
    await db.refresh(ticket)

    # Record Audit Trail (Dual signature)
    await record_audit_event(
        db=db,
        action_type="HANDOVER_EQUIPMENT",
        action_title=f"Ký biên bản nghiệm thu & bàn giao {ticket.device_name}",
        target_item=f"{ticket.code} ({ticket.device_name})",
        legal_basis="Điều 34 & 58 Nghị định 98/2021/NĐ-CP",
        signer_name=payload.assigned_engineer,
        signer_certificate="BME-204/VTYT",
        witness_name=payload.clinical_receiver,
        witness_certificate="002341/HN-CCHN",
        auth_method=payload.auth_method,
        payload_data={
            "ticket_code": ticket.code,
            "test_result": payload.test_result,
            "location": ticket.location
        }
    )

    return ticket
