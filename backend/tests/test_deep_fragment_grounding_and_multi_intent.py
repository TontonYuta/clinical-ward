"""
Bộ Kiểm Thử Toàn Diện: Deep Fragment Grounding, Dynamic INN Bridge, Multi-Intent & Prescription Audit.
Kiểm tra triệt để:
1. Số trang tiểu mục chính xác (Section-level Page Grounding).
2. Cầu nối động Biệt dược DAV -> Dược Thư Quốc Gia Việt Nam (Dynamic INN Bridge).
3. Chuẩn hóa URL W3C Text Fragment (#page=X:~:text=...).
4. Phân rã và thực thi câu hỏi kép đa ý định (Recursive Multi-Intent).
5. Nhận diện và thẩm định khối đơn thuốc nhiều dòng (Prescription Block Audit).
"""
import pytest
from types import SimpleNamespace
from app.database import AsyncSessionLocal
from app.schemas.copilot import CopilotQuery
from app.services.session_context import get_or_create_session
from app.services.chatbot.copilot_orchestrator import handle_copilot_chat
from app.services.chatbot.dynamic_inn_bridge import (
    resolve_drug_to_monograph,
    get_monograph_section_page,
    build_w3c_text_fragment_url,
)
from app.services.chatbot.prescription_block_handler import detect_prescription_block
from app.services.chatbot.prescription_block_handler import handle_prescription_block_audit
from app.services.rag.source_resolver import resolve_citation_document


class DummyRequest:
    headers = {"user-agent": "pytest-clinical-runner"}
    client = type("Client", (), {"host": "127.0.0.1"})()
    state = SimpleNamespace()


def test_section_page_grounding_paracetamol():
    """Kiểm tra số trang chuyên luận Paracetamol được gán chính xác theo từng tiểu mục."""
    mono = resolve_drug_to_monograph("Paracetamol 500mg", "Paracetamol")
    assert mono is not None
    assert mono.get("inn") == "Paracetamol"

    # Liều dùng phải trỏ đến trang 1120 (thay vì trang đầu 1118)
    dose_page, sec_dose = get_monograph_section_page(mono, "dosage")
    assert dose_page == 1120
    assert sec_dose == "dosage"

    # Tác dụng phụ phải trỏ đến trang 1119
    adr_page, sec_adr = get_monograph_section_page(mono, "adverse_effects")
    assert adr_page == 1119
    assert sec_adr == "adverse_effects"

    # Quá liều & xử trí phải trỏ đến trang 1121
    od_page, sec_od = get_monograph_section_page(mono, "overdose_treatment")
    assert od_page == 1121
    assert sec_od == "overdose_treatment"


def test_dynamic_inn_bridge_dav_to_monograph():
    """Kiểm tra biệt dược DAV tự động được ánh xạ sang chuyên luận DĐVN V."""
    cases = [
        ("Nexium 40mg", "Esomeprazol magnesi 40mg", "Esomeprazole"),
        ("Coversyl 5mg", "Perindopril arginine 5mg", "Perindopril"),
        ("Klacid 500mg", "Clarithromycin 500mg", "Clarithromycin"),
        ("Augmentin 1g", "Amoxicillin 875mg, Acid clavulanic 125mg", "Amoxicillin"),
        ("Hapacol 250", "Paracetamol 250mg", "Paracetamol"),
    ]
    for brand, active, expected_inn in cases:
        mono = resolve_drug_to_monograph(brand, active)
        assert mono is not None, f"Failed to bridge {brand} ({active})"
        assert expected_inn.lower() in mono.get("inn", "").lower()
        assert mono.get("start_page") is not None
        assert mono.get("start_page") > 0


def test_w3c_text_fragment_url_generation():
    """Kiểm tra sinh URL chuẩn W3C Text Fragment."""
    url = build_w3c_text_fragment_url(
        "/pdf/Duoc_Thu_Quoc_Gia_Viet_Nam.pdf",
        1120,
        "Liều uống thông thường là 0,5 - 1 g mỗi lần."
    )
    assert "/pdf/Duoc_Thu_Quoc_Gia_Viet_Nam.pdf#page=1120" in url
    assert ":~:text=" in url


def test_regulatory_circular_page_grounding():
    """Kiểm tra văn bản quy phạm pháp luật không bị hardcode rơi về page=1."""
    # Thông tư 20/2017 Điều 15 về thu hồi vỏ ống morphin phải ra trang 8
    url, doc_id, page = resolve_citation_document(
        source="Thông tư 20/2017/TT-BYT",
        legal_basis="Điều 15 Thông tư 20/2017/TT-BYT thu hồi vỏ ống gây nghiện",
        section="Điều 15",
        query="thu hồi vỏ ống morphin"
    )
    assert doc_id == "tt-20-2017"
    assert page == 8
    assert "#page=8" in url

    # Thông tư 22/2011 Điều 10 về tủ trực phải ra trang 4
    url, doc_id, page = resolve_citation_document(
        source="Thông tư 22/2011/TT-BYT",
        legal_basis="Thông tư 22/2011/TT-BYT",
        section="Điều 10",
        query="cơ số tủ trực cấp cứu mẫu 01"
    )
    assert doc_id == "tt-22-2011"
    assert page == 4
    assert "#page=4" in url


def test_dtqg_source_identity_wins_over_query_terms_that_name_a_regulation():
    url, doc_id, page = resolve_citation_document(
        source="Dược thư Quốc gia Việt Nam, lần xuất bản II",
        legal_basis="Dược thư Quốc gia Việt Nam (2015, QĐ 2033/QĐ-BYT)",
        section="Adrenalin (Trang 56)",
        query="xử trí phản vệ bằng Adrenalin",
        active_drug="Adrenalin",
    )

    assert doc_id == "dtqg-v2-2015"
    assert url.startswith("/pdf/Duoc_Thu_Quoc_Gia_Viet_Nam.pdf")
    assert page == 56


def test_prescription_block_detection():
    """Kiểm tra nhận diện khối đơn thuốc nhiều dòng."""
    raw_rx = """1. Augmentin 1g x 2 viên/ngày uống sau ăn
2. Panadol 500mg x 3 viên/ngày khi sốt
3. Nexium 40mg x 1 viên/ngày sáng trước ăn"""

    is_rx, lines = detect_prescription_block(raw_rx)
    assert is_rx is True
    assert len(lines) == 3

    # Câu hỏi đơn lẻ không phải đơn thuốc
    single_q = "cho tôi hỏi liều Paracetamol cho trẻ em"
    is_rx_single, _ = detect_prescription_block(single_q)
    assert is_rx_single is False


@pytest.mark.asyncio
async def test_live_prescription_block_audit_fails_closed_without_versioned_rule_sources():
    """Không phát hành kết luận audit trước khi rule catalog có provenance."""
    raw_rx = """Bác sĩ duyệt giúp đơn thuốc:
1. Clopidogrel 75mg x 1v/ngày
2. Omeprazol 20mg x 1v/ngày
3. Aspirin 81mg x 1v/ngày"""

    async with AsyncSessionLocal() as db:
        session = get_or_create_session("bench_rx_01", "BS. Hoàng Long", "doctor")
        q = CopilotQuery(
            query=raw_rx,
            user_name="BS. Hoàng Long",
            user_role="doctor",
            session_id="bench_rx_01"
        )
        resp = await handle_copilot_chat(q, DummyRequest(), db, session=session, history="")

        assert resp is not None
        if not resp.rag_grounded:
            assert resp.answer_type == "safe_abstention"
            assert resp.citations == []
            assert resp.evidence == []
            assert resp.abstention_reason
            assert "chưa thể xác minh an toàn" in resp.reply_text.casefold()
        else:
            assert resp.answer_type == "composite_answer"
            assert resp.citations and resp.evidence
            citation_ids = {item.get("chunk_id") for item in resp.citations}
            evidence_ids = {item.get("chunk_id") for item in resp.evidence}
            assert citation_ids.intersection(evidence_ids)


@pytest.mark.asyncio
async def test_prescription_audit_does_not_claim_verified_safety_from_unlinked_rules():
    async with AsyncSessionLocal() as db:
        response = await handle_prescription_block_audit(
            raw_query="1. Example 10 mg\n2. Example 20 mg",
            prescription_lines=["1. Example 10 mg", "2. Example 20 mg"],
            user_name="Clinician", user_role="doctor", session_id="source-check", db=db,
        )

    assert response.rag_grounded is False
    assert response.answer_type == "safe_abstention"
    assert response.citations == []
    assert response.evidence == []


@pytest.mark.asyncio
async def test_multi_intent_compound_query_abstains_if_any_child_lacks_linked_evidence():
    """Kiểm tra câu hỏi kép phân rã và trả lời trọn vẹn cả 2 vế."""
    compound_query = "cho biết liều Paracetamol cho trẻ 15kg và thuốc này có tương tác với Ibuprofen không"

    async with AsyncSessionLocal() as db:
        session = get_or_create_session("bench_multi_01", "BS. Nguyễn Mai", "doctor")
        q = CopilotQuery(
            query=compound_query,
            user_name="BS. Nguyễn Mai",
            user_role="doctor",
            session_id="bench_multi_01"
        )
        resp = await handle_copilot_chat(q, DummyRequest(), db, session=session, history="")

        assert resp is not None
        assert resp.intent == "MULTI_INTENT_COMPOSITE"
        if resp.rag_grounded:
            assert resp.answer_type == "composite_answer"
            assert resp.citations and resp.evidence
            citation_ids = {item.get("chunk_id") for item in resp.citations}
            evidence_ids = {item.get("chunk_id") for item in resp.evidence}
            assert citation_ids.intersection(evidence_ids)
        else:
            assert resp.answer_type == "safe_abstention"
            assert resp.citations == []
            assert resp.abstention_reason
            assert "chưa thể xác minh" in resp.reply_text.casefold()
