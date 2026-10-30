#!/usr/bin/env python3
"""Propose deterministic winners for duplicate DAV registration codes."""
from __future__ import annotations
import csv, json
from collections import defaultdict
from datetime import datetime
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]

def code(v): return str(v or '').strip().casefold()
def dt(v):
    try: return datetime.fromisoformat(str(v).replace('Z','+00:00'))
    except Exception: return datetime.min
def score(row):
    # Active, non-expired, non-deleted records are preferred. A later source
    # modification wins only after status; ties remain explicitly reviewable.
    return (int(row.get('isDeleted') is not True), int(row.get('isDaRutSoDangKy') is not True), int(row.get('isHetHan') is not True), int(row.get('isActive') is True), dt(row.get('lastModificationTime')), dt(row.get('creationTime')))
def main():
    manifest=ROOT/'artifacts/dav-raw-snapshot/manifest.json'; m=json.loads(manifest.read_text(encoding='utf-8')); groups=defaultdict(list)
    for page in m['pages']:
        payload=json.loads((manifest.parent/page['path']).read_text(encoding='utf-8'))
        for row in (payload.get('result') or {}).get('items') or []:
            if code(row.get('soDangKy')): groups[code(row['soDangKy'])].append(row)
    rows=[]
    for reg, items in sorted(groups.items()):
        if len(items)<2: continue
        ranked=sorted(items,key=lambda row:(score(row),str(row.get('id') or '')),reverse=True); top=ranked[0]; second=ranked[1]; same=score(top)==score(second)
        reason='manual_review_tie' if same else ('active_nonexpired_latest_update' if top.get('isActive') is True and top.get('isHetHan') is not True else 'status_priority')
        rows.append({'registration_code':top.get('soDangKy'),'candidate_count':len(items),'proposed_source_id':'' if same else top.get('id'),'proposed_status': 'review' if same else 'proposed_winner','reason':reason,'candidate_ids':','.join(str(x.get('id')) for x in ranked),'candidate_statuses':json.dumps([{'id':x.get('id'),'active':x.get('isActive'),'expired':x.get('isHetHan'),'deleted':x.get('isDeleted'),'withdrawn':x.get('isDaRutSoDangKy'),'updated':x.get('lastModificationTime')} for x in ranked],ensure_ascii=False)})
    out=ROOT/'artifacts/dav-duplicate-resolution.csv'
    with out.open('w',newline='',encoding='utf-8-sig') as f:
        w=csv.DictWriter(f,fieldnames=list(rows[0]) if rows else ['registration_code']);w.writeheader();w.writerows(rows)
    summary={'duplicate_code_groups':len(rows),'proposed_winners':sum(x['proposed_status']=='proposed_winner' for x in rows),'manual_review':sum(x['proposed_status']=='review' for x in rows),'output':str(out)}
    (ROOT/'artifacts/dav-duplicate-resolution.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n',encoding='utf-8'); print(json.dumps(summary,ensure_ascii=False,indent=2))
if __name__=='__main__': main()
