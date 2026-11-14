from app.schemas.copilot import RagResponse


def test_rag_response_defaults_are_unverified():
    response = RagResponse(query="dose?", answer="")

    assert response.rag_grounded is False
    assert response.confidence_score == 0.0
    assert response.factuality_score == 0.0
    assert response.critique_verdict == "NOT_RUN"
