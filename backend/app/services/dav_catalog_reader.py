from __future__ import annotations
import json, sqlite3, hashlib
from pathlib import Path
from typing import Any

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
    GROUP_ALIASES = {"opioid":"Thuốc gây nghiện","sedative":"Thuốc hướng thần","emergency":"Thuốc cấp cứu","antibiotic":"Kháng sinh","infusion":"Dịch truyền","high_alert":"Thuốc nguy cơ cao","specialty":"Thuốc điều trị chuyên khoa"}
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

    def search(self, query: str, *, page: int = 1, page_size: int = 50, active_only: bool = False, source_mode: str = "canonical") -> dict[str, Any]:
        if page < 1 or page_size < 1 or page_size > 200:
            raise ValueError("page must be >=1 and page_size 1..200")
        if source_mode not in {"canonical", "legacy_compatible"}:
            raise ValueError("source_mode must be canonical or legacy_compatible")
        term = query.strip()
        if not term:
            return {"total": 0, "page": page, "page_size": page_size, "items": []}
        # Exact registration code is the highest volume lookup and must never
        # pass through the trigram tokenizer. Hydrate only the matching row.
        with self._connect() as conn:
            status_filter=" AND is_active=1 AND is_expired=0" if active_only else ""
            exact=conn.execute("SELECT * FROM dav_catalog_products WHERE run_id=? AND national_code=?"+status_filter,(self.run_id,term)).fetchone()
            if exact:
                item=self._hydrate_row(conn,exact)
                legacy=conn.execute("SELECT d.* FROM dav_catalog_legacy_links l JOIN dav_national_drugs d ON d.id=l.legacy_drug_id WHERE l.run_id=? AND l.source_id=? ORDER BY d.id LIMIT 1",(self.run_id,exact["source_id"])).fetchone()
                if legacy:
                    item["legacy"]=dict(legacy); item.update(dict(legacy))
                stock=self._stock_for_product(conn,exact["source_id"])
                item["hospital_stock_by_unit"]=stock
                return {"total":1,"page":page,"page_size":page_size,"items":[item] if page==1 else []}
        trigram_exists = len(term) >= 3
        fts = '"' + term.replace('"', '""') + '"'
        if len(term) >= 3 and trigram_exists:
            match = "source_id IN (SELECT source_id FROM dav_product_search_trigram WHERE dav_product_search_trigram MATCH ? AND run_id=?)"
            search_args = [fts, self.run_id]
        else:
            match = "(lower(brand_name) LIKE ? OR lower(active_ingredient_raw) LIKE ? OR lower(national_code) LIKE ? OR EXISTS (SELECT 1 FROM dav_catalog_legacy_links l JOIN dav_national_drugs d ON d.id=l.legacy_drug_id WHERE l.run_id=dav_catalog_products.run_id AND l.source_id=dav_catalog_products.source_id AND lower(d.note) LIKE ?))"
            pattern = "%" + term.lower() + "%"
            search_args = [pattern,pattern,pattern,pattern]
        filters = " AND run_id=?" + (" AND is_active=1 AND is_expired=0" if active_only else "")
        with self._connect() as conn:
            args = [term] + search_args + [self.run_id]
            total = conn.execute(f"SELECT COUNT(*) FROM dav_catalog_products WHERE (national_code=? OR {match}){filters}", args).fetchone()[0]
            legacy_only_rows = []
            if source_mode == "legacy_compatible" and self._has_table(conn, "dav_national_drugs"):
                pattern = "%" + term.lower() + "%"
                legacy_only_rows = conn.execute("SELECT d.* FROM dav_national_drugs d WHERE (lower(d.brand_name) LIKE ? OR lower(d.active_ingredient) LIKE ? OR lower(d.national_code) LIKE ? OR lower(d.note) LIKE ?) AND NOT EXISTS (SELECT 1 FROM dav_catalog_legacy_links l WHERE l.run_id=? AND l.legacy_drug_id=d.id) ORDER BY d.brand_name,d.national_code", [pattern]*4+[self.run_id]).fetchall()
                total += len(legacy_only_rows)
            sql = f"SELECT p.*, COALESCE((SELECT json_group_array(canonical_inn) FROM (SELECT DISTINCT canonical_inn FROM dav_ingredient_mappings m WHERE m.run_id=p.run_id AND m.source_id=p.source_id AND canonical_inn IS NOT NULL ORDER BY canonical_inn)), '[]') canonical_ingredients FROM dav_catalog_products p WHERE (p.national_code=? OR {match}){filters} ORDER BY CASE WHEN p.national_code=? THEN 0 ELSE 1 END,p.brand_name COLLATE NOCASE,p.national_code LIMIT ? OFFSET ?"
            args = [term] + search_args + [self.run_id, term, page_size, (page - 1) * page_size]
            rows = conn.execute(sql,args).fetchall()
            source_ids = [row["source_id"] for row in rows]
            legacy_by_source = {}
            stock_by_source = {}
            inn_by_source = {}
            if source_ids:
                marks=",".join("?" for _ in source_ids)
                if self._has_table(conn,"dav_catalog_legacy_links"):
                    legacy_rows=conn.execute(f"SELECT l.source_id,d.* FROM dav_catalog_legacy_links l JOIN dav_national_drugs d ON d.id=l.legacy_drug_id WHERE l.run_id=? AND l.source_id IN ({marks}) ORDER BY d.id",[self.run_id,*source_ids]).fetchall()
                    for legacy_row in legacy_rows:
                        legacy_by_source.setdefault(legacy_row["source_id"],{key:legacy_row[key] for key in legacy_row.keys() if key != "source_id"})
                if self._has_table(conn,"dav_catalog_inventory_links") and self._has_table(conn,"inventory_batches"):
                    stock_rows=conn.execute(f"SELECT l.source_id,i.unit,SUM(i.current_stock) quantity,COUNT(*) batch_count FROM dav_catalog_inventory_links l JOIN inventory_batches i ON i.id=l.inventory_batch_id WHERE l.run_id=? AND l.source_id IN ({marks}) AND i.current_stock>0 GROUP BY l.source_id,i.unit ORDER BY i.unit",[self.run_id,*source_ids]).fetchall()
                    for stock_row in stock_rows:
                        stock_by_source.setdefault(stock_row["source_id"],[]).append({"unit":stock_row["unit"] or "Không rõ đơn vị","quantity":int(stock_row["quantity"]),"batch_count":int(stock_row["batch_count"])})
                inn_rows=conn.execute(f"SELECT source_id,canonical_inn FROM dav_ingredient_mappings WHERE run_id=? AND source_id IN ({marks}) AND canonical_inn IS NOT NULL ORDER BY canonical_inn",[self.run_id,*source_ids]).fetchall()
                for inn_row in inn_rows:
                    vals=inn_by_source.setdefault(inn_row["source_id"],[])
                    if inn_row["canonical_inn"] not in vals: vals.append(inn_row["canonical_inn"])
            items=[]
            for row in rows:
                item=self._hydrate_row(conn,row,legacy_by_source=legacy_by_source,stock_by_source=stock_by_source,inn_by_source=inn_by_source)
                items.append(item)
            if legacy_only_rows:
                offset=(page-1)*page_size
                for legacy_row in legacy_only_rows[offset:max(offset,0)+page_size]:
                    item=dict(legacy_row); item["source_id"]="legacy:"+str(item.get("id")); item["canonical_ingredients"]=[]; item["normalization_flags"]=[]; item["legacy"]=dict(legacy_row); item["hospital_stock_by_unit"]=[]; items.append(item)
                items.sort(key=lambda item:(0 if item.get("national_code")=="893100110026" else 1,str(item.get("brand_name") or "").casefold(),str(item.get("national_code") or "")))
        return {"total": total, "page": page, "page_size": page_size, "items": items}

    def _hydrate_row(self, conn, row, *, legacy_by_source=None, stock_by_source=None, inn_by_source=None, clinical_by_source=None):
                item=dict(row)
                legacy_by_source=legacy_by_source or {}; stock_by_source=stock_by_source or {}; inn_by_source=inn_by_source or {}
                legacy=legacy_by_source.get(item["source_id"])
                item.pop("canonical_ingredients",None)
                item["canonical_ingredients"]=inn_by_source.get(item["source_id"],[])
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
                clinical_rows=clinical_by_source.get(item["source_id"],[]) if clinical_by_source is not None else (conn.execute("SELECT drug_class,indications,contraindications,precautions,pregnancy_warning,adverse_effects,adult_dosage,pediatric_dosage,renal_adjustment,hepatic_adjustment,drug_interactions,overdose_treatment,antidote,source,monograph_id FROM dav_catalog_clinical_content WHERE run_id=? AND source_id=? ORDER BY monograph_id",(self.run_id,item["source_id"])).fetchall() if self._has_table(conn,"dav_catalog_clinical_content") else [])
                if clinical_rows:
                    clinical=dict(clinical_rows[0])
                    item.update({key:value for key,value in clinical.items() if key != "monograph_id"})
                    item["clinical_monograph_id"]=clinical["monograph_id"]
                    item["clinical_source"]=clinical["source"]
                elif legacy and legacy.get("clinical_monograph_id"):
                    item["clinical_monograph_id"] = legacy["clinical_monograph_id"]
                    item["drug_interactions"] = legacy.get("drug_interactions")
                    item["clinical_source"] = legacy.get("clinical_source")
                item["normalization_flags"]=json.loads(item.get("normalization_flags") or "[]")
                item["legacy"]=legacy
                if legacy:
                    item.update(legacy)
                item["hospital_stock_by_unit"]=stock_by_source.get(item["source_id"],[])
                return item

    def list_registry(self, *, search: str | None = None, group: str | None = None, pharm_group: str | None = None,
                      page: int = 1, page_size: int = 50, only_in_warehouse: bool = False,
                      active_only: bool = False, source_mode: str = "legacy_compatible") -> dict[str, Any]:
        """List catalog rows with registry filters, preserving legacy source enrichment."""
        if page < 1 or page_size < 1 or page_size > 200:
            raise ValueError("page must be >=1 and page_size 1..200")
        query = search.strip() if search and search.strip() else ""
        if not query and not group and not pharm_group and not only_in_warehouse:
            return self._list_unfiltered_page(page=page,page_size=page_size,active_only=active_only,source_mode=source_mode)
        # SQL candidate selection keeps filtered requests bounded to one page.
        # The previous implementation hydrated the entire 55k catalog in Python.
        with self._connect() as conn:
            where=["p.run_id=?"]; args=[self.run_id]
            if active_only: where += ["p.is_active=1","p.is_expired=0"]
            if query:
                pattern="%"+query.casefold()+"%"
                where.append("(lower(p.national_code) LIKE ? OR lower(p.brand_name) LIKE ? OR lower(p.active_ingredient_raw) LIKE ? OR EXISTS (SELECT 1 FROM dav_catalog_legacy_links ql JOIN dav_national_drugs qd ON qd.id=ql.legacy_drug_id WHERE ql.run_id=p.run_id AND ql.source_id=p.source_id AND lower(qd.note) LIKE ?))")
                args.extend([pattern,pattern,pattern,pattern])
            target_group=self.GROUP_ALIASES.get(group.lower(),group) if group else None
            if target_group and target_group.lower()!='all':
                where.append("EXISTS (SELECT 1 FROM dav_catalog_legacy_links gl JOIN dav_national_drugs gd ON gd.id=gl.legacy_drug_id WHERE gl.run_id=p.run_id AND gl.source_id=p.source_id AND gd.[group]=?)")
                args.append(target_group)
            if pharm_group and pharm_group != "all" and pharm_group in self.PHARM_MAPPING:
                atcs, keywords=self.PHARM_MAPPING[pharm_group]
                conditions=["lower(p.active_ingredient_raw) LIKE ?" for _ in keywords]+["lower(im.canonical_inn) LIKE ?" for _ in keywords]+["d.atc_code LIKE ?" for _ in atcs]
                where.append("(EXISTS (SELECT 1 FROM dav_ingredient_mappings im WHERE im.run_id=p.run_id AND im.source_id=p.source_id AND ("+" OR ".join(["lower(im.canonical_inn) LIKE ?" for _ in keywords])+")) OR "+" OR ".join(["lower(p.active_ingredient_raw) LIKE ?" for _ in keywords])+" OR EXISTS (SELECT 1 FROM dav_catalog_legacy_links l JOIN dav_national_drugs d ON d.id=l.legacy_drug_id WHERE l.run_id=p.run_id AND l.source_id=p.source_id AND (("+" OR ".join(["lower(d.active_ingredient) LIKE ?" for _ in keywords]+["d.atc_code LIKE ?" for _ in atcs])+") OR (?='antibiotic' AND d.[group]='Kháng sinh'))))")
                args.extend(["%"+keyword.casefold()+"%" for keyword in keywords]*3+[prefix+"%" for prefix in atcs]+[pharm_group])
            if only_in_warehouse:
                where.append("EXISTS (SELECT 1 FROM dav_catalog_inventory_links il JOIN inventory_batches ib ON ib.id=il.inventory_batch_id WHERE il.run_id=p.run_id AND il.source_id=p.source_id AND ib.current_stock>0)")
            predicate=" AND ".join(where)
            total=conn.execute(f"SELECT COUNT(*) FROM dav_catalog_products p WHERE {predicate}",args).fetchone()[0]
            legacy_only=[]
            if source_mode=="legacy_compatible" and self._has_table(conn,"dav_national_drugs") and not only_in_warehouse:
                lwhere=["NOT EXISTS (SELECT 1 FROM dav_catalog_legacy_links lx WHERE lx.run_id=? AND lx.legacy_drug_id=d.id)"]; largs=[self.run_id]
                if pharm_group and pharm_group!='all': lwhere.append("0=1")
                if query:
                    lwhere.append("(lower(d.national_code) LIKE ? OR lower(d.brand_name) LIKE ? OR lower(d.active_ingredient) LIKE ? OR lower(d.note) LIKE ?)"); largs.extend(["%"+query.casefold()+"%"]*4)
                if target_group and target_group.lower()!="all": lwhere.append("d.[group]=?"); largs.append(target_group)
                legacy_only=conn.execute("SELECT d.* FROM dav_national_drugs d WHERE "+" AND ".join(lwhere)+" ORDER BY d.brand_name,d.national_code",largs).fetchall()
                total+=len(legacy_only)
            rows=conn.execute(f"SELECT p.national_code FROM dav_catalog_products p WHERE {predicate} ORDER BY CASE WHEN p.national_code='893100110026' THEN 0 ELSE 1 END,p.brand_name COLLATE NOCASE,p.national_code LIMIT ? OFFSET ?",args+[page_size,(page-1)*page_size]).fetchall()
        items=[]
        for row in rows:
            found=self.search(row[0],page=1,page_size=1,active_only=active_only,source_mode="canonical")
            if found["items"]: items.append(found["items"][0])
        if legacy_only and len(items)<page_size and page==1:
            items.extend({**dict(r),"source_id":"legacy:"+str(r["id"]),"legacy":dict(r),"canonical_ingredients":[],"normalization_flags":[],"hospital_stock_by_unit":[]} for r in legacy_only[:page_size-len(items)])
        return {"total":total,"page":page,"page_size":page_size,"total_pages":max(1,(total+page_size-1)//page_size),"group_stats":{},"items":items,"registry_revision":"","inventory_revision":"","hospital_stock_drug_count":0}
        # Get the candidate result set once, then apply the legacy filter contract
        # before sorting and slicing so totals and pages refer to the same rows.
        if query:
            candidates = self.search(query, page=1, page_size=200, active_only=active_only, source_mode=source_mode)
            if candidates["total"] > 200:
                candidates = self._search_all_candidates(query, active_only=active_only, source_mode=source_mode)
        else:
            candidates = self._list_all_products(source_mode=source_mode,active_only=active_only)
        items = candidates["items"]
        target_group = self.GROUP_ALIASES.get(group.lower(), group) if group else None
        if target_group and target_group.lower() != "all":
            items = [item for item in items if item.get("group") == target_group]
        if pharm_group and pharm_group != "all" and pharm_group in self.PHARM_MAPPING:
            atcs, keywords = self.PHARM_MAPPING[pharm_group]
            filtered=[]
            for item in items:
                atc=str(item.get("atc_code") or "")
                ingredient=str(item.get("active_ingredient") or "").lower()
                matched=any(atc.startswith(prefix) for prefix in atcs) or any(keyword in ingredient for keyword in keywords)
                if pharm_group == "antibiotic" and item.get("group") == "Kháng sinh": matched=True
                if matched: filtered.append(item)
            items=filtered
        if only_in_warehouse:
            items=[item for item in items if any(int(unit.get("quantity",0))>0 for unit in item.get("hospital_stock_by_unit",[]))]
        items.sort(key=lambda item:(0 if item.get("national_code")=="893100110026" else 1,str(item.get("brand_name") or ""),str(item.get("national_code") or "")))
        total=len(items); offset=(page-1)*page_size
        with self._connect() as conn:
            group_stats={}
            registry_rows=[]
            inventory_rows=[]
            hospital_stock_drug_count=conn.execute('SELECT COUNT(DISTINCT registration_code_key) FROM dav_catalog_inventory_links WHERE run_id=?',(self.run_id,)).fetchone()[0] if self._has_table(conn,"dav_catalog_inventory_links") else 0
        return {"total":total,"page":page,"page_size":page_size,"total_pages":max(1,(total+page_size-1)//page_size),"items":items[offset:offset+page_size],"group_stats":group_stats,"registry_revision":self._revision(registry_rows),"inventory_revision":self._revision(inventory_rows),"hospital_stock_drug_count":hospital_stock_drug_count}

    @staticmethod
    def _revision(rows) -> str:
        digest=hashlib.sha256()
        for row in rows:
            digest.update(repr(tuple(row)).encode("utf-8")); digest.update(b"\n")
        return digest.hexdigest()

    def _search_all_candidates(self, query: str, *, active_only: bool, source_mode: str) -> dict[str, Any]:
        # Bounded chunks prevent SQLite parameter limits while retaining the same
        # query semantics. At present the catalog size is below 60k records.
        all_items=[]; page=1
        while True:
            result=self.search(query,page=page,page_size=200,active_only=active_only,source_mode=source_mode)
            all_items.extend(result["items"])
            if page*200 >= result["total"]: return {"total":result["total"],"items":all_items}
            page+=1

    def _list_all_products(self, *, source_mode: str, active_only: bool) -> dict[str,Any]:
        with self._connect() as conn:
            filters="run_id=?"+(" AND is_active=1 AND is_expired=0" if active_only else "")
            rows=conn.execute(f"SELECT national_code FROM dav_catalog_products WHERE {filters} ORDER BY national_code",(self.run_id,)).fetchall()
            all_codes=[row["national_code"] for row in rows]
        items=[]
        for code in all_codes:
            result=self.search(code,page=1,page_size=1,active_only=active_only,source_mode="canonical")
            if result["items"]: items.append(result["items"][0])
        if source_mode=="legacy_compatible":
            with self._connect() as conn:
                linked={row[0] for row in conn.execute("SELECT legacy_drug_id FROM dav_catalog_legacy_links WHERE run_id=?",(self.run_id,))}
                all_legacy=conn.execute("SELECT * FROM dav_national_drugs").fetchall() if self._has_table(conn,"dav_national_drugs") else []
            items.extend({**dict(row),"source_id":"legacy:"+str(row["id"]),"legacy":dict(row),"canonical_ingredients":[],"normalization_flags":[],"hospital_stock_by_unit":[]} for row in all_legacy if row["id"] not in linked)
        return {"total":len(items),"items":items}

    def _list_unfiltered_page(self, *, page: int, page_size: int, active_only: bool, source_mode: str) -> dict[str,Any]:
        with self._connect() as conn:
            where="run_id=?"+(" AND is_active=1 AND is_expired=0" if active_only else "")
            total=conn.execute(f"SELECT COUNT(*) FROM dav_catalog_products WHERE {where}",(self.run_id,)).fetchone()[0]
            order_rows=conn.execute(f"SELECT national_code,brand_name,source_id,'canonical' source_type FROM dav_catalog_products WHERE {where} ORDER BY CASE WHEN national_code='893100110026' THEN 0 ELSE 1 END,brand_name COLLATE NOCASE,national_code LIMIT ? OFFSET ?",(self.run_id,page_size,(page-1)*page_size)).fetchall()
            legacy_rows=[]
            if source_mode=="legacy_compatible" and self._has_table(conn,"dav_national_drugs"):
                legacy_rows=conn.execute("SELECT id,national_code,brand_name FROM dav_national_drugs d WHERE NOT EXISTS (SELECT 1 FROM dav_catalog_legacy_links l WHERE l.run_id=? AND l.legacy_drug_id=d.id) ORDER BY brand_name,national_code LIMIT ? OFFSET ?",(self.run_id,page_size,max(0,(page-1)*page_size-total))).fetchall()
                total+=conn.execute("SELECT COUNT(*) FROM dav_national_drugs d WHERE NOT EXISTS (SELECT 1 FROM dav_catalog_legacy_links l WHERE l.run_id=? AND l.legacy_drug_id=d.id)",(self.run_id,)).fetchone()[0]
            selected=list(order_rows)
            if legacy_rows and len(selected)<page_size:
                canonical_count=total-len(legacy_rows)
                legacy_offset=max(0,(page-1)*page_size-canonical_count)
                selected.extend((row[1],row[2],row[0],"legacy") for row in legacy_rows[legacy_offset:legacy_offset+page_size-len(selected)])
            codes=[row for row in selected if row[3]=="canonical"]
            items=[]
            source_ids=[row[2] for row in codes]
            legacy_by_source={}; stock_by_source={}; inn_by_source={}; clinical_by_source={}
            if source_ids:
                marks=",".join("?" for _ in source_ids)
                for r in conn.execute(f"SELECT l.source_id,d.* FROM dav_catalog_legacy_links l JOIN dav_national_drugs d ON d.id=l.legacy_drug_id WHERE l.run_id=? AND l.source_id IN ({marks}) ORDER BY d.id",[self.run_id,*source_ids]): legacy_by_source.setdefault(r["source_id"],dict(r))
                for r in conn.execute(f"SELECT l.source_id,i.unit,SUM(i.current_stock) quantity,COUNT(*) batch_count FROM dav_catalog_inventory_links l JOIN inventory_batches i ON i.id=l.inventory_batch_id WHERE l.run_id=? AND l.source_id IN ({marks}) AND i.current_stock>0 GROUP BY l.source_id,i.unit",[self.run_id,*source_ids]): stock_by_source.setdefault(r["source_id"],[]).append({"unit":r["unit"] or "Không rõ đơn vị","quantity":int(r["quantity"]),"batch_count":int(r["batch_count"])})
                for r in conn.execute(f"SELECT source_id,canonical_inn FROM dav_ingredient_mappings WHERE run_id=? AND source_id IN ({marks}) AND canonical_inn IS NOT NULL ORDER BY canonical_inn",[self.run_id,*source_ids]): inn_by_source.setdefault(r["source_id"],[]).append(r["canonical_inn"])
                for r in conn.execute(f"SELECT * FROM dav_catalog_clinical_content WHERE run_id=? AND source_id IN ({marks}) ORDER BY monograph_id",[self.run_id,*source_ids]): clinical_by_source.setdefault(r["source_id"],[]).append(r)
            for row in codes:
                product=conn.execute("SELECT * FROM dav_catalog_products WHERE run_id=? AND national_code=?",(self.run_id,row[0])).fetchone()
                if product:
                    sid=product["source_id"]; item=dict(product); item.update({"active_ingredient":item.get("active_ingredient_raw"),"concentration":item.get("strength_raw"),"packaging_spec":item.get("package_spec"),"applicant_name":item.get("applicant"),"country":item.get("manufacturer_country"),"group":"Thuốc điều trị chuyên khoa","canonical_ingredients":inn_by_source.get(sid,[]),"normalization_flags":json.loads(item.get("normalization_flags") or "[]"),"legacy":legacy_by_source.get(sid),"hospital_stock_by_unit":stock_by_source.get(sid,[])})
                    linked=legacy_by_source.get(sid)
                    if linked: item["legacy"]=linked; item.update(linked)
                    clinical_rows = clinical_by_source.get(sid, [])
                    if clinical_rows:
                        clinical = dict(clinical_rows[0])
                        item.update({key: value for key, value in clinical.items() if key not in {"run_id", "source_id", "monograph_id"}})
                        item["clinical_monograph_id"] = clinical["monograph_id"]
                    items.append(item)
            for row in selected:
                if row[3]=="legacy":
                    legacy=conn.execute("SELECT * FROM dav_national_drugs WHERE id=?",(row[2],)).fetchone()
                    item=dict(legacy);item["source_id"]="legacy:"+str(legacy["id"]);item["legacy"]=dict(legacy);item["canonical_ingredients"]=[];item["normalization_flags"]=[]
                    item["hospital_stock_by_unit"]=self._stock_for_registration(conn,legacy["national_code"])
                    items.append(item)
            group_stats={row[0] or "":row[1] for row in conn.execute('SELECT [group],COUNT(*) FROM dav_national_drugs GROUP BY [group]')} if self._has_table(conn,"dav_national_drugs") else {}
            registry_rows=conn.execute('SELECT id,national_code,brand_name,active_ingredient,[group],atc_code FROM dav_national_drugs ORDER BY id').fetchall() if self._has_table(conn,"dav_national_drugs") else []
            inventory_rows=conn.execute('SELECT id,registration_number,current_stock,unit FROM inventory_batches ORDER BY id').fetchall() if self._has_table(conn,"inventory_batches") else []
            stock_count=conn.execute('SELECT COUNT(DISTINCT registration_code_key) FROM dav_catalog_inventory_links WHERE run_id=?',(self.run_id,)).fetchone()[0] if self._has_table(conn,"dav_catalog_inventory_links") else 0
        return {"total":total,"page":page,"page_size":page_size,"total_pages":max(1,(total+page_size-1)//page_size),"items":items,"group_stats":group_stats,"registry_revision":"","inventory_revision":"","hospital_stock_drug_count":stock_count}

    def _stock_for_registration(self, conn, code: str | None):
        if not code or not self._has_table(conn,"inventory_batches"): return []
        key=str(code).strip().casefold()
        rows=conn.execute("SELECT unit,SUM(current_stock),COUNT(*) FROM inventory_batches WHERE lower(trim(registration_number))=? AND current_stock>0 GROUP BY unit ORDER BY unit",(key,)).fetchall()
        return [{"unit":row[0] or "Không rõ đơn vị","quantity":int(row[1]),"batch_count":int(row[2])} for row in rows]

    def _has_table_context(self, term: str) -> bool:
        with self._connect() as conn:
            return self._has_table(conn,"dav_product_search_trigram")

    @staticmethod
    def _has_table(conn, name: str) -> bool:
        return conn.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?",(name,)).fetchone() is not None

    def _stock_for_product(self, conn, source_id: str) -> list[dict[str,Any]]:
        if not self._has_table(conn,"inventory_batches"):
            return []
        rows=conn.execute("SELECT i.unit,SUM(i.current_stock),COUNT(*) FROM dav_catalog_inventory_links l JOIN inventory_batches i ON i.id=l.inventory_batch_id WHERE l.run_id=? AND l.source_id=? AND i.current_stock>0 GROUP BY i.unit ORDER BY i.unit",(self.run_id,source_id)).fetchall()
        return [{"unit":row[0] or "Không rõ đơn vị","quantity":int(row[1]),"batch_count":int(row[2])} for row in rows]
