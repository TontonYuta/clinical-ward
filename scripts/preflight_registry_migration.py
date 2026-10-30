#!/usr/bin/env python3
"""Read-only preflight for additive DAV registry migration."""
from __future__ import annotations
import json,sqlite3
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
LIVE=ROOT/'backend/clinical_hospital.db'
STAGING=ROOT/'artifacts/source-staging-canonical.sqlite'
BACKUP=ROOT/'artifacts/clinical_hospital-pre-cutover.sqlite'
def key(value): return str(value or '').strip().casefold()
def main():
    live=sqlite3.connect(f'file:{LIVE.resolve()}?mode=ro',uri=True); stage=sqlite3.connect(f'file:{STAGING.resolve()}?mode=ro',uri=True); backup=sqlite3.connect(f'file:{BACKUP.resolve()}?mode=ro',uri=True)
    live_rows=live.execute('select id,national_code,brand_name,active_ingredient,concentration,dosage_form,manufacturer,clinical_monograph_id from dav_national_drugs').fetchall()
    stage_rows=stage.execute('select source_id,national_code,brand_name,active_ingredient_raw,strength_raw,dosage_form,manufacturer from normalized_products').fetchall()
    live_codes={key(row[1]):row for row in live_rows}; stage_codes={key(row[1]):row for row in stage_rows}
    matched=set(live_codes)&set(stage_codes); added=set(stage_codes)-set(live_codes); removed=set(live_codes)-set(stage_codes)
    fields={'brand_name':(2,2),'active_ingredient':(3,3),'concentration':(4,4),'dosage_form':(5,5),'manufacturer':(6,6)}
    diffs={name:sum(str(live_codes[k][li] or '').strip().casefold()!=str(stage_codes[k][si] or '').strip().casefold() for k in matched) for name,(li,si) in fields.items()}
    clinical=sum(bool(any(row[i] for i in range(7,8))) for row in live_rows)
    result={'mode':'READ_ONLY_PREFLIGHT','live_db':str(LIVE),'staging_db':str(STAGING),'backup_db':str(BACKUP),'backup_integrity':backup.execute('pragma integrity_check').fetchone()[0],'live_integrity':live.execute('pragma integrity_check').fetchone()[0],'live_records':len(live_rows),'staging_records':len(stage_rows),'matched_by_registration_code':len(matched),'new_staging_codes':len(added),'live_codes_absent_from_staging':len(removed),'matched_field_differences':diffs,'live_rows_with_clinical_monograph_link':clinical,'write_performed':False,'release_gate':'Do not replace or merge production rows until status semantics, source gaps, clinical field preservation, and API pagination equivalence have an approved migration test.'}
    out=ROOT/'artifacts/registry-migration-preflight.json';out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps(result,ensure_ascii=False,indent=2))
    live.close();stage.close();backup.close()
if __name__=='__main__':main()
