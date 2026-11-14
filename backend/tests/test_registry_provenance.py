import sqlite3

from app.seed_registry_helpers import update_curated_enrichment


def test_curated_enrichment_updates_provenance_to_curated_artifact():
    connection = sqlite3.connect(":memory:")
    connection.execute("CREATE TABLE dav_national_drugs (national_code TEXT, indications TEXT, source_id TEXT, source_version TEXT)")
    connection.execute("INSERT INTO dav_national_drugs VALUES (?, ?, ?, ?)", ("REG-1", None, "base.json.gz", "sha256:base"))
    update_curated_enrichment(connection.cursor(), "backend/tests/fixtures/registry-curated-provenance.json", source_id="curated.json", source_version="sha256:curated")
    assert connection.execute("SELECT indications, source_id, source_version FROM dav_national_drugs").fetchone() == ("fixture indication", "curated.json", "sha256:curated")


def test_curated_enrichment_does_not_relabel_rows_without_updates():
    connection = sqlite3.connect(":memory:")
    connection.execute("CREATE TABLE dav_national_drugs (national_code TEXT, indications TEXT, source_id TEXT, source_version TEXT)")
    connection.execute("INSERT INTO dav_national_drugs VALUES (?, ?, ?, ?)", ("REG-1", None, "base.json.gz", "sha256:base"))
    update_curated_enrichment(connection.cursor(), "backend/tests/fixtures/registry-curated-empty.json", source_id="curated.json", source_version="sha256:curated")
    assert connection.execute("SELECT source_id, source_version FROM dav_national_drugs").fetchone() == ("base.json.gz", "sha256:base")
