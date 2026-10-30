#!/usr/bin/env python3
"""Build a deduplicated DAV raw snapshot using reviewed winner proposals."""
from __future__ import annotations
import argparse,csv,hashlib,json,os
from datetime import datetime
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--input',type=Path,default=ROOT/'artifacts/dav-raw-snapshot')
    parser.add_argument('--resolution',type=Path,default=ROOT/'artifacts/dav-duplicate-resolution.csv')
    parser.add_argument('--out',type=Path,default=ROOT/'artifacts/dav-raw-resolved')
    args=parser.parse_args()
    manifest_path=args.input/'manifest.json'; manifest=json.loads(manifest_path.read_text(encoding='utf-8')); groups={}
    for page in manifest['pages']:
        payload=json.loads((args.input/page['path']).read_text(encoding='utf-8'))
        for row in (payload.get('result') or {}).get('items') or []:
            groups.setdefault(str(row.get('soDangKy') or '').strip().casefold(),[]).append(row)
    decisions={}
    for row in csv.DictReader(args.resolution.open(encoding='utf-8-sig')):
        decisions[row['registration_code'].strip().casefold()]=row
    kept=[]; unresolved=[]
    for code, candidates in groups.items():
        if not code or len(candidates)==1:
            kept.extend(candidates); continue
        decision=decisions.get(code)
        if not decision or decision.get('proposed_status')!='proposed_winner':
            unresolved.append({'registration_code':candidates[0].get('soDangKy'),'source_ids':[x.get('id') for x in candidates]})
            kept.extend(candidates); continue
        winner=next((x for x in candidates if str(x.get('id'))==decision.get('proposed_source_id')),None)
        if winner is None:
            unresolved.append({'registration_code':candidates[0].get('soDangKy'),'source_ids':[x.get('id') for x in candidates],'reason':'proposed_source_id_not_found'}); kept.extend(candidates)
        else: kept.append(winner)
    args.out.mkdir(parents=True,exist_ok=True); pages_dir=args.out/'pages';pages_dir.mkdir(exist_ok=True)
    # A single immutable payload preserves original DAV rows exactly; the manifest
    # records that this derivative is a resolved view of the original snapshot.
    payload={'result':{'items':kept,'totalCount':len(kept)}}
    raw=json.dumps(payload,ensure_ascii=False,indent=2)+'\n'; path=pages_dir/'page-000001.json';tmp=path.with_suffix('.json.tmp');tmp.write_text(raw,encoding='utf-8');os.replace(tmp,path)
    output={'manifest_version':1,'source':manifest.get('source'),'captured_at':manifest.get('captured_at'),'derived_at':datetime.now().astimezone().isoformat(),'derived_from':str(args.input.resolve()),'derivation':'duplicate SĐK groups use explicit proposed winners; unresolved groups retained in full','records':len(kept),'input_records':manifest.get('records'),'duplicate_groups':sum(len(v)>1 for v in groups.values()),'unresolved_duplicate_groups':len(unresolved),'pages':[{'page':1,'skip_count':0,'requested_count':len(kept),'returned_count':len(kept),'path':'pages/page-000001.json','sha256':hashlib.sha256(raw.encode()).hexdigest()}]}
    tmp_manifest=args.out/'manifest.json.tmp';tmp_manifest.write_text(json.dumps(output,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');os.replace(tmp_manifest,args.out/'manifest.json')
    (ROOT/'artifacts/dav-duplicate-unresolved.json').write_text(json.dumps(unresolved,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(output,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
