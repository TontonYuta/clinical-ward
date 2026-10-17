from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.coldchain import ColdChainCurrentState, ColdChainTelemetry
from app.schemas.coldchain import ColdChainStateResponse, TelemetryLog, ReleaseQuarantineRequest
from app.services.coldchain_service import calculate_mkt
from app.services.audit_service import record_audit_event

router = APIRouter(prefix="/coldchain", tags=["Chuỗi Lạnh Vắc Xin & Datalogger (WHO PQS & GSP)"])

@router.get("/status", response_model=ColdChainStateResponse)
async def get_cold_chain_status(db: AsyncSession = Depends(get_db)):
    stmt = select(ColdChainCurrentState).limit(1)
    res = await db.execute(stmt)
    state = res.scalar_one_or_none()

    if not state:
        state = ColdChainCurrentState(
            id=1,
            current_temp=4.5,
            is_outage=False,
            is_quarantined=False,
            vvm_level=1,
            mkt_temp=5.6,
            outage_minutes=0,
            total_vaccine_doses=1250
        )
        db.add(state)
        await db.commit()
        await db.refresh(state)

    # Fetch last 6 telemetry logs
    telemetry_stmt = select(ColdChainTelemetry).order_by(ColdChainTelemetry.id.desc()).limit(6)
    t_res = await db.execute(telemetry_stmt)
    db_logs = list(reversed(t_res.scalars().all()))

    logs = [TelemetryLog(timestamp=l.timestamp, temperature=l.temperature) for l in db_logs]
    if not logs:
        # Default 24h sample logs
        logs = [
            TelemetryLog(timestamp="00:00", temperature=4.2),
            TelemetryLog(timestamp="04:00", temperature=4.5),
            TelemetryLog(timestamp="08:00", temperature=4.8),
            TelemetryLog(timestamp="12:00", temperature=5.1),
            TelemetryLog(timestamp="16:00", temperature=4.6),
            TelemetryLog(timestamp="20:00", temperature=4.3),
        ]

    return ColdChainStateResponse(
        current_temp=state.current_temp,
        is_outage=state.is_outage,
        is_quarantined=state.is_quarantined,
        vvm_level=state.vvm_level,
        mkt_temp=state.mkt_temp,
        outage_minutes=state.outage_minutes,
        total_vaccine_doses=state.total_vaccine_doses,
        logs=logs
    )

@router.post("/simulate-outage")
async def simulate_outage(db: AsyncSession = Depends(get_db)):
    stmt = select(ColdChainCurrentState).limit(1)
    res = await db.execute(stmt)
    state = res.scalar_one_or_none()

    state.current_temp = 11.0
    state.is_outage = True
    state.is_quarantined = True
    state.outage_minutes = 12
    state.vvm_level = 1

    # Record telemetry alert
    now_str = datetime.now().strftime("%H:%M")
    telemetry = ColdChainTelemetry(
        sensor_id="VAX-LOG-04",
        timestamp=now_str,
        temperature=11.0,
        power_source="MẤT ĐIỆN LƯỚI (CẢNH BÁO)",
        is_alert=True
    )
    db.add(telemetry)

    # Update MKT with new 11.0 reading
    all_temps_stmt = select(ColdChainTelemetry.temperature).limit(20)
    all_temps_res = await db.execute(all_temps_stmt)
    temps = list(all_temps_res.scalars().all()) + [11.0]
    state.mkt_temp = calculate_mkt(temps)

    await db.commit()
    await db.refresh(state)

    return {"message": "Đã mô phỏng sự cố mất điện (11.0°C), tự động kích hoạt chế độ biệt trữ cách ly lô vắc xin"}

@router.post("/restore-power")
async def restore_power(db: AsyncSession = Depends(get_db)):
    stmt = select(ColdChainCurrentState).limit(1)
    res = await db.execute(stmt)
    state = res.scalar_one_or_none()

    state.current_temp = 4.5
    state.is_outage = False

    now_str = datetime.now().strftime("%H:%M")
    telemetry = ColdChainTelemetry(
        sensor_id="VAX-LOG-04",
        timestamp=now_str,
        temperature=4.5,
        power_source="Đã khôi phục điện lưới 220V",
        is_alert=False
    )
    db.add(telemetry)
    await db.commit()

    return {"message": "Đã khôi phục điện lưới, nhiệt độ buồng lạnh ổn định trở lại 4.5°C"}

@router.post("/release-quarantine")
async def release_quarantine(
    payload: ReleaseQuarantineRequest,
    db: AsyncSession = Depends(get_db)
):
    stmt = select(ColdChainCurrentState).limit(1)
    res = await db.execute(stmt)
    state = res.scalar_one_or_none()

    state.is_quarantined = False
    state.outage_minutes = 0

    await db.commit()

    # Record Audit Trail (Director + Pharmacist QA double signature)
    await record_audit_event(
        db=db,
        action_type="QUARANTINE_RELEASE",
        action_title="Hội đồng Dược ký lệnh giải phóng lô vắc xin sau sự cố nhiệt độ",
        target_item=f"1.250 liều sinh phẩm & vắc xin (Kho Lạnh GSP)",
        legal_basis="Điều 12 Thông tư 36/2018/TT-BYT & Chuẩn WHO PQS",
        signer_name=payload.signer_name,
        signer_certificate="001002/BYT-CCHN",
        witness_name=payload.pharmacist_name,
        witness_certificate="001098/BYT-CCHN",
        auth_method="PIN",
        payload_data={
            "vvm_level": payload.vvm_level_confirmed,
            "mkt_temp": payload.mkt_confirmed,
            "total_doses": 1250
        }
    )

    return {"message": "Đã ký lệnh giải phóng lô vắc xin thành công, đưa trở lại phục vụ tiêm chủng"}
