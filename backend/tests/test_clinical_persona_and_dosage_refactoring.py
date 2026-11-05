"""
Verification tests for Step 3: Clinical Persona Refactoring & Hierarchical Dosage Deduplication.
Ensures zero technical jargon, eliminates flat repetition of 'Người lớn:' and 'Trẻ em:',
and verifies professional BLUF structure for clinical drug profiles.
"""
import pytest
import sqlite3
from app.seed_registry import resolve_db_path
from app.services.chatbot.conversational_clinical_engine import (
    format_hierarchical_dosage,
    get_clinical_persona_greeting,
)
from app.services.copilot_drug_formatter import build_drug_profile_response
from app.database import get_db
from app.services.session_context import get_or_create_session
from app.models.registry import DavNationalDrug, ClinicalDrugMonograph
from sqlalchemy import select


def test_format_hierarchical_dosage_deduplication():
    conn = sqlite3.connect(resolve_db_path())
    cur = conn.cursor()
    cur.execute(
        "SELECT adult_dosage, pediatric_dosage FROM clinical_drug_monographs WHERE inn LIKE '%paracetamol%' LIMIT 1"
    )
    raw_ad, raw_pd = cur.fetchone()
    conn.close()

    lines = format_hierarchical_dosage(raw_ad, raw_pd, is_detailed=True)
    full_text = "\n".join(lines)

    # 1. 'Người lớn' should appear as a single clear section header, NOT repeated on every line
    nguoi_lon_headers = [l for l in lines if "**Người lớn:**" in l]
    assert len(nguoi_lon_headers) == 1, "There must be exactly ONE header for Người lớn"

    # 2. 'Trẻ em' should appear as a single clear section header
    tre_em_headers = [l for l in lines if "**Trẻ em:**" in l]
    assert len(tre_em_headers) == 1, "There must be exactly ONE header for Trẻ em"

    # 3. No lines should start with raw 'Người lớn:' or 'Trẻ em:'
    for l in lines:
        stripped = l.strip()
        assert not stripped.startswith("Người lớn:"), f"Line starts with repeated prefix: {stripped}"
        assert not stripped.startswith("Trẻ em:"), f"Line starts with repeated prefix: {stripped}"

    # 4. Anti-repetition inside bullet lists: 'Trẻ em' should NOT be repeated 9 times in age breakdown
    for l in lines:
        assert l.count("Trẻ em") <= 2, f"Excessive repetition of 'Trẻ em' in line: {l}"

    # 5. No broken dangling fragments
    for l in lines:
        stripped = l.strip()
        assert stripped != "4 lần/ngày.", "Dangling broken fragment found!"
        assert stripped != "30 mg/kg/ngày chia làm nhiều liều nhỏ.", "Dangling broken fragment found!"
        assert stripped != "Liều được tính theo cân nặng.", "Dangling tautological header found!"

    # 6. Safety limit is highlighted
    assert any("*Lưu ý an toàn liều tối đa:*" in l for l in lines)


def test_clinical_persona_greeting_natural():
    # Doctor role
    greeting_doc = get_clinical_persona_greeting("Bác sĩ Minh", "doctor")
    assert greeting_doc == "Kính gửi Bác sĩ,"

    # Pharmacist role
    greeting_pharm = get_clinical_persona_greeting("Dược sĩ Linh", "pharmacist")
    assert greeting_pharm == "Kính gửi Dược sĩ lâm sàng,"

    # Nurse role
    greeting_nurse = get_clinical_persona_greeting("Điều dưỡng Trang", "nurse")
    assert greeting_nurse == "Chào Điều dưỡng,"


@pytest.mark.asyncio
async def test_full_drug_profile_anti_jargon_and_clean_greeting():
    async for db in get_db():
        # Retrieve Paracetamol
        res = await db.execute(select(DavNationalDrug).where(DavNationalDrug.brand_name.ilike("%paracetamol%")).limit(1))
        drug = res.scalar_one_or_none()
        assert drug is not None

        session = get_or_create_session("test_persona_session", "Bác sĩ Hùng", "doctor")
        resp = await build_drug_profile_response([drug], db, session, query="Thông tin thuốc Paracetamol")

        reply = resp.reply_text
        reply_lower = reply.lower()

        # 1. Must NOT contain robotic phrasing
        assert "hệ thống cung cấp" not in reply_lower
        assert "toàn văn csdl dược thư" not in reply_lower
        assert "mô hình ai" not in reply_lower
        assert "retrieval" not in reply_lower
        assert "safe abstention" not in reply_lower

        # 2. Must contain natural doctor greeting
        assert "Kính gửi Bác sĩ," in reply
        assert "dược thư quốc gia việt nam" in reply_lower

        # 3. Must have structured dosage
        assert "• **Liều dùng & Cách dùng:**" in reply
        assert "**Người lớn:**" in reply
        assert "**Trẻ em:**" in reply
        break
