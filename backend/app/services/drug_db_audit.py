"""Read-only data quality audit for the local drug registry and monographs."""

from __future__ import annotations

import json
import re
import sqlite3
from collections import Counter
from pathlib import Path
from typing import Any

EMPTY_VALUES = {"", "-", "n/a", "na", "null", "none", "chưa cập nhật"}


def _empty(value: Any) -> bool:
    return value is None or str(value).strip().casefold() in EMPTY_VALUES


def audit_drug_database(db_path: Path, dtqg_json: Path) -> dict[str, Any]:
    """Return aggregate metrics and review queues without modifying either input."""
    conn = sqlite3.connect(f"file:{db_path.resolve()}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    try:
        products = [dict(row) for row in conn.execute("SELECT * FROM dav_national_drugs ORDER BY id")]
        monographs = [dict(row) for row in conn.execute("SELECT * FROM clinical_drug_monographs ORDER BY id")]
    finally:
        conn.close()

    by_code = Counter(str(row.get("national_code", "")).strip().casefold() for row in products)
    duplicate_codes = sorted(code for code, count in by_code.items() if code and count > 1)
    product_missing = {
        field: sum(_empty(row.get(field)) for row in products)
        for field in ("national_code", "brand_name", "active_ingredient", "dosage_form", "concentration", "manufacturer", "clinical_source")
    }
    ddi_rows = [row for row in products if not _empty(row.get("drug_interactions"))]
    monograph_missing = {
        field: sum(_empty(row.get(field)) for row in monographs)
        for field in ("inn", "source", "atc_code", "indications", "contraindications", "adult_dosage", "pediatric_dosage", "drug_interactions")
    }

    review_queue = []
    for row in products:
        flags = []
        if _empty(row.get("active_ingredient")):
            flags.append("missing_active_ingredient")
        if _empty(row.get("clinical_source")) and any(not _empty(row.get(key)) for key in ("indications", "contraindications", "adult_dosage", "drug_interactions")):
            flags.append("clinical_data_without_source")
        ingredient = str(row.get("active_ingredient") or "").strip()
        if re.search(r"\s(?:\+|/|;|and|và)\s", ingredient, re.IGNORECASE):
            flags.append("possible_combination_product")
        if not _empty(row.get("drug_interactions")) and _empty(row.get("clinical_source")):
            flags.append("interaction_text_without_source")
        if flags:
            review_queue.append({
                "record_type": "product",
                "id": row.get("id"),
                "national_code": row.get("national_code"),
                "brand_name": row.get("brand_name"),
                "active_ingredient": ingredient,
                "flags": flags,
            })

    with dtqg_json.open(encoding="utf-8") as source:
        source_rows = json.load(source)
    source_inns = Counter(re.sub(r"[^a-z0-9]+", "", str(row.get("inn", "")).casefold()) for row in source_rows)
    database_inns = Counter(re.sub(r"[^a-z0-9]+", "", str(row.get("inn", "")).casefold()) for row in monographs)
    missing_pages = [row.get("inn") for row in source_rows if not row.get("start_page")]
    return {
        "database": {
            "product_count": len(products),
            "duplicate_registration_codes": duplicate_codes,
            "missing_product_fields": product_missing,
            "products_with_interaction_text": len(ddi_rows),
            "interaction_text_without_source": sum(_empty(row.get("clinical_source")) for row in ddi_rows),
            "interaction_model": "free_text_on_product_record",
        },
        "monographs": {
            "database_count": len(monographs),
            "source_json_count": len(source_rows),
            "missing_fields": monograph_missing,
            "duplicate_normalized_inns": sorted(inn for inn, count in source_inns.items() if inn and count > 1),
            "database_only_normalized_inns": sorted(inn for inn in database_inns if inn and inn not in source_inns),
            "source_only_normalized_inns": sorted(inn for inn in source_inns if inn and inn not in database_inns),
            "source_entries_missing_page": missing_pages,
            "entries_with_interaction_text_in_source": sum(not _empty(row.get("drug_interactions")) for row in source_rows),
        },
        "review_queue": review_queue,
    }
