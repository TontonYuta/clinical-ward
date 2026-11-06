"""Subject routing regressions without database or provider side effects."""
from app.services.chatbot.lexical_trie_matcher import DrugLexicalMatcher
from app.services.rag.citation_grounder import format_grounded_answer
from app.services.rag.types import RagChunk, RetrievedChunk
import asyncio
from types import SimpleNamespace


def test_patient_name_is_not_a_cross_boundary_herbal_drug_mention():
    matcher = DrugLexicalMatcher()
    matcher.insert("Nhân trần", "Nhân trần")
    matcher.insert("Paracetamol", "Paracetamol")
    matcher.insert("Mai", "Mai")
    matcher._is_loaded = True
    assert matcher.extract_medications("Bệnh nhân Trần Thị Mai sốt 39 độ") == []
    assert matcher.extract_medications("Bệnh nhân Trần Thị Mai đang dùng Paracetamol") == ["Paracetamol"]
    assert matcher.extract_medications("Bệnh nhân Trần Thị Mai, đang dùng Paracetamol") == ["Paracetamol"]
    assert matcher.extract_medications("Thông tin thuốc Nhân trần") == ["Nhân trần"]


def test_accent_folding_does_not_turn_clinical_words_into_herbal_product():
    matcher = DrugLexicalMatcher()
    matcher.insert("Cao lá", "Cao lá")
    matcher.insert("Nhân trần", "Nhân trần")
    matcher._is_loaded = True
    assert matcher.extract_medications("triệu chứng buồn nôn, sốt cao là biểu hiện của gì") == []
    assert matcher.extract_medications("Thông tin thuốc Cao lá") == ["Cao lá"]
    assert matcher.extract_medications("Thông tin thuốc Nhan tran") == ["Nhân trần"]


def test_symptom_query_cannot_be_answered_with_an_unrelated_drug_adr():
    query = "đau bụng, đi ngoài, mất nước là biểu hiện của gì"
    chunk = RagChunk("adr", "Dược thư", "test", "test", "Tác dụng phụ: Clioquinol",
                     "Clioquinol có tác dụng phụ đau bụng, đi ngoài và mất nước.", entity_type="monograph")
    result = format_grounded_answer(query, [RetrievedChunk(chunk, 1)], [], {})
    assert result.rag_grounded is False
    assert "Clioquinol" not in result.answer


def test_matching_symptom_guideline_is_still_available():
    query = "đau bụng, đi ngoài, mất nước là biểu hiện của gì"
    chunk = RagChunk("guide", "Clinical source", "test", "test", "Đau bụng, tiêu chảy và mất nước",
                     "Đau bụng, đi ngoài và mất nước cần đánh giá theo hướng dẫn nguồn G-123.", entity_type="guideline")
    result = format_grounded_answer(query, [RetrievedChunk(chunk, 1)], [], {})
    assert result.rag_grounded is True
    assert "G-123" in result.answer


def test_drug_named_adr_query_keeps_its_drug_evidence():
    query = "Paracetamol gây đau bụng và buồn nôn không?"
    chunk = RagChunk("adr", "Dược thư", "test", "test", "Tác dụng phụ Paracetamol",
                     "Paracetamol và nguy cơ đau bụng, buồn nôn theo nguồn P-123.", entity_type="monograph")
    result = format_grounded_answer(query, [RetrievedChunk(chunk, 1)], [], {})
    assert result.rag_grounded is True
    assert "P-123" in result.answer


class ColdDb:
    def __init__(self, rows): self.rows = rows
    async def execute(self, stmt): return self
    def scalars(self): return self
    def all(self): return self.rows
    def scalar_one_or_none(self): return self.rows[0] if self.rows else None


def cold_state(**changes):
    return SimpleNamespace(**(dict(id=1, current_temp=4.5, mkt_temp=4.8, is_quarantined=False,
                                  is_outage=False, vvm_level=1, updated_at="2026-11-05T10:00:00Z") | changes))


def test_coldchain_chat_never_invents_telemetry_without_a_record():
    from app.services.copilot_intents_info import handle_coldchain_intent
    response = asyncio.run(handle_coldchain_intent(ColdDb([])))
    assert "4.5" not in response.reply_text
    assert "4.8" not in response.reply_text
    assert response.card is None
    assert response.source_status == "no_recorded_telemetry"


def test_coldchain_chat_high_temperature_is_not_normal():
    from app.services.copilot_intents_info import handle_coldchain_intent
    response = asyncio.run(handle_coldchain_intent(ColdDb([cold_state(current_temp=12)])))
    assert "BÌNH THƯỜNG" not in response.reply_text
    assert response.intent == "CLINICAL_COLD_CHAIN_ALERT"
    assert "12" in response.reply_text


def test_coldchain_chat_does_not_silently_choose_between_cabinets():
    from app.services.copilot_intents_info import handle_coldchain_intent
    response = asyncio.run(handle_coldchain_intent(ColdDb([cold_state(), cold_state(id=2)])))
    assert response.answer_type == "clarification"
    assert response.card is None


def test_coldchain_gsp_chip_routes_to_recorded_data():
    from app.services.chatbot.hospital_business_dispatcher import dispatch_operational_business
    response = asyncio.run(dispatch_operational_business("Kiểm tra kho lạnh GSP", "kiểm tra kho lạnh gsp", "test", ColdDb([cold_state()])))
    assert response is not None
    assert response.intent == "CLINICAL_COLD_CHAIN_TELEMETRY"
    assert response.card.data["temperature"] == 4.5


def test_new_symptom_case_does_not_inherit_prior_drug_or_search_patient_name(monkeypatch):
    from app.schemas.copilot import CopilotQuery
    from app.services.chatbot.copilot_orchestrator import handle_copilot_chat
    from app.services.session_context import SessionState

    class Retriever:
        def retrieve(self, *args, **kwargs):
            chunk = RagChunk("adr", "Dược thư", "test", "test", "Tác dụng phụ Clioquinol",
                             "Clioquinol gây đau bụng, đi ngoài, mất nước.", entity_type="monograph")
            return [RetrievedChunk(chunk, 1)]

    class NoPatientLookup:
        async def execute(self, stmt):
            raise AssertionError("A symptom question must not become a patient-name drug search")

    monkeypatch.setattr("app.services.chatbot.pure_rag_handler.HybridRetriever", Retriever)
    monkeypatch.setattr("app.services.rag.rag_pipeline.get_rag_retriever", Retriever)
    session = SessionState("test", "test", "doctor")
    session.set_active_medication("Paracetamol", "paracetamol")
    request = SimpleNamespace(state=SimpleNamespace(authenticated_user=None))
    payload = CopilotQuery(query="Bệnh nhân Trần Thị Mai đau bụng, đi ngoài, mất nước là biểu hiện của gì", user_name="test", user_role="doctor", session_id="test")
    response = asyncio.run(handle_copilot_chat(payload, request, NoPatientLookup(), session=session,
                                            history="Thông tin Paracetamol"))
    assert response.intent == "CLINICAL_CASE_CLARIFICATION"
    assert response.rag_grounded is False
    assert "Clioquinol" not in response.reply_text
    assert "Nhân trần" not in response.reply_text
    assert session.active_medication_name is None


def test_unidentified_object_does_not_trigger_fuzzy_drug_suggestions():
    from app.schemas.copilot import CopilotQuery
    from app.services.chatbot.copilot_orchestrator import handle_copilot_chat
    from app.services.session_context import SessionState
    class NoDrugSearch:
        async def execute(self, stmt):
            raise AssertionError("No medication was supplied for a drug search")
    payload = CopilotQuery(query="cái này dùng thế nào nhỉ cho tôi biết thêm", user_name="test", session_id="object")
    request = SimpleNamespace(state=SimpleNamespace(authenticated_user=None))
    response = asyncio.run(handle_copilot_chat(payload, request, NoDrugSearch(),
                                            session=SessionState("object", "test", "nurse"), history=""))
    assert response.intent == "CLINICAL_SAFE_ABSTENTION"
    assert response.citations == []
    assert response.card is None
