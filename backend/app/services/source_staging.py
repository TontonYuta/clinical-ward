from __future__ import annotations

import hashlib
import json
import os
import re
import sqlite3
import subprocess
from collections import Counter
from pathlib import Path
from typing import Any
from app.services.dav_normalizer import normalize_dav_record
from app.services.ingredient_parser import parse_active_ingredients
from app.services.ingredient_mapping import build_ingredient_dictionary, map_ingredient_name, load_reviewed_aliases, validate_reviewed_aliases


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _extract_pdf_pages(pdf_path: Path) -> list[str]:
    result = subprocess.run(["pdftotext", "-layout", str(pdf_path), "-"], check=True, capture_output=True, text=True)
    return result.stdout.split("")


def _read_dav_records(dav_json: Path) -> list[dict[str, Any]]:
    with dav_json.open(encoding="utf-8") as stream:
        payload = json.load(stream)
    if not isinstance(payload, list):
        raise ValueError("DAV snapshot must be a JSON list")
    return payload


def _read_raw_dav_pages(snapshot_dir: Path) -> tuple[list[dict[str, Any]], str]:
    manifest = json.loads((snapshot_dir / "manifest.json").read_text(encoding="utf-8"))
    records = []
    for page in manifest.get("pages", []):
        payload = json.loads((snapshot_dir / page["path"]).read_text(encoding="utf-8"))
        records.extend((payload.get("result") or {}).get("items") or [])
    if len(records) != int(manifest.get("records", -1)):
        raise ValueError("DAV raw snapshot record count does not match its manifest")
    return records, str(manifest.get("source", ""))


def _raw_snapshot_digest(snapshot_dir: Path) -> tuple[str, int]:
    manifest = json.loads((snapshot_dir / "manifest.json").read_text(encoding="utf-8"))
    digest = hashlib.sha256()
    byte_count = 0
    for page in manifest.get("pages", []):
        page_path = snapshot_dir / page["path"]
        digest.update(bytes.fromhex(_sha256(page_path)))
        byte_count += page_path.stat().st_size
    return digest.hexdigest(), byte_count


def _build_source_staging_file(*, dav_json: Path | None = None, dav_snapshot_dir: Path | None = None, pdf_path: Path, staging_db: Path, dav_url: str, pdf_url: str) -> dict[str, Any]:
    """Build a replaceable staging snapshot; original source files remain untouched."""
    if (dav_json is None) == (dav_snapshot_dir is None):
        raise ValueError("Provide exactly one of dav_json or dav_snapshot_dir")
    records, raw_dav_url = _read_raw_dav_pages(dav_snapshot_dir) if dav_snapshot_dir else (_read_dav_records(dav_json), dav_url)
    monographs_path = Path(__file__).resolve().parents[2] / "data/knowledge_base/dtqg_monographs_extracted.json"
    with monographs_path.open(encoding="utf-8") as stream:
        monographs = json.load(stream)
    ingredient_dictionary = build_ingredient_dictionary(monographs)
    reviewed_alias_path = Path(__file__).resolve().parents[2] / "data/knowledge_base/ingredient_aliases_reviewed.json"
    reviewed_aliases = load_reviewed_aliases(reviewed_alias_path)
    reviewed_alias_rows = json.loads(reviewed_alias_path.read_text(encoding="utf-8")) if reviewed_alias_path.exists() else []
    alias_errors = validate_reviewed_aliases(reviewed_alias_rows, ingredient_dictionary)
    if alias_errors:
        raise ValueError("Invalid reviewed aliases: " + "; ".join(alias_errors[:10]))
    pages = _extract_pdf_pages(pdf_path)
    staging_db.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(staging_db)
    try:
        conn.execute("PRAGMA journal_mode=DELETE")
        conn.executescript("""
        DROP TABLE IF EXISTS source_records;
        DROP TABLE IF EXISTS pdf_pages;
        DROP TABLE IF EXISTS ingredient_parse_audit;
        DROP TABLE IF EXISTS product_ingredient_mappings;
        DROP TABLE IF EXISTS ingredient_aliases;
        DROP TABLE IF EXISTS reviewed_aliases;
        DROP TABLE IF EXISTS ingredients;
        DROP TABLE IF EXISTS ingredient_source_gaps;
        DROP TABLE IF EXISTS product_ingredients;
        DROP TABLE IF EXISTS normalized_products;
        DROP TABLE IF EXISTS source_manifest;
        DROP TABLE IF EXISTS dictionary_manifest;
        CREATE TABLE source_manifest (
            source_key TEXT PRIMARY KEY, source_url TEXT NOT NULL,
            source_path TEXT NOT NULL, sha256 TEXT NOT NULL,
            byte_count INTEGER NOT NULL, record_count INTEGER,
            captured_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE dictionary_manifest (
            dictionary_key TEXT PRIMARY KEY, source_path TEXT NOT NULL,
            sha256 TEXT NOT NULL, entry_count INTEGER NOT NULL
        );
        CREATE TABLE source_records (
            source_key TEXT NOT NULL REFERENCES source_manifest(source_key),
            source_record_id TEXT NOT NULL, ordinal INTEGER NOT NULL,
            raw_json TEXT NOT NULL, PRIMARY KEY (source_key, source_record_id),
            UNIQUE (source_key, ordinal)
        );
        CREATE TABLE source_record_resolution (
            source_key TEXT NOT NULL, source_record_id TEXT NOT NULL,
            national_code_key TEXT, resolution_status TEXT NOT NULL,
            selected_source_record_id TEXT, resolution_reason TEXT,
            PRIMARY KEY (source_key, source_record_id),
            FOREIGN KEY (source_key, source_record_id) REFERENCES source_records(source_key, source_record_id)
        );
        CREATE INDEX ix_source_record_resolution_code ON source_record_resolution(national_code_key,resolution_status);
        CREATE TABLE duplicate_registration_groups (
            national_code_key TEXT PRIMARY KEY, candidate_count INTEGER NOT NULL,
            selected_source_record_id TEXT, resolution_status TEXT NOT NULL, resolution_reason TEXT
        );
        CREATE TABLE pdf_pages (
            source_key TEXT NOT NULL REFERENCES source_manifest(source_key),
            physical_page INTEGER NOT NULL, raw_text TEXT NOT NULL,
            PRIMARY KEY (source_key, physical_page)
        );
        CREATE TABLE normalized_products (
            source_id TEXT, national_code TEXT, brand_name TEXT, active_ingredient_raw TEXT,
            strength_raw TEXT, dosage_form TEXT, package_spec TEXT, standard_pharmacopeia TEXT,
            shelf_life TEXT, manufacturer TEXT, manufacturer_country TEXT, applicant TEXT,
            applicant_country TEXT, approval_date TEXT, expiry_date TEXT, approval_decision TEXT,
            is_active INTEGER, is_expired INTEGER, normalization_flags TEXT NOT NULL,
            PRIMARY KEY (source_id)
        );
        CREATE INDEX ix_normalized_products_code ON normalized_products(national_code);
        CREATE INDEX ix_normalized_products_brand ON normalized_products(brand_name);
        CREATE INDEX ix_normalized_products_active ON normalized_products(active_ingredient_raw);
        CREATE INDEX ix_normalized_products_expiry_active ON normalized_products(is_active,is_expired);
        CREATE VIRTUAL TABLE product_search USING fts5(
            source_id UNINDEXED, national_code, brand_name, active_ingredients,
            tokenize='unicode61 remove_diacritics 2'
        );
        CREATE TABLE product_ingredients (
            source_id TEXT NOT NULL REFERENCES normalized_products(source_id),
            ingredient_ordinal INTEGER NOT NULL, name_raw TEXT NOT NULL,
            strength_raw TEXT, parse_status TEXT NOT NULL, review_reason TEXT,
            PRIMARY KEY (source_id, ingredient_ordinal)
        );
        CREATE INDEX ix_product_ingredients_name_raw ON product_ingredients(name_raw);
        CREATE TABLE ingredient_parse_audit (
            source_id TEXT PRIMARY KEY REFERENCES normalized_products(source_id),
            raw_text TEXT NOT NULL, parse_status TEXT NOT NULL, review_reason TEXT
        );
        CREATE TABLE ingredients (
            canonical_inn TEXT PRIMARY KEY, atc_code_raw TEXT, source_title TEXT
        );
        CREATE TABLE ingredient_aliases (
            alias_key TEXT PRIMARY KEY, alias_raw TEXT NOT NULL,
            canonical_inn TEXT NOT NULL REFERENCES ingredients(canonical_inn),
            match_type TEXT NOT NULL
        );
        CREATE TABLE reviewed_aliases (
            alias TEXT PRIMARY KEY, canonical_inn TEXT NOT NULL,
            source TEXT NOT NULL, reviewer TEXT NOT NULL, reviewed_at TEXT NOT NULL
        );
        CREATE TABLE product_ingredient_mappings (
            source_id TEXT NOT NULL, ingredient_ordinal INTEGER NOT NULL,
            raw_name TEXT NOT NULL, canonical_inn TEXT, atc_code_raw TEXT,
            mapping_status TEXT NOT NULL, match_type TEXT,
            PRIMARY KEY (source_id, ingredient_ordinal)
        );
        CREATE INDEX ix_product_ingredient_mappings_inn ON product_ingredient_mappings(canonical_inn);
        CREATE INDEX ix_product_ingredient_mappings_status ON product_ingredient_mappings(mapping_status);
        CREATE INDEX ix_product_ingredient_mappings_review ON product_ingredient_mappings(mapping_status,raw_name,source_id);
        CREATE INDEX ix_product_ingredient_mappings_product ON product_ingredient_mappings(source_id,ingredient_ordinal);
        CREATE TABLE ingredient_source_gaps (
            raw_name TEXT PRIMARY KEY, occurrence_count INTEGER NOT NULL,
            product_count INTEGER NOT NULL, gap_type TEXT NOT NULL, action TEXT NOT NULL
        );
        CREATE INDEX ix_ingredient_source_gaps_type ON ingredient_source_gaps(gap_type);
        CREATE INDEX ix_ingredient_source_gaps_frequency ON ingredient_source_gaps(product_count DESC,raw_name);
        """)
        if dav_snapshot_dir:
            dav_digest, dav_bytes = _raw_snapshot_digest(dav_snapshot_dir)
            dav_source = ("dav", raw_dav_url or dav_url, str(dav_snapshot_dir.resolve()), dav_digest, dav_bytes, len(records))
        else:
            dav_source = ("dav", dav_url, str(dav_json.resolve()), _sha256(dav_json), dav_json.stat().st_size, len(records))
        sources = [dav_source, ("dtqg_pdf", pdf_url, str(pdf_path.resolve()), _sha256(pdf_path), pdf_path.stat().st_size, len(pages))]
        conn.executemany(
            "INSERT INTO source_manifest (source_key,source_url,source_path,sha256,byte_count,record_count) VALUES (?,?,?,?,?,?)",
            sources,
        )
        canonical_count = len({str(row.get("inn") or "").strip() for row in monographs if str(row.get("inn") or "").strip()})
        conn.execute("INSERT INTO dictionary_manifest VALUES (?,?,?,?)", ("dtqg_inn", str(monographs_path.resolve()), _sha256(monographs_path), canonical_count))
        conn.execute("INSERT INTO dictionary_manifest VALUES (?,?,?,?)", ("reviewed_aliases", str(reviewed_alias_path.resolve()), _sha256(reviewed_alias_path) if reviewed_alias_path.exists() else hashlib.sha256(b'[]').hexdigest(), len(reviewed_aliases)))
        conn.executemany(
            "INSERT INTO source_records (source_key,source_record_id,ordinal,raw_json) VALUES ('dav',?,?,?)",
            [(str(row.get("id") or row.get("nationalCode") or index), index, json.dumps(row, ensure_ascii=False, sort_keys=True)) for index, row in enumerate(records, 1)],
        )
        # Preserve every source row, but make the canonical searchable catalog
        # select only an explicit winner for duplicate registration codes.
        by_code: dict[str, list[dict[str, Any]]] = {}
        for index, raw in enumerate(records, 1):
            code = str(raw.get("soDangKy") or raw.get("nationalCode") or "").strip().casefold()
            if code:
                by_code.setdefault(code, []).append(raw)
        resolution_file = Path(__file__).resolve().parents[3] / "artifacts/dav-duplicate-resolution.csv"
        decisions = {}
        if resolution_file.exists():
            import csv
            with resolution_file.open(encoding="utf-8-sig", newline="") as stream:
                decisions = {str(row.get("registration_code") or "").strip().casefold(): row for row in csv.DictReader(stream)}
        resolution_rows = []
        duplicate_rows = []
        for code, candidates in by_code.items():
            if len(candidates) == 1:
                raw = candidates[0]
                source_record_id = str(raw.get("id") or raw.get("nationalCode") or "")
                resolution_rows.append(("dav", source_record_id, code, "unique", source_record_id, "unique_registration_code"))
                continue
            decision = decisions.get(code)
            selected_id = str(decision.get("proposed_source_id") or "") if decision and decision.get("proposed_status") == "proposed_winner" else ""
            status = "resolved" if selected_id and any(str(row.get("id")) == selected_id for row in candidates) else "unresolved"
            reason = str(decision.get("reason") or "no_approved_winner") if decision else "no_resolution_record"
            duplicate_rows.append((code, len(candidates), selected_id or None, status, reason))
            for raw in candidates:
                source_record_id = str(raw.get("id") or raw.get("nationalCode") or "")
                resolution_rows.append(("dav", source_record_id, code, "selected" if status == "resolved" and str(raw.get("id")) == selected_id else ("superseded" if status == "resolved" else "unresolved"), selected_id or None, reason))
        conn.executemany("INSERT INTO source_record_resolution VALUES (?,?,?,?,?,?)", resolution_rows)
        conn.executemany("INSERT INTO duplicate_registration_groups VALUES (?,?,?,?,?)", duplicate_rows)
        selected_ids = {row[4] for row in resolution_rows if row[3] in {"unique", "selected"} and row[4]}
        # Unresolved duplicates remain fully auditable in source_records, but
        # are excluded from the canonical product catalog until reviewed.
        catalog_records = [row for row in records if str(row.get("id") or row.get("nationalCode") or "") in selected_ids]
        normalized_rows = [normalize_dav_record(row) for row in catalog_records]
        normalized_columns = ("source_id", "national_code", "brand_name", "active_ingredient_raw", "strength_raw", "dosage_form", "package_spec", "standard_pharmacopeia", "shelf_life", "manufacturer", "manufacturer_country", "applicant", "applicant_country", "approval_date", "expiry_date", "approval_decision", "is_active", "is_expired", "normalization_flags")
        placeholders = ",".join("?" for _ in normalized_columns)
        conn.executemany(
            f"INSERT INTO normalized_products ({','.join(normalized_columns)}) VALUES ({placeholders})",
            [tuple(json.dumps(row[column], ensure_ascii=False) if column == "normalization_flags" else row[column] for column in normalized_columns) for row in normalized_rows],
        )
        conn.executemany(
            "INSERT INTO product_search (source_id,national_code,brand_name,active_ingredients) VALUES (?,?,?,?)",
            [(row["source_id"], row["national_code"] or "", row["brand_name"] or "", row["active_ingredient_raw"] or "") for row in normalized_rows],
        )
        parsed_count = 0
        review_count = 0
        ingredient_rows = []
        parse_audit_rows = []
        for product in normalized_rows:
            parsed = parse_active_ingredients(product["active_ingredient_raw"], product["strength_raw"])
            if parsed["status"] == "parsed":
                parsed_count += 1
            else:
                review_count += 1
            parse_audit_rows.append((product["source_id"], parsed["raw"], parsed["status"], parsed["reason"]))
            for ordinal, ingredient in enumerate(parsed["ingredients"], 1):
                ingredient_rows.append((product["source_id"], ordinal, ingredient["name_raw"], ingredient["strength_raw"], parsed["status"], parsed["reason"]))
        conn.executemany("INSERT INTO product_ingredients VALUES (?,?,?,?,?,?)", ingredient_rows)
        conn.executemany("INSERT INTO ingredient_parse_audit VALUES (?,?,?,?)", parse_audit_rows)
        ingredient_rows_by_inn = {}
        alias_rows = {}
        for monograph in monographs:
            canonical_inn = str(monograph.get("inn") or "").strip()
            if not canonical_inn:
                continue
            ingredient_rows_by_inn.setdefault(canonical_inn, (canonical_inn, monograph.get("atc_code"), monograph.get("title")))
            alias_names = [canonical_inn, *re.findall(r"\(([^()]+)\)", canonical_inn)]
            no_parenthetical = re.sub(r"\s*\([^()]+\)", "", canonical_inn).strip()
            if no_parenthetical:
                alias_names.append(no_parenthetical)
            for alias in alias_names:
                alias_rows.setdefault(re.sub(r"[^a-z0-9]+", "", alias.casefold().replace("β", "beta").replace("µ", "u").replace("μ", "u")), (alias, canonical_inn, "canonical" if alias == canonical_inn or alias == no_parenthetical else "alias"))
        conn.executemany("INSERT INTO ingredients VALUES (?,?,?)", ingredient_rows_by_inn.values())
        conn.executemany("INSERT INTO ingredient_aliases VALUES (?,?,?,?)", ((key, alias, inn, match_type) for key, (alias, inn, match_type) in alias_rows.items()))
        if reviewed_aliases:
            approved_rows = json.loads(reviewed_alias_path.read_text(encoding="utf-8"))
            conn.executemany("INSERT INTO reviewed_aliases VALUES (?,?,?,?,?)", [(row["alias"], row["canonical_inn"], row["source"], row["reviewer"], row["reviewed_at"]) for row in approved_rows if str(row.get("alias", "")).casefold() in reviewed_aliases])
        mapped_rows = []
        mapping_counts = Counter()
        for product in normalized_rows:
            parsed = parse_active_ingredients(product["active_ingredient_raw"], product["strength_raw"])
            for ordinal, ingredient in enumerate(parsed["ingredients"], 1):
                mapping = map_ingredient_name(ingredient["name_raw"], ingredient_dictionary, reviewed_aliases)
                mapping_counts[mapping["status"]] += 1
                mapped_rows.append((product["source_id"], ordinal, ingredient["name_raw"], mapping["canonical_inn"], mapping["atc_code"], mapping["status"], mapping["match_type"]))
        conn.executemany("INSERT INTO product_ingredient_mappings VALUES (?,?,?,?,?,?,?)", mapped_rows)
        conn.executemany("INSERT INTO product_search (source_id,active_ingredients) VALUES (?,?)", [(row[0], row[3] or "") for row in mapped_rows if row[3]])
        gap_rows = []
        for raw_name, counts in Counter(row[2] for row in mapped_rows if row[5] == "unmapped").items():
            product_count = conn.execute("SELECT COUNT(DISTINCT source_id) FROM product_ingredient_mappings WHERE raw_name=? AND mapping_status='unmapped'", (raw_name,)).fetchone()[0]
            gap_type = "needs_alias_or_parser_review" if re.search(r"\b(?:dưới dạng|as|hydrochloride|hydrobromide|natri|kali|sodium|potassium)\b|\d+(?:[.,]\d+)?\s*(?:mg|g|mcg|iu|ui|%)", raw_name or "", re.IGNORECASE) else "not_in_dtqg_catalog"
            action = "Add reviewed alias or parser rule" if gap_type == "needs_alias_or_parser_review" else "Add a separately sourced monograph; do not infer from DTQG"
            gap_rows.append((raw_name, counts, product_count, gap_type, action))
        conn.executemany("INSERT INTO ingredient_source_gaps VALUES (?,?,?,?,?)", gap_rows)
        conn.executemany(
            "INSERT INTO pdf_pages (source_key,physical_page,raw_text) VALUES ('dtqg_pdf',?,?)",
            list(enumerate(pages, 1)),
        )
        conn.commit()
        dav_hash = _sha256(dav_json) if dav_json else _raw_snapshot_digest(dav_snapshot_dir)[0]
        flag_counts = Counter(flag for row in normalized_rows for flag in row["normalization_flags"])
        gap_counts = dict(conn.execute("SELECT gap_type,COUNT(*) FROM ingredient_source_gaps GROUP BY gap_type").fetchall())
        return {"dav_records": len(records), "normalized_products": len(normalized_rows), "parsed_ingredient_records": parsed_count, "ingredient_review_records": review_count, "product_ingredient_rows": len(ingredient_rows), "mapping_counts": dict(mapping_counts), "ingredient_dictionary_size": len(ingredient_rows_by_inn), "source_gap_counts": gap_counts, "normalization_flags": dict(flag_counts), "pdf_physical_pages": len(pages), "dav_sha256": dav_hash, "pdf_sha256": _sha256(pdf_path), "staging_db": str(staging_db.resolve())}
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def build_source_staging(*, dav_json: Path | None = None, dav_snapshot_dir: Path | None = None, pdf_path: Path, staging_db: Path, dav_url: str, pdf_url: str) -> dict[str, Any]:
    staging_db.parent.mkdir(parents=True, exist_ok=True)
    temp_db = staging_db.with_name(staging_db.name + ".building")
    if temp_db.exists():
        temp_db.unlink()
    try:
        result = _build_source_staging_file(dav_json=dav_json, dav_snapshot_dir=dav_snapshot_dir, pdf_path=pdf_path, staging_db=temp_db, dav_url=dav_url, pdf_url=pdf_url)
        os.replace(temp_db, staging_db)
        result["staging_db"] = str(staging_db.resolve())
        return result
    finally:
        for suffix in ("", "-journal", "-wal", "-shm"):
            path = Path(str(temp_db) + suffix)
            if path.exists():
                path.unlink()
