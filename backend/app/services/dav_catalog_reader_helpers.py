from __future__ import annotations
import json
import sqlite3
import hashlib
from typing import Any

def has_table(conn: sqlite3.Connection, name: str) -> bool:
    return conn.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (name,)).fetchone() is not None

def stock_for_registration(conn: sqlite3.Connection, code: str | None) -> list[dict[str, Any]]:
    if not code or not has_table(conn, "inventory_batches"):
        return []
    key = str(code).strip().casefold()
    rows = conn.execute(
        "SELECT unit,SUM(current_stock),COUNT(*) FROM inventory_batches WHERE lower(trim(registration_number))=? AND current_stock>0 GROUP BY unit ORDER BY unit",
        (key,)
    ).fetchall()
    return [{"unit": row[0] or "Không rõ đơn vị", "quantity": int(row[1]), "batch_count": int(row[2])} for row in rows]

def stock_for_product(conn: sqlite3.Connection, run_id: str, source_id: str) -> list[dict[str, Any]]:
    if not has_table(conn, "inventory_batches"):
        return []
    rows = conn.execute(
        "SELECT i.unit,SUM(i.current_stock),COUNT(*) FROM dav_catalog_inventory_links l JOIN inventory_batches i ON i.id=l.inventory_batch_id WHERE l.run_id=? AND l.source_id=? AND i.current_stock>0 GROUP BY i.unit ORDER BY i.unit",
        (run_id, source_id)
    ).fetchall()
    return [{"unit": row[0] or "Không rõ đơn vị", "quantity": int(row[1]), "batch_count": int(row[2])} for row in rows]

def hydrate_row(
    conn: sqlite3.Connection, run_id: str, row: Any, *,
    legacy_by_source: dict | None = None, stock_by_source: dict | None = None,
    inn_by_source: dict | None = None, clinical_by_source: dict | None = None
) -> dict[str, Any]:
    item = dict(row)
    legacy_by_source = legacy_by_source or {}
    stock_by_source = stock_by_source or {}
    inn_by_source = inn_by_source or {}
    legacy = legacy_by_source.get(item["source_id"])
    item.pop("canonical_ingredients", None)
    item["canonical_ingredients"] = inn_by_source.get(item["source_id"], [])
    item["active_ingredient"] = item.get("active_ingredient_raw")
    item["concentration"] = item.get("strength_raw")
    item["packaging_spec"] = item.get("package_spec")
    item["applicant_name"] = item.get("applicant")
    item["country"] = item.get("manufacturer_country")
    item["group"] = "Thuốc điều trị chuyên khoa"
    item["route"] = None
    item["is_controlled"] = False
    item["is_high_alert"] = False
    item["is_crash_cart"] = False
    item["note"] = None
    item["hdsd_path"] = None
    item["label_path"] = None
    item["atc_code"] = None
    item["drug_class"] = None
    item["indications"] = None
    item["contraindications"] = None
    item["precautions"] = None
    item["pregnancy_warning"] = None
    item["adult_dosage"] = None
    item["pediatric_dosage"] = None
    item["renal_adjustment"] = None
    item["hepatic_adjustment"] = None
    item["adverse_effects"] = None
    item["drug_interactions"] = None
    item["overdose_treatment"] = None
    item["antidote"] = None
    item["clinical_source"] = None

    clinical_rows = clinical_by_source.get(item["source_id"], []) if clinical_by_source is not None else (
        conn.execute(
            "SELECT drug_class,indications,contraindications,precautions,pregnancy_warning,adverse_effects,adult_dosage,pediatric_dosage,renal_adjustment,hepatic_adjustment,drug_interactions,overdose_treatment,antidote,source,monograph_id FROM dav_catalog_clinical_content WHERE run_id=? AND source_id=? ORDER BY monograph_id",
            (run_id, item["source_id"])
        ).fetchall() if has_table(conn, "dav_catalog_clinical_content") else []
    )
    if clinical_rows:
        clinical = dict(clinical_rows[0])
        item.update({key: value for key, value in clinical.items() if key != "monograph_id"})
        item["clinical_monograph_id"] = clinical["monograph_id"]
        item["clinical_source"] = clinical["source"]
    elif legacy and legacy.get("clinical_monograph_id"):
        item["clinical_monograph_id"] = legacy["clinical_monograph_id"]
        item["drug_interactions"] = legacy.get("drug_interactions")
        item["clinical_source"] = legacy.get("clinical_source")

    item["normalization_flags"] = json.loads(item.get("normalization_flags") or "[]")
    item["legacy"] = legacy
    if legacy:
        item.update(legacy)
    item["hospital_stock_by_unit"] = stock_by_source.get(item["source_id"], [])
    return item

def list_unfiltered_page(reader, *, page: int, page_size: int, active_only: bool, source_mode: str) -> dict[str, Any]:
    with reader._connect() as conn:
        where = "run_id=?" + (" AND is_active=1 AND is_expired=0" if active_only else "")
        total = conn.execute(f"SELECT COUNT(*) FROM dav_catalog_products WHERE {where}", (reader.run_id,)).fetchone()[0]
        order_rows = conn.execute(
            f"SELECT national_code,brand_name,source_id,'canonical' source_type FROM dav_catalog_products WHERE {where} ORDER BY CASE WHEN national_code='893100110026' THEN 0 ELSE 1 END,brand_name COLLATE NOCASE,national_code LIMIT ? OFFSET ?",
            (reader.run_id, page_size, (page - 1) * page_size)
        ).fetchall()
        legacy_rows = []
        if source_mode == "legacy_compatible" and has_table(conn, "dav_national_drugs"):
            legacy_rows = conn.execute(
                "SELECT id,national_code,brand_name FROM dav_national_drugs d WHERE NOT EXISTS (SELECT 1 FROM dav_catalog_legacy_links l WHERE l.run_id=? AND l.legacy_drug_id=d.id) ORDER BY brand_name,national_code LIMIT ? OFFSET ?",
                (reader.run_id, page_size, max(0, (page - 1) * page_size - total))
            ).fetchall()
            total += conn.execute(
                "SELECT COUNT(*) FROM dav_national_drugs d WHERE NOT EXISTS (SELECT 1 FROM dav_catalog_legacy_links l WHERE l.run_id=? AND l.legacy_drug_id=d.id)",
                (reader.run_id,)
            ).fetchone()[0]
        selected = list(order_rows)
        if legacy_rows and len(selected) < page_size:
            canonical_count = total - len(legacy_rows)
            legacy_offset = max(0, (page - 1) * page_size - canonical_count)
            selected.extend((row[1], row[2], row[0], "legacy") for row in legacy_rows[legacy_offset:legacy_offset + page_size - len(selected)])
        codes = [row for row in selected if row[3] == "canonical"]
        items = []
        source_ids = [row[2] for row in codes]
        legacy_by_source = {}
        stock_by_source = {}
        inn_by_source = {}
        clinical_by_source = {}
        if source_ids:
            marks = ",".join("?" for _ in source_ids)
            for r in conn.execute(f"SELECT l.source_id,d.* FROM dav_catalog_legacy_links l JOIN dav_national_drugs d ON d.id=l.legacy_drug_id WHERE l.run_id=? AND l.source_id IN ({marks}) ORDER BY d.id", [reader.run_id, *source_ids]):
                legacy_by_source.setdefault(r["source_id"], dict(r))
            for r in conn.execute(f"SELECT l.source_id,i.unit,SUM(i.current_stock) quantity,COUNT(*) batch_count FROM dav_catalog_inventory_links l JOIN inventory_batches i ON i.id=l.inventory_batch_id WHERE l.run_id=? AND l.source_id IN ({marks}) AND i.current_stock>0 GROUP BY l.source_id,i.unit", [reader.run_id, *source_ids]):
                stock_by_source.setdefault(r["source_id"], []).append({"unit": r["unit"] or "Không rõ đơn vị", "quantity": int(r["quantity"]), "batch_count": int(r["batch_count"])})
            for r in conn.execute(f"SELECT source_id,canonical_inn FROM dav_ingredient_mappings WHERE run_id=? AND source_id IN ({marks}) AND canonical_inn IS NOT NULL ORDER BY canonical_inn", [reader.run_id, *source_ids]):
                inn_by_source.setdefault(r["source_id"], []).append(r["canonical_inn"])
            for r in conn.execute(f"SELECT * FROM dav_catalog_clinical_content WHERE run_id=? AND source_id IN ({marks}) ORDER BY monograph_id", [reader.run_id, *source_ids]):
                clinical_by_source.setdefault(r["source_id"], []).append(r)
        for row in codes:
            product = conn.execute("SELECT * FROM dav_catalog_products WHERE run_id=? AND national_code=?", (reader.run_id, row[0])).fetchone()
            if product:
                sid = product["source_id"]
                item = dict(product)
                item.update({
                    "active_ingredient": item.get("active_ingredient_raw"), "concentration": item.get("strength_raw"),
                    "packaging_spec": item.get("package_spec"), "applicant_name": item.get("applicant"),
                    "country": item.get("manufacturer_country"), "group": "Thuốc điều trị chuyên khoa",
                    "canonical_ingredients": inn_by_source.get(sid, []),
                    "normalization_flags": json.loads(item.get("normalization_flags") or "[]"),
                    "legacy": legacy_by_source.get(sid), "hospital_stock_by_unit": stock_by_source.get(sid, [])
                })
                linked = legacy_by_source.get(sid)
                if linked:
                    item["legacy"] = linked
                    item.update(linked)
                clinical_rows = clinical_by_source.get(sid, [])
                if clinical_rows:
                    clinical = dict(clinical_rows[0])
                    item.update({key: value for key, value in clinical.items() if key not in {"run_id", "source_id", "monograph_id"}})
                    item["clinical_monograph_id"] = clinical["monograph_id"]
                items.append(item)
        for row in selected:
            if row[3] == "legacy":
                legacy = conn.execute("SELECT * FROM dav_national_drugs WHERE id=?", (row[2],)).fetchone()
                item = dict(legacy)
                item["source_id"] = "legacy:" + str(legacy["id"])
                item["legacy"] = dict(legacy)
                item["canonical_ingredients"] = []
                item["normalization_flags"] = []
                item["hospital_stock_by_unit"] = stock_for_registration(conn, legacy["national_code"])
                items.append(item)
        group_stats = {row[0] or "": row[1] for row in conn.execute('SELECT [group],COUNT(*) FROM dav_national_drugs GROUP BY [group]')} if has_table(conn, "dav_national_drugs") else {}
        stock_count = conn.execute('SELECT COUNT(DISTINCT registration_code_key) FROM dav_catalog_inventory_links WHERE run_id=?', (reader.run_id,)).fetchone()[0] if has_table(conn, "dav_catalog_inventory_links") else 0
    return {
        "total": total, "page": page, "page_size": page_size,
        "total_pages": max(1, (total + page_size - 1) // page_size), "items": items,
        "group_stats": group_stats, "registry_revision": "", "inventory_revision": "",
        "hospital_stock_drug_count": stock_count
    }
