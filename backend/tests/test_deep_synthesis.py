import pytest

from app.services.chatbot.grounded_web_search_handler import (
    _format_reader_blocks_for_llm,
    enrich_web_search_context_with_articles,
)
from app.services.chatbot.web_search_engine import WebSearchResult


def test_format_reader_blocks_for_llm_includes_tables_and_caps_length():
    blocks = [
        {"type": "heading", "level": 2, "text": "Khuyến cáo KDIGO 2024"},
        {"type": "paragraph", "text": "Khởi trị SGLT2i ở bệnh nhân CKD có eGFR >= 20 mL/phút/1,73 m2."},
        {
            "type": "table",
            "headers": ["Thuốc", "Liều chuẩn"],
            "rows": [["Empagliflozin", "10 mg/ngày"]],
        },
        {"type": "list", "ordered": False, "items": ["Theo dõi eGFR", "Tạm ngưng khi mất nước nặng"]},
    ]
    md = _format_reader_blocks_for_llm(blocks, max_chars=2000)
    assert "#### Khuyến cáo KDIGO 2024" in md
    assert "| Thuốc | Liều chuẩn |" in md
    assert "| Empagliflozin | 10 mg/ngày |" in md
    assert "- Theo dõi eGFR" in md


@pytest.mark.asyncio
async def test_enrich_web_search_context_with_articles_appends_deep_extracts(monkeypatch):
    async def fake_fetch(url: str):
        return {
            "url": url,
            "status": "ok",
            "title": "KDIGO 2024 CKD",
            "blocks": [
                {"type": "paragraph", "text": "A" * 260 + " Empagliflozin 10 mg/ngày khuyến cáo mức 1A theo KDIGO 2024."}
            ],
            "paragraphs": [],
        }

    monkeypatch.setattr("app.services.chatbot.web_reader_service.fetch_web_reader_content", fake_fetch)

    res = [
        WebSearchResult(
            title="KDIGO 2024",
            url="https://timmachhoc.vn/empagliflozin",
            snippet="Tóm tắt ngắn KDIGO 2024",
            source_domain="timmachhoc.vn",
            credibility_tier=2,
        )
    ]
    out = await enrich_web_search_context_with_articles(res, "<medical_search_evidence>base</medical_search_evidence>")
    assert "<deep_article_extracts>" in out
    assert "Empagliflozin 10 mg/ngày khuyến cáo mức 1A" in out
    assert getattr(res[0], "_deep_extract", "").endswith("khuyến cáo mức 1A theo KDIGO 2024.")


def test_evidence_claim_contract_supports_paraphrased_synthesis_and_blocks_unprovenanced():
    from app.services.copilot_drug_formatter import _evidence_claim_contract

    verified_evidence = [
        {
            "evidence_id": "document:monograph:paracetamol:overdose",
            "evidence_type": "document_chunk",
            "chunk_id": "monograph:paracetamol:overdose",
            "source_id": "data/duoc_thu.pdf",
            "source_version": "sha256:abc123",
            "content": (
                "Nhiễm độc paracetamol có thể do dùng một liều độc duy nhất hoặc lặp lại liều lớn 7,5 - 10 g mỗi ngày. "
                "Liệu pháp giải độc chính là N-acetylcystein tiêm tĩnh mạch liều đầu 150 mg/kg."
            ),
        }
    ]
    # 1. Clean Gemini Answer-First paraphrase (not verbatim copy-paste!) MUST produce supported claims
    paraphrased_reply = (
        "### Tóm tắt nhanh\n"
        "Quá liều **Paracetamol** gây nhiễm độc gan khi dùng liều lớn 7,5 - 10 g mỗi ngày; "
        "thuốc giải độc đặc hiệu là **N-acetylcystein** tiêm tĩnh mạch liều đầu 150 mg/kg."
    )
    contract = _evidence_claim_contract(verified_evidence, paraphrased_reply, {"monograph:paracetamol:overdose"})
    assert len(contract["claims"]) >= 1
    # Verify full end-to-end compliance with strict evidence_contract_validator boundary
    from app.schemas.copilot import CopilotResponse
    from app.services.chatbot.evidence_contract_validator import validate_response_evidence_contract

    resp = CopilotResponse(
        intent="MEDICATION_SAFETY_PROFILE",
        reply_text=paraphrased_reply,
        answer_type="grounded_reference",
        source_status="exact_match",
        confidence=0.95,
        rag_grounded=True,
        citations=[{"chunk_id": "monograph:paracetamol:overdose", "source": "Dược thư VN"}],
        evidence=verified_evidence,
        claims=contract["claims"],
        evidence_claim_map=contract["evidence_claim_map"],
    )
    validated = validate_response_evidence_contract(resp)
    assert validated.answer_type == "grounded_reference"
    assert validated.rag_grounded is True
    assert len(validated.claims) >= 1

    # 2. Completely unrelated / hallucinated reply MUST yield 0 claims -> safe_abstention
    hallucinated_reply = "### Tóm tắt nhanh\nThuốc này giúp mọc tóc nhanh và trị sâu răng hiệu quả."
    contract_bad = _evidence_claim_contract(verified_evidence, hallucinated_reply, {"monograph:paracetamol:overdose"})
    assert len(contract_bad["claims"]) == 0

    # 3. Missing source_version MUST yield 0 claims -> safe_abstention
    unversioned_ev = [{**verified_evidence[0], "source_version": "unversioned"}]
    contract_unver = _evidence_claim_contract(unversioned_ev, paraphrased_reply, {"monograph:paracetamol:overdose"})
    assert len(contract_unver["claims"]) == 0


def test_stale_auto_qa_node_detection():
    from app.services.rag.verified_qa_service import VerifiedQAService

    assert VerifiedQAService._is_stale_auto_node({
        "verification_source": "auto_drug_lookup",
        "answer_markdown": "Nếu không có N-acetylcystein, dùng methionin (xem chuyên luận Methionin).",
    }) is True
    assert VerifiedQAService._is_stale_auto_node({
        "verification_source": "manual_curator",
        "answer_markdown": "Nội dung đã kiểm duyệt thủ công (xem chuyên luận Methionin).",
    }) is False
    assert VerifiedQAService._is_stale_auto_node({
        "verification_source": "auto_drug_lookup",
        "answer_markdown": "### Tóm tắt nhanh\nParacetamol quá liều cần dùng N-acetylcystein.",
    }) is False
