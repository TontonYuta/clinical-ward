"""Output & citation grounding validator to prevent cross-drug hallucinations (<=80 LOC)."""
from typing import Any
from app.services.clinical_ddi_engine.drug_registry import DRUG_REGISTRY
from app.services.clinical_ddi_engine.entity_resolution import resolve_registered_medications


def validate_grounded_reply(
    reply_text: str,
    citations: list[dict[str, Any]],
    target_drug_keys: list[str],
) -> tuple[str, list[dict[str, Any]], bool]:
    """Validate that reply and citations match the requested target drug.

    Returns (validated_reply, validated_citations, is_valid).
    """
    if not target_drug_keys:
        return reply_text, citations, True

    valid_citations = []
    for c in citations:
        source_text = f"{c.get('source', '')} {c.get('section', '')} {c.get('excerpt', '')}".casefold()
        resolved_citation_drugs = resolve_registered_medications(source_text)
        # Citation is valid if it contains the target drug or is a general protocol
        if any(key in resolved_citation_drugs for key in target_drug_keys) or not resolved_citation_drugs:
            valid_citations.append(c)

    # Check for critical cross-drug leak in the answer
    reply_lower = reply_text.casefold()
    reply_drugs = resolve_registered_medications(reply_lower)
    leak_drugs = [d for d in reply_drugs if d not in target_drug_keys and DRUG_REGISTRY.get(d, {}).get("entity_role") != "contextual_exposure"]

    # If the reply explicitly talks about another drug while missing the target drug entirely
    target_present = any(
        alias in reply_lower
        for key in target_drug_keys
        for alias in DRUG_REGISTRY.get(key, {}).get("aliases", [key])
    )

    if not target_present and leak_drugs:
        target_display = DRUG_REGISTRY[target_drug_keys[0]].get("display", target_drug_keys[0].title())
        safe_reply = (
            f"### Thông tin đối chiếu lâm sàng: {target_display}\n\n"
            f"Hiện chưa tìm thấy tài liệu chuyên luận đầy đủ cho hoạt chất **{target_display}** trong kho dữ liệu cục bộ.\n"
            f"Vui lòng tra cứu trực tiếp từ Dược thư Quốc gia Việt Nam hoặc tờ hướng dẫn sử dụng (SPC) đã được Cục Quản lý Dược phê duyệt."
        )
        return safe_reply, [], False

    return reply_text, valid_citations, True
