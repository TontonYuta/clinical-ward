#!/usr/bin/env python3
"""Compare raw and canonical staging catalogs without touching application DB."""
from __future__ import annotations
import json, sqlite3, time
from pathlib import Path
from app.services.staging_drug_catalog import StagingDrugCatalog
ROOT=Path(__file__).resolve().parents[1]

def codes(path):
    c=sqlite3.connect(path)
    rows=c.execute("select national_code,is_active,is_expired from normalized_products where national_code is not null").fetchall(); c.close()
    return {str(code).strip().casefold(): (active,expired) for code,active,expired in rows}
def main():
    raw=ROOT/'artifacts/source-staging-raw.sqlite'; canonical=ROOT/'artifacts/source-staging-canonical.sqlite'
    raw_codes=codes(raw); canonical_codes=codes(canonical)
    conn=sqlite3.connect(canonical); terms=[r[0] for r in conn.execute("select brand_name from normalized_products where brand_name is not null and brand_name <> '' order by source_id limit 3")] + [r[0] for r in conn.execute("select canonical_inn from product_ingredient_mappings where canonical_inn is not null order by canonical_inn limit 3")] ; conn.close()
    searches=[]
    catalog=StagingDrugCatalog(canonical)
    for term in terms:
        start=time.perf_counter(); result=catalog.search(term); elapsed=(time.perf_counter()-start)*1000
        searches.append({'query':term,'total':result['total'],'returned':len(result['items']),'elapsed_ms':round(elapsed,2)})
    status_changes=[{'national_code':k,'raw':raw_codes.get(k),'canonical':canonical_codes.get(k)} for k in sorted(set(raw_codes)&set(canonical_codes)) if raw_codes[k]!=canonical_codes[k]]
    result={'raw_products':len(raw_codes),'canonical_products':len(canonical_codes),'raw_distinct_codes':len(raw_codes),'canonical_distinct_codes':len(canonical_codes),'codes_removed_from_catalog':len(set(raw_codes)-set(canonical_codes)),'codes_added_to_catalog':len(set(canonical_codes)-set(raw_codes)),'active_code_delta':len({k for k,v in raw_codes.items() if v==(1,0)} ^ {k for k,v in canonical_codes.items() if v==(1,0)}),'status_changed_codes':status_changes,'canonical_integrity':sqlite3.connect(canonical).execute('pragma integrity_check').fetchone()[0],'search_samples':searches}
    out=ROOT/'artifacts/staging-catalog-shadow.json'; out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8'); print(json.dumps(result,ensure_ascii=False,indent=2))
if __name__=='__main__': main()
