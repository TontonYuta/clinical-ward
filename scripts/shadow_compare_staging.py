#!/usr/bin/env python3
"""Compare normalized staging records with the legacy JSON registry by SĐK."""
from __future__ import annotations
import json
import csv
import sqlite3
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def norm(value):
    return " ".join(str(value or "").split()).casefold()

def main():
    db = ROOT / "artifacts/source-staging-raw.sqlite"
    legacy = json.loads((ROOT / "data/vietnam_drug_registry/dav_master_registry.json").read_text(encoding="utf-8"))
    old = {norm(row.get("nationalCode")): row for row in legacy if norm(row.get("nationalCode"))}
    manifest_path = ROOT / "artifacts/dav-raw-snapshot/manifest.json"
    raw_manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    raw_by_code = defaultdict(list)
    for page in raw_manifest.get("pages", []):
        payload = json.loads((manifest_path.parent / page["path"]).read_text(encoding="utf-8"))
        for record in (payload.get("result") or {}).get("items") or []:
            code = norm(record.get("soDangKy"))
            if code: raw_by_code[code].append(record)
    conn = sqlite3.connect(db)
    rows = conn.execute("SELECT national_code,brand_name,active_ingredient_raw,strength_raw,dosage_form,manufacturer FROM normalized_products").fetchall()
    conn.close()
    fields = (("brand_name", 1, "brandName"), ("active_ingredient_raw", 2, "activeIngredient"), ("strength_raw", 3, "concentration"), ("dosage_form", 4, "dosageForm"), ("manufacturer", 5, "manufacturer"))
    counts = Counter(); field_counts = Counter(); examples = []; field_examples = {}; review_rows = []
    staging_codes = {norm(row[0]) for row in rows if norm(row[0])}
    for row in rows:
        code = norm(row[0]); previous = old.get(code)
        if previous is None:
            counts["missing_in_legacy"] += 1
            if len(examples) < 100: examples.append({"national_code": row[0], "status": "missing_in_legacy", "brand_name": row[1]})
            continue
        raw_matches = raw_by_code.get(code, [])
        if len(raw_matches) != 1:
            counts["raw_code_duplicate_or_missing"] += 1
            review_rows.append({"priority": "P1", "national_code_staging": row[0], "national_code_legacy": previous.get("nationalCode"), "field": "national_code", "staging_value": row[0], "legacy_value": previous.get("nationalCode"), "source_status": "ambiguous_raw_code", "reason": f"raw_records={len(raw_matches)}"})
            continue
        raw = raw_matches[0]
        if raw.get("isDeleted") is True or raw.get("isDaRutSoDangKy") is True or raw.get("isHetHan") is True or raw.get("isActive") is False:
            source_status = "inactive_or_deleted"
        elif raw.get("isActive") is True and raw.get("isHetHan") is False and raw.get("isDeleted") is False:
            source_status = "active"
        else:
            source_status = "status_uncertain"
        changed = [name for name, idx, old_key in fields if norm(row[idx]) != norm(previous.get(old_key))]
        if changed:
            counts["changed_record"] += 1
            for field in changed:
                field_counts[field] += 1
                idx = next(index for name, index, _ in fields if name == field)
                old_key = next(key for name, _, key in fields if name == field)
                missing = row[idx] in (None, "")
                review_rows.append({"priority": "P1" if field in {"active_ingredient_raw", "brand_name"} else "P2", "national_code_staging": row[0], "national_code_legacy": previous.get("nationalCode"), "field": field, "staging_value": row[idx], "legacy_value": previous.get(old_key), "source_status": source_status, "reason": "staging_value_missing" if missing else "values_differ"})
                if len(field_examples.setdefault(field, [])) < 10:
                    field_examples[field].append({"national_code": row[0], "staging": row[idx], "legacy": previous.get(old_key)})
            if len(examples) < 100: examples.append({"national_code": row[0], "status": "changed", "changed_fields": changed})
        else: counts["exact"] += 1
    missing_old = sorted(set(old) - staging_codes)
    counts["missing_in_staging"] = len(missing_old)
    classification = {
        "source_refresh_or_schema_mismatch": ["strength_raw", "dosage_form", "manufacturer"],
        "requires_manual_content_review": ["active_ingredient_raw", "brand_name"],
    }
    result = {"staging_records": len(rows), "legacy_records": len(legacy), "comparison": dict(counts), "changed_field_counts": dict(field_counts), "classification": classification, "changed_field_examples": field_examples, "missing_in_staging_examples": [{"national_code": old[key].get("nationalCode"), "brand_name": old[key].get("brandName")} for key in missing_old[:100]], "changed_examples": examples}
    counts["raw_duplicate_registration_codes"] = sum(len(items) > 1 for items in raw_by_code.values())
    counts["raw_registration_records_missing_code"] = int(raw_manifest.get("records", 0)) - sum(len(items) for items in raw_by_code.values())
    for key in missing_old:
        review_rows.append({"priority": "P1", "national_code_staging": "", "national_code_legacy": old[key].get("nationalCode"), "field": "national_code", "staging_value": "", "legacy_value": old[key].get("nationalCode"), "source_status": "not_in_current_snapshot", "reason": "registration_code_absent_from_staging"})
    for row in rows:
        if norm(row[0]) not in old:
            review_rows.append({"priority": "P1", "national_code_staging": row[0], "national_code_legacy": "", "field": "national_code", "staging_value": row[0], "legacy_value": "", "source_status": "not_in_legacy_registry", "reason": "registration_code_absent_from_legacy"})
    result = {"staging_records": len(rows), "legacy_records": len(legacy), "raw_snapshot_records": raw_manifest.get("records"), "comparison": dict(counts), "changed_field_counts": dict(field_counts), "classification": classification, "review_queue_rows": len(review_rows), "changed_field_examples": field_examples, "missing_in_staging_examples": [{"national_code": old[key].get("nationalCode"), "brand_name": old[key].get("brandName")} for key in missing_old[:100]], "changed_examples": examples}
    out = ROOT / "artifacts/staging-shadow-comparison.json"
    out.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    review_rows.sort(key=lambda item: (item["priority"], item["field"], item["national_code_staging"]))
    with (ROOT / "artifacts/staging-shadow-review.csv").open("w", newline="", encoding="utf-8-sig") as stream:
        writer = csv.DictWriter(stream, fieldnames=["priority", "national_code_staging", "national_code_legacy", "field", "staging_value", "legacy_value", "source_status", "reason"])
        writer.writeheader(); writer.writerows(review_rows)
    print(json.dumps(result, ensure_ascii=False, indent=2))

if __name__ == "__main__": main()
