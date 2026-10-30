import sqlite3
import json

from app.services.dav_catalog_migration import migrate_staging_catalog

def test_migration_preserves_legacy_and_imports_catalog(tmp_path):
    app = tmp_path / 'app.sqlite'
    source = tmp_path / 'source.sqlite'
    out = tmp_path / 'out.sqlite'
    a = sqlite3.connect(app)
    a.executescript('CREATE TABLE dav_national_drugs (id TEXT PRIMARY KEY, national_code TEXT, clinical_monograph_id TEXT, brand_name TEXT, active_ingredient TEXT, note TEXT); INSERT INTO dav_national_drugs VALUES ("old","SDK-1","mono-1","Brand One","Drug A","Legacy Note"); CREATE TABLE clinical_drug_monographs (id TEXT PRIMARY KEY, inn TEXT, drug_interactions TEXT); INSERT INTO clinical_drug_monographs VALUES ("mono-1","Drug A","Do not combine with Drug B");')
    a.commit(); a.close()
    s = sqlite3.connect(source)
    s.executescript('CREATE TABLE source_manifest (source_key TEXT,source_url TEXT,source_path TEXT,sha256 TEXT,byte_count INTEGER,record_count INTEGER); CREATE TABLE source_records (source_key TEXT,source_record_id TEXT,ordinal INTEGER,raw_json TEXT); CREATE TABLE source_record_resolution (source_key TEXT,source_record_id TEXT,national_code_key TEXT,resolution_status TEXT,selected_source_record_id TEXT,resolution_reason TEXT); CREATE TABLE duplicate_registration_groups (national_code_key TEXT,candidate_count INTEGER,selected_source_record_id TEXT,resolution_status TEXT,resolution_reason TEXT); CREATE TABLE normalized_products (source_id TEXT,national_code TEXT,brand_name TEXT,active_ingredient_raw TEXT,strength_raw TEXT,dosage_form TEXT,package_spec TEXT,standard_pharmacopeia TEXT,shelf_life TEXT,manufacturer TEXT,manufacturer_country TEXT,applicant TEXT,applicant_country TEXT,approval_date TEXT,expiry_date TEXT,approval_decision TEXT,is_active INTEGER,is_expired INTEGER,normalization_flags TEXT); CREATE TABLE product_ingredients (source_id TEXT,ingredient_ordinal INTEGER,name_raw TEXT,strength_raw TEXT,parse_status TEXT,review_reason TEXT); CREATE TABLE product_ingredient_mappings (source_id TEXT,ingredient_ordinal INTEGER,raw_name TEXT,canonical_inn TEXT,atc_code_raw TEXT,mapping_status TEXT,match_type TEXT); CREATE TABLE ingredients (canonical_inn TEXT,atc_code_raw TEXT,source_title TEXT);')
    s.execute('INSERT INTO source_manifest VALUES (?,?,?,?,?,?)', ('dav','url','path','hash',1,1)); s.execute('INSERT INTO source_records VALUES (?,?,?,?)', ('dav','1',1,'{}')); s.execute('INSERT INTO source_record_resolution VALUES (?,?,?,?,?,?)', ('dav','1','sdk-1','unique','1','unique')); s.execute('INSERT INTO normalized_products VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', ('1','SDK-1','Brand','Drug','10mg','tablet',None,None,None,'Maker',None,None,None,None,None,None,1,0,'[]')); s.commit(); s.close()
    result = migrate_staging_catalog(source_db=source, app_db=app, output_db=out, run_id='run-1')
    c = sqlite3.connect(out)
    assert c.execute('SELECT COUNT(*) FROM dav_national_drugs').fetchone()[0] == 1
    assert c.execute('SELECT COUNT(*) FROM dav_catalog_products').fetchone()[0] == 1
    assert c.execute('SELECT national_code FROM dav_catalog_products').fetchone()[0] == 'SDK-1'
    assert result['imported_products'] == 1
    assert result['ingredient_mapping_rows'] == 0
    assert result['mapped_ingredient_rows'] == 0
    assert c.execute("SELECT clinical_monograph_id FROM dav_national_drugs WHERE id='old'").fetchone()[0] == 'mono-1'
    link = c.execute("SELECT legacy_drug_id,clinical_monograph_id FROM dav_catalog_legacy_links WHERE national_code_key='sdk-1'").fetchone()
    assert link == ('old', 'mono-1')
    legacy_link_index = c.execute("PRAGMA index_list(dav_catalog_legacy_links)").fetchall()
    assert any(index[1] == 'ix_dav_catalog_legacy_links_legacy' for index in legacy_link_index)
    assert c.execute("SELECT COUNT(*) FROM dav_product_search WHERE dav_product_search MATCH 'Brand*'").fetchone()[0] == 1
    c.close()

def test_migration_refuses_existing_output(tmp_path):
    for name in ('app.sqlite','source.sqlite'):
        sqlite3.connect(tmp_path/name).close()
    out = tmp_path/'out.sqlite'; out.write_bytes(b'existing')
    try:
        migrate_staging_catalog(source_db=tmp_path/'source.sqlite', app_db=tmp_path/'app.sqlite', output_db=out, run_id='run-1')
    except FileExistsError:
        pass
    else:
        raise AssertionError('expected FileExistsError')

def test_unresolved_duplicate_raw_records_are_kept_but_not_canonical(tmp_path):
    app=tmp_path/'app.sqlite'; source=tmp_path/'source.sqlite'; out=tmp_path/'out.sqlite'
    sqlite3.connect(app).close()
    s=sqlite3.connect(source)
    s.executescript('CREATE TABLE source_manifest (source_key TEXT,source_url TEXT,source_path TEXT,sha256 TEXT,byte_count INTEGER,record_count INTEGER); CREATE TABLE source_records (source_key TEXT,source_record_id TEXT,ordinal INTEGER,raw_json TEXT); CREATE TABLE source_record_resolution (source_key TEXT,source_record_id TEXT,national_code_key TEXT,resolution_status TEXT,selected_source_record_id TEXT,resolution_reason TEXT); CREATE TABLE duplicate_registration_groups (national_code_key TEXT,candidate_count INTEGER,selected_source_record_id TEXT,resolution_status TEXT,resolution_reason TEXT); CREATE TABLE normalized_products (source_id TEXT,national_code TEXT,brand_name TEXT,active_ingredient_raw TEXT,strength_raw TEXT,dosage_form TEXT,package_spec TEXT,standard_pharmacopeia TEXT,shelf_life TEXT,manufacturer TEXT,manufacturer_country TEXT,applicant TEXT,applicant_country TEXT,approval_date TEXT,expiry_date TEXT,approval_decision TEXT,is_active INTEGER,is_expired INTEGER,normalization_flags TEXT); CREATE TABLE product_ingredients (source_id TEXT,ingredient_ordinal INTEGER,name_raw TEXT,strength_raw TEXT,parse_status TEXT,review_reason TEXT); CREATE TABLE product_ingredient_mappings (source_id TEXT,ingredient_ordinal INTEGER,raw_name TEXT,canonical_inn TEXT,atc_code_raw TEXT,mapping_status TEXT,match_type TEXT); CREATE TABLE ingredients (canonical_inn TEXT,atc_code_raw TEXT,source_title TEXT);')
    s.execute('INSERT INTO source_manifest VALUES (?,?,?,?,?,?)',('dav','url','path','hash',1,2))
    s.executemany('INSERT INTO source_records VALUES (?,?,?,?)',[('dav','a',1,'{}'),('dav','b',2,'{}')])
    s.executemany('INSERT INTO source_record_resolution VALUES (?,?,?,?,?,?)',[('dav','a','dup','unresolved',None,'tie'),('dav','b','dup','unresolved',None,'tie')])
    s.execute('INSERT INTO duplicate_registration_groups VALUES (?,?,?,?,?)',('dup',2,None,'unresolved','tie'))
    s.commit();s.close()
    migrate_staging_catalog(source_db=source,app_db=app,output_db=out,run_id='r')
    c=sqlite3.connect(out)
    assert c.execute('SELECT COUNT(*) FROM dav_source_records').fetchone()[0]==2
    assert c.execute('SELECT COUNT(*) FROM dav_duplicate_groups WHERE resolution_status="unresolved"').fetchone()[0]==1
    assert c.execute('SELECT COUNT(*) FROM dav_catalog_products').fetchone()[0]==0
    c.close()
