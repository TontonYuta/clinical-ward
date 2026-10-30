#!/usr/bin/env python3
import gzip,hashlib,json,sqlite3
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]; RUN='dav-canonical-20261030-v12'
gz=ROOT/'public/data/canonical-drug-catalog.json.gz'; manifest=json.loads((ROOT/'public/data/canonical-drug-catalog.manifest.json').read_text())
assert hashlib.sha256(gz.read_bytes()).hexdigest()==manifest['sha256']
data=json.loads(gzip.decompress(gz.read_bytes()))
db_path=ROOT/'artifacts/clinical_hospital-with-dav-catalog.sqlite'
db=sqlite3.connect('file:'+str(db_path)+'?mode=ro',uri=True)
assert len(data)==db.execute('select count(*) from dav_catalog_products where run_id=?',(RUN,)).fetchone()[0]==manifest['product_count']
codes={x['national_code']:x for x in data}
for code in ('893110151100','893110107400','840110304425'): assert code in codes,code
assert all(product.get('national_code') and product.get('brand_name') for product in data)
missing_ingredients=sum(not product.get('active_ingredient_raw') for product in data)
assert db.execute('pragma integrity_check').fetchone()[0]=='ok'
assert not db.execute('pragma foreign_key_check').fetchall()
print(json.dumps({'products':len(data),'missing_active_ingredient':missing_ingredients,'sha256':manifest['sha256'],'sample_codes':['893110151100','893110107400','840110304425'],'integrity':'ok','foreign_key_errors':0},indent=2))
