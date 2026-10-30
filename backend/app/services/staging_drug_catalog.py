from __future__ import annotations
import re,sqlite3
from pathlib import Path
from typing import Any

class StagingDrugCatalog:
    def __init__(self, db_path: Path): self.db_path=Path(db_path)
    def search(self, query: str, *, page: int=1, page_size: int=50, active_only: bool=True) -> dict[str,Any]:
        if page < 1 or page_size < 1 or page_size > 200: raise ValueError("page must be >=1 and page_size 1..200")
        term=query.strip()
        if not term: return {"total":0,"page":page,"page_size":page_size,"items":[]}
        conn=sqlite3.connect(f"file:{self.db_path.resolve()}?mode=ro",uri=True);conn.row_factory=sqlite3.Row
        try:
            table_names={row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
            has_mappings="product_ingredient_mappings" in table_names
            mappings_sql="(SELECT json_group_array(canonical_inn) FROM (SELECT DISTINCT canonical_inn FROM product_ingredient_mappings m WHERE m.source_id=p.source_id AND m.canonical_inn IS NOT NULL ORDER BY canonical_inn))" if has_mappings else "'[]'"
            conditions=[]; args=[]
            if active_only: conditions.append("p.is_active=1 AND p.is_expired=0")
            exact="p.national_code=?"; exact_args=[term]
            # FTS5's unicode61 tokenizer removes Vietnamese diacritics and
            # punctuation. Match that behavior while preserving accented text;
            # quote each token to prevent user input from becoming FTS syntax.
            tokens=re.findall(r"[^\W_]+",term,flags=re.UNICODE)
            fts_query=" AND ".join('"'+part.replace('"','')+'"*' for part in tokens) if tokens else ""
            where=(" WHERE "+" AND ".join(conditions)) if conditions else ""
            match_sql="p.source_id IN (SELECT source_id FROM product_search WHERE product_search MATCH ?)" if fts_query else "0"
            count_sql=f"SELECT COUNT(*) FROM normalized_products p WHERE ({exact} OR {match_sql}){' AND ' + ' AND '.join(conditions) if conditions else ''}"
            total=conn.execute(count_sql,exact_args+([fts_query] if fts_query else [])).fetchone()[0]
            query_sql=f"SELECT p.*, {mappings_sql} AS canonical_ingredients FROM normalized_products p WHERE (p.national_code=? OR {match_sql}){' AND ' + ' AND '.join(conditions) if conditions else ''} ORDER BY CASE WHEN p.national_code=? THEN 0 ELSE 1 END,p.brand_name COLLATE NOCASE,p.national_code LIMIT ? OFFSET ?"
            rows=conn.execute(query_sql,[term]+([fts_query] if fts_query else [])+[term,page_size,(page-1)*page_size]).fetchall()
            import json
            items=[]
            for row in rows:
                item=dict(row); item["canonical_ingredients"]=json.loads(item.pop("canonical_ingredients") or "[]"); item["normalization_flags"]=json.loads(item.get("normalization_flags") or "[]"); items.append(item)
            return {"total":total,"page":page,"page_size":page_size,"items":items}
        finally: conn.close()
