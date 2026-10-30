#!/usr/bin/env python3
"""Export read-only canonical drug catalog data for the Vercel static CDN."""
from __future__ import annotations
import gzip, hashlib, json, sqlite3
from datetime import datetime, timezone
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
DB=ROOT/'artifacts/clinical_hospital-with-dav-catalog.sqlite'
OUT=ROOT/'public/data/canonical-drug-catalog.json.gz'
MANIFEST=ROOT/'public/data/canonical-drug-catalog.manifest.json'
RUN='dav-canonical-20261030-v12'
FIELDS=('source_id','national_code','brand_name','active_ingredient_raw','strength_raw','dosage_form','package_spec','standard_pharmacopeia','shelf_life','manufacturer','manufacturer_country','applicant','approval_date','expiry_date','approval_decision','is_active','is_expired','normalization_flags')
def main():
    if not DB.is_file(): raise SystemExit(f'Canonical DB missing: {DB}')
    conn=sqlite3.connect(f'file:{DB}?mode=ro',uri=True); conn.row_factory=sqlite3.Row
    columns=','.join(FIELDS)
    products=conn.execute(f'SELECT {columns} FROM dav_catalog_products WHERE run_id=? ORDER BY national_code',(RUN,))
    legacy_by_source={}
    for row in conn.execute('SELECT l.source_id,d.* FROM dav_catalog_legacy_links l JOIN dav_national_drugs d ON d.id=l.legacy_drug_id WHERE l.run_id=? ORDER BY d.id',(RUN,)):
        legacy_by_source.setdefault(row['source_id'],dict(row))
    clinical_by_source={}
    for row in conn.execute('SELECT * FROM dav_catalog_clinical_content WHERE run_id=? ORDER BY monograph_id',(RUN,)):
        clinical_by_source.setdefault(row['source_id'],dict(row))
    ingredients_by_source={}
    for row in conn.execute('SELECT source_id,canonical_inn FROM dav_ingredient_mappings WHERE run_id=? AND canonical_inn IS NOT NULL ORDER BY canonical_inn',(RUN,)):
        values=ingredients_by_source.setdefault(row['source_id'],[])
        if row['canonical_inn'] not in values: values.append(row['canonical_inn'])
    OUT.parent.mkdir(parents=True,exist_ok=True)
    count=0
    with OUT.open('wb') as raw, gzip.GzipFile(fileobj=raw,mode='wb',compresslevel=9,mtime=0) as gz:
        gz.write(b'[')
        for product in products:
            row=dict(product); sid=row['source_id']
            legacy=legacy_by_source.get(sid)
            if legacy:
                for key in ('id','route','standard_unit','group','is_controlled','is_high_alert','is_crash_cart','note','hdsd_path','label_path','atc_code','drug_class','indications','contraindications','precautions','pregnancy_warning','adult_dosage','pediatric_dosage','renal_adjustment','hepatic_adjustment','adverse_effects','drug_interactions','overdose_treatment','antidote','clinical_source','clinical_monograph_id'):
                    if key in legacy: row[key]=legacy[key]
            clinical=clinical_by_source.get(sid)
            if clinical:
                for key,value in clinical.items():
                    if key=='source': row['clinical_source']=value
                    elif key=='monograph_id': row['clinical_monograph_id']=value
                    elif value is not None: row[key]=value
            ingredients=ingredients_by_source.get(sid,[])
            row['canonical_ingredients']=ingredients
            if count: gz.write(b',')
            gz.write(json.dumps(row,ensure_ascii=False,separators=(',',':')).encode())
            count+=1
        gz.write(b']')
    conn.close()
    digest=hashlib.sha256(OUT.read_bytes()).hexdigest()
    manifest={'schema_version':1,'run_id':RUN,'generated_at':datetime.now(timezone.utc).isoformat(),'source':'DAV catalog canonical DB derived from DAV portal data with linked clinical monographs','source_db_sha256':hashlib.sha256(DB.read_bytes()).hexdigest(),'product_count':count,'file':'/data/canonical-drug-catalog.json.gz','encoding':'gzip','sha256':digest,'bytes':OUT.stat().st_size,'clinical_interactions_are_source_text':True}
    MANIFEST.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(manifest,ensure_ascii=False,indent=2))
if __name__=='__main__': main()
