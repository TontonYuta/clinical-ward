"""
Unit tests for Citation Standardizer (Milestone 1 & 4).
Verifies:
1. All clinical & operational intents have verifiable, structured citations.
2. Exempt intents (greetings, out-of-scope) remain citation-free.
3. Every citation includes source, legal_basis, title, document_id, and url.
"""

import pytest
from app.schemas.copilot import CopilotResponse
from app.services.chatbot.citation_standardizer import (
    standardize_response_citations,
    EXEMPT_INTENTS,
)


def test_exempt_intents_produce_no_citations():
    for intent in EXEMPT_INTENTS:
        resp = CopilotResponse(intent=intent, reply_text="Phản hồi từ chối hoặc chào hỏi", legal_basis=None)
        std_resp = standardize_response_citations(resp, "query")
        assert len(std_resp.citations) == 0, f"Intent {intent} should not have citations"


def test_abstention_does_not_receive_synthetic_legal_citation():
    resp = CopilotResponse(
        intent="CLINICAL_AI_CONSULTATION", reply_text="Insufficient evidence",
        answer_type="safe_abstention", legal_basis="Dược thư Quốc gia",
    )

    standardized = standardize_response_citations(resp, "dose question")

    assert standardized.citations == []


def test_citation_standardization_does_not_invent_source_for_factual_response_without_source():
    resp = CopilotResponse(
        intent="CLINICAL_AI_CONSULTATION", reply_text="A factual statement",
        answer_type="grounded_reference", legal_basis=None,
    )

    standardized = standardize_response_citations(resp, "generic clinical question")

    assert standardized.citations == []


def test_standardizer_does_not_redirect_unresolved_citation_to_generic_drug_reference(monkeypatch):
    monkeypatch.setattr(
        "app.services.chatbot.citation_standardizer.resolve_citation_document",
        lambda *args, **kwargs: (None, None, None),
    )
    resp = CopilotResponse(
        intent="CLINICAL_AI_CONSULTATION", reply_text="Answer",
        citations=[{"source": "Unresolved external guideline", "legal_basis": "External guideline",
                    "section": "Section 4", "excerpt": "Evidence excerpt"}],
    )

    standardized = standardize_response_citations(resp, "query")

    assert standardized.citations[0].get("url") is None


def test_standardizer_does_not_create_citation_from_operational_intent_or_legal_basis():
    resp = CopilotResponse(
        intent="BORROW_EMERGENCY_ITEM", reply_text="Action prepared",
        legal_basis="Thông tư 20/2017/TT-BYT",
    )

    standardized = standardize_response_citations(resp, "cho 1 lọ morphin cấp cứu")

    assert standardized.citations == []


def test_specialty_citation_is_formatted_when_executor_provides_it():
    resp = CopilotResponse(
        intent="MEDICATION_SAFETY_PROFILE",
        reply_text="Phác đồ sốc tim theo SOAP II Trial",
        legal_basis="SOAP II Trial (NEJM 2010) & AHA Guidelines",
        citations=[{
            "source": "SOAP II Trial (NEJM 2010)",
            "title": "Lựa chọn vận mạch trong sốc tim: Noradrenalin so với Dopamin",
            "section": "Chuyên luận Hướng dẫn Lâm sàng",
            "legal_basis": "SOAP II Trial (NEJM 2010)"
        }]
    )
    std_resp = standardize_response_citations(resp, "lựa chọn vận mạch trong sốc tim noradrenalin hay dopamin")
    assert len(std_resp.citations) == 1
    c = std_resp.citations[0]
    assert c["title"] is not None
    assert c["url"] is not None


def test_monograph_citation_preserves_page_and_excerpt():
    resp = CopilotResponse(
        intent="MEDICATION_SAFETY_PROFILE",
        reply_text="Liều dùng paracetamol...",
        legal_basis="Dược thư Quốc gia Việt Nam (2015, Trang 1118)",
        citations=[{
            "source": "Dược thư Quốc gia Việt Nam, lần xuất bản II",
            "legal_basis": "Dược thư Quốc gia Việt Nam (2015, Trang 1118)",
            "section": "Paracetamol 500mg",
            "excerpt": "Liều uống thường dùng là 0,5 - 1 g/lần...",
            "document_id": "dtqg-v2-2015",
            "url": "/pdf/Duoc_Thu_Quoc_Gia_Viet_Nam.pdf#page=1118",
            "page": 1118
        }]
    )
    std_resp = standardize_response_citations(resp, "liều dùng paracetamol")
    assert len(std_resp.citations) == 1
    c = std_resp.citations[0]
    assert c["page"] == 1118
    assert "#page=1118" in c["url"]
    assert c["excerpt"] is not None


def test_drug_citation_carries_versioned_provenance_from_selected_monograph():
    from types import SimpleNamespace
    from app.services.copilot_drug_citation_helper import build_drug_citation

    matched = SimpleNamespace(
        brand_name="Generic brand", active_ingredient="Generic substance",
        clinical_source="Clinical monograph", indications="Source indication",
    )
    monograph = SimpleNamespace(
        id="record-1", inn="Generic substance", title="Generic substance monograph",
        source="Clinical monograph", source_id="kb/monograph.json",
        source_version="sha256:version-1", indications="Source indication",
    )

    citation = build_drug_citation(matched, monograph, monograph.source)

    assert citation["source_id"] == monograph.source_id
    assert citation["source_version"] == monograph.source_version


def test_factual_citation_without_matching_provenance_abstains_at_response_gate():
    from app.services.chatbot.copilot_orchestrator import validate_response_evidence_contract
    response = CopilotResponse(
        intent="MEDICATION_SAFETY_PROFILE", reply_text="Clinical claim",
        answer_type="medication_profile", rag_grounded=True,
        citations=[{"source": "Dược thư Quốc gia", "chunk_id": "chunk-1"}],
        evidence=[],
    )
    validated = validate_response_evidence_contract(response)
    assert validated.answer_type == "safe_abstention"
    assert validated.rag_grounded is False


def test_standardizer_does_not_add_query_inferred_page_to_versioned_chunk_citation(monkeypatch):
    def unexpected_resolver(*_args, **_kwargs):
        raise AssertionError("versioned chunk citation must retain retrieval metadata")
    monkeypatch.setattr(
        "app.services.chatbot.citation_standardizer.resolve_citation_document",
        unexpected_resolver,
    )
    response = CopilotResponse(
        intent="CLINICAL_AI_CONSULTATION", reply_text="Evidence answer",
        citations=[{"source": "Guide", "legal_basis": "Guideline",
                    "chunk_id": "c1", "source_id": "doc",
                    "source_version": "sha256:verified"}],
    )
    standardized = standardize_response_citations(response, "dose query")
    assert standardized.citations[0]["chunk_id"] == "c1"
    assert standardized.citations[0].get("url") is None
