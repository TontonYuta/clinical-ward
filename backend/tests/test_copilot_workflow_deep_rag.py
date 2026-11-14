import pytest


@pytest.mark.asyncio
async def test_deep_rag_reuses_single_retrieval_path(monkeypatch):
    from types import SimpleNamespace
    from app.services.chatbot import pure_rag_handler
    from app.services.session_context import clear_session

    calls = {"pipeline": 0}

    async def execute(*args, **kwargs):
        calls["pipeline"] += 1
        return SimpleNamespace(
            citations=[], retrieved_chunks=[], rag_grounded=False, answer="insufficient", cdss_alert=None,
            legal_basis="", confidence_score=0.0, factuality_score=0.0,
            critique_verdict="NOT_RUN",
        )

    monkeypatch.setattr(pure_rag_handler.rag_pipeline, "execute_clinical_rag", execute)
    clear_session("deep-rag-single-retrieval")

    await pure_rag_handler.handle_deep_rag_consultation(
        query="Paracetamol liều dùng như thế nào?",
        lower_query="paracetamol liều dùng như thế nào?",
        user_role="doctor", history="", session_id="deep-rag-single-retrieval",
        user_name="Doctor", is_deep_pharmacology=True,
    )

    assert calls["pipeline"] == 1
