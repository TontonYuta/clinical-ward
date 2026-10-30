#!/usr/bin/env python3
from __future__ import annotations
import json,sqlite3
from pathlib import Path
from app.services.staging_drug_catalog import StagingDrugCatalog
ROOT=Path(__file__).resolve().parents[1]

def main():
    db=ROOT/'artifacts/source-staging-canonical.sqlite'; conn=sqlite3.connect(db)
    samples=[r[0] for r in conn.execute("select national_code from normalized_products where national_code is not null order by national_code limit 3")]
    samples += [r[0] for r in conn.execute("select brand_name from normalized_products where brand_name is not null and brand_name <> '' order by brand_name limit 5")]
    samples += ['Acarbose','Paracetamol','thuốc không tồn tại']
    conn.close(); cat=StagingDrugCatalog(db); rows=[]
    for term in samples:
        default=cat.search(term); all_rows=cat.search(term,active_only=False)
        rows.append({'query':term,'canonical_active_total':default['total'],'canonical_all_total':all_rows['total'],'hidden_inactive_or_expired':all_rows['total']-default['total'],'first_codes_active':[x['national_code'] for x in default['items'][:3]],'first_codes_all':[x['national_code'] for x in all_rows['items'][:3]]})
    result={'contract':{'legacy_endpoint_returns_all_registry_rows':True,'canonical_catalog_default_active_only':True,'adapter_requirement':'pass active_only explicitly for production-equivalent behavior'},'queries':rows}
    out=ROOT/'artifacts/registry-query-semantics.json';out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps(result,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
