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


@pytest.mark.parametrize(
    "intent, legal_basis, query, expected_doc_id",
    [
        ("QUERY_FEFO_EXPIRY", "Thông tư 36/2018/TT-BYT & TT 22/2011", "thuốc cận hạn dưới 60 ngày", "tt-22-2011"),
        ("BORROW_EMERGENCY_ITEM", "Thông tư 20/2017/TT-BYT", "cho 1 lọ morphin cấp cứu", "tt-20-2017"),
        ("PROPOSE_RESTOCK_PLAN", "Thông tư 22/2011/TT-BYT", "mặt hàng nào sắp hết cần bù", "tt-22-2011"),
        ("REPORT_EQUIPMENT_INCIDENT", "Nghị định 98/2021/NĐ-CP", "máy thở PB840 bị hỏng", "nd-98-2021"),
        ("CHECK_DRUG_INTERACTIONS", "Quyết định 5948/QĐ-BYT", "tương tác clopidogrel và omeprazol", "qd-5948-2021"),
        ("CPOE_PRESCRIPTION_FORM", "Thông tư 26/2025/TT-BYT", "kê đơn thuốc cpoe", "tt-26-2025"),
        ("EMERGENCY_ADRENALIN", "Thông tư 51/2017/TT-BYT", "phác đồ tiêm bắp adrenalin phản vệ", "tt-51-2017"),
    ],
)
def test_operational_and_regulatory_citations(intent, legal_basis, query, expected_doc_id):
    resp = CopilotResponse(intent=intent, reply_text="Phản hồi nghiệp vụ", legal_basis=legal_basis)
    std_resp = standardize_response_citations(resp, query)

    assert len(std_resp.citations) >= 1, f"Intent {intent} must have at least 1 citation"
    citation = std_resp.citations[0]
    assert citation.get("document_id") == expected_doc_id
    assert citation.get("url") is not None
    assert citation.get("title") is not None
    assert citation.get("legal_basis") is not None


def test_specialty_consultation_has_citations():
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
