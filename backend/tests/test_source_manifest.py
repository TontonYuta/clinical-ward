import hashlib
import json

from app.services.source_manifest import build_manifest


def test_build_manifest_records_hashes_and_counts(tmp_path):
    dav = tmp_path / "dav.json"
    dav.write_text(json.dumps([{"nationalCode": "A"}, {"nationalCode": "B"}], ensure_ascii=False), encoding="utf-8")
    pdf = tmp_path / "duoc.pdf"
    pdf.write_bytes(b"pdf fixture")

    manifest = build_manifest(dav_path=dav, pdf_path=pdf, source_urls={"dav": "https://example.test/dav"})

    assert manifest["sources"]["dav"]["sha256"] == hashlib.sha256(dav.read_bytes()).hexdigest()
    assert manifest["sources"]["dav"]["record_count"] == 2
    assert manifest["sources"]["pdf"]["sha256"] == hashlib.sha256(pdf.read_bytes()).hexdigest()
    assert manifest["sources"]["pdf"]["bytes"] == len(b"pdf fixture")
    assert manifest["manifest_version"] == 2
    assert manifest["sources"]["pdf"]["edition_year"] == 2015
    assert manifest["sources"]["pdf"]["legal_basis"] == "Quyết định 2033/QĐ-BYT"
    assert manifest["policy"]["derived_data_requires_matching_sha256"] is True
