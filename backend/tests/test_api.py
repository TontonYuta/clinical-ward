import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.seed import seed
from app.database import engine, Base
from app.seed_inventory_data import INVENTORY_DATA

@pytest_asyncio.fixture(autouse=True)
async def prepare_database():
    """Reset and seed the database before test session."""
    await seed()
    yield

@pytest.mark.asyncio
async def test_health_check():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert len(data["legal_compliance"]) >= 5

@pytest.mark.asyncio
async def test_debts_workflow_and_narcotic_lock():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Get initial debts
        res = await client.get("/api/v1/debts")
        assert res.status_code == 200
        debts = res.json()
        assert len(debts) == 12

        # 2. Filter debts
        res_debt = await client.get("/api/v1/debts?status=debt")
        assert res_debt.status_code == 200
        active_debts = res_debt.json()
        assert all(d["status"] == "debt" for d in active_debts)

        # 3. Search debt
        res_search = await client.get("/api/v1/debts?search=Adrenalin")
        assert res_search.status_code == 200
        assert len(res_search.json()) >= 1

        # 4. Emergency borrow a narcotic (Morphin)
        borrow_payload = {
            "item_name": "Morphin sulfat 10mg/1ml",
            "item_type": "Thuốc gây nghiện",
            "quantity": 2,
            "patient_name": "Nguyễn Văn Test (BN-9999)",
            "patient_room": "Buồng Cấp Cứu 1 - Giường 01",
            "borrower": "ĐD. Lê Thị Thu",
            "clinical_reason": "Test giảm đau cấp cứu nhồi máu cơ tim",
            "auth_method": "PIN"
        }
        res_borrow = await client.post("/api/v1/debts/borrow", json=borrow_payload)
        assert res_borrow.status_code == 201
        new_debt = res_borrow.json()
        debt_id = new_debt["id"]
        assert new_debt["status"] == "debt"
        assert new_debt["ampoule_returned"] is False  # Narcotic must require ampoule return

        # 5. HARD CLINICAL RULE: Settle MUST FAIL (409 Conflict) if ampoule not returned!
        res_settle_fail = await client.put(
            f"/api/v1/debts/{debt_id}/settle",
            json={"settler": "DS. Nguyễn Bích Ngọc", "auth_method": "PIN"}
        )
        assert res_settle_fail.status_code == 409
        assert "BẮT BUỘC THU HỒI VỎ" in res_settle_fail.json()["detail"]

        # 6. Return ampoule
        res_return = await client.put(f"/api/v1/debts/{debt_id}/return-ampoule")
        assert res_return.status_code == 200
        assert res_return.json()["ampoule_returned"] is True

        # 7. Settle should now succeed
        res_settle_ok = await client.put(
            f"/api/v1/debts/{debt_id}/settle",
            json={"settler": "DS. Nguyễn Bích Ngọc", "auth_method": "PIN"}
        )
        assert res_settle_ok.status_code == 200
        assert res_settle_ok.json()["status"] == "settled"

        # 8. Destroy ampoules council
        res_destroy = await client.post(
            "/api/v1/debts/destroy-ampoules",
            json={
                "pharmacist_name": "DS. Nguyễn Bích Ngọc",
                "nurse_name": "ĐD. Lê Thị Thu",
                "doctor_witness": "BS. Trần Văn Hùng",
                "method": "Đập vỡ ngâm hóa chất khử hoạt tính theo quy trình TT 20/2017"
            }
        )
        assert res_destroy.status_code == 200

@pytest.mark.asyncio
async def test_equipment_incident_and_handover():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Get equipment tickets
        res = await client.get("/api/v1/equipment")
        assert res.status_code == 200
        tickets = res.json()
        assert len(tickets) == 10

        # 2. Report incident
        incident_payload = {
            "device_name": "Máy sốc tim ngoài lồng ngực Philips",
            "device_model": "HeartStart XL",
            "serial_number": "PHI-TEST-8899",
            "risk_class": "D",
            "location": "Khoa Hồi Sức Tích Cực (ICU) - Xe tiêm 1",
            "accessory_issue": "Dây cáp ECG 3 chuyển đạo bị rách vỏ cách điện",
            "urgency": "urgent",
            "assigned_engineer": "KS. Đặng Văn Nam"
        }
        res_inc = await client.post("/api/v1/equipment/incidents", json=incident_payload)
        assert res_inc.status_code == 201
        ticket = res_inc.json()
        ticket_id = ticket["id"]
        assert ticket["status"] == "reported"

        # 3. Handover and electrical safety test
        handover_payload = {
            "assigned_engineer": "KS. Đặng Văn Nam",
            "clinical_receiver": "BS. Trần Văn Hùng",
            "test_result": "Đạt chuẩn an toàn dòng rò điện và đo năng lượng xung nạp 200J sai số < 2%",
            "auth_method": "PIN"
        }
        res_handover = await client.put(f"/api/v1/equipment/{ticket_id}/handover", json=handover_payload)
        assert res_handover.status_code == 200
        updated = res_handover.json()
        assert updated["status"] == "resolved"
        assert updated["handover_engineer"] == "KS. Đặng Văn Nam"
        assert updated["handover_receiver"] == "BS. Trần Văn Hùng"

@pytest.mark.asyncio
async def test_inventory_fefo_and_restock():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Get batches - verify FEFO ordering (expiry_date ASC)
        res = await client.get("/api/v1/inventory/batches")
        assert res.status_code == 200
        batches = res.json()
        assert len(batches) == len(INVENTORY_DATA)

        # Check expiry_date is sorted ascending
        dates = [b["expiry_date"] for b in batches]
        assert dates == sorted(dates), "Batches must be strictly sorted by FEFO (expiry_date ascending)"

        # 2. Dispatch FEFO batch
        target_batch = batches[0]
        initial_stock = target_batch["current_stock"]
        dispatch_qty = 5

        res_dispatch = await client.post(
            f"/api/v1/inventory/batches/{target_batch['id']}/dispatch",
            json={"quantity": dispatch_qty, "reason": "Xuất cấp cứu lâm sàng"}
        )
        assert res_dispatch.status_code == 200
        updated_batch = res_dispatch.json()
        assert updated_batch["current_stock"] == initial_stock - dispatch_qty

        # 3. Dispatch beyond available stock should fail with 400
        res_excess = await client.post(
            f"/api/v1/inventory/batches/{target_batch['id']}/dispatch",
            json={"quantity": 999999, "reason": "Xuất vượt tồn kho"}
        )
        assert res_excess.status_code == 400

        # 4. Restock proposal
        low_stock_ids = [b["id"] for b in batches if b["is_low_stock"]][:3]
        if low_stock_ids:
            res_restock = await client.post(
                "/api/v1/inventory/restock-proposal",
                json={
                    "batch_ids": low_stock_ids,
                    "pharmacist_name": "DS. Nguyễn Bích Ngọc",
                    "urgency_reason": "Bù cơ số tủ trực chạm ngưỡng an toàn theo Mẫu 01/TT22"
                }
            )
            assert res_restock.status_code == 200
            assert res_restock.json()["restocked_count"] == len(low_stock_ids)

@pytest.mark.asyncio
async def test_cold_chain_outage_and_quarantine():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Initial status
        res = await client.get("/api/v1/coldchain/status")
        assert res.status_code == 200
        state = res.json()
        assert state["current_temp"] == 4.5
        assert state["is_outage"] is False
        assert state["is_quarantined"] is False

        # 2. Simulate power outage (temperature rises to 11.0°C)
        res_outage = await client.post("/api/v1/coldchain/simulate-outage")
        assert res_outage.status_code == 200

        res_after = await client.get("/api/v1/coldchain/status")
        state_after = res_after.json()
        assert state_after["current_temp"] == 11.0
        assert state_after["is_outage"] is True
        assert state_after["is_quarantined"] is True

        # 3. Restore power
        res_restore = await client.post("/api/v1/coldchain/restore-power")
        assert res_restore.status_code == 200

        res_restored = await client.get("/api/v1/coldchain/status")
        assert res_restored.json()["current_temp"] == 4.5
        assert res_restored.json()["is_outage"] is False
        # Vaccine remains quarantined until council signs release
        assert res_restored.json()["is_quarantined"] is True

        # 4. Release vaccine quarantine with double signature
        release_payload = {
            "signer_name": "TS.BS. Nguyễn Văn An",
            "pharmacist_name": "DS. Nguyễn Bích Ngọc",
            "vvm_level_confirmed": 1,
            "mkt_confirmed": 6.2,
            "clinical_notes": "Chỉ số MKT đạt chuẩn ổn định nhiệt học, vắc xin còn nguyên hoạt tính sinh học."
        }
        res_release = await client.post("/api/v1/coldchain/release-quarantine", json=release_payload)
        assert res_release.status_code == 200

        res_final = await client.get("/api/v1/coldchain/status")
        assert res_final.json()["is_quarantined"] is False

@pytest.mark.asyncio
async def test_assets_management_and_audit():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Get assets
        res = await client.get("/api/v1/assets")
        assert res.status_code == 200
        assets = res.json()
        assert len(assets) == 12

        # 2. Scan QR
        target_asset = assets[0]
        res_scan = await client.post(f"/api/v1/assets/{target_asset['id']}/scan-qr")
        assert res_scan.status_code == 200
        assert res_scan.json()["id"] == target_asset["id"]

        # 3. Transfer asset (Mẫu 01/TSC-ĐC)
        transfer_payload = {
            "new_department": "Khoa Hồi Sức Tích Cực (ICU)",
            "engineer_name": "KS. Đặng Văn Nam",
            "receiver_name": "ĐD. Lê Thị Thu",
            "transfer_reason": "Điều chuyển hỗ trợ cấp cứu theo lệnh Ban Giám Đốc"
        }
        res_transfer = await client.put(f"/api/v1/assets/{target_asset['id']}/transfer", json=transfer_payload)
        assert res_transfer.status_code == 200
        transferred = res_transfer.json()
        assert transferred["registered_department"] == "Khoa Hồi Sức Tích Cực (ICU)"
        assert transferred["actual_department"] == "Khoa Hồi Sức Tích Cực (ICU)"
        assert transferred["is_misallocated"] is False

        # 4. Liquidate asset
        liquidate_payload = {
            "director_name": "TS.BS. Nguyễn Văn An",
            "reason": "Hao mòn vô hình và hư hỏng không thể phục hồi theo Điều 39 NĐ 151/2017"
        }
        res_liq = await client.put(f"/api/v1/assets/{target_asset['id']}/liquidate", json=liquidate_payload)
        assert res_liq.status_code == 200
        assert res_liq.json()["pending_liquidation"] is True

@pytest.mark.asyncio
async def test_tamper_evident_audit_ledger_integrity():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Check audit ledger records
        res_ledger = await client.get("/api/v1/audit/ledger")
        assert res_ledger.status_code == 200
        ledger = res_ledger.json()
        assert len(ledger) >= 1

        # Verify cryptographic integrity of HMAC-SHA256 hash chaining
        res_verify = await client.get("/api/v1/audit/verify-integrity")
        assert res_verify.status_code == 200
        verify_data = res_verify.json()
        assert verify_data["is_valid"] is True
        assert verify_data["broken_at_id"] is None
        assert "100% bản ghi kiểm toán nguyên vẹn" in verify_data["message"]

@pytest.mark.asyncio
async def test_copilot_clinical_intents():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Test emergency borrow query
        res1 = await client.post(
            "/api/v1/copilot/chat",
            json={"query": "Tôi cần lấy 2 ống Morphin cho bệnh nhân buồng cấp cứu 3"}
        )
        assert res1.status_code == 200
        data1 = res1.json()
        assert data1["intent"] == "BORROW_EMERGENCY_ITEM"
        assert "Thông tư 22" in data1["legal_basis"]

        # Test equipment malfunction query
        res2 = await client.post(
            "/api/v1/copilot/chat",
            json={"query": "Máy thở phòng mổ 2 bị xì khí nứt bẫy nước"}
        )
        assert res2.status_code == 200
        data2 = res2.json()
        assert data2["intent"] == "REPORT_EQUIPMENT_INCIDENT"
        assert "Nghị định 98" in data2["legal_basis"]

        # Test clinical consultation inquiry
        res3 = await client.post(
            "/api/v1/copilot/chat",
            json={"query": "Thời gian bán thải của Morphin sulfat trong huyết tương là bao lâu?"}
        )
        assert res3.status_code == 200
        data3 = res3.json()
        assert data3["intent"] in ["CLINICAL_AI_CONSULTATION", "GENERAL_CLINICAL_ASSISTANCE"]
        assert len(data3["reply_text"]) > 10

@pytest.mark.asyncio
async def test_national_drug_registry():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Test paginated listing across 55k drugs
        res = await client.get("/api/v1/registry?page=1&page_size=50")
        assert res.status_code == 200
        data = res.json()
        assert data["total"] >= 50000
        assert len(data["items"]) == 50
        assert data["page"] == 1
        assert "Kháng sinh" in data["group_stats"]

        # 2. Test group filter (Kháng sinh)
        res_anti = await client.get("/api/v1/registry?group=antibiotic&page_size=10")
        assert res_anti.status_code == 200
        anti_data = res_anti.json()
        assert anti_data["total"] >= 8000
        for item in anti_data["items"]:
            assert item["group"] == "Kháng sinh"

        # 3. Test search by SĐK
        res_sdk = await client.get("/api/v1/registry?search=VD-24757-16")
        assert res_sdk.status_code == 200
        sdk_data = res_sdk.json()
        assert sdk_data["total"] >= 1
        assert sdk_data["items"][0]["national_code"] == "VD-24757-16"

        # 4. Test stats endpoint
        res_stats = await client.get("/api/v1/registry/stats")
        assert res_stats.status_code == 200
        stats_data = res_stats.json()
        assert stats_data["total_drugs"] >= 50000
        assert "Thuốc gây nghiện" in stats_data["category_stats"]

        # 5. Test single drug detail endpoint
        res_detail = await client.get("/api/v1/registry/VD-24757-16")
        assert res_detail.status_code == 200
        drug = res_detail.json()
        assert drug["brand_name"] == "Ceflodin 500"

        # 6. Test drug documents endpoint
        res_docs = await client.get("/api/v1/registry/539110203326/documents")
        assert res_docs.status_code == 200
        doc_data = res_docs.json()
        assert "hdsd_path" in doc_data
        assert "label_path" in doc_data
