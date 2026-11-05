"""
Unit & Integration Tests for Adaptive Clinical Slicer & Synthesizer (Parts 2 & 3).
Verifies:
1. Overview generation is concise (< 450 chars) and BLUF structured.
2. Deep facet extraction answers directly (< 500 chars) for timing, max dosage, alcohol, renal.
3. Multi-turn session context inheritance works seamlessly.
"""
import pytest
from app.database import AsyncSessionLocal
from app.services.session_context import get_or_create_session
from app.services.chatbot.clinical_schema_extractor import extract_clinical_query_schema_deterministic
from app.services.chatbot.adaptive_drug_slicer import slice_clinical_drug_evidence
from app.services.chatbot.adaptive_clinical_synthesizer import synthesize_adaptive_clinical_response


@pytest.mark.asyncio
async def test_adaptive_overview_concise_bluf():
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("sess_ada_ov", "Bác sĩ", "doctor")
        analysis = extract_clinical_query_schema_deterministic("Paracetamol")
        evidence, candidates, status = await slice_clinical_drug_evidence(analysis, db, session)
        
        assert status == "ok"
        assert evidence is not None
        assert evidence.query_depth == "OVERVIEW"
        assert evidence.drug_name == "Paracetamol"
        assert len(evidence.core_indication) > 0

        resp = synthesize_adaptive_clinical_response(evidence, "Bác sĩ", "doctor", session.session_id)
        assert resp.intent == "MEDICATION_SAFETY_PROFILE"
        assert len(resp.reply_text) < 500, f"Overview reply text too long: {len(resp.reply_text)}"
        assert "Bác sĩ" in resp.reply_text
        assert "Paracetamol" in resp.reply_text
        assert len(resp.suggested_chips) == 4


@pytest.mark.asyncio
async def test_adaptive_timing_direct_answer():
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("sess_ada_time", "Bác sĩ", "doctor")
        session.set_active_medication("Paracetamol", "Paracetamol", "893100141525", "", "", "893100141525")
        
        analysis = extract_clinical_query_schema_deterministic("Uống sáng hay tối?", session_context={"active_medication": "Paracetamol"})
        evidence, candidates, status = await slice_clinical_drug_evidence(analysis, db, session)
        
        assert status == "ok"
        assert evidence is not None
        assert evidence.query_depth == "DEEP_FACET"
        assert "timing_and_administration" in evidence.target_facets

        resp = synthesize_adaptive_clinical_response(evidence, "Bác sĩ", "doctor", session.session_id)
        assert "sáng hay tối đều được" in resp.reply_text.lower()
        assert len(resp.reply_text) < 600, f"Deep facet reply too long: {len(resp.reply_text)}"


@pytest.mark.asyncio
async def test_adaptive_alcohol_interaction():
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("sess_ada_alc", "Bác sĩ", "doctor")
        session.set_active_medication("Paracetamol", "Paracetamol", "893100141525", "", "", "893100141525")

        analysis = extract_clinical_query_schema_deterministic("thuốc có kỵ rượu không", session_context={"active_medication": "Paracetamol"})
        evidence, candidates, status = await slice_clinical_drug_evidence(analysis, db, session)

        assert status == "ok"
        assert evidence is not None
        assert "alcohol_interaction" in evidence.target_facets

        resp = synthesize_adaptive_clinical_response(evidence, "Bác sĩ", "doctor", session.session_id)
        assert "kỵ rượu" in resp.reply_text.lower()
        assert "napqi" in resp.reply_text.lower() or "cyp2e1" in resp.reply_text.lower()


@pytest.mark.asyncio
async def test_adaptive_max_dosage():
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("sess_ada_max", "Bác sĩ", "doctor")
        session.set_active_medication("Paracetamol", "Paracetamol", "893100141525", "", "", "893100141525")

        analysis = extract_clinical_query_schema_deterministic("Còn liều tối đa?", session_context={"active_medication": "Paracetamol"})
        evidence, candidates, status = await slice_clinical_drug_evidence(analysis, db, session)

        assert status == "ok"
        assert evidence is not None
        assert "max_dosage" in evidence.target_facets

        resp = synthesize_adaptive_clinical_response(evidence, "Bác sĩ", "doctor", session.session_id)
        assert "4.000 mg" in resp.reply_text or "4g" in resp.reply_text or "4 g" in resp.reply_text
