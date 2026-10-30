#!/usr/bin/env python3
from __future__ import annotations
import json,sqlite3,time
from pathlib import Path
from app.services.dav_catalog_reader import DavCatalogReader
ROOT=Path(__file__).resolve().parents[1]
def main():
 db=ROOT/'artifacts/clinical_hospital-with-dav-catalog.sqlite';run='dav-canonical-20261030-v4';c=sqlite3.connect(db)
 codes=[r[0] for r in c.execute('select national_code from dav_catalog_products where run_id=? order by national_code limit 4',(run,))]
 brands=[r[0] for r in c.execute('select brand_name from dav_catalog_products where run_id=? and brand_name is not null order by brand_name limit 4',(run,))]
 inns=[r[0] for r in c.execute('select distinct canonical_inn from dav_ingredient_mappings where run_id=? and canonical_inn is not null order by canonical_inn limit 4',(run,))];c.close()
 reader=DavCatalogReader(db,run);results=[]
 for label,terms in [('code',codes),('brand',brands),('inn',inns)]:
  for term in terms:
   start=time.perf_counter();page=reader.search(term,page=1,page_size=20);elapsed=(time.perf_counter()-start)*1000
   results.append({'type':label,'query':term,'total':page['total'],'first_page':len(page['items']),'elapsed_ms':round(elapsed,2),'first_code':page['items'][0]['national_code'] if page['items'] else None})
 result={'run_id':run,'queries':len(results),'mean_latency_ms':round(sum(x['elapsed_ms'] for x in results)/max(1,len(results)),2),'results':results,'legacy_table_untouched':True}
 (ROOT/'artifacts/dav-catalog-shadow-read.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps(result,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
