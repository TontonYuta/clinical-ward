#!/usr/bin/env python3
import json
from pathlib import Path
from app.services.dav_reconciliation import reconcile_dav_snapshots
ROOT = Path(__file__).resolve().parents[1]
def main():
    snapshot = ROOT / 'artifacts/dav-raw-snapshot'
    manifest = json.loads((snapshot / 'manifest.json').read_text(encoding='utf-8'))
    raw = [row for page in manifest['pages'] for row in json.loads((snapshot / page['path']).read_text(encoding='utf-8'))['result']['items']]
    old = json.loads((ROOT / 'data/vietnam_drug_registry/dav_master_registry.json').read_text(encoding='utf-8'))
    report = reconcile_dav_snapshots(raw, old)
    out = ROOT / 'artifacts/dav-reconciliation.json'
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({key: len(value) if isinstance(value, list) else value for key, value in report.items()}, ensure_ascii=False, indent=2))
    print(out)
if __name__ == '__main__': main()
