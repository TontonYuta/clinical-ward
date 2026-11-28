from app.services.chatbot.smart_chip_engine import generate_smart_clinical_chips


def test_comprehensive_query_prefers_canonical_inn_and_deep_followups():
    chips = generate_smart_clinical_chips(
        query="Thông tin chi tiết về thuốc Ibuprofen",
        drug_name="Ibuprofeno Azevedos",
        active_ingredient="Ibuprofen",
    )
    assert len(chips) == 3
    assert all("Ibuprofeno Azevedos" not in c for c in chips)
    assert all("Ibuprofen" in c for c in chips)
    assert not any("Chỉ định và liều dùng" in c for c in chips)
    assert any("suy thận" in c.lower() for c in chips)
    assert any("có thai" in c.lower() for c in chips)


def test_explicit_brand_query_preserves_brand_name():
    chips = generate_smart_clinical_chips(
        query="Tác dụng phụ của Efferalgan Codein",
        drug_name="Efferalgan Codein",
        active_ingredient="Paracetamol + Codein",
    )
    assert len(chips) == 3
    assert all("Efferalgan Codein" in c for c in chips)
