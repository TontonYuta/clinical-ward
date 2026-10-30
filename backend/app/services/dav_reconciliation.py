from __future__ import annotations
from collections import Counter
from typing import Any
from app.services.dav_normalizer import normalize_dav_record


def _code(row: dict[str, Any], raw: bool) -> str:
    return str((row.get("soDangKy") if raw else row.get("nationalCode")) or "").strip()


def _key(code: str) -> str:
    return code.casefold()


def reconcile_dav_snapshots(raw_rows: list[dict[str, Any]], old_rows: list[dict[str, Any]]) -> dict[str, Any]:
    raw_counts = Counter(_key(_code(row, True)) for row in raw_rows if _code(row, True))
    raw_by_code = {}
    for row in raw_rows:
        if _code(row, True) and _key(_code(row, True)) not in raw_by_code:
            raw_by_code[_key(_code(row, True))] = row
    old_by_code = {_key(_code(row, False)): row for row in old_rows if _code(row, False)}
    added = sorted(set(raw_by_code) - set(old_by_code))
    removed = sorted(set(old_by_code) - set(raw_by_code))
    changed = []
    for code in sorted(set(raw_by_code) & set(old_by_code)):
        raw = raw_by_code[code]
        normalized = normalize_dav_record(raw)
        raw_fields = {"brand_name": normalized["brand_name"], "active_ingredient": normalized["active_ingredient_raw"], "concentration": normalized["strength_raw"], "dosage_form": normalized["dosage_form"], "manufacturer": normalized["manufacturer"]}
        old = old_by_code[code]
        old_names = {"brand_name": "brandName", "active_ingredient": "activeIngredient", "concentration": "concentration", "dosage_form": "dosageForm", "manufacturer": "manufacturer"}
        fields = [field for field, value in raw_fields.items() if str(value or "").strip() != str(old.get(old_names[field]) or "").strip()]
        if fields:
            changed.append({"registration_code": _code(raw, True), "changed_fields": fields})
    duplicate_display = sorted(_code(next(row for row in raw_rows if _key(_code(row, True)) == key), True) for key, count in raw_counts.items() if count > 1)
    added_display = sorted(_code(raw_by_code[key], True) for key in added)
    removed_display = sorted(_code(old_by_code[key], False) for key in removed)
    return {"raw_records": len(raw_rows), "old_records": len(old_rows), "added_registration_codes": added_display, "removed_registration_codes": removed_display, "duplicate_raw_registration_codes": duplicate_display, "changed_records": changed}
