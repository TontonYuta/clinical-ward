import pytest
import re
from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models.registry import DavNationalDrug, ClinicalDrugMonograph
from app.services.chatbot.conversational_clinical_engine import (
    build_fluent_drug_profile_response,
    format_hierarchical_dosage,
    format_hierarchical_special_populations
)
from app.services.copilot_drug_citation_helper import split_clinical_chunks, smart_unfold_clinical_text


@pytest.mark.asyncio
async def test_smart_unfold_and_fragment_prevention():
    """Kiểm tra smart_unfold_clinical_text không bị rách dòng do căn lề hay số liều."""
    sample = (
        "Đặt trực tràng: 0,5 - 1 g/lần, 4 - 6 giờ một lần, tối đa\n"
        "4 lần/ngày.\n"
        "Sơ sinh: 10 mg/kg cách\n"
        "4 - 6 giờ/lần; tối đa 30 mg/kg/24 giờ.\n"
        "Trẻ em cân nặng < 10 kg:.\n"
        "10 mg/kg cách 4 - 6 giờ/lần; tối đa 30 mg/kg/24 giờ.\n"
        "Trẻ em 12 - 18 tuổi:\n"
        "500 mg cách 4 - 6 giờ/lần.\n"
        "Đau Paracetamol được dùng điều trị đau nhẹ.\n"
        "Sốt Paracetamol thường được dùng hạ thân nhiệt."
    )
    unfolded = smart_unfold_clinical_text(sample)
    
    # Không được có rách dòng tại "tối đa" hay "cách"
    assert "tối đa." not in unfolded
    assert "cách." not in unfolded
    assert "tối đa 4 lần/ngày" in unfolded
    assert "10 mg/kg cách 4 - 6 giờ/lần" in unfolded
    assert "Trẻ em 12 - 18 tuổi: 500 mg cách 4 - 6 giờ/lần" in unfolded
    assert "Giảm đau: Paracetamol" in unfolded
    assert "Hạ sốt: Paracetamol" in unfolded
    assert "Đau Paracetamol" not in unfolded
    assert "Sốt Paracetamol" not in unfolded


@pytest.mark.asyncio
async def test_paracetamol_detail_profile_no_prefix_repetition():
    """Kiểm tra toàn diện phản hồi tra cứu chi tiết Paracetamol: không lặp prefix, cấu trúc phân cấp."""
    async with AsyncSessionLocal() as db:
        drug = (await db.execute(select(DavNationalDrug).filter(DavNationalDrug.national_code == '893100141525'))).scalars().first()
        assert drug is not None
        mono = (await db.execute(select(ClinicalDrugMonograph).filter(ClinicalDrugMonograph.id == drug.clinical_monograph_id))).scalars().first() if drug.clinical_monograph_id else None

        resp = await build_fluent_drug_profile_response(drug, mono, 100, "Kho Ngoại Trú", "thông tin chi tiết paracetamol")
        text = resp.reply_text

        # 1. Khử lặp prefix tuyệt đối
        adult_prefix_count = len(re.findall(r'^\s*-\s*\*\*Người lớn:\*\*', text, re.MULTILINE))
        ped_prefix_count = len(re.findall(r'^\s*-\s*\*\*Trẻ em:\*\*', text, re.MULTILINE))
        renal_prefix_count = len(re.findall(r'^\s*-\s*\*\*Hiệu chỉnh suy thận:\*\*', text, re.MULTILINE))

        assert adult_prefix_count <= 1, f"Người lớn prefix lặp {adult_prefix_count} lần!"
        assert ped_prefix_count <= 1, f"Trẻ em prefix lặp {ped_prefix_count} lần (trước đây lặp 34 lần)!"
        assert renal_prefix_count <= 1, f"Hiệu chỉnh suy thận prefix lặp {renal_prefix_count} lần!"

        # 2. Không còn câu cụt, vỡ dòng do OCR
        assert "tối đa." not in text
        assert "cách." not in text
        assert "< 10 kg:." not in text
        assert "Đau Paracetamol" not in text
        assert "Sốt Paracetamol" not in text

        # 3. Phân cấp chuẩn y khoa
        assert "• **Liều dùng & Cách dùng:**" in text
        assert "  - **Người lớn:**" in text
        assert "+ **Đường uống:**" in text
        assert "+ **Đặt trực tràng:**" in text
        assert "+ **Truyền tĩnh mạch (15 phút):**" in text
        assert "  - **Trẻ em:**" in text
        assert "+ **Đau & Sốt (Đường uống):**" in text

        # 4. Thận trọng & Đối tượng đặc biệt có phân cấp
        assert "• **Thận trọng & Đối tượng đặc biệt:**" in text
        assert "  - **Hiệu chỉnh suy thận:**" in text
        assert "  - **Phụ nữ mang thai & cho con bú:**" in text

        # 5. Duy nhất 1 tag nguồn ở cuối
        assert text.endswith("[Dược thư tr.1118]") or "Nguồn: [Dược thư" in text
        assert "Căn cứ Y văn:" not in text
