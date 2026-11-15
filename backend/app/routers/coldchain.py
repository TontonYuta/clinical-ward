from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas.coldchain import ColdChainStateResponse, TelemetryLog, ReleaseQuarantineRequest
from app.domains.cold_chain.service import ColdChainService
from app.services.audit_service import record_audit_event

router = APIRouter(prefix="/coldchain", tags=["Chuỗi Lạnh Vắc Xin & Datalogger (WHO PQS & GSP)"])

@router.get("/status", response_model=ColdChainStateResponse)
async def get_cold_chain_status(db: AsyncSession = Depends(get_db)):
    result = await ColdChainService().get_status(db)
    if result.snapshot is None:
        raise HTTPException(status_code=503, detail="cold_chain_state_unavailable")
    state = result.snapshot
    logs = [TelemetryLog(timestamp=l.timestamp, temperature=l.temperature) for l in reversed(result.telemetry)]

    return ColdChainStateResponse(
        current_temp=state.current_temp, is_outage=state.is_outage, is_quarantined=state.is_quarantined,
        vvm_level=state.vvm_level, mkt_temp=state.mkt_temp, outage_minutes=state.outage_minutes,
        total_vaccine_doses=state.total_vaccine_doses,
        logs=logs
    )

@router.post("/simulate-outage")
async def simulate_outage(db: AsyncSession = Depends(get_db)):
    try:
        await ColdChainService().simulate_outage(db, temperature=11.0, outage_minutes=12, sensor_id="VAX-LOG-04")
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    return {"message": "Đã mô phỏng sự cố mất điện (11.0°C), tự động kích hoạt chế độ biệt trữ cách ly lô vắc xin"}

@router.post("/restore-power")
async def restore_power(db: AsyncSession = Depends(get_db)):
    try:
        await ColdChainService().restore_power(db, temperature=4.5, sensor_id="VAX-LOG-04")
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    return {"message": "Đã khôi phục điện lưới, nhiệt độ buồng lạnh ổn định trở lại 4.5°C"}

@router.post("/release-quarantine")
async def release_quarantine(
    payload: ReleaseQuarantineRequest,
    db: AsyncSession = Depends(get_db)
):
    try:
        await ColdChainService().release_quarantine(db)
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    # Record Audit Trail (Director + Pharmacist QA double signature)
    await record_audit_event(
        db=db,
        action_type="QUARANTINE_RELEASE",
        action_title="Hội đồng Dược ký lệnh giải phóng lô vắc xin sau sự cố nhiệt độ",
        target_item="Lô bảo quản chuỗi lạnh được ghi nhận trong CSDL",
        legal_basis="Điều 12 Thông tư 36/2018/TT-BYT & Chuẩn WHO PQS",
        signer_name=payload.signer_name,
        signer_certificate="001002/BYT-CCHN",
        witness_name=payload.pharmacist_name,
        witness_certificate="001098/BYT-CCHN",
        auth_method="PIN",
        payload_data={
            "vvm_level": payload.vvm_level_confirmed,
            "mkt_temp": payload.mkt_confirmed,
            "total_doses": "from_current_state"
        }
    )

    return {"message": "Đã ký lệnh giải phóng lô vắc xin thành công, đưa trở lại phục vụ tiêm chủng"}
