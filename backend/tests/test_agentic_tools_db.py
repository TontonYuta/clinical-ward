import pytest
from app.database import AsyncSessionLocal
from app.services.chatbot.agentic_router import IntentExtractionResult, ClinicalIntent
from app.services.chatbot.agentic_tools import (
    execute_dispense_tool,
    execute_equipment_tool,
    execute_fefo_tool,
    execute_restock_tool,
    execute_shift_handover_tool,
    execute_coldchain_tool
)

@pytest.mark.asyncio
async def test_agentic_dispense_tool_real_db():
    async with AsyncSessionLocal() as db:
        # 1. Mượn thường: 1 lọ Morphin
        params = IntentExtractionResult(
            intent=ClinicalIntent.DISPENSE_MEDICATION,
            drug_name="morphin",
            quantity=1,
            unit="lọ",
            patient_name="Nguyễn Văn An (BN-8820)",
            patient_room="Phòng mổ 1"
        )
        resp = await execute_dispense_tool(db, params, "ĐD. Minh", "nurse")
        assert resp.card is not None
        assert resp.card.card_type == "borrow_confirm"
        assert resp.card.data["quantity"] == 1
        assert resp.cdss_alert is None

        # 2. Quá liều: 4 lọ Morphin -> Bắt buộc có CDSS critical alert
        params_overdose = IntentExtractionResult(
            intent=ClinicalIntent.DISPENSE_MEDICATION,
            drug_name="morphin",
            quantity=4,
            unit="lọ"
        )
        resp_overdose = await execute_dispense_tool(db, params_overdose, "ĐD. Minh", "nurse")
        assert resp_overdose.card is not None
        assert resp_overdose.cdss_alert is not None
        assert resp_overdose.cdss_alert.level == "critical"
        assert "OPIOID" in resp_overdose.cdss_alert.title

        # 3. Kali Clorid 10% tiêm trực tiếp -> Bắt buộc có CDSS lethal alert
        params_kcl = IntentExtractionResult(
            intent=ClinicalIntent.DISPENSE_MEDICATION,
            drug_name="kali clorid 10%",
            clinical_reason="tiêm 1 ống kali clorid 10%",
            quantity=1,
            unit="ống"
        )
        resp_kcl = await execute_dispense_tool(db, params_kcl, "ĐD. Minh", "nurse")
        assert resp_kcl.cdss_alert is not None
        assert resp_kcl.cdss_alert.level == "critical"
        assert "KALI CLORID" in resp_kcl.cdss_alert.title

        # 4. Tương tác Morphin + Diazepam -> CDSS interaction alert
        params_ddi = IntentExtractionResult(
            intent=ClinicalIntent.DISPENSE_MEDICATION,
            drug_name="morphin",
            clinical_reason="bệnh nhân cần dùng 3 lọ morphin và 1 ống diazepam",
            quantity=3,
            unit="lọ"
        )
        resp_ddi = await execute_dispense_tool(db, params_ddi, "ĐD. Minh", "nurse")
        assert resp_ddi.cdss_alert is not None
        assert resp_ddi.cdss_alert.level == "critical"
        assert "OPIOID + BENZODIAZEPINE" in resp_ddi.cdss_alert.title

@pytest.mark.asyncio
async def test_agentic_equipment_tool_real_db():
    async with AsyncSessionLocal() as db:
        params = IntentExtractionResult(
            intent=ClinicalIntent.REPORT_EQUIPMENT_INCIDENT,
            device_name="máy thở PB840",
            device_location="Phòng mổ 2",
            issue_description="xì khí nứt bẫy nước",
            urgency="urgent"
        )
        resp = await execute_equipment_tool(db, params, "KTV. Hùng", "engineer")
        assert resp.card is not None
        assert resp.card.card_type == "incident_confirm"
        assert "PB840" in resp.card.data["device_name"] or "Máy thở" in resp.card.data["device_name"]

@pytest.mark.asyncio
async def test_agentic_shift_handover_tool_real_db():
    async with AsyncSessionLocal() as db:
        resp = await execute_shift_handover_tool(db, "BS. Hưng", "doctor")
        assert resp.card is not None
        assert resp.card.card_type == "shift_handover_report"
        assert "active_debts_count" in resp.card.data

@pytest.mark.asyncio
async def test_agentic_fefo_and_restock_real_db():
    async with AsyncSessionLocal() as db:
        fefo_resp = await execute_fefo_tool(db, threshold_days=60)
        assert fefo_resp.card is not None
        assert fefo_resp.card.card_type == "fefo_report"

        restock_resp = await execute_restock_tool(db)
        assert restock_resp.card is not None
        assert restock_resp.card.card_type == "low_stock_report"

@pytest.mark.asyncio
async def test_agentic_coldchain_tool_real_db():
    async with AsyncSessionLocal() as db:
        resp = await execute_coldchain_tool(db)
        assert resp.card is not None
        assert resp.card.card_type == "coldchain_status"
