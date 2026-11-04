"""
Unit & Integration Tests for Corrective RAG (CRAG) & Tripartite Decision Engine (ICLR 2024 / MedAbstain)
"""
import pytest
from app.database import AsyncSessionLocal
from app.services.copilot_drug_lookup import lookup_drug_authoritative
from app.services.chatbot.corrective_rag import find_crag_candidates

@pytest.mark.asyncio
async def test_crag_candidate_search_typo_venclex():
    async with AsyncSessionLocal() as db:
        candidates = await find_crag_candidates("venclex", db, top_k=4)
        assert len(candidates) >= 1
        brand_names = [c["brand_name"].lower() for c in candidates]
        assert any("venclexta" in b for b in brand_names)
        assert candidates[0]["score"] >= 0.70

@pytest.mark.asyncio
async def test_crag_candidate_search_typo_efferal():
    async with AsyncSessionLocal() as db:
        candidates = await find_crag_candidates("efferal", db, top_k=4)
        assert len(candidates) >= 1
        brand_names = [c["brand_name"].lower() for c in candidates]
        assert any("efferalgan" in b for b in brand_names)

@pytest.mark.asyncio
async def test_crag_tripartite_branch2_ask_venclex():
    async with AsyncSessionLocal() as db:
        resp = await lookup_drug_authoritative("venclex", db, session_id="test_crag_ask", user_role="doctor", user_name="BS. Hùng")
        assert resp.intent == "CLINICAL_TYPO_SUGGESTION"
        assert resp.answer_type == "corrective_clarification"
        assert resp.confidence >= 0.50
        assert "venclexta" in resp.reply_text.lower()
        assert any("venclexta" in chip.lower() for chip in (resp.suggested_chips or []))

@pytest.mark.asyncio
async def test_crag_tripartite_branch2_ask_efferal():
    async with AsyncSessionLocal() as db:
        resp = await lookup_drug_authoritative("efferal", db, session_id="test_crag_efferal", user_role="doctor", user_name="BS. Hùng")
        assert resp.intent == "CLINICAL_TYPO_SUGGESTION"
        assert resp.answer_type == "corrective_clarification"
        assert "efferalgan" in resp.reply_text.lower()
        assert any("efferalgan" in chip.lower() for chip in (resp.suggested_chips or []))

@pytest.mark.asyncio
async def test_crag_tripartite_branch3_defer_gibberish():
    async with AsyncSessionLocal() as db:
        resp = await lookup_drug_authoritative("xytz987654321random", db, session_id="test_crag_defer", user_role="doctor", user_name="BS. Hùng")
        assert resp.intent == "CLINICAL_SAFE_ABSTENTION"
        assert resp.answer_type == "safe_abstention"
        assert resp.confidence == 0.0
        assert "từ chối" in resp.reply_text.lower()

@pytest.mark.asyncio
async def test_crag_tripartite_branch1_decide_exact_paracetamol():
    async with AsyncSessionLocal() as db:
        resp = await lookup_drug_authoritative("Paracetamol", db, session_id="test_crag_decide", user_role="doctor", user_name="BS. Hùng")
        assert resp.intent == "MEDICATION_SAFETY_PROFILE"
        assert resp.confidence >= 0.85
        assert "paracetamol" in resp.reply_text.lower()
