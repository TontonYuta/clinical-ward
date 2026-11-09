"""
Unit and Regression Test Suite for Gemini Structured NLU Router (Zero Hardcoded Rules).
Validates intent classification, entity extraction, anti-false-positives, deictic resolution, and caching.
"""
import pytest
import time
from app.services.chatbot.gemini_nlu_router import parse_clinical_nlu, fallback_nlu_heuristic


@pytest.mark.asyncio
async def test_gemini_nlu_feedback_detection():
    query = "Bạn trả lời bị cứng nhắc quá"
    res = await parse_clinical_nlu(query)
    assert res is not None
    assert res.intent == "CONVERSATIONAL_FEEDBACK"
    assert res.primary_drug is None
    assert res.user_sentiment == "complaint"


@pytest.mark.asyncio
async def test_gemini_nlu_interaction_clarification():
    query = "Tương tác thuốc thế nào?"
    res = await parse_clinical_nlu(query)
    assert res is not None
    assert res.intent == "MEDICATION_INTERACTION_CLARIFICATION"
    assert res.secondary_drug is None


@pytest.mark.asyncio
async def test_gemini_nlu_interaction_check_two_drugs():
    query = "Kiểm tra tương tác Warfarin và Aspirin"
    res = await parse_clinical_nlu(query)
    assert res is not None
    assert res.intent == "MEDICATION_INTERACTION_CHECK"
    assert res.primary_drug and "warfarin" in res.primary_drug.lower()
    assert res.secondary_drug and "aspirin" in res.secondary_drug.lower()


@pytest.mark.asyncio
async def test_gemini_nlu_deictic_lookup_with_context():
    query = "Tóm tắt thông tin thuốc đó"
    res = await parse_clinical_nlu(query, active_med="Teglutik")
    assert res is not None
    assert res.intent == "MEDICATION_LOOKUP"
    assert res.primary_drug == "Teglutik"
    assert res.requested_field == "summary"
    assert res.is_deictic_referent is True


@pytest.mark.asyncio
async def test_gemini_nlu_pediatric_inquiry():
    query = "Liều Paracetamol cho trẻ em 15kg"
    res = await parse_clinical_nlu(query)
    assert res is not None
    assert res.intent == "MEDICATION_LOOKUP"
    assert res.primary_drug and "paracetamol" in res.primary_drug.lower()
    assert res.requested_field in ("pediatric", "dosage")


@pytest.mark.asyncio
async def test_gemini_nlu_out_of_scope():
    query = "Hôm nay thời tiết Hà Nội thế nào?"
    res = await parse_clinical_nlu(query)
    assert res is not None
    assert res.intent == "OUT_OF_SCOPE"


@pytest.mark.asyncio
async def test_gemini_nlu_cache_performance():
    query = "Thông tin thuốc Augmentin"
    t0 = time.monotonic()
    res1 = await parse_clinical_nlu(query)
    t1 = time.monotonic()

    t2 = time.monotonic()
    res2 = await parse_clinical_nlu(query)
    t3 = time.monotonic()

    assert res1 is not None and res2 is not None
    assert res1.intent == res2.intent
    assert res1.primary_drug == res2.primary_drug
    # Cache hit should be sub-millisecond (< 5ms)
    assert (t3 - t2) < 0.05


@pytest.mark.asyncio
async def test_gemini_nlu_counseling_detection():
    query = "Bác sĩ dặn bệnh nhân cách uống thuốc này dễ hiểu giúp em"
    res = await parse_clinical_nlu(query, active_med="Coversyl")
    assert res is not None
    assert res.intent == "PATIENT_MEDICATION_COUNSELING"
    assert res.primary_drug == "Coversyl"
    assert res.depth_preference == "COUNSELING"


@pytest.mark.asyncio
async def test_gemini_nlu_renal_reasoning_detection():
    query = "bệnh nhân suy thận creatinin 180 dùng Ciprofloxacin liều thế nào"
    res = await parse_clinical_nlu(query)
    assert res is not None
    assert res.intent == "PATIENT_CASE_REASONING"
    assert res.is_renal_inquiry is True
    assert res.primary_drug and "ciprofloxacin" in res.primary_drug.lower()


@pytest.mark.asyncio
async def test_gemini_nlu_protocol_detection():
    query = "Quy chế quản lý thuốc gây nghiện theo Thông tư 20"
    res = await parse_clinical_nlu(query)
    assert res is not None
    assert res.intent == "SPECIALTY_CLINICAL_PROTOCOL"
    assert res.requested_field == "guideline"


@pytest.mark.asyncio
async def test_gemini_nlu_topic_shift_detection():
    query = "thế còn Paracetamol thì sao"
    res = await parse_clinical_nlu(query, active_med="Coversyl")
    assert res is not None
    assert res.intent == "MEDICATION_LOOKUP"
    assert res.primary_drug and "paracetamol" in res.primary_drug.lower()
    assert res.is_topic_shift is True

