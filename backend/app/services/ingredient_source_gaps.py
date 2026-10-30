from __future__ import annotations
import re
import sqlite3
from typing import Any

def _looks_structured(raw: str) -> bool:
    return bool(re.search(r"\b(?:dưới dạng|as|hydrochloride|hydrobromide|natri|kali|sodium|potassium)\b", raw, re.IGNORECASE) or re.search(r"\d+(?:[.,]\d+)?\s*(?:mg|g|mcg|iu|ui|%)", raw, re.IGNORECASE))

def build_source_gap_report(conn: sqlite3.Connection, limit: int | None = None) -> list[dict[str, Any]]:
    rows = conn.execute("SELECT raw_name, COUNT(*) AS occurrence_count, COUNT(DISTINCT source_id) AS product_count FROM product_ingredient_mappings WHERE mapping_status = 'unmapped' GROUP BY raw_name ORDER BY product_count DESC, raw_name COLLATE NOCASE" + (" LIMIT ?" if limit else ""), (limit,) if limit else ()).fetchall()
    report = []
    for raw_name, occurrence_count, product_count in rows:
        gap_type = "needs_alias_or_parser_review" if _looks_structured(raw_name or "") else "not_in_dtqg_catalog"
        report.append({"raw_name": raw_name, "occurrence_count": occurrence_count, "product_count": product_count, "gap_type": gap_type, "action": "Add reviewed alias or parser rule" if gap_type == "needs_alias_or_parser_review" else "Add a separately sourced monograph; do not infer from DTQG"})
    return report
