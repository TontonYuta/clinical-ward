import sqlite3
from pathlib import Path
from app.services.dav_catalog_reader import DavCatalogReader

def make_db(path: Path):
    c=sqlite3.connect(path)
    c.executescript("""
    CREATE TABLE dav_catalog_runs (run_id TEXT PRIMARY KEY,status TEXT);
    INSERT INTO dav_catalog_runs VALUES ('r','ready');
    CREATE TABLE dav_catalog_products (run_id TEXT,source_id TEXT,national_code TEXT,brand_name TEXT,active_ingredient_raw TEXT,is_active INTEGER,is_expired INTEGER,normalization_flags TEXT,PRIMARY KEY(run_id,source_id),UNIQUE(run_id,national_code));
    INSERT INTO dav_catalog_products VALUES ('r','1','SDK-1','Brand One','Drug A',1,0,'[]');
    INSERT INTO dav_catalog_products VALUES ('r','2','SDK-2','Old Brand','Drug B',0,0,'[]');
    CREATE VIRTUAL TABLE dav_product_search USING fts5(run_id UNINDEXED,source_id UNINDEXED,national_code,brand_name,active_ingredients,tokenize='unicode61 remove_diacritics 2');
    INSERT INTO dav_product_search VALUES ('r','1','SDK-1','Brand One','Drug A Paracetamol');
    INSERT INTO dav_product_search VALUES ('r','2','SDK-2','Old Brand','Drug B');
    CREATE VIRTUAL TABLE dav_product_search_trigram USING fts5(run_id UNINDEXED,source_id UNINDEXED,national_code,brand_name,active_ingredients,note,tokenize='trigram');
    INSERT INTO dav_product_search_trigram VALUES ('r','1','SDK-1','Brand One','Drug A Paracetamol','Legacy Note XYZ');
    INSERT INTO dav_product_search_trigram VALUES ('r','2','SDK-2','Old Brand','Drug B','');
    CREATE TABLE dav_ingredient_mappings (run_id TEXT,source_id TEXT,ingredient_ordinal INTEGER,canonical_inn TEXT);
    INSERT INTO dav_ingredient_mappings VALUES ('r','1',1,'Paracetamol');
    CREATE TABLE dav_catalog_legacy_links (run_id TEXT,source_id TEXT,legacy_drug_id TEXT,national_code_key TEXT,clinical_monograph_id TEXT);
    CREATE TABLE dav_national_drugs (id TEXT PRIMARY KEY,national_code TEXT,brand_name TEXT,active_ingredient TEXT,"group" TEXT,clinical_monograph_id TEXT,note TEXT,atc_code TEXT,drug_interactions TEXT,clinical_source TEXT);
    INSERT INTO dav_national_drugs VALUES ('legacy-1','SDK-1','Brand One','Paracetamol','Legacy Group','mono-1','','N02B01','Legacy interaction','LegacySource');
    INSERT INTO dav_national_drugs VALUES ('legacy-2','LEG-9','Hidden Brand','Legacy only ingredient','Legacy Group',NULL,'',NULL,NULL,NULL);
    INSERT INTO dav_catalog_legacy_links VALUES ('r','1','legacy-1','sdk-1','mono-1');
    CREATE TABLE inventory_batches (id TEXT PRIMARY KEY,registration_number TEXT,current_stock INTEGER,unit TEXT);
    INSERT INTO inventory_batches VALUES ('batch-1','SDK-1',7,'viên');
    CREATE TABLE dav_catalog_inventory_links (run_id TEXT,source_id TEXT,inventory_batch_id TEXT,registration_code_key TEXT);
    INSERT INTO dav_catalog_inventory_links VALUES ('r','1','batch-1','sdk-1');
    CREATE TABLE dav_catalog_clinical_content (run_id TEXT,source_id TEXT,monograph_id TEXT,drug_class TEXT,indications TEXT,contraindications TEXT,precautions TEXT,pregnancy_warning TEXT,adverse_effects TEXT,adult_dosage TEXT,pediatric_dosage TEXT,renal_adjustment TEXT,hepatic_adjustment TEXT,drug_interactions TEXT,overdose_treatment TEXT,antidote TEXT,source TEXT);
    INSERT INTO dav_catalog_clinical_content VALUES ('r','1','mono-1','class','indication','contra','precaution','pregnancy','adverse','adult','pediatric','renal','hepatic','Avoid Drug B','overdose','antidote','DTQG');
    """); c.commit();c.close()

def test_reader_exact_fts_and_explicit_run(tmp_path):
    db=tmp_path/'db.sqlite';make_db(db); reader=DavCatalogReader(db,'r')
    assert reader.search('SDK-1')['items'][0]['national_code']=='SDK-1'
    exact = reader.search('SDK-1')
    assert exact['total'] == 1
    assert exact['items'][0]['source_id'] == '1'
    assert exact['items'][0]['legacy']['group'] == 'Legacy Group'
    assert exact['items'][0]['hospital_stock_by_unit'] == [{'unit':'viên','quantity':7,'batch_count':1}]
    assert exact['items'][0]['drug_interactions'] == 'Legacy interaction'
    assert reader.search('Brand')['items'][0]['brand_name']=='Brand One'
    assert reader.search('and O')['total']==1
    assert reader.search('Note XYZ')['items'][0]['national_code']=='SDK-1'
    assert reader.search('Paracetamol')['items'][0]['canonical_ingredients']==['Paracetamol']
    assert reader.search('Brand',active_only=True)['total']==1
    assert reader.search('Brand',active_only=False)['total']==2
    assert reader.search('Brand',source_mode='legacy_compatible')['total']==3
    assert reader.search('Legacy only',source_mode='legacy_compatible')['items'][0]['national_code']=='LEG-9'
    result = reader.list_registry(search='Brand', group='Legacy Group', page=1, page_size=10, source_mode='legacy_compatible')
    assert result['total'] == 2
    assert result['items'][0]['national_code'] == 'SDK-1'
    assert result['items'][0]['drug_interactions'] == 'Legacy interaction'
    unfiltered = reader.list_registry(page=1,page_size=10,source_mode='canonical')
    assert unfiltered['total'] == 2
    assert len(unfiltered['items']) == 2
    assert unfiltered['items'][0]['drug_interactions'] == 'Avoid Drug B'
    legacy_unfiltered = reader.list_registry(page=1,page_size=10,source_mode='legacy_compatible')
    assert legacy_unfiltered['total'] == 3
    assert {x['national_code'] for x in legacy_unfiltered['items']} == {'SDK-1','SDK-2','LEG-9'}
    stock_filtered = reader.list_registry(only_in_warehouse=True,source_mode='legacy_compatible')
    assert stock_filtered['total'] == 1
    assert stock_filtered['items'][0]['national_code'] == 'SDK-1'
    pharm_filtered = reader.list_registry(pharm_group='fever_pain',source_mode='legacy_compatible')
    assert pharm_filtered['total'] == 1
    second_page = reader.search('Brand',page=2,page_size=1,source_mode='legacy_compatible')
    assert second_page['total'] == 3
    assert len(second_page['items']) == 1
    assert reader.list_registry(page=1,page_size=10,source_mode='canonical')['total'] == 2

def test_reader_rejects_non_ready_run(tmp_path):
    db=tmp_path/'db.sqlite';make_db(db)
    c=sqlite3.connect(db);c.execute("UPDATE dav_catalog_runs SET status='loading'");c.commit();c.close()
    try: DavCatalogReader(db,'r')
    except ValueError as exc: assert 'ready' in str(exc)
    else: raise AssertionError('expected non-ready run rejection')
