"""
Verification tests for Step 2: Deterministic Database Entity Resolver & Honest Clinical Gatekeeper.
Verifies exact CSDL scoping, zero cross-drug leakage, and 100% jargon-free honest safe abstention.
"""
import pytest
from app.database import get_db
from app.services.chatbot.clinical_db_resolver import (
    resolve_drug_entity_deterministic,
    build_honest_abstention_reply,
    build_natural_clarification_reply,
)

FORBIDDEN_JARGON = [
    "rag", "crag", "csdl", "database", "safe abstention",
    "medabstain", "hệ thống", "arxiv", "framework", "iclr",
    "retrieval", "vector search"
]


@pytest.mark.asyncio
async def test_resolve_exact_drug_in_db():
    async for db in get_db():
        record, candidates = await resolve_drug_entity_deterministic("Paracetamol", db)
        assert record is not None
        assert record.is_exact_match is True
        assert "paracetamol" in (record.drug.brand_name.lower() + record.drug.active_ingredient.lower())
        break


@pytest.mark.asyncio
async def test_resolve_composite_inn_brand_drug():
    async for db in get_db():
        record, _ = await resolve_drug_entity_deterministic("Riluzol (Teglutik)", db)
        assert record is not None
        assert record.is_exact_match is True
        break


@pytest.mark.asyncio
async def test_resolve_nonexistent_drug_triggers_gatekeeper():
    async for db in get_db():
        record, candidates = await resolve_drug_entity_deterministic("Thuoc-Khong-Co-Trong-CSDL-9999", db)
        assert record is None
        # Must not fabricate or hallucinate a drug
        assert candidates == []
        break


def test_honest_abstention_tone_and_anti_jargon():
    resp = build_honest_abstention_reply(
        raw_kw="Thuoc-Bi-An-XYZ",
        user_name="Bác sĩ Hoàng",
        user_role="doctor"
    )
    assert resp.intent == "CLINICAL_SAFE_ABSTENTION"
    reply_lower = resp.reply_text.lower()

    # Must be natural and polite
    assert "dạ thưa bác sĩ" in reply_lower or "kính gửi bác sĩ" in reply_lower or "thưa bác sĩ" in reply_lower
    assert "chưa có dữ liệu chính thức" in reply_lower
    assert "thuoc-bi-an-xyz" in reply_lower

    # STRICT ANTI-JARGON CHECK: Must not contain technical terms
    for term in FORBIDDEN_JARGON:
        assert term not in reply_lower, f"Forbidden technical term '{term}' found in reply: {resp.reply_text}"


def test_natural_clarification_tone_and_anti_jargon():
    mock_candidates = [
        {
            "brand_name": "Paracetamol 500mg",
            "active_ingredient": "Paracetamol",
            "national_code": "VD-12345-16",
            "concentration": "Viên nén",
            "source": "Danh mục thuốc lưu hành (DAV)"
        }
    ]
    resp = build_natural_clarification_reply(
        raw_kw="Paracetamoll",
        candidates=mock_candidates,
        user_name="Bác sĩ",
        user_role="doctor"
    )
    assert resp.intent == "CLINICAL_TYPO_SUGGESTION"
    reply_lower = resp.reply_text.lower()

    # Natural tone
    assert "dạ thưa bác sĩ" in reply_lower
    assert "paracetamol 500mg" in reply_lower

    # STRICT ANTI-JARGON CHECK
    for term in ["crag", "framework", "iclr", "54,885", "database"]:
        assert term not in reply_lower, f"Forbidden term '{term}' found in typo suggestion: {resp.reply_text}"
