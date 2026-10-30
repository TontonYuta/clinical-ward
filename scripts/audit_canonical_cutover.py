#!/usr/bin/env python3
"""Audit canonical vs legacy coverage before a full registry cutover."""
from __future__ import annotations
import json, sqlite3
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
DB=ROOT/'artifacts/clinical_hospital-local-canonical.sqlite'
RUN='dav-canonical-local-20261030-v12'
def main():
    conn=sqlite3.connect(f'file:{DB.resolve()}?mode=ro',uri=True); conn.row_factory=sqlite3.Row
    q={}
    q['legacy_products']=conn.execute('select count(*) from dav_national_drugs').fetchone()[0]
    q['canonical_products']=conn.execute('select count(*) from dav_catalog_products where run_id=?',(RUN,)).fetchone()[0]
    q['canonical_legacy_links']=conn.execute('select count(*) from dav_catalog_legacy_links where run_id=?',(RUN,)).fetchone()[0]
    q['unlinked_legacy_products']=conn.execute('select count(*) from dav_national_drugs d where not exists (select 1 from dav_catalog_legacy_links l where l.run_id=? and l.legacy_drug_id=d.id)',(RUN,)).fetchone()[0]
    q['canonical_missing_active_ingredient']=conn.execute("select count(*) from dav_catalog_products where run_id=? and (active_ingredient_raw is null or trim(active_ingredient_raw)='')",(RUN,)).fetchone()[0]
    q['canonical_products_with_interactions']=conn.execute("select count(distinct source_id) from dav_catalog_clinical_content where run_id=? and length(trim(coalesce(drug_interactions,'')))>0",(RUN,)).fetchone()[0]
    q['high_risk_products_with_interactions']=conn.execute("select count(*) from dav_national_drugs where (is_controlled=1 or is_high_alert=1 or is_crash_cart=1) and length(trim(coalesce(drug_interactions,'')))>0").fetchone()[0]
    q['mapped_ingredient_rows']=conn.execute('select count(*) from dav_ingredient_mappings where run_id=? and canonical_inn is not null',(RUN,)).fetchone()[0]
    q['unmapped_ingredient_rows']=conn.execute('select count(*) from dav_ingredient_mappings where run_id=? and canonical_inn is null',(RUN,)).fetchone()[0]
    q['inventory_batches']=conn.execute('select count(*) from inventory_batches').fetchone()[0]
    q['linked_inventory_batches']=conn.execute('select count(distinct inventory_batch_id) from dav_catalog_inventory_links where run_id=?',(RUN,)).fetchone()[0]
    q['clinical_monographs']=conn.execute('select count(*) from clinical_drug_monographs').fetchone()[0]
    q['linked_clinical_products']=conn.execute('select count(distinct source_id) from dav_catalog_clinical_content where run_id=?',(RUN,)).fetchone()[0]
    blockers=[]
    if q['unlinked_legacy_products']: blockers.append('unlinked legacy products require reconciliation')
    if q['canonical_missing_active_ingredient']: blockers.append('canonical products missing active ingredient')
    if q['unmapped_ingredient_rows']: blockers.append('unmapped ingredient rows require reviewed mapping')
    blockers.append('structured interaction rules are not yet reviewed')
    result={'run_id':RUN,'database':str(DB),'integrity_check':conn.execute('pragma integrity_check').fetchone()[0],'foreign_key_errors':len(conn.execute('pragma foreign_key_check').fetchall()),'counts':q,'unlinked_legacy_samples':[dict(r) for r in conn.execute('select d.national_code,d.brand_name,d.active_ingredient from dav_national_drugs d where not exists (select 1 from dav_catalog_legacy_links l where l.run_id=? and l.legacy_drug_id=d.id) order by d.national_code',(RUN,))],'interaction_model':'source_text_only','interaction_structured_pair_count':0,'interaction_note':'Không tự chuyển văn bản chuyên luận thành cặp chống chỉ định; cần review dược sĩ trước khi tạo rule máy.','cutover_blockers':blockers,'ready_for_full_cutover':False}
    out=ROOT/'artifacts/canonical-cutover-audit.json'; out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8'); print(json.dumps(result,ensure_ascii=False,indent=2)); conn.close()
if __name__=='__main__': main()
