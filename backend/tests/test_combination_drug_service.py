"""
Bộ kiểm thử tính chính xác tuyệt đối 100% cho Thuốc phối hợp đa hoạt chất (Combination Drugs)
Tuân thủ nghiêm ngặt Dược thư Quốc gia Việt Nam (DĐVN V, QĐ 2033/QĐ-BYT).
Tuyệt đối không suy đoán, không tạo trích dẫn giả khi hoạt chất không có trong Dược thư.
"""
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select
from app.main import app
from app.database import AsyncSessionLocal
from app.models.registry import DavNationalDrug
from app.services.combination_drug_service import (
    parse_combination_ingredients,
    clean_substance_name,
    resolve_combination_monographs,
    build_combination_drug_profile,
    CANONICAL_COMBINED_MONOGRAPHS,
)

def test_parse_combination_ingredients_formats():
    # 1. Định dạng phân tách bằng dấu chấm phẩy
    res1 = parse_combination_ingredients("Paracetamol 500mg; Codein phosphat 30mg")
    assert "Paracetamol" in res1
    assert any("Codein" in x for x in res1)

    # 2. Định dạng Amoxicillin + Acid clavulanic có kèm dạng muối
    res2 = parse_combination_ingredients("Amoxicillin (dưới dạng Amoxicillin trihydrate) 500mg; Acid clavulanic (dưới dạng Kali clavulanate) 125mg")
    assert any("amoxicillin" in x.lower() for x in res2)
    assert any("acid clavulanic" in x.lower() for x in res2)

    # 3. Định dạng phân tách bằng dấu cộng
    res3 = parse_combination_ingredients("Ampicillin 1g + Sulbactam 0,5g")
    assert any("ampicillin" in x.lower() for x in res3)
    assert any("sulbactam" in x.lower() for x in res3)

    # 4. Định dạng phân tách bằng chữ 'và' có tiền tố mô tả liều lượng
    res4 = parse_combination_ingredients("Sau khi hoàn nguyên, mỗi 5 mL hỗn dịch thuốc chứa 600mg amoxicillin (dưới dạng amoxicillin trihydrate) và 42,9mg acid clavulanic (dưới dạng kali clavulanate), tỷ lệ 14:1")
    assert any("amoxicillin" in x.lower() for x in res4)
    assert any("acid clavulanic" in x.lower() for x in res4)

    # 5. Định dạng phân tách bằng dấu phẩy
    res5 = parse_combination_ingredients("Paracetamol 500 mg, Cafein 65 mg")
    assert any("paracetamol" in x.lower() for x in res5)
    assert any("cafein" in x.lower() or "caffeine" in x.lower() for x in res5)

@pytest.mark.asyncio
async def test_canonical_combination_monograph_amox_clav():
    async with AsyncSessionLocal() as db:
        aug_res = await db.execute(select(DavNationalDrug).where(DavNationalDrug.brand_name.like("Augmentin%")).limit(1))
        aug = aug_res.scalar_one_or_none()
        assert aug is not None

        primary_mono, components = await resolve_combination_monographs(aug, db)
        assert primary_mono is not None
        assert primary_mono.id == "DTQG-0048-Amoxicillinandpotass"
        assert "AMOXICILIN VÀ KALI CLAVULANAT" in primary_mono.title
        assert "Trang 192" in (primary_mono.source or "")

        reply, citations, legal_basis = build_combination_drug_profile(aug, primary_mono, components)
        assert "AMOXICILIN VÀ KALI CLAVULANAT" in reply
        assert len(citations) == 1
        assert citations[0]["url"] == "/pdf/Duoc_Thu_Quoc_Gia_Viet_Nam.pdf#page=192"

@pytest.mark.asyncio
async def test_multi_monograph_dual_resolution_efferalgan_codeine():
    async with AsyncSessionLocal() as db:
        eff_res = await db.execute(select(DavNationalDrug).where(DavNationalDrug.brand_name.like("Efferalgan Codein%")).limit(1))
        eff = eff_res.scalar_one_or_none()
        assert eff is not None

        primary_mono, components = await resolve_combination_monographs(eff, db)
        assert primary_mono is None  # Không có chuyên luận gộp, mà có 2 chuyên luận đơn lập
        assert len(components) == 2

        verified_names = [c["ingredient_name"] for c in components if c["status"] == "verified_dtqg"]
        assert "Paracetamol" in verified_names
        assert any("Codein" in n for n in verified_names)

        reply, citations, legal_basis = build_combination_drug_profile(eff, primary_mono, components)
        # Phải có cảnh báo Opioid theo Thông tư 20/2017/TT-BYT
        assert "Opioid" in reply or "Codein" in reply
        assert "Thông tư 20/2017/TT-BYT" in reply
        assert "4000 mg" in reply or "4g/ngày" in reply  # Liều trần paracetamol

        # Phải có đủ 2 trích dẫn chính xác với số trang PDF tương ứng
        assert len(citations) == 2
        citation_urls = [c["url"] for c in citations]
        assert "/pdf/Duoc_Thu_Quoc_Gia_Viet_Nam.pdf#page=1118" in citation_urls
        assert "/pdf/Duoc_Thu_Quoc_Gia_Viet_Nam.pdf#page=459" in citation_urls

@pytest.mark.asyncio
async def test_multi_monograph_strict_unverified_handling():
    async with AsyncSessionLocal() as db:
        pan_res = await db.execute(select(DavNationalDrug).where(DavNationalDrug.brand_name.like("Panadol Extra%")).limit(1))
        pan = pan_res.scalar_one_or_none()
        assert pan is not None

        primary_mono, components = await resolve_combination_monographs(pan, db)
        assert len(components) >= 2

        para_comp = next((c for c in components if "Paracetamol" in c["ingredient_name"]), None)
        assert para_comp is not None
        assert para_comp["status"] == "verified_dtqg"

        cafein_comp = next((c for c in components if any(k in c["ingredient_name"].lower() for k in ("cafein", "caffeine"))), None)
        assert cafein_comp is not None
        assert cafein_comp["status"] == "unverified_in_dtqg"
        assert "chưa có chuyên luận đơn chất độc lập" in cafein_comp["note"].lower()

        reply, citations, legal_basis = build_combination_drug_profile(pan, primary_mono, components)
        # Trích dẫn CHỈ ĐƯỢC chứa Paracetamol (Trang 1118), tuyệt đối không bịa số trang cho Cafein
        assert len(citations) == 1
        assert citations[0]["url"] == "/pdf/Duoc_Thu_Quoc_Gia_Viet_Nam.pdf#page=1118"
        assert "chưa có chuyên luận đơn chất độc lập trong Dược thư Quốc gia" in reply

@pytest.mark.asyncio
async def test_chat_api_combination_drug_e2e():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Truy vấn thông tin Augmentin
        res1 = await client.post("/api/v1/copilot/chat", json={"query": "Thông tin thuốc Augmentin", "user_role": "doctor"})
        assert res1.status_code == 200
        data1 = res1.json()
        assert data1["intent"] == "MEDICATION_SAFETY_PROFILE"
        assert any("page=192" in c.get("url", "") for c in data1.get("citations", []))
        assert "AMOXICILIN VÀ KALI CLAVULANAT" in data1.get("reply_text", "")

        # 2. Truy vấn chống chỉ định Efferalgan Codein
        res2 = await client.post("/api/v1/copilot/chat", json={"query": "Efferalgan Codein chỉ định và chống chỉ định", "user_role": "doctor"})
        assert res2.status_code == 200
        data2 = res2.json()
        assert data2["intent"] == "MEDICATION_SAFETY_PROFILE"
        urls2 = [c.get("url", "") for c in data2.get("citations", [])]
        assert any("page=1118" in u for u in urls2)
        assert any("page=459" in u for u in urls2)
        assert "Paracetamol" in data2.get("reply_text", "")
        assert "Codein" in data2.get("reply_text", "")
