import json
import sqlite3

from app.services.drug_db_audit import audit_drug_database


def test_audit_reports_missing_source_and_combination_products_without_mutating_inputs(tmp_path):
    db_path = tmp_path / "drugs.sqlite"
    conn = sqlite3.connect(db_path)
    conn.execute("CREATE TABLE dav_national_drugs (id TEXT, national_code TEXT, brand_name TEXT, active_ingredient TEXT, dosage_form TEXT, concentration TEXT, manufacturer TEXT, clinical_source TEXT, indications TEXT, contraindications TEXT, adult_dosage TEXT, drug_interactions TEXT)")
    conn.execute("INSERT INTO dav_national_drugs VALUES ('1','A1','Brand','Drug A + Drug B','tablet','10mg','Maker',NULL,NULL,NULL,NULL,'Raises risk')")
    conn.execute("CREATE TABLE clinical_drug_monographs (id TEXT, inn TEXT, source TEXT, atc_code TEXT, indications TEXT, contraindications TEXT, adult_dosage TEXT, pediatric_dosage TEXT, drug_interactions TEXT)")
    conn.execute("INSERT INTO clinical_drug_monographs VALUES ('M1','Drug A',NULL,NULL,NULL,NULL,NULL,NULL,NULL)")
    conn.commit()
    conn.close()
    source_path = tmp_path / "source.json"
    source_path.write_text(json.dumps([{"inn": "Drug A", "drug_interactions": "Other", "start_page": 3}]), encoding="utf-8")

    report = audit_drug_database(db_path, source_path)

    flags = report["review_queue"][0]["flags"]
    assert "possible_combination_product" in flags
    assert "interaction_text_without_source" in flags
    assert report["database"]["products_with_interaction_text"] == 1
    readonly = sqlite3.connect(f"file:{db_path.resolve()}?mode=ro", uri=True)
    assert readonly.execute("SELECT COUNT(*) FROM dav_national_drugs").fetchone()[0] == 1
    readonly.close()
