"""Contextual suggested chip generation based on active drug and route (<=60 LOC)."""
from app.services.clinical_ddi_engine.drug_registry import DRUG_REGISTRY


def generate_suggested_chips(
    active_drug_key: str | None = None,
    route: str = "general",
    requested_fields: set[str] | None = None,
    drug_name: str | None = None,
) -> list[str]:
    """Return 2-3 contextual chips aligned with active medication and current intent."""
    req = requested_fields or set()
    if route == "emergency":
        return ["Phác đồ cấp cứu phản vệ TT 51/2017/TT-BYT", "Liều Adrenalin tiêm bắp cấp cứu"]
    if route == "ddi_pair_assessment":
        return ["Cơ chế và mức độ nghiêm trọng của tương tác này", "Biện pháp xử trí hoặc phối hợp thay thế an toàn"]

    target = drug_name
    if not target and active_drug_key and active_drug_key in DRUG_REGISTRY:
        target = DRUG_REGISTRY[active_drug_key].get("display", active_drug_key.title())

    if target:
        target_clean = target.split("(")[0].strip() if not target.startswith("(") else target.strip("()")
        chips = []
        if not any(f in req for f in ("adult_dosage", "dosage", "pediatric_dosage")):
            chips.append(f"Liều dùng của {target_clean}")
        if "contraindications" not in req:
            chips.append(f"Chống chỉ định của {target_clean}")
        if "adverse_effects" not in req:
            chips.append(f"Tác dụng phụ của {target_clean}")
        if "interaction" not in req:
            chips.append(f"Tương tác thuốc của {target_clean}")
        if len(chips) < 3:
            chips.append(f"Chỉ định của {target_clean}")
        return chips[:3]

    return [
        "Tra cứu thuốc Paracetamol",
        "Tra cứu SĐK VD-24757-16",
        "Tương tác giữa Clopidogrel và Omeprazol",
    ]
