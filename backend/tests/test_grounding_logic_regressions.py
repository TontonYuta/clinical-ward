"""Deterministic entity and evidence regressions without DB/network access."""
import asyncio

from app.models.registry import DavNationalDrug, ClinicalDrugMonograph
from app.services.copilot_drug_formatter import build_drug_profile_response
from app.services.rag.self_rag_verifier import verify_clinical_answer
from app.services.rag.types import RagChunk, RetrievedChunk
from app.services.session_context import SessionState


def test_linked_monograph_is_not_overridden_by_longer_substring_match():
    exact = ClinicalDrugMonograph(id="insulin", inn="insulin", title="Insulin",
                                 indications="EXACT_INSULIN", adult_dosage="EXACT_DOSE", source="exact source")
    other = ClinicalDrugMonograph(id="glargine", inn="insulin glargine", title="Insulin glargine",
                                 indications="OTHER_GLARGINE " * 20, adult_dosage="OTHER_DOSE " * 20, source="other source")
    drug = DavNationalDrug(id="test", national_code="test", brand_name="Insulin",
                          active_ingredient="insulin", clinical_monograph_id="insulin")

    class Result:
        def __init__(self, value): self.value = value
        def scalar_one_or_none(self): return self.value
        def scalars(self): return self
        def all(self): return self.value

    class Db:
        async def execute(self, stmt):
            # Honor the linked ID lookup while retaining a longer substring
            # candidate for the formatter's broad search.
            params = stmt.compile().params
            return Result(exact if "insulin" in params.values() else [exact, other])

    response = asyncio.run(build_drug_profile_response(
        [drug], Db(), SessionState("test", "test", "doctor"), query="Chỉ định và liều dùng insulin"))
    assert "EXACT_DOSE" in response.reply_text
    assert "OTHER_DOSE" not in response.reply_text
    assert response.legal_basis == "exact source"


def test_reversed_source_negation_is_not_verified_or_repeated_as_guidance():
    chunk = RagChunk("test", "test", "test", "test", "Metformin",
                     "Metformin chống chỉ định ở người suy thận nặng.")
    result = verify_clinical_answer(
        "Metformin ở người suy thận nặng",
        "Metformin không chống chỉ định ở người suy thận nặng.", [RetrievedChunk(chunk, 1)], {})
    assert result["critique_verdict"] == "REJECT"
    assert "Metformin không chống chỉ định" not in result["cleaned_answer"]
    assert "100%" not in result["cleaned_answer"]


def test_lexical_overlap_does_not_claim_clinical_validation():
    text = "Liều dùng TestDrug là 5mg mỗi ngày."
    chunk = RagChunk("test", "test", "test", "test", "TestDrug", text)
    result = verify_clinical_answer("Liều TestDrug", text, [RetrievedChunk(chunk, 1)], {})
    assert "ĐÃ XÁC THỰC" not in result["cleaned_answer"]
    assert "Độ trung thực: 100%" not in result["cleaned_answer"]


def test_unsupported_negation_cannot_hide_among_supported_claims():
    statements = [f"Liều thuốc TestDrug{i} là 5mg mỗi ngày." for i in range(4)]
    source = " ".join(statements + ["Metformin chống chỉ định ở người suy thận nặng."])
    answer = " ".join(statements + ["Metformin không chống chỉ định ở người suy thận nặng."])
    chunk = RagChunk("test", "test", "test", "test", "Test", source)
    result = verify_clinical_answer("Metformin ở người suy thận nặng", answer, [RetrievedChunk(chunk, 1)], {})
    assert result["critique_verdict"] == "REJECT"
    assert "Metformin không chống chỉ định" not in result["cleaned_answer"]


def test_unrelated_negated_sentence_does_not_reject_supported_paraphrase():
    source = ("TestDrug cần giảm liều ở người suy thận. "
              "Không dùng OtherDrug ở người suy thận nặng.")
    answer = "Người suy thận cần giảm liều TestDrug."
    chunk = RagChunk("test", "test", "test", "test", "TestDrug", source)
    result = verify_clinical_answer("TestDrug suy thận", answer, [RetrievedChunk(chunk, 1)], {})
    assert result["critique_verdict"] == "PASS"
    assert answer in result["cleaned_answer"]
    assert result["claims_audit"][0]["status"] == "FULLY_SUPPORTED"


def test_mixed_sources_do_not_make_other_drug_negation_a_contradiction():
    chunks = [
        RetrievedChunk(RagChunk("one", "one", "test", "test", "TestDrug",
                                "TestDrug cần giảm liều ở người suy thận."), 1),
        RetrievedChunk(RagChunk("two", "two", "test", "test", "OtherDrug",
                                "Không dùng OtherDrug ở người suy thận nặng."), 1),
    ]
    answer = "Người suy thận cần giảm liều TestDrug."
    result = verify_clinical_answer("TestDrug suy thận", answer, chunks, {})
    assert result["critique_verdict"] == "PASS"
    assert answer in result["cleaned_answer"]


def test_conflicting_literal_source_statements_require_abstention():
    chunks = [RetrievedChunk(RagChunk(str(i), "test", "test", "test", "TestDrug", text), 1)
              for i, text in enumerate([
                  "TestDrug chống chỉ định ở người suy thận.",
                  "TestDrug không chống chỉ định ở người suy thận.",
              ])]
    result = verify_clinical_answer("TestDrug suy thận", "TestDrug chống chỉ định ở người suy thận.", chunks, {})
    assert result["critique_verdict"] == "REJECT"


def test_zero_support_is_not_itself_a_polarity_contradiction():
    statements = [f"Liều TestDrug{i} là 5mg mỗi ngày." for i in range(4)]
    source = " ".join(statements)
    answer = source + " Thuốc MysteryCompound gây nguy cơ co thắt phế quản."
    chunk = RagChunk("test", "test", "test", "test", "Test", source)
    result = verify_clinical_answer("Liều thuốc", answer, [RetrievedChunk(chunk, 1)], {})
    assert result["critique_verdict"] != "REJECT"
    assert result["claims_audit"][-1]["status"] == "UNSUPPORTED"
    assert not any(claim["status"] == "CONTRADICTORY" for claim in result["claims_audit"])


def test_verified_joint_monograph_alias_matches_only_exact_active_identity():
    joint = ClinicalDrugMonograph(id="joint", inn="Norethisterone and norethisterone acetate",
                                 title="NORETHISTERONE AND NORETHISTERONE ACETATE",
                                 indications="JOINT_INDICATION", drug_interactions="CYP3A4", source="joint source")
    unrelated = ClinicalDrugMonograph(id="other", inn="norethisterone unrelated",
                                     title="Unrelated", indications="WRONG " * 100, source="wrong source")

    class Result:
        def scalars(self): return self
        def all(self): return [joint, unrelated]

    class Db:
        async def execute(self, stmt): return Result()

    for active, expected in [("Norethisterone\xa05mg", True), ("Norethisteron 5mg", True),
                             ("Norethisteron acetat 5mg", True), ("Norethisteronex 5mg", False)]:
        drug = DavNationalDrug(id="test", national_code="test", brand_name="Primolut N", active_ingredient=active)
        response = asyncio.run(build_drug_profile_response(
            [drug], Db(), SessionState("test", "test", "doctor"), query="Chỉ định và tương tác Primolut N"))
        assert ("CYP3A4" in response.reply_text) is expected
        assert "WRONG" not in response.reply_text


def test_ddi_only_retrieval_cannot_support_non_interaction_llm_answer():
    from app.services.rag.citation_grounder import format_grounded_answer
    chunk = RagChunk("test", "test", "test", "test", "Paracetamol",
                     "Liều Paracetamol và tương tác thuốc cần theo dõi.", entity_type="ddi")
    result = format_grounded_answer("Liều Paracetamol", [RetrievedChunk(chunk, 1)], [], {},
                                   llm_generated_text="Paracetamol nên dùng theo hướng dẫn đã được xác minh.")
    assert result.rag_grounded is False
    assert result.retrieved_chunks == []
    assert "đã được xác minh" not in result.answer
