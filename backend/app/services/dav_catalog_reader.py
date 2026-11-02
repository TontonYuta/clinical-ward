from __future__ import annotations
import sqlite3
import hashlib
from pathlib import Path
from typing import Any
from app.services.dav_catalog_reader_helpers import (
    has_table, stock_for_registration, stock_for_product,
    hydrate_row, list_unfiltered_page
)

class DavCatalogReader:
    PHARM_MAPPING = {
        "fever_pain": (["N02B"], ["paracetamol", "acetaminophen"]),
        "cardiotonic_vasopressor": (["C01C", "A03BA"], ["adrenalin", "noradrenalin", "epinephrin", "dopamin", "dobutamin", "atropin"]),
        "diuretic": (["C03"], ["furosemid", "spironolacton", "indapamid"]),
        "antihypertensive": (["C08", "C09", "C07"], ["amlodipin", "enalapril", "losartan", "perindopril"]),
        "antiarrhythmic": (["C01B"], ["amiodaron", "lidocain"]),
        "antibiotic": (["J01"], ["ceftriaxon", "meropenem", "vancomycin", "ciprofloxacin", "cefaclor", "amoxicillin"]),
        "opioid": (["N02A", "N01A"], ["morphin", "fentanyl", "tramadol"]),
        "sedative": (["N05B"], ["diazepam", "midazolam"]),
        "bronchodilator": (["R03"], ["salbutamol", "ipratropium"]),
        "antiulcer_ppi": (["A02B"], ["omeprazol", "esomeprazol", "pantoprazol"]),
        "antidiabetic": (["A10"], ["insulin", "metformin"]),
        "lipid_lowering": (["C10"], ["atorvastatin", "rosuvastatin"]),
        "iv_fluids_electrolytes": (["B05B"], ["natri clorid", "glucose", "ringer", "kali clorid"]),
        "vaccine": (["J07"], ["vaccine", "vắc xin", "vaxigrip"]),
    }
    GROUP_ALIASES = {
        "opioid": "Thuốc gây nghiện", "sedative": "Thuốc hướng thần", "emergency": "Thuốc cấp cứu",
        "antibiotic": "Kháng sinh", "infusion": "Dịch truyền", "high_alert": "Thuốc nguy cơ cao", "specialty": "Thuốc điều trị chuyên khoa"
    }

    def __init__(self, db_path: Path, run_id: str):
        self.db_path, self.run_id = Path(db_path), run_id
        with self._connect() as conn:
            row = conn.execute("SELECT status FROM dav_catalog_runs WHERE run_id=?", (run_id,)).fetchone()
        if not row or row[0] != "ready":
            raise ValueError(f"DAV catalog run is missing or not ready: {run_id}")

    def _connect(self):
        conn = sqlite3.connect(f"file:{self.db_path.resolve()}?mode=ro", uri=True)
        conn.row_factory = sqlite3.Row
        return conn

    @staticmethod
    def _has_table(conn, name: str) -> bool:
        return has_table(conn, name)

    def _stock_for_product(self, conn, source_id: str) -> list[dict[str, Any]]:
        return stock_for_product(conn, self.run_id, source_id)

    def _hydrate_row(self, conn, row, **kwargs):
        return hydrate_row(conn, self.run_id, row, **kwargs)

    def _list_unfiltered_page(self, **kwargs):
        return list_unfiltered_page(self, **kwargs)

    def search(self, query: str, *, page: int = 1, page_size: int = 50, active_only: bool = False, source_mode: str = "canonical") -> dict[str, Any]:
        if page < 1 or page_size < 1 or page_size > 200:
            raise ValueError("page must be >=1 and page_size 1..200")
        if source_mode not in {"canonical", "legacy_compatible"}:
            raise ValueError("source_mode must be canonical or legacy_compatible")
        term = query.strip()
        if not term:
            return {"total": 0, "page": page, "page_size": page_size, "items": []}

        with self._connect() as conn:
            status_filter = " AND is_active=1 AND is_expired=0" if active_only else ""
            exact = conn.execute("SELECT * FROM dav_catalog_products WHERE run_id=? AND national_code=?" + status_filter, (self.run_id, term)).fetchone()
            if exact:
                item = self._hydrate_row(conn, exact)
                legacy = conn.execute("SELECT d.* FROM dav_catalog_legacy_links l JOIN dav_national_drugs d ON d.id=l.legacy_drug_id WHERE l.run_id=? AND l.source_id=? ORDER BY d.id LIMIT 1", (self.run_id, exact["source_id"])).fetchone()
                if legacy:
                    item["legacy"] = dict(legacy)
                    item.update(dict(legacy))
                item["hospital_stock_by_unit"] = self._stock_for_product(conn, exact["source_id"])
                return {"total": 1, "page": page, "page_size": page_size, "items": [item] if page == 1 else []}

        trigram_exists = len(term) >= 3
        fts = '"' + term.replace('"', '""') + '"'
        if len(term) >= 3 and trigram_exists:
            match = "source_id IN (SELECT source_id FROM dav_product_search_trigram WHERE dav_product_search_trigram MATCH ? AND run_id=?)"
            search_args = [fts, self.run_id]
        else:
            match = "(lower(brand_name) LIKE ? OR lower(active_ingredient_raw) LIKE ? OR lower(national_code) LIKE ? OR EXISTS (SELECT 1 FROM dav_catalog_legacy_links l JOIN dav_national_drugs d ON d.id=l.legacy_drug_id WHERE l.run_id=dav_catalog_products.run_id AND l.source_id=dav_catalog_products.source_id AND lower(d.note) LIKE ?))"
            pattern = "%" + term.lower() + "%"
            search_args = [pattern, pattern, pattern, pattern]

        filters = " AND run_id=?" + (" AND is_active=1 AND is_expired=0" if active_only else "")
        with self._connect() as conn:
            args = [term] + search_args + [self.run_id]
            total = conn.execute(f"SELECT COUNT(*) FROM dav_catalog_products WHERE (national_code=? OR {match}){filters}", args).fetchone()[0]
            legacy_only_rows = []
            if source_mode == "legacy_compatible" and self._has_table(conn, "dav_national_drugs"):
                pattern = "%" + term.lower() + "%"
                legacy_only_rows = conn.execute("SELECT d.* FROM dav_national_drugs d WHERE (lower(d.brand_name) LIKE ? OR lower(d.active_ingredient) LIKE ? OR lower(d.national_code) LIKE ? OR lower(d.note) LIKE ?) AND NOT EXISTS (SELECT 1 FROM dav_catalog_legacy_links l WHERE l.run_id=? AND l.legacy_drug_id=d.id) ORDER BY d.brand_name,d.national_code", [pattern] * 4 + [self.run_id]).fetchall()
                total += len(legacy_only_rows)
            sql = f"SELECT p.*, COALESCE((SELECT json_group_array(canonical_inn) FROM (SELECT DISTINCT canonical_inn FROM dav_ingredient_mappings m WHERE m.run_id=p.run_id AND m.source_id=p.source_id AND canonical_inn IS NOT NULL ORDER BY canonical_inn)), '[]') canonical_ingredients FROM dav_catalog_products p WHERE (p.national_code=? OR {match}){filters} ORDER BY CASE WHEN p.national_code=? THEN 0 ELSE 1 END,p.brand_name COLLATE NOCASE,p.national_code LIMIT ? OFFSET ?"
            args = [term] + search_args + [self.run_id, term, page_size, (page - 1) * page_size]
            rows = conn.execute(sql, args).fetchall()
            source_ids = [row["source_id"] for row in rows]
            legacy_by_source = {}
            stock_by_source = {}
            inn_by_source = {}
            if source_ids:
                marks = ",".join("?" for _ in source_ids)
                if self._has_table(conn, "dav_catalog_legacy_links"):
                    legacy_rows = conn.execute(f"SELECT l.source_id,d.* FROM dav_catalog_legacy_links l JOIN dav_national_drugs d ON d.id=l.legacy_drug_id WHERE l.run_id=? AND l.source_id IN ({marks}) ORDER BY d.id", [self.run_id, *source_ids]).fetchall()
                    for legacy_row in legacy_rows:
                        legacy_by_source.setdefault(legacy_row["source_id"], {key: legacy_row[key] for key in legacy_row.keys() if key != "source_id"})
                if self._has_table(conn, "dav_catalog_inventory_links") and self._has_table(conn, "inventory_batches"):
                    stock_rows = conn.execute(f"SELECT l.source_id,i.unit,SUM(i.current_stock) quantity,COUNT(*) batch_count FROM dav_catalog_inventory_links l JOIN inventory_batches i ON i.id=l.inventory_batch_id WHERE l.run_id=? AND l.source_id IN ({marks}) AND i.current_stock>0 GROUP BY l.source_id,i.unit ORDER BY i.unit", [self.run_id, *source_ids]).fetchall()
                    for stock_row in stock_rows:
                        stock_by_source.setdefault(stock_row["source_id"], []).append({"unit": stock_row["unit"] or "Không rõ đơn vị", "quantity": int(stock_row["quantity"]), "batch_count": int(stock_row["batch_count"])})
                inn_rows = conn.execute(f"SELECT source_id,canonical_inn FROM dav_ingredient_mappings WHERE run_id=? AND source_id IN ({marks}) AND canonical_inn IS NOT NULL ORDER BY canonical_inn", [self.run_id, *source_ids]).fetchall()
                for inn_row in inn_rows:
                    vals = inn_by_source.setdefault(inn_row["source_id"], [])
                    if inn_row["canonical_inn"] not in vals:
                        vals.append(inn_row["canonical_inn"])
            items = []
            for row in rows:
                items.append(self._hydrate_row(conn, row, legacy_by_source=legacy_by_source, stock_by_source=stock_by_source, inn_by_source=inn_by_source))
            if legacy_only_rows:
                offset = (page - 1) * page_size
                for legacy_row in legacy_only_rows[offset:max(offset, 0) + page_size]:
                    item = dict(legacy_row)
                    item["source_id"] = "legacy:" + str(item.get("id"))
                    item["canonical_ingredients"] = []
                    item["normalization_flags"] = []
                    item["legacy"] = dict(legacy_row)
                    item["hospital_stock_by_unit"] = []
                    items.append(item)
                items.sort(key=lambda it: (0 if it.get("national_code") == "893100110026" else 1, str(it.get("brand_name") or "").casefold(), str(it.get("national_code") or "")))
        return {"total": total, "page": page, "page_size": page_size, "items": items}

    def list_registry(self, *, search: str | None = None, group: str | None = None, pharm_group: str | None = None,
                      page: int = 1, page_size: int = 50, only_in_warehouse: bool = False,
                      active_only: bool = False, source_mode: str = "legacy_compatible") -> dict[str, Any]:
        if page < 1 or page_size < 1 or page_size > 200:
            raise ValueError("page must be >=1 and page_size 1..200")
        query = search.strip() if search and search.strip() else ""
        if not query and not group and not pharm_group and not only_in_warehouse:
            return self._list_unfiltered_page(page=page, page_size=page_size, active_only=active_only, source_mode=source_mode)

        with self._connect() as conn:
            where = ["p.run_id=?"]
            args = [self.run_id]
            if active_only:
                where += ["p.is_active=1", "p.is_expired=0"]
            if query:
                pattern = "%" + query.casefold() + "%"
                where.append("(lower(p.national_code) LIKE ? OR lower(p.brand_name) LIKE ? OR lower(p.active_ingredient_raw) LIKE ? OR EXISTS (SELECT 1 FROM dav_catalog_legacy_links ql JOIN dav_national_drugs qd ON qd.id=ql.legacy_drug_id WHERE ql.run_id=p.run_id AND ql.source_id=p.source_id AND lower(qd.note) LIKE ?))")
                args.extend([pattern, pattern, pattern, pattern])
            target_group = self.GROUP_ALIASES.get(group.lower(), group) if group else None
            if target_group and target_group.lower() != 'all':
                where.append("EXISTS (SELECT 1 FROM dav_catalog_legacy_links gl JOIN dav_national_drugs gd ON gd.id=gl.legacy_drug_id WHERE gl.run_id=p.run_id AND gl.source_id=p.source_id AND gd.[group]=?)")
                args.append(target_group)
            if pharm_group and pharm_group != "all" and pharm_group in self.PHARM_MAPPING:
                atcs, keywords = self.PHARM_MAPPING[pharm_group]
                where.append("(EXISTS (SELECT 1 FROM dav_ingredient_mappings im WHERE im.run_id=p.run_id AND im.source_id=p.source_id AND (" + " OR ".join(["lower(im.canonical_inn) LIKE ?" for _ in keywords]) + ")) OR " + " OR ".join(["lower(p.active_ingredient_raw) LIKE ?" for _ in keywords]) + " OR EXISTS (SELECT 1 FROM dav_catalog_legacy_links l JOIN dav_national_drugs d ON d.id=l.legacy_drug_id WHERE l.run_id=p.run_id AND l.source_id=p.source_id AND ((" + " OR ".join(["lower(d.active_ingredient) LIKE ?" for _ in keywords] + ["d.atc_code LIKE ?" for _ in atcs]) + ") OR (?='antibiotic' AND d.[group]='Kháng sinh'))))")
                args.extend(["%" + keyword.casefold() + "%" for keyword in keywords] * 3 + [prefix + "%" for prefix in atcs] + [pharm_group])
            if only_in_warehouse:
                where.append("EXISTS (SELECT 1 FROM dav_catalog_inventory_links il JOIN inventory_batches ib ON ib.id=il.inventory_batch_id WHERE il.run_id=p.run_id AND il.source_id=p.source_id AND ib.current_stock>0)")
            predicate = " AND ".join(where)
            total = conn.execute(f"SELECT COUNT(*) FROM dav_catalog_products p WHERE {predicate}", args).fetchone()[0]
            legacy_only = []
            if source_mode == "legacy_compatible" and self._has_table(conn, "dav_national_drugs") and not only_in_warehouse:
                lwhere = ["NOT EXISTS (SELECT 1 FROM dav_catalog_legacy_links lx WHERE lx.run_id=? AND lx.legacy_drug_id=d.id)"]
                largs = [self.run_id]
                if pharm_group and pharm_group != 'all':
                    lwhere.append("0=1")
                if query:
                    lwhere.append("(lower(d.national_code) LIKE ? OR lower(d.brand_name) LIKE ? OR lower(d.active_ingredient) LIKE ? OR lower(d.note) LIKE ?)")
                    largs.extend(["%" + query.casefold() + "%"] * 4)
                if target_group and target_group.lower() != "all":
                    lwhere.append("d.[group]=?")
                    largs.append(target_group)
                legacy_only = conn.execute("SELECT d.* FROM dav_national_drugs d WHERE " + " AND ".join(lwhere) + " ORDER BY d.brand_name,d.national_code", largs).fetchall()
                total += len(legacy_only)
            rows = conn.execute(f"SELECT p.national_code FROM dav_catalog_products p WHERE {predicate} ORDER BY CASE WHEN p.national_code='893100110026' THEN 0 ELSE 1 END,p.brand_name COLLATE NOCASE,p.national_code LIMIT ? OFFSET ?", args + [page_size, (page - 1) * page_size]).fetchall()

        items = []
        for row in rows:
            found = self.search(row[0], page=1, page_size=1, active_only=active_only, source_mode="canonical")
            if found["items"]:
                items.append(found["items"][0])
        if legacy_only and len(items) < page_size and page == 1:
            items.extend({**dict(r), "source_id": "legacy:" + str(r["id"]), "legacy": dict(r), "canonical_ingredients": [], "normalization_flags": [], "hospital_stock_by_unit": []} for r in legacy_only[:page_size - len(items)])
        return {"total": total, "page": page, "page_size": page_size, "total_pages": max(1, (total + page_size - 1) // page_size), "group_stats": {}, "items": items, "registry_revision": "", "inventory_revision": "", "hospital_stock_drug_count": 0}
