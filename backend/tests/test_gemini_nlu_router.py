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
async def test_standalone_turn_is_classified_without_previous_medication_context(monkeypatch):
    import app.services.chatbot.gemini_nlu_router as nlu

    nlu._NLU_CACHE.clear()
    seen = {}
    monkeypatch.setattr(nlu.settings, "GEMINI_API_KEY", "test-api-key-value")

    async def capture_prompt(**kwargs):
        seen.update(kwargs)
        return (
            '{"intent":"GREETING_WELLBEING","primary_drug":null,'
            '"secondary_drug":null,"additional_drugs":[],"sub_queries":[],'
            '"requested_field":null,"is_deictic_referent":false,'
            '"is_topic_shift":true,"depth_preference":"SUMMARY",'
            '"user_sentiment":"positive","confidence":0.99}'
        )

    monkeypatch.setattr(
        "app.services.llm_provider.query_clinical_llm", capture_prompt, raising=False
    )
    result = await nlu.parse_clinical_nlu(
        "Bạn có đang nghe tôi nói không?",
        history="Bác sĩ: Liều Paracetamol người lớn?\nTrợ lý: ...",
        active_med="Paracetamol",
    )

    assert result is not None
    assert result.intent == "GREETING_WELLBEING"
    assert "last_active_medication" not in seen["prompt"]
    assert "conversation_history" not in seen["prompt"]


@pytest.mark.asyncio
async def test_contextual_nlu_classification_cache_reuses_only_current_turn_decision(monkeypatch):
    import app.services.chatbot.gemini_nlu_router as nlu

    nlu._NLU_CACHE.clear()
    monkeypatch.setattr(nlu, "fallback_nlu_heuristic", lambda query, active_med=None: None)
    monkeypatch.setattr(
        "app.services.admin_key_vault.get_active_api_key",
        lambda provider: "test-api-key-value",
    )
    calls = []
    first = (
        '{"intent":"MEDICATION_LOOKUP","conversation_mode":"contextual_followup",'
        '"primary_drug":null,"is_deictic_referent":true,'
        '"requested_field":"dosage","confidence":0.99}'
    )

    async def contextual_response(**kwargs):
        calls.append(kwargs["prompt"])
        return first

    monkeypatch.setattr(
        "app.services.llm_provider.query_clinical_llm", contextual_response
    )
    query = "Còn liều dùng thì sao?"
    first_result = await nlu.parse_clinical_nlu(
        query, history="Lượt trước hỏi Paracetamol", active_med="Paracetamol"
    )
    second_result = await nlu.parse_clinical_nlu(
        query, history="Lượt trước hỏi Ibuprofen", active_med="Ibuprofen"
    )

    assert len(calls) == 1
    assert "conversation_history" not in calls[0]
    assert first_result is not None and first_result.primary_drug == "Paracetamol"
    assert second_result is not None and second_result.primary_drug == "Ibuprofen"


@pytest.mark.asyncio
async def test_contextual_followup_reuses_active_entity_without_second_llm_call(monkeypatch):
    import app.services.chatbot.gemini_nlu_router as nlu

    nlu._NLU_CACHE.clear()
    monkeypatch.setattr(nlu.settings, "GEMINI_API_KEY", "test-api-key-value")
    calls = []

    async def classify_current_turn(**kwargs):
        calls.append(kwargs["prompt"])
        return (
            '{"intent":"MEDICATION_LOOKUP","conversation_mode":"contextual_followup",'
            '"primary_drug":null,"is_deictic_referent":true,'
            '"requested_field":"dosage","confidence":0.99}'
        )

    monkeypatch.setattr(
        "app.services.llm_provider.query_clinical_llm", classify_current_turn
    )
    result = await nlu.parse_clinical_nlu(
        "Còn liều dùng thì sao?", history="previous drug context", active_med="Paracetamol"
    )

    assert len(calls) == 1
    assert result is not None and result.primary_drug == "Paracetamol"
    assert result.is_deictic_referent is True
    assert "last_active_medication" not in calls[0]


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



def test_fallback_nlu_does_not_treat_dosage_unit_as_drug_entity():
    result = fallback_nlu_heuristic(
        "bệnh nhân cần dùng 3 lọ morphin và 1 ống diazepam"
    )

    assert result.intent == "MEDICATION_INTERACTION_CHECK"
    assert result.primary_drug and "morphin" in result.primary_drug.casefold()
    assert result.secondary_drug and "diazepam" in result.secondary_drug.casefold()
    assert result.additional_drugs == []


def test_lexical_medication_matcher_ignores_dosage_quantity_and_packaging_phrases():
    from app.services.chatbot.lexical_trie_matcher import get_drug_lexical_matcher

    meds = get_drug_lexical_matcher().extract_medications(
        "bệnh nhân cần dùng 3 lọ morphin và 1 ống diazepam"
    )

    assert [med.casefold() for med in meds] == ["morphin", "diazepam"]


def test_fallback_keeps_single_medication_question_with_compound_facets_intact():
    result = fallback_nlu_heuristic(
        "Thời gian bán thải và liều tối đa của Paracetamol trong huyết tương"
    )

    assert result.sub_queries == []
    assert set(result.requested_fields) == {"pharmacokinetics", "adult_dosage"}

@pytest.mark.asyncio
async def test_contextless_turn_does_not_inherit_active_medication(monkeypatch):
    import app.services.chatbot.gemini_nlu_router as nlu

    nlu._NLU_CACHE.clear()
    monkeypatch.setattr(nlu.settings, "GEMINI_API_KEY", "test-api-key-value")

    async def classify_unanchored_turn(**kwargs):
        return (
            '{"intent":"MEDICATION_LOOKUP","conversation_mode":"contextual_followup",'
            '"primary_drug":null,"is_deictic_referent":true,"requested_field":null,"confidence":0.99}'
        )

    monkeypatch.setattr("app.services.llm_provider.query_clinical_llm", classify_unanchored_turn)
    result = await nlu.parse_clinical_nlu(
        "dùng bạn - tôi", history="Lượt trước hỏi liều Paracetamol", active_med="Paracetamol"
    )

    assert result is not None
    assert result.primary_drug is None
    assert result.is_deictic_referent is False
    assert result.conversation_mode == "independent"


@pytest.mark.asyncio
async def test_explicit_new_drug_is_preserved_when_session_has_another_drug(monkeypatch):
    import app.services.chatbot.gemini_nlu_router as nlu

    nlu._NLU_CACHE.clear()
    monkeypatch.setattr(nlu.settings, "GEMINI_API_KEY", "test-api-key-value")

    async def classify_new_drug(**kwargs):
        return (
            '{"intent":"MEDICATION_LOOKUP","conversation_mode":"independent",'
            '"primary_drug":"Ibuprofen","is_deictic_referent":false,'
            '"requested_field":"dosage","confidence":0.99}'
        )

    monkeypatch.setattr("app.services.llm_provider.query_clinical_llm", classify_new_drug)
    result = await nlu.parse_clinical_nlu(
        "Liều Ibuprofen dùng thế nào?", active_med="Paracetamol"
    )

    assert result is not None
    assert result.primary_drug == "Ibuprofen"
    assert result.is_deictic_referent is False


def test_context_reference_gate_rejects_unrelated_phrase():
    from app.services.chatbot.gemini_nlu_router import _has_explicit_context_reference

    assert _has_explicit_context_reference("dùng bạn - tôi") is False
    assert _has_explicit_context_reference("còn liều dùng thuốc đó thì sao") is True
