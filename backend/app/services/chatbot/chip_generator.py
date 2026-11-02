"""Contextual suggested chip generation based on active drug and route (<=60 LOC)."""
from app.services.clinical_ddi_engine.drug_registry import DRUG_REGISTRY


def generate_suggested_chips(
    active_drug_key: str | None = None,
    route: str = "general",
    requested_fields: set[str] | None = None,
) -> list[str]:
    """Return 2-3 contextual chips aligned with active medication and current intent."""
    req = requested_fields or set()
    if route == "emergency":
        return [
            "Phác đồ cấp cứu phản vệ TT 51/2017/TT-BYT",
            "Liều Adrenalin tiêm bắp cấp cứu",
        ]
    if route == "ddi_pair_assessment":
        return [
            "Cơ chế và mức độ nghiêm trọng của tương tác này",
            "Biện pháp xử trí hoặc phối hợp thay thế an toàn",
        ]

    if active_drug_key and active_drug_key in DRUG_REGISTRY:
        display = DRUG_REGISTRY[active_drug_key].get("display", active_drug_key.title())
        chips = []
        if "dosage" not in req:
            chips.append(f"Liều tối đa 24h của {display}?")
        if "contraindications" not in req:
            chips.append(f"Chống chỉ định của {display} là gì?")
        if "adverse_effects" not in req:
            chips.append(f"Tác dụng phụ thường gặp của {display}?")
        if len(chips) < 3:
            chips.append(f"Kiểm tra tương tác thuốc của {display}")
        return chips[:3]

    return [
        "Tra cứu Dược Thư Quốc Gia",
        "Kiểm tra tương tác hai thuốc",
        "Phác đồ cấp cứu phản vệ TT 51/2017",
    ]
