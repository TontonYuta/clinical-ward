import pytest

from app.database import AsyncSessionLocal
from app.services.copilot_drug_lookup import lookup_drug_authoritative
from app.services.chatbot.copilot_orchestrator import _requested_fields_from_managed_schema
from app.services.chatbot.clinical_schema_extractor import extract_clinical_query_schema_deterministic


@pytest.mark.asyncio
async def test_alcohol_facet_does_not_render_unrelated_interactions():
    query = "Paracetamol có dùng cùng rượu không?"
    analysis = extract_clinical_query_schema_deterministic(query)
    requested_fields = _requested_fields_from_managed_schema(
        query,
        requested_fields=analysis.requested_fields,
    )
    async with AsyncSessionLocal() as db:
        response = await lookup_drug_authoritative(
            query,
            db,
            user_name="Bác sĩ",
            user_role="doctor",
            requested_fields=requested_fields,
        )

    text = response.reply_text.casefold()
    assert "rượu" in text or "cồn" in text or "bia" in text
    assert "isoniazid" not in text
    assert "probenecid" not in text
    assert response.rag_grounded is True
    assert response.citations
    assert all("isoniazid" not in str(citation.get("excerpt", "")).casefold() for citation in response.citations)
    assert all("isoniazid" not in str(item.get("content", "")).casefold() for item in response.evidence)

