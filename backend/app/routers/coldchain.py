from datetime import datetime
import math
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.coldchain import ColdChainCurrentState, ColdChainTelemetry
from app.schemas.coldchain import ColdChainStateResponse, TelemetryLog, ReleaseQuarantineRequest
from app.services.coldchain_service import calculate_mkt
from app.services.audit_service import record_audit_event
from app.security.auth import audit_actor_fields

router = APIRouter(prefix="/coldchain", tags=["Chuỗi Lạnh Vắc Xin & Datalogger (WHO PQS & GSP)"])
MONITORED_SENSOR_ID = "VAX-LOG-04"

async def _single_cabinet(db: AsyncSession) -> ColdChainCurrentState:
    states = (await db.execute(select(ColdChainCurrentState).limit(2))).scalars().all()
    if not states:
        raise HTTPException(status_code=409, detail="Chưa có trạng thái chuỗi lạnh được xác nhận; không thể kết luận an toàn")
    if len(states) != 1:
        raise HTTPException(status_code=409, detail="Có nhiều tủ lạnh; giao diện hiện tại chưa xác định tủ cần thao tác")
    return states[0]

async def _update_mkt(db: AsyncSession, state: ColdChainCurrentState) -> None:
    # Persist the new sample into this transaction before selecting the latest
    # window so it is included exactly once, regardless of session autoflush.
    await db.flush()
    temperatures = await db.execute(
        select(ColdChainTelemetry.temperature)
        .where(ColdChainTelemetry.sensor_id == MONITORED_SENSOR_ID)
        .order_by(ColdChainTelemetry.id.desc()).limit(20)
    )
    state.mkt_temp = calculate_mkt(list(temperatures.scalars().all()))

@router.get("/status", response_model=ColdChainStateResponse)
async def get_cold_chain_status(db: AsyncSession = Depends(get_db)):
    state = await _single_cabinet(db)

    # Fetch last 6 telemetry logs
    telemetry_stmt = (select(ColdChainTelemetry)
        .where(ColdChainTelemetry.sensor_id == MONITORED_SENSOR_ID)
        .order_by(ColdChainTelemetry.id.desc()).limit(6))
    t_res = await db.execute(telemetry_stmt)
    db_logs = list(reversed(t_res.scalars().all()))

    logs = [TelemetryLog(timestamp=l.timestamp, temperature=l.temperature) for l in db_logs]

    return ColdChainStateResponse(
        id=state.id,
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
    state = await _single_cabinet(db)
    if state.is_outage:
        raise HTTPException(status_code=409, detail="Sự cố mất điện đang diễn ra; không được ghi đè dữ liệu phơi nhiễm")
    result = await db.execute(update(ColdChainCurrentState).where(
        ColdChainCurrentState.id == state.id,
        ColdChainCurrentState.is_outage.is_(False),
    ).values(
        current_temp=11.0, is_outage=True, is_quarantined=True,
        outage_minutes=ColdChainCurrentState.outage_minutes + 12,
    ).returning(ColdChainCurrentState).execution_options(populate_existing=True))
    state = result.scalar_one_or_none()
    if state is None:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Trạng thái tủ lạnh đã thay đổi; tải lại trước khi thao tác")

    # Record telemetry alert
    now_str = datetime.now().strftime("%H:%M")
    telemetry = ColdChainTelemetry(
        sensor_id=MONITORED_SENSOR_ID,
        timestamp=now_str,
        temperature=11.0,
        power_source="MẤT ĐIỆN LƯỚI (CẢNH BÁO)",
        is_alert=True
    )
    db.add(telemetry)

    await _update_mkt(db, state)

    await db.commit()
    await db.refresh(state)

    return {"message": "Đã mô phỏng sự cố mất điện (11.0°C), tự động kích hoạt chế độ biệt trữ cách ly lô vắc xin"}

@router.post("/restore-power")
async def restore_power(db: AsyncSession = Depends(get_db)):
    state = await _single_cabinet(db)
    if not state.is_outage:
        raise HTTPException(status_code=409, detail="Không có sự cố mất điện cần khôi phục; không tạo thêm số đo mô phỏng")
    result = await db.execute(update(ColdChainCurrentState).where(
        ColdChainCurrentState.id == state.id,
        ColdChainCurrentState.is_outage.is_(True),
    ).values(current_temp=4.5, is_outage=False).returning(ColdChainCurrentState)
        .execution_options(populate_existing=True))
    state = result.scalar_one_or_none()
    if state is None:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Trạng thái tủ lạnh đã thay đổi; tải lại trước khi thao tác")

    now_str = datetime.now().strftime("%H:%M")
    telemetry = ColdChainTelemetry(
        sensor_id=MONITORED_SENSOR_ID,
        timestamp=now_str,
        temperature=4.5,
        power_source="Đã khôi phục điện lưới 220V",
        is_alert=False
    )
    db.add(telemetry)
    await _update_mkt(db, state)
    await db.commit()

    return {"message": "Đã khôi phục điện lưới, nhiệt độ buồng lạnh ổn định trở lại 4.5°C"}

@router.post("/release-quarantine")
async def release_quarantine(
    payload: ReleaseQuarantineRequest,
    db: AsyncSession = Depends(get_db),
    request: Request = None,
):
    state = await _single_cabinet(db)
    if not state.is_quarantined:
        raise HTTPException(status_code=409, detail="Lô vắc xin hiện không ở trạng thái biệt trữ")
    if (
        state.is_outage
        or not math.isfinite(state.current_temp)
        or not 2 <= state.current_temp <= 8
        or state.vvm_level != 1
        or not math.isfinite(state.mkt_temp)
        or not 2 <= state.mkt_temp < 8
    ):
        raise HTTPException(status_code=409, detail="Trạng thái chuỗi lạnh chưa đáp ứng điều kiện thẩm định giải phóng")
    if (
        payload.vvm_level_confirmed != state.vvm_level
        or not math.isclose(payload.mkt_confirmed, state.mkt_temp, abs_tol=0.005, rel_tol=0)
    ):
        raise HTTPException(status_code=409, detail="Chỉ số xác nhận không khớp dữ liệu chuỗi lạnh hiện tại")

    result = await db.execute(
        update(ColdChainCurrentState)
        .where(
            ColdChainCurrentState.id == state.id,
            ColdChainCurrentState.is_quarantined.is_(True),
            ColdChainCurrentState.is_outage.is_(False),
            ColdChainCurrentState.current_temp == state.current_temp,
            ColdChainCurrentState.vvm_level == state.vvm_level,
            ColdChainCurrentState.mkt_temp == state.mkt_temp,
            ColdChainCurrentState.outage_minutes == state.outage_minutes,
        )
        .values(is_quarantined=False, outage_minutes=0)
        .execution_options(synchronize_session=False)
    )
    if result.rowcount != 1:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Dữ liệu chuỗi lạnh đã thay đổi; cần thẩm định lại")

    # Record the authenticated account; second-person names remain unverified claims.
    await record_audit_event(
        db=db,
        action_type="QUARANTINE_RELEASE",
        action_title="Ghi nhận giải phóng biệt trữ tủ lạnh sau sự cố nhiệt độ",
        target_item=f"Tủ lạnh {state.id}: {state.total_vaccine_doses:,} liều ghi nhận trên tủ (chưa đối soát tồn kho)",
        legal_basis="Điều 12 Thông tư 36/2018/TT-BYT & Chuẩn WHO PQS",
        **audit_actor_fields(request),
        payload_data={
            "vvm_level": payload.vvm_level_confirmed,
            "mkt_temp": payload.mkt_confirmed,
            "total_doses": state.total_vaccine_doses,
            "claimed_signer_name": payload.signer_name,
            "claimed_witness_name": payload.pharmacist_name,
            "dual_witness_verified": False,
            "quantity_basis": "recorded_cabinet_aggregate",
            "inventory_reconciled": False,
        }
    )

    return {"message": "Đã giải phóng biệt trữ của tủ lạnh; các lô có biệt trữ riêng vẫn chưa được phép xuất"}
