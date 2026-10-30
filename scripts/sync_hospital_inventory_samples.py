"""Create 50 hospital inventory samples using exact DAV registry records."""
import gzip
import json
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GZ = ROOT / 'public/data/vietnam_drug_registry/dav_master_registry.json.gz'
JSON = ROOT / 'data/vietnam_drug_registry/dav_master_registry.json'
OUT = ROOT / 'backend/app/seed_inventory_data.py'

def main():
    source = gzip.open(GZ, 'rt', encoding='utf8') if GZ.exists() else JSON.open(encoding='utf8')
    with source as f: drugs = json.load(f)
    ns = {}
    exec(OUT.read_text(encoding='utf8'), ns)
    old_rows = ns['INVENTORY_DATA']
    old = {str(x['national_code']).strip().casefold(): x for x in old_rows}
    by_code = {str(x['nationalCode']).strip().casefold(): x for x in drugs if x.get('nationalCode')}
    codes = list(old)
    for code in by_code:
        if code not in old: codes.append(code)
        if len(codes) == 50: break
    if len(codes) != 50: raise RuntimeError('Could not select 50 unique registry codes')
    rows=[]; today=date.today()
    for n, code in enumerate(codes, 1):
        d=by_code.get(code)
        if not d: raise RuntimeError(f'SĐK not found in DAV registry: {code}')
        o=old.get(code,{})
        rows.append({
            **o, 'id': o.get('id') or f'b-{n}', 'item_name': d.get('brandName') or '',
            'national_code': d['nationalCode'], 'registration_number': d['nationalCode'],
            'active_ingredient': d.get('activeIngredient') or '', 'concentration': d.get('concentration') or '',
            'dosage_form': d.get('dosageForm') or '', 'manufacturer': d.get('manufacturer') or '',
            'country': d.get('country') or 'Quốc tế', 'packaging_spec': d.get('packagingSpec') or '',
            'standard_pharmacopeia': d.get('standardPharmacopeia') or 'NSX', 'shelf_life': d.get('shelfLife') or '36 tháng',
            'applicant_name': d.get('applicantName') or '', 'approval_decision': d.get('approvalDecision') or '',
            'route': d.get('route') or '', 'batch_number': o.get('batch_number') or f'SAMPLE-{n:03d}',
            'category': d.get('group') or 'Thuốc điều trị chuyên khoa',
            'expiry_date': o.get('expiry_date') or (today+timedelta(days=365+n)).isoformat(),
            'days_left': o.get('days_left') or 365+n, 'current_stock': o.get('current_stock') or 100,
            'min_threshold': o.get('min_threshold') or 20, 'max_threshold': o.get('max_threshold') or 500,
            'unit': d.get('standardUnit') or o.get('unit') or 'Đơn vị',
            'warehouse_location': o.get('warehouse_location') or f'Kho Dược (Kệ {chr(65+(n-1)%8)}{(n-1)//8+1})',
            'is_near_expiry': bool(o.get('is_near_expiry',False)), 'is_low_stock': bool(o.get('is_low_stock',False)),
            'is_quarantined': bool(o.get('is_quarantined',False)),
        })
    assert len(set(r['national_code'].casefold() for r in rows)) == 50
    text='"""50 hospital inventory samples with identity fields from DAV registry."""\n\nINVENTORY_DATA = [\n'
    text += '\n'.join('    '+repr(r)+',' for r in rows)+'\n]\n'
    OUT.write_text(text,encoding='utf8')
    print('Wrote 50 hospital inventory samples; every SĐK matched DAV exactly.')

if __name__ == '__main__': main()
