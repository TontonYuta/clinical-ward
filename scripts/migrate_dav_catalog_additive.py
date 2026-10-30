#!/usr/bin/env python3
from __future__ import annotations
import argparse, hashlib, json, sqlite3
from datetime import datetime, timezone
from pathlib import Path
from app.services.dav_catalog_migration import migrate_staging_catalog
ROOT=Path(__file__).resolve().parents[1]
def sha(path:Path)->str:
    h=hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda:f.read(1024*1024),b''): h.update(chunk)
    return h.hexdigest()
def main():
    p=argparse.ArgumentParser(description='Import canonical DAV staging into additive tables in a copy of the app DB')
    p.add_argument('--source',type=Path,default=ROOT/'artifacts/source-staging-canonical.sqlite')
    p.add_argument('--app-db',type=Path,default=ROOT/'backend/clinical_hospital.db')
    p.add_argument('--output',type=Path,default=ROOT/'artifacts/clinical_hospital-with-dav-catalog.sqlite')
    p.add_argument('--run-id',default=datetime.now(timezone.utc).strftime('dav-%Y%m%dT%H%M%SZ'))
    args=p.parse_args(); live_hash_before=sha(args.app_db)
    report=migrate_staging_catalog(source_db=args.source,app_db=args.app_db,output_db=args.output,run_id=args.run_id)
    c=sqlite3.connect(f'file:{args.output.resolve()}?mode=ro',uri=True)
    report.update({'created_at':datetime.now(timezone.utc).isoformat(),'app_db_sha256_before':live_hash_before,'app_db_sha256_after':sha(args.app_db),'app_db_unchanged':live_hash_before==sha(args.app_db),'legacy_product_count':c.execute('select count(*) from dav_national_drugs').fetchone()[0],'legacy_clinical_link_count':c.execute('select count(*) from dav_national_drugs where clinical_monograph_id is not null').fetchone()[0],'source_rows_imported':c.execute('select count(*) from dav_source_records where run_id=?',(args.run_id,)).fetchone()[0],'unresolved_duplicate_groups':c.execute("select count(*) from dav_duplicate_groups where run_id=? and resolution_status='unresolved'",(args.run_id,)).fetchone()[0],'code_query_plan':[list(row) for row in c.execute('explain query plan select * from dav_catalog_products where run_id=? and national_code=?',(args.run_id,'SDK-EXAMPLE'))],'fts_query_plan':[list(row) for row in c.execute('explain query plan select source_id from dav_product_search where dav_product_search match ?',(args.run_id+' Brand*',))]})
    report['write_performed_on_live_db']=False
    c.close(); out=ROOT/'artifacts/dav-catalog-migration-report.json';out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps(report,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
