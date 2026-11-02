from __future__ import annotations

import os
import sqlite3
from pathlib import Path
from typing import Any
from app.services.dav_catalog_schema import SCHEMA, PRODUCT_COLUMNS

def _table_columns(conn: sqlite3.Connection, table: str) -> set[str]:
    return {row[1] for row in conn.execute(f"PRAGMA table_info({table})")}

def _copy_database(source: Path, output: Path) -> None:
    if output.exists():
        raise FileExistsError(f"Refusing to overwrite migration output: {output}")
    output.parent.mkdir(parents=True, exist_ok=True)
    temp = output.with_name(output.name + ".building")
    if temp.exists():
        temp.unlink()
    src = sqlite3.connect(f"file:{source.resolve()}?mode=ro", uri=True)
    dst = sqlite3.connect(temp)
    try:
        src.backup(dst)
        dst.commit()
    finally:
        dst.close()
        src.close()
    os.replace(temp, output)

def migrate_staging_catalog(*, source_db: Path, app_db: Path, output_db: Path, run_id: str) -> dict[str, Any]:
    """Create an additive DB copy and import one canonical staging run."""
    source_db, app_db, output_db = Path(source_db), Path(app_db), Path(output_db)
    if not run_id.strip():
        raise ValueError("run_id must not be empty")
    if not source_db.is_file() or not app_db.is_file():
        raise FileNotFoundError("Both source_db and app_db must exist")
    _copy_database(app_db, output_db)
    source = sqlite3.connect(f"file:{source_db.resolve()}?mode=ro", uri=True)
    target = sqlite3.connect(output_db)
    source.row_factory = sqlite3.Row
    target.row_factory = sqlite3.Row
    try:
        target.execute("PRAGMA foreign_keys=ON")
        target.executescript(SCHEMA)
        if target.execute("SELECT 1 FROM dav_catalog_runs WHERE run_id=?", (run_id,)).fetchone():
            raise ValueError(f"run_id already exists: {run_id}")
        source_tables = {row[0] for row in source.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        needed = {"source_records","source_record_resolution","duplicate_registration_groups","normalized_products","product_ingredients","product_ingredient_mappings","ingredients","source_manifest"}
        missing = needed - source_tables
        if missing:
            raise ValueError(f"Staging DB missing tables: {sorted(missing)}")
        manifest = source.execute("SELECT source_key,sha256,record_count FROM source_manifest WHERE source_key='dav'").fetchone()
        if not manifest:
            raise ValueError("Staging DB has no DAV source manifest")
        product_cols = _table_columns(source, "normalized_products")
        if not set(PRODUCT_COLUMNS).issubset(product_cols):
            raise ValueError("Unexpected normalized product schema")
        products = source.execute("SELECT " + ",".join(PRODUCT_COLUMNS) + " FROM normalized_products ORDER BY national_code").fetchall()
        raw = source.execute("SELECT source_key,source_record_id,ordinal,raw_json FROM source_records ORDER BY ordinal").fetchall()
        resolutions = source.execute("SELECT source_record_id,national_code_key,resolution_status,selected_source_record_id,resolution_reason FROM source_record_resolution").fetchall()
        duplicates = source.execute("SELECT national_code_key,candidate_count,selected_source_record_id,resolution_status,resolution_reason FROM duplicate_registration_groups").fetchall()
        source_hash = str(manifest["sha256"])
        target.execute("BEGIN IMMEDIATE")
        target.execute("INSERT INTO dav_catalog_runs(run_id,source_sha256,source_record_count,canonical_product_count,status) VALUES(?,?,?,?,?)", (run_id,source_hash,len(raw),len(products),"loading"))
        target.executemany("INSERT INTO dav_source_records VALUES(?,?,?,?,?)", [(run_id,*tuple(row)) for row in raw])
        target.executemany("INSERT INTO dav_record_resolution VALUES(?,?,?,?,?,?)", [(run_id,*tuple(row)) for row in resolutions])
        target.executemany("INSERT INTO dav_duplicate_groups VALUES(?,?,?,?,?,?)", [(run_id,*tuple(row)) for row in duplicates])
        target.executemany("INSERT INTO dav_catalog_products VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", [(run_id,*tuple(row)) for row in products])
        legacy_columns = _table_columns(target, "dav_national_drugs")
        link_rows = []
        legacy_by_code: dict[str, list[sqlite3.Row]] = {}
        if {"id", "national_code", "clinical_monograph_id"}.issubset(legacy_columns):
            legacy_rows = target.execute("SELECT id,national_code,clinical_monograph_id FROM dav_national_drugs").fetchall()
            for legacy_row in legacy_rows:
                code_key = str(legacy_row["national_code"] or "").strip().casefold()
                if code_key:
                    legacy_by_code.setdefault(code_key, []).append(legacy_row)
            for product in products:
                for legacy_row in legacy_by_code.get(str(product[1] or "").strip().casefold(), []):
                    link_rows.append((run_id, product[0], legacy_row["id"], str(product[1]).strip().casefold(), legacy_row["clinical_monograph_id"]))
            target.executemany("INSERT INTO dav_catalog_legacy_links VALUES(?,?,?,?,?)", link_rows)
        clinical_link_rows = []
        clinical_columns = _table_columns(target, "clinical_drug_monographs") if target.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='clinical_drug_monographs'").fetchone() else set()
        if clinical_columns:
            mono_by_inn = {str(row[0] or "").strip().casefold(): row[0] for row in target.execute("SELECT DISTINCT inn FROM clinical_drug_monographs WHERE inn IS NOT NULL")}
            for product in products:
                codes = [str(product[1] or "").strip().casefold()]
                matched_legacy = legacy_by_code.get(codes[0], [])
                mono_ids = {row["clinical_monograph_id"] for row in matched_legacy if row["clinical_monograph_id"]}
                clinical_link_rows.extend((run_id, product[0], mono_id) for mono_id in mono_ids)
            target.executemany("INSERT INTO dav_catalog_clinical_links VALUES(?,?,?)", clinical_link_rows)
            clinical_match_rows = []
            for product in products:
                for legacy_row in legacy_by_code.get(str(product[1] or "").strip().casefold(), []):
                    if legacy_row["clinical_monograph_id"]:
                        clinical_match_rows.append((run_id, product[0], legacy_row["clinical_monograph_id"], "legacy_exact_code", "national_code"))
                ingredient_name = str(product[3] or "").strip().casefold()
                if ingredient_name in mono_by_inn:
                    clinical_match_rows.append((run_id, product[0], mono_by_inn[ingredient_name], "exact_inn", "active_ingredient_exact"))
            target.executemany("INSERT INTO dav_catalog_clinical_matches VALUES(?,?,?,?,?)", clinical_match_rows)
            if clinical_columns and {"id","drug_class","indications","contraindications","precautions","pregnancy_warning","adverse_effects","adult_dosage","pediatric_dosage","renal_adjustment","hepatic_adjustment","drug_interactions","overdose_treatment","antidote","source"}.issubset(clinical_columns):
                ids = sorted({row[2] for row in clinical_match_rows})
                if ids:
                    marks = ','.join('?' for _ in ids)
                    clinical_rows = target.execute(f"SELECT id,drug_class,indications,contraindications,precautions,pregnancy_warning,adverse_effects,adult_dosage,pediatric_dosage,renal_adjustment,hepatic_adjustment,drug_interactions,overdose_treatment,antidote,source FROM clinical_drug_monographs WHERE id IN ({marks})", ids).fetchall()
                    clinical_by_id = {row[0]: tuple(row[1:]) for row in clinical_rows}
                    content_rows = [(run_id, source_id, mono_id, *clinical_by_id[mono_id]) for _, source_id, mono_id, _, _ in clinical_match_rows if mono_id in clinical_by_id]
                    target.executemany("INSERT INTO dav_catalog_clinical_content VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", content_rows)
        inventory_columns = _table_columns(target, "inventory_batches") if target.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='inventory_batches'").fetchone() else set()
        inventory_link_rows = []
        if {"id", "registration_number"}.issubset(inventory_columns):
            inventory_rows = target.execute("SELECT id,registration_number FROM inventory_batches WHERE registration_number IS NOT NULL").fetchall()
            product_by_code = {str(row[1] or "").strip().casefold(): str(row[0]) for row in products if row[1]}
            for inventory_id, registration_number in inventory_rows:
                product_source_id = product_by_code.get(str(registration_number or "").strip().casefold())
                if product_source_id:
                    inventory_link_rows.append((run_id, product_source_id, inventory_id, str(registration_number).strip().casefold()))
            target.executemany("INSERT INTO dav_catalog_inventory_links VALUES(?,?,?,?)", inventory_link_rows)
        ingredients = source.execute("SELECT source_id,ingredient_ordinal,name_raw,strength_raw,parse_status,review_reason FROM product_ingredients").fetchall()
        target.executemany("INSERT INTO dav_product_ingredients VALUES(?,?,?,?,?,?,?)", [(run_id,*tuple(row)) for row in ingredients])
        canonical_ingredients = source.execute("SELECT canonical_inn,atc_code_raw,source_title FROM ingredients").fetchall()
        target.executemany("INSERT INTO dav_ingredients VALUES(?,?,?,?)", [(run_id,*tuple(row)) for row in canonical_ingredients])
        mappings = source.execute("SELECT source_id,ingredient_ordinal,raw_name,canonical_inn,atc_code_raw,mapping_status,match_type FROM product_ingredient_mappings").fetchall()
        target.executemany("INSERT INTO dav_ingredient_mappings VALUES(?,?,?,?,?,?,?,?)", [(run_id,*tuple(row)) for row in mappings])
        mapped_inns = {row[0]: row[1] or "" for row in source.execute("SELECT source_id,GROUP_CONCAT(DISTINCT canonical_inn) FROM product_ingredient_mappings WHERE canonical_inn IS NOT NULL GROUP BY source_id")}
        target.executemany("INSERT INTO dav_product_search VALUES(?,?,?,?,?)", [(run_id,row[0],row[1] or "",row[2] or ""," ".join(filter(None,(row[3] or "",mapped_inns.get(row[0],""))))) for row in products])
        legacy_search_rows = target.execute("SELECT d.national_code,d.brand_name,d.active_ingredient,d.note,l.source_id FROM dav_catalog_legacy_links l JOIN dav_national_drugs d ON d.id=l.legacy_drug_id WHERE l.run_id=?", (run_id,)).fetchall() if target.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='dav_national_drugs'").fetchone() else []
        legacy_by_source = {row[4]: row for row in legacy_search_rows}
        target.executemany("INSERT INTO dav_product_search_trigram VALUES(?,?,?,?,?,?)", [(run_id,row[0],row[1] or "",row[2] or " "," ".join(filter(None,(row[3] or "",mapped_inns.get(row[0],"")))),(legacy_by_source[row[0]][3] if row[0] in legacy_by_source else "") or "") for row in products])
        target.executemany("INSERT INTO dav_product_search(run_id,source_id,active_ingredients) VALUES(?,?,?)", [(run_id,row[0],row[1]) for row in source.execute("SELECT m.source_id,GROUP_CONCAT(DISTINCT m.canonical_inn) FROM product_ingredient_mappings m JOIN normalized_products p ON p.source_id=m.source_id WHERE m.canonical_inn IS NOT NULL GROUP BY m.source_id")])
        integrity = target.execute("PRAGMA integrity_check").fetchone()[0]
        fk_errors = target.execute("PRAGMA foreign_key_check").fetchall()
        imported = target.execute("SELECT COUNT(*) FROM dav_catalog_products WHERE run_id=?",(run_id,)).fetchone()[0]
        mapped_count = target.execute("SELECT COUNT(*) FROM dav_ingredient_mappings WHERE run_id=? AND canonical_inn IS NOT NULL",(run_id,)).fetchone()[0]
        distinct_codes = target.execute("SELECT COUNT(DISTINCT national_code) FROM dav_catalog_products WHERE run_id=?",(run_id,)).fetchone()[0]
        if integrity != "ok" or fk_errors or imported != len(products) or distinct_codes != imported:
            raise RuntimeError(f"Migration validation failed: integrity={integrity}, fk_errors={len(fk_errors)}, products={imported}/{len(products)}, distinct_codes={distinct_codes}")
        target.execute("UPDATE dav_catalog_runs SET status='ready' WHERE run_id=?",(run_id,))
        target.commit()
        clinical_content_count = target.execute("SELECT COUNT(*) FROM dav_catalog_clinical_content WHERE run_id=?",(run_id,)).fetchone()[0]
        interaction_content_count = target.execute("SELECT COUNT(*) FROM dav_catalog_clinical_content WHERE run_id=? AND drug_interactions IS NOT NULL AND length(trim(drug_interactions))>0",(run_id,)).fetchone()[0]
        missing_exact_clinical_links = 0
        if target.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='dav_national_drugs'").fetchone():
            live_clinical = target.execute("SELECT id,national_code,clinical_monograph_id FROM dav_national_drugs WHERE clinical_monograph_id IS NOT NULL").fetchall()
            canonical_codes = {str(row[0] or '').strip().casefold() for row in target.execute("SELECT national_code FROM dav_catalog_products WHERE run_id=?",(run_id,))}
            for legacy_row in live_clinical:
                code_key = str(legacy_row[1] or '').strip().casefold()
                if code_key in canonical_codes and not target.execute("SELECT 1 FROM dav_catalog_legacy_links WHERE run_id=? AND legacy_drug_id=?",(run_id,legacy_row[0])).fetchone():
                    missing_exact_clinical_links += 1
        return {"run_id":run_id,"source_sha256":source_hash,"source_records":len(raw),"imported_products":imported,"canonical_products":imported,"distinct_registration_codes":distinct_codes,"legacy_links":len(link_rows),"clinical_links":len(clinical_link_rows),"missing_exact_clinical_links":missing_exact_clinical_links,"clinical_content_rows":clinical_content_count,"clinical_interaction_rows":interaction_content_count,"inventory_links":len(inventory_link_rows),"product_ingredient_rows":len(ingredients),"ingredient_mapping_rows":len(mappings),"mapped_ingredient_rows":mapped_count,"unmapped_ingredient_rows":len(mappings)-mapped_count,"duplicate_groups":len(duplicates),"integrity_check":integrity,"foreign_key_errors":len(fk_errors),"status":"ready","output_db":str(output_db.resolve())}
    except Exception:
        target.rollback()
        target.close()
        source.close()
        output_db.unlink(missing_ok=True)
        raise
    finally:
        try:
            target.close()
        except Exception:
            pass
        source.close()
