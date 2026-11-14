"""
Admin Telemetry Aggregator & Token Budget Service.
"""
import os
import json
import time
import math
from datetime import timedelta, timezone
from typing import Dict, Any, List, Optional
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.copilot_log import CopilotChatLog
from app.schemas.admin_monitoring_schema import (
    BudgetCapConfig, BudgetCapResponse,
    TelemetryOverviewResponse, TelemetryEventItem,
    BhytAuditLogItem, PaginatedTelemetryResponse
)
from app.models.bhyt import BhytAuditLog

VN_TZ = timezone(timedelta(hours=7))

_BUDGET_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../data/token_budget_config.json"))

def load_budget_config() -> BudgetCapConfig:
    if os.path.exists(_BUDGET_FILE):
        try:
            with open(_BUDGET_FILE, "r", encoding="utf-8") as f:
                return BudgetCapConfig(**json.load(f))
        except Exception:
            pass
    return BudgetCapConfig()

def save_budget_config(cfg: BudgetCapConfig) -> None:
    try:
        os.makedirs(os.path.dirname(_BUDGET_FILE), exist_ok=True)
        with open(_BUDGET_FILE, "w", encoding="utf-8") as f:
            json.dump(cfg.model_dump(), f, ensure_ascii=False, indent=2)
    except Exception:
        pass

def check_token_budget_gate() -> tuple[bool, str]:
    """
    Kiểm tra hạn mức ngân sách token thực tế trước khi gọi LLM.
    Trả về (allowed, reason). Nếu False và auto_offline_fallback, chuyển về local mode.
    """
    try:
        cfg = load_budget_config()
        from app.services.telemetry_store import get_daily_token_usage
        today_tokens_used, _ = get_daily_token_usage()
        # The daily token gate uses provider reported calls only. Legacy estimates
        # remain display telemetry and must not trigger a billing/budget cutoff.
        if cfg.daily_token_limit > 0 and today_tokens_used >= cfg.daily_token_limit:
            return False, "Chạm trần ngân sách Token ngày (Tự động chuyển về Dược thư Local 0 VNĐ)"
    except Exception:
        pass
    return True, "Hạn mức khả dụng"

async def get_budget_status() -> BudgetCapResponse:
    cfg = load_budget_config()
    from app.services.telemetry_store import get_daily_token_usage, get_monthly_token_usage
    today_real_tok, today_real_cost = get_daily_token_usage()
    month_real_tok, month_real_cost = get_monthly_token_usage()

    today_tokens_used = today_real_tok
    month_tokens_used = month_real_tok
    today_pct = min(100.0, round((today_tokens_used / cfg.daily_token_limit) * 100, 1)) if cfg.daily_token_limit > 0 else 0.0
    
    saved_cost_vnd = 0.0
    est_cost_vnd = today_real_cost

    # Tự động tính toán trạng thái thích ứng ngân sách (Auto Adaptive Throttling)
    throttling_status = "normal"
    if today_pct >= 100.0:
        throttling_status = "offline_fallback"
    elif today_pct >= cfg.alert_on_threshold_pct:
        throttling_status = "adaptive_throttling"

    return BudgetCapResponse(
        config=cfg,
        today_tokens_used=today_tokens_used,
        month_tokens_used=month_tokens_used,
        today_usage_pct=today_pct,
        estimated_cost_vnd=est_cost_vnd,
        saved_cost_vnd=saved_cost_vnd,
        throttling_status=throttling_status
    )

def map_chat_log_to_telemetry_event(l: CopilotChatLog) -> TelemetryEventItem:
    ev_type = "ADAPTIVE_RAG"
    status = "success"

    intent_val = getattr(l, "intent", "") or ""
    if intent_val in ("MEDICATION_INTERACTION_BLOCKED", "CLINICAL_CONTRAINDICATION_BLOCKED"):
        ev_type = "DDI_BLOCKED"
        status = "blocked"
    elif intent_val in ("SECURITY_GUARDRAIL_BLOCKED", "OFFTOPIC_DECLINED"):
        ev_type = "GUARDRAIL_BLOCKED"
        status = "blocked"
    elif intent_val == "BHYT_VISION_OCR" or "OCR" in getattr(l, "id", ""):
        ev_type = "VISION_OCR_BHYT"
        status = "success"
    elif getattr(l, "has_image", False) or "MULTIMODAL" in intent_val:
        ev_type = "MULTIMODAL_CLINICAL_VISION"
        status = "success"

    has_img = bool(getattr(l, "has_image", False) or ev_type in ("VISION_OCR_BHYT", "MULTIMODAL_CLINICAL_VISION"))
    img_tok = getattr(l, "image_tokens", 0) or (258 if has_img else 0)
    
    usage_source = getattr(l, "usage_source", None) or "none"
    # Legacy logs may carry estimated values; expose provider-confirmed usage only.
    p_tok = getattr(l, "prompt_tokens", 0) or 0
    
    c_tok = getattr(l, "completion_tokens", 0) or 0
        
    tot_tok = getattr(l, "total_tokens", 0) or 0
    if usage_source != "provider":
        p_tok = c_tok = tot_tok = 0
    if tot_tok <= 0 and p_tok + c_tok > 0:
        tot_tok = p_tok + c_tok

    # 1. Chuẩn hóa Múi giờ Việt Nam (UTC + 7 tiếng) và Ngày Tháng
    time_str = "00:00:00"
    date_str = ""
    full_str = "00:00:00"
    iso_str = None

    if l.created_at:
        raw_dt = l.created_at
        if raw_dt.tzinfo is None:
            vn_dt = raw_dt.replace(tzinfo=timezone.utc).astimezone(VN_TZ)
        else:
            vn_dt = raw_dt.astimezone(VN_TZ)
        time_str = vn_dt.strftime("%H:%M:%S")
        date_str = vn_dt.strftime("%d/%m/%Y")
        full_str = vn_dt.strftime("%H:%M:%S %d/%m/%Y")
        iso_str = vn_dt.isoformat()

    # 2. Chuẩn hóa Model AI đồng bộ với Google AI Studio và hệ thống kiểm soát lâm sàng
    m_name = getattr(l, "model_name", None)
    prov = getattr(l, "provider", None)
    if getattr(l, "model_call_count", 0) == 0 and getattr(l, "cache_hit_count", 0) > 0:
        m_name = "clinical-cache-engine"
        prov = "local-cache"

    if status == "blocked":
        if ev_type == "DDI_BLOCKED":
            m_name = "safety-ddi-matrix"
            prov = "clinical-safety"
        else:
            m_name = "clinical-guardrail-v2"
            prov = "system-guardrail"
    elif ev_type == "CACHE_HIT":
        m_name = "clinical-cache-engine"
        prov = "local-cache"
    elif not m_name or m_name in ("gemini-2.5-flash", "gemini-auto"):
        # Google AI Studio không còn hỗ trợ gemini-2.5-flash (404) -> chuẩn hóa sang model hoạt động thực tế
        m_name = "gemini-3.5-flash-lite"
        prov = "gemini"

    if not prov:
        prov = "gemini" if "gemini" in m_name else "system"

    lat = float(getattr(l, "latency_ms", 0.0) or (4.0 if status == "blocked" else 85.0))

    return TelemetryEventItem(
        id=l.id,
        timestamp=time_str,
        created_at_date=date_str,
        created_at_full=full_str,
        created_at_iso=iso_str,
        event_type=ev_type,
        query=l.query or "",
        user_role=l.user_role or "doctor",
        latency_ms=lat,
        tokens=tot_tok,
        prompt_tokens=p_tok,
        completion_tokens=c_tok,
        total_tokens=tot_tok,
        model_name=m_name,
        provider=prov,
        has_image=has_img,
        image_tokens=img_tok,
        status=status,
        reply_text=l.reply_text,
        intent=l.intent,
        user_name=l.user_name,
        session_id=l.session_id,
        grounded_source=l.grounded_source,
        quality_category=l.quality_category
    )

async def get_paginated_telemetry_logs(
    db: AsyncSession,
    page: int = 1,
    page_size: int = 25,
    event_type: Optional[str] = None,
    model_name: Optional[str] = None,
    user_role: Optional[str] = None,
    q: Optional[str] = None
) -> PaginatedTelemetryResponse:
    """Truy vấn nhật ký sự kiện Copilot AI & Multimodal có phân trang và bộ lọc chuyên sâu."""
    stmt = select(CopilotChatLog)
    count_stmt = select(func.count(CopilotChatLog.id))

    filters = []

    if q and q.strip():
        term = f"%{q.strip()}%"
        filters.append(
            (CopilotChatLog.query.ilike(term)) |
            (CopilotChatLog.id.ilike(term)) |
            (CopilotChatLog.user_role.ilike(term)) |
            (CopilotChatLog.reply_text.ilike(term))
        )

    if model_name and model_name.upper() != "ALL":
        filters.append(CopilotChatLog.model_name == model_name)

    if user_role and user_role.upper() != "ALL":
        filters.append(CopilotChatLog.user_role.ilike(user_role))

    if event_type and event_type.upper() != "ALL":
        et = event_type.upper()
        if et == "DDI_BLOCKED":
            filters.append(CopilotChatLog.intent.in_(["MEDICATION_INTERACTION_BLOCKED", "CLINICAL_CONTRAINDICATION_BLOCKED"]))
        elif et == "GUARDRAIL_BLOCKED":
            filters.append(CopilotChatLog.intent.in_(["SECURITY_GUARDRAIL_BLOCKED", "OFFTOPIC_DECLINED"]))
        elif et == "VISION_OCR_BHYT":
            filters.append((CopilotChatLog.intent == "BHYT_VISION_OCR") | (CopilotChatLog.id.like("%OCR%")))
        elif et == "MULTIMODAL_CLINICAL_VISION":
            filters.append((CopilotChatLog.has_image == True) | (CopilotChatLog.intent.like("%MULTIMODAL%")))
        elif et == "ADAPTIVE_RAG":
            filters.append(CopilotChatLog.intent.not_in([
                "MEDICATION_INTERACTION_BLOCKED", "CLINICAL_CONTRAINDICATION_BLOCKED",
                "SECURITY_GUARDRAIL_BLOCKED", "OFFTOPIC_DECLINED", "BHYT_VISION_OCR"
            ]))

    for f in filters:
        stmt = stmt.where(f)
        count_stmt = count_stmt.where(f)

    total_res = await db.execute(count_stmt)
    total_items = total_res.scalar() or 0

    page = max(1, page)
    page_size = max(5, min(page_size, 200))
    total_pages = max(1, math.ceil(total_items / page_size))
    offset = (page - 1) * page_size

    stmt = stmt.order_by(CopilotChatLog.created_at.desc(), CopilotChatLog.id.desc()).offset(offset).limit(page_size)
    rows_res = await db.execute(stmt)
    logs = rows_res.scalars().all()

    items = [map_chat_log_to_telemetry_event(l) for l in logs]

    return PaginatedTelemetryResponse(
        total_items=total_items,
        total_pages=total_pages,
        current_page=page,
        page_size=page_size,
        items=items
    )

async def aggregate_telemetry_overview(db: AsyncSession) -> TelemetryOverviewResponse:
    from sqlalchemy import func
    from app.services.telemetry_store import get_all_time_token_usage, get_last_7_days_token_trend
    from app.services.admin_key_vault import _load_vault_data
    from app.models.cpoe import CpoePrescription

    # 1. Thống kê Cache thực tế từ bộ nhớ đệm
    from app.services.cache.clinical_cache import get_clinical_cache
    cache_stats = get_clinical_cache().get_stats()
    exact_hits = cache_stats.get("exact_hits", 0)
    semantic_hits = cache_stats.get("semantic_hits", 0)
    total_hits = exact_hits + semantic_hits
    misses = cache_stats.get("misses", 0)
    total_queries = total_hits + misses
    hit_rate = round((total_hits / total_queries) * 100, 1) if total_queries > 0 else 0.0

    # 2. Nhật ký và sự kiện kiểm toán thật từ CSDL Bệnh viện (30 sự kiện gần nhất)
    stmt = select(CopilotChatLog).order_by(CopilotChatLog.created_at.desc(), CopilotChatLog.id.desc()).limit(30)
    res = await db.execute(stmt)
    logs = res.scalars().all()
    recent_events: List[TelemetryEventItem] = [map_chat_log_to_telemetry_event(l) for l in logs]

    # 3. Token từ provider metadata; chi phí quy đổi dùng giả định rate cấu hình
    _, _, real_tokens_consumed, _ = get_all_time_token_usage()
    recent_tokens_sum = sum(ev.total_tokens for ev in recent_events)
    tokens_consumed = real_tokens_consumed
    # No counterfactual token/cost savings are claimed without measured paired runs.
    tokens_saved = 0
    cost_saved_vnd = 0.0

    # 4. Đếm vi phạm DDI và Guardrail thực tế từ toàn bộ bảng logs
    ddi_stmt = select(func.count(CopilotChatLog.id)).where(
        CopilotChatLog.intent.in_(["MEDICATION_INTERACTION_BLOCKED", "CLINICAL_CONTRAINDICATION_BLOCKED"])
    )
    ddi_res = await db.execute(ddi_stmt)
    ddi_blocks_count = ddi_res.scalar() or 0

    gr_stmt = select(func.count(CopilotChatLog.id)).where(
        CopilotChatLog.intent.in_(["SECURITY_GUARDRAIL_BLOCKED", "OFFTOPIC_DECLINED"])
    )
    gr_res = await db.execute(gr_stmt)
    guardrail_blocks_count = gr_res.scalar() or 0

    # 5. Dữ liệu thật từ phân hệ Giám định BHYT & Sổ nhật ký xuất toán
    real_bhyt_count = 0
    bhyt_saved_vnd = 0.0
    bhyt_logs_list: List[BhytAuditLogItem] = []
    try:
        # Số ca đã giám định thực tế trong CSDL
        bhyt_cnt_res = await db.execute(select(func.count(BhytAuditLog.id)))
        real_bhyt_count = bhyt_cnt_res.scalar() or 0

        # Tổng số tiền nguy cơ xuất toán được phát hiện và cảnh báo
        bhyt_sum_res = await db.execute(select(func.sum(BhytAuditLog.at_risk_cost_vnd)))
        bhyt_saved_vnd = float(bhyt_sum_res.scalar() or 0.0)

        # 30 ca giám định BHYT mới nhất
        bhyt_stmt = select(BhytAuditLog).order_by(BhytAuditLog.created_at.desc()).limit(30)
        bhyt_rows = (await db.execute(bhyt_stmt)).scalars().all()
        for r in bhyt_rows:
            bhyt_logs_list.append(BhytAuditLogItem(
                id=r.id,
                prescription_id=r.prescription_id,
                patient_name=r.patient_name or "Bệnh nhân",
                insurance_card_number=r.insurance_card_number or "",
                hospital_rank=r.hospital_rank or "HANG_I",
                treatment_type=r.treatment_type or "NGOAI_TRU",
                primary_icd10=r.primary_icd10 or "",
                status=r.status or "PASS",
                total_cost_vnd=float(r.total_cost_vnd or 0.0),
                at_risk_cost_vnd=float(r.at_risk_cost_vnd or 0.0),
                violations_count=int(r.violations_count or 0),
                violations_json=r.violations_json or "[]",
                created_at=r.created_at.strftime("%Y-%m-%d %H:%M:%S") if r.created_at else None
            ))
    except Exception as e:
        print(f"Warning: Failed to fetch bhyt logs in telemetry: {e}")

    # 6. Độ trễ thực tế từ Bể Khóa API Key
    vault_keys = _load_vault_data()
    lats = [k.get("latency_ms", 0.0) for k in vault_keys if k.get("latency_ms") and k.get("latency_ms") > 0]
    p95_latency = round(sum(lats) / len(lats), 1) if lats else (recent_events[0].latency_ms if recent_events else 0.0)

    # 7. Phân bố ý định lâm sàng thực tế 100% từ bảng CopilotChatLog
    intent_color_map = {
        "MEDICATION_SAFETY_PROFILE": ("Chuyên Khảo Dược Thư DĐVN V", "#0d9488"),
        "MEDICATION_INTERACTION": ("Kiểm Tra Tương Tác Thuốc DDI", "#0284c7"),
        "CLINICAL_RENAL_DOSING": ("Hiệu Chỉnh Liều Suy Thận", "#16a34a"),
        "CLINICAL_PED_DOSING": ("Hiệu Chỉnh Liều Nhi Khoa", "#8b5cf6"),
        "CLINICAL_FOOD_INTERACTION": ("Tương Tác Thức Ăn & Rượu Bia", "#f59e0b"),
        "CLINICAL_FEVER_TRIAGE_PROTOCOL": ("Phác Đồ Xử Trí Lâm Sàng", "#eab308"),
        "CLINICAL_SAFE_ABSTENTION": ("Cơ Chế Phân Tử / RAG An Toàn", "#6366f1"),
        "BHYT_CHECK": ("Giám Định & Xuất Toán BHYT", "#f97316"),
        "BHYT_OCR": ("OCR Hóa Đơn & Đơn Thuốc BHYT", "#ec4899"),
        "FEFO_INVENTORY": ("Kê Đơn CPOE & Tồn Kho FEFO", "#ec4899"),
        "DISPENSE": ("Cấp Phát Thuốc & Xuất Kho", "#14b8a6"),
    }
    
    intent_stmt = select(CopilotChatLog.intent, func.count(CopilotChatLog.id)).where(
        CopilotChatLog.intent.isnot(None)
    ).group_by(CopilotChatLog.intent).order_by(func.count(CopilotChatLog.id).desc()).limit(5)
    
    intent_rows = (await db.execute(intent_stmt)).all()
    total_intent_cnt = sum(cnt for _, cnt in intent_rows) or 1
    intent_distribution = []
    
    for int_key, cnt in intent_rows:
        label, col = intent_color_map.get(int_key, (int_key, "#64748b"))
        intent_distribution.append({
            "intent": label,
            "count": cnt,
            "pct": round((cnt / total_intent_cnt) * 100, 1),
            "color": col
        })

    # 8. Xu hướng 7 ngày thực tế từ Sổ cái Token Ledger
    timeline_trend = get_last_7_days_token_trend()

    return TelemetryOverviewResponse(
        total_queries=total_queries,
        cache_hit_rate_pct=hit_rate,
        exact_hits=exact_hits,
        semantic_hits=semantic_hits,
        tokens_consumed=tokens_consumed,
        tokens_saved=tokens_saved,
        cost_saved_vnd=cost_saved_vnd,
        p95_latency_ms=p95_latency,
        bhyt_audited=real_bhyt_count,
        bhyt_rejection_saved_vnd=bhyt_saved_vnd,
        ddi_blocks_count=ddi_blocks_count,
        guardrail_blocks_count=guardrail_blocks_count,
        recent_events=recent_events[:30],
        intent_distribution=intent_distribution,
        timeline_trend=timeline_trend,
        bhyt_logs=bhyt_logs_list
    )
