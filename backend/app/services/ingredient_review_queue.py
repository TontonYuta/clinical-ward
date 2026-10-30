from __future__ import annotations
import sqlite3
from typing import Any


def build_unmapped_review_queue(conn: sqlite3.Connection, limit: int | None = None) -> list[dict[str, Any]]:
    conn.row_factory = sqlite3.Row
    sql = """
        WITH grouped AS (
            SELECT raw_name, COUNT(*) AS ingredient_rows, COUNT(DISTINCT source_id) AS product_count
            FROM product_ingredient_mappings WHERE mapping_status = 'unmapped'
            GROUP BY raw_name
        ), ranked_examples AS (
            SELECT m.raw_name, p.national_code, p.brand_name,
                   ROW_NUMBER() OVER (PARTITION BY m.raw_name ORDER BY p.national_code) AS rank
            FROM product_ingredient_mappings m
            JOIN normalized_products p ON p.source_id = m.source_id
            WHERE m.mapping_status = 'unmapped'
            GROUP BY m.raw_name, p.source_id
        )
        SELECT g.raw_name, g.ingredient_rows, g.product_count, e.national_code, e.brand_name
        FROM grouped g LEFT JOIN ranked_examples e ON e.raw_name = g.raw_name AND e.rank <= 5
        ORDER BY g.product_count DESC, g.raw_name COLLATE NOCASE, e.rank
    """
    rows = conn.execute(sql).fetchall()
    grouped_rows: dict[str, dict[str, Any]] = {}
    for row in rows:
        item = grouped_rows.setdefault(row["raw_name"], {"raw_name": row["raw_name"], "ingredient_rows": row["ingredient_rows"], "product_count": row["product_count"], "examples": [], "decision": None, "proposed_canonical_inn": None, "reviewer": None, "reviewed_at": None})
        if row["national_code"] is not None:
            item["examples"].append({"national_code": row["national_code"], "brand_name": row["brand_name"]})
    items = list(grouped_rows.values())
    return items[:limit] if limit else items
