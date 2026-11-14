from app.services.chatbot.copilot_orchestrator import _requested_fields_from_managed_schema


def test_hepatic_adjustment_context_does_not_expand_into_dosage_or_contraindications():
    query = "Paracetamol có cần hiệu chỉnh liều khi suy gan không?"

    fields = _requested_fields_from_managed_schema(
        query,
        requested_field="dosage",
        requested_fields=["hepatic_adjustment", "adult_dosage", "contraindications"],
    )

    assert fields == ["hepatic_adjustment"]


def test_explicit_multi_field_request_keeps_independently_requested_facets():
    query = "Paracetamol: liều dùng và tác dụng phụ là gì?"

    fields = _requested_fields_from_managed_schema(
        query,
        requested_field="detailed_profile",
        requested_fields=["adult_dosage", "adverse_effects"],
    )

    assert set(fields) == {"adult_dosage", "adverse_effects"}
