"""
backend/tests/test_hospital_inventory_audit.py
Kiểm thử tự động đối soát 100% 20 thuốc kho bệnh viện với Dược Thư QG 2022 & Cục QLD (<=200 LOC)
"""

import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select
from app.main import app
from app.database import AsyncSessionLocal
from app.models.inventory import InventoryBatch
from app.models.registry import DavNationalDrug

@pytest.mark.asyncio
async def test_all_20_hospital_inventory_drugs_verified():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        async with AsyncSessionLocal() as session:
            stmt = select(InventoryBatch).order_by(InventoryBatch.id)
            batches = (await session.execute(stmt)).scalars().all()
            assert len(batches) == 20, f"Phải có đủ 20 thuốc trong kho bệnh viện, tìm thấy: {len(batches)}"

            for b in batches:
                sdk = b.national_code or b.registration_number
                assert sdk, f"Thuốc {b.id} ({b.item_name}) thiếu số đăng ký Cục QLD"
                res = await client.get(f"/api/v1/registry/{sdk}")
                assert res.status_code == 200, f"Không tìm thấy hồ sơ Cục QLD cho SĐK {sdk} ({b.item_name})"
                data = res.json()

                # Kiểm tra tính toàn vẹn chuyên môn
                assert data["brand_name"], f"Thiếu tên thương mại: {b.id}"
                assert data["active_ingredient"], f"Thiếu hoạt chất: {b.id}"
                assert data["atc_code"], f"Thiếu mã ATC: {b.id}"
                assert data["indications"], f"Thiếu chỉ định lâm sàng: {b.id}"
                assert data["contraindications"], f"Thiếu chống chỉ định: {b.id}"
                assert data["adult_dosage"], f"Thiếu liều người lớn: {b.id}"
                assert data["clinical_source"], f"Thiếu nguồn thẩm định: {b.id}"
                assert data["antidote"], f"Thiếu thuốc giải độc đặc hiệu: {b.id}"

@pytest.mark.asyncio
async def test_hadunalin_adrenalin_accuracy():
    """Kiểm tra độ chính xác tuyệt đối của Hadunalin (Adrenalin 1 mg/ml)."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/v1/registry/893110151100")
        assert res.status_code == 200
        d = res.json()
        assert "Adrenalin" in d["active_ingredient"] or "Epinephrin" in d["active_ingredient"]
        assert "C01CA24" in d["atc_code"]
        assert "Phentolamin" in d["antidote"]
        # Phải có cảnh báo về đường dùng và phác đồ phản vệ
        assert "tiêm bắp" in d["adult_dosage"].lower() or "tiêm bắp" in d["route"].lower()
        assert "phản vệ" in d["indications"].lower()
        # Đảm bảo KHÔNG có rác liều 4-6h của Paracetamol
        assert "4 g/ngày" not in d["adult_dosage"]

@pytest.mark.asyncio
async def test_noradrenalin_accuracy():
    """Kiểm tra Noradrenalin 4mg/4ml (SĐK: 893110107400) đối soát DTQG 1065-1068."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/v1/registry/893110107400")
        assert res.status_code == 200
        d = res.json()
        assert "Noradrenalin" in d["active_ingredient"]
        assert "C01CA03" in d["atc_code"]
        assert "Trang 1065 - 1068" in d["clinical_source"]
        assert "bơm tiêm điện" in d["adult_dosage"].lower() or "pha loãng" in d["adult_dosage"].lower()

@pytest.mark.asyncio
async def test_vaxigrip_smpc_cold_chain():
    """Kiểm tra Vaxigrip (300310033526) đối soát SmPC Cục QLD & Chuỗi lạnh GSP."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/v1/registry/300310033526")
        assert res.status_code == 200
        d = res.json()
        assert "vắc xin" in d["active_ingredient"].lower()
        assert "cúm" in d["indications"].lower()
        assert "J07BB01" in d["atc_code"]
        assert "145/QĐ-QLD" in d["clinical_source"] or "352/QĐ-QLD" in d["clinical_source"]
        assert "đông băng" in d["precautions"].lower()

@pytest.mark.asyncio
async def test_ceftriaxone_ringer_calcium_contraindication():
    """Kiểm tra tương kỵ tử vong Ceftriaxon + Ringer Lactat (Calci) theo QĐ 5948/QĐ-BYT."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res_cef = await client.get("/api/v1/registry/840110304425")
        res_lr = await client.get("/api/v1/registry/520110410325")
        assert res_cef.status_code == 200
        assert res_lr.status_code == 200
        cef = res_cef.json()
        lr = res_lr.json()
        assert "calci" in cef["contraindications"].lower()
        assert "ceftriaxon" in lr["drug_class"].lower() or "ceftriaxon" in lr["contraindications"].lower()
