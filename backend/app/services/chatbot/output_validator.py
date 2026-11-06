"""Output & citation grounding validator to prevent cross-drug hallucinations (<=80 LOC)."""
from typing import Any
from app.services.clinical_ddi_engine.drug_registry import DRUG_REGISTRY
from app.services.clinical_ddi_engine.entity_resolution import resolve_registered_medications


def validate_grounded_reply(
    reply_text: str,
    citations: list[dict[str, Any]],
    target_drug_keys: list[str],
    query: str = "",
) -> tuple[str, list[dict[str, Any]], bool]:
    """Validate that reply and citations match the requested target drug.

    Returns (validated_reply, validated_citations, is_valid).
    """
    reply_lower = reply_text.casefold()
    query_lower = (query or "").casefold()
    reply_drugs = resolve_registered_medications(reply_lower)

    # Prevent accidental drift into controlled substances when not queried
    controlled_unrelated = not target_drug_keys and any(d in ("morphine", "diazepam", "fentanyl") for d in reply_drugs) and not any(
        k in query_lower for k in ("morphin", "diazepam", "fentanyl", "gây nghiện", "hướng thần", "giảm đau ung thư", "đau nặng", "an thần", "co giật")
    )
    if controlled_unrelated:
        safe_reply = (
            "Chưa tìm thấy tài liệu hướng dẫn chuyên môn phù hợp cho nội dung tra cứu này trong nguồn tri thức đang lập chỉ mục.\n"
            "Vui lòng tham khảo phác đồ điều trị chuyên khoa của Bộ Y tế hoặc xin ý kiến dược sĩ lâm sàng."
        )
        return safe_reply, [], False

    # Prevent antimalarial drift when antipyretics are queried without explicit malaria mention
    is_fever_query = any(k in query_lower for k in ("hạ sốt", "thuốc hạ sốt", "giảm sốt", "trị sốt", "uống thuốc hạ sốt", "sốt cao", "thân nhiệt"))
    is_malaria_query = any(k in query_lower for k in ("sốt rét", "malaria", "plasmodium", "ký sinh trùng sốt rét"))
    contains_antimalarial = any(
        d in ("artemether", "artemisinin", "artesunat", "chloroquine", "hydroxychloroquine", "quinine")
        for d in reply_drugs
    ) or any(w in reply_lower for w in ("thuốc chống sốt rét", "diệt thể phân liệt", "plasmodium", "artemether"))

    if is_fever_query and not is_malaria_query and contains_antimalarial:
        safe_reply = (
            "Dạ thưa Bác sĩ, nội dung tra cứu liên quan đến **thuốc hạ sốt thông thường (antipyretics)**. "
            "Tài liệu truy xuất là **thuốc chống sốt rét (antimalarials)**, không phù hợp về mặt chỉ định lâm sàng cho hạ sốt thông thường.\n\n"
            "Theo **Dược thư Quốc gia Việt Nam (DĐVN V)**, các thuốc hạ sốt an toàn được khuyến cáo bao gồm:\n"
            "• **Paracetamol (Acetaminophen):** Lựa chọn đầu tay hạ sốt giảm đau an toàn cho người lớn (500 - 1000mg/lần, tối đa 4g/ngày) và trẻ em (10 - 15 mg/kg/lần).\n"
            "• **Ibuprofen (NSAID):** Lựa chọn thay thế khi cần kháng viêm, nhưng **tuyệt đối không dùng khi nghi ngờ Sốt xuất huyết Dengue (QĐ 2760/QĐ-BYT)** do nguy cơ xuất huyết tiêu hóa ồ ạt.\n\n"
            "🔗 **Nguồn đối chứng:** Dược thư Quốc gia Việt Nam (DĐVN V) - Chuyên luận Paracetamol & Ibuprofen."
        )
        return safe_reply, [], False

    if not target_drug_keys:
        # Prevent ungrounded dumping of a single drug monograph when query intent doesn't match
        if "### chỉ định & liều dùng:" in reply_lower:
            core_intent_terms = [w for w in ("hạ sốt", "sốt", "đau đầu", "đau bụng", "dị ứng", "trĩ", "kháng sinh") if w in query_lower]
            if core_intent_terms and not any(t in reply_lower for t in core_intent_terms):
                safe_reply = (
                    "Chưa tìm thấy tài liệu hướng dẫn chuyên môn phù hợp cho nội dung tra cứu này trong nguồn tri thức đang lập chỉ mục.\n"
                    "Vui lòng tham khảo phác đồ điều trị chuyên khoa của Bộ Y tế hoặc xin ý kiến dược sĩ lâm sàng."
                )
                return safe_reply, [], False
        return reply_text, citations, True

    valid_citations = []
    for c in citations:
        source_text = f"{c.get('source', '')} {c.get('section', '')} {c.get('excerpt', '')}".casefold()
        resolved_citation_drugs = resolve_registered_medications(source_text)
        if any(key in resolved_citation_drugs for key in target_drug_keys) or not resolved_citation_drugs:
            valid_citations.append(c)

    leak_drugs = [d for d in reply_drugs if d not in target_drug_keys and DRUG_REGISTRY.get(d, {}).get("entity_role") != "contextual_exposure"]

    target_present = any(
        alias in reply_lower or key in reply_lower
        for key in target_drug_keys
        for alias in DRUG_REGISTRY.get(key, {}).get("aliases", [key])
    )

    if not target_present and leak_drugs:
        target_display = target_drug_keys[0].title()
        safe_reply = (
            f"### Thông tin đối chiếu lâm sàng: {target_display}\n\n"
            f"Hiện chưa tìm thấy tài liệu chuyên luận đầy đủ cho hoạt chất **{target_display}** trong kho dữ liệu cục bộ.\n"
            f"Vui lòng tra cứu trực tiếp từ Dược thư Quốc gia Việt Nam hoặc tờ hướng dẫn sử dụng (SPC) đã được Cục Quản lý Dược phê duyệt."
        )
        return safe_reply, [], False

    return reply_text, valid_citations, True
