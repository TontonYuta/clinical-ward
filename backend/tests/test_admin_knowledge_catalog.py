import json

from app.routers.admin_knowledge import build_document_catalog


def test_catalog_includes_only_manifest_documents_and_preserves_nested_urls(tmp_path):
    pdf_root = tmp_path / "pdf"
    (pdf_root / "bhyt").mkdir(parents=True)
    (pdf_root / "Thong_Tu_36_2018_TT_BYT_GSP.pdf").write_bytes(b"pdf")
    (pdf_root / "bhyt" / "Nghi_Dinh_146_2018.pdf").write_bytes(b"pdf")
    manifest = tmp_path / "manifest.json"
    manifest.write_text(json.dumps({"sources": [{
        "id": "nd-146", "title": "Nghị định 146/2018",
        "legal_basis": "Nghị định 146/2018/NĐ-CP",
        "public_path": "public/pdf/bhyt/Nghi_Dinh_146_2018.pdf",
        "category": "Nghị định", "edition_year": 2018,
    }]}), encoding="utf-8")

    documents = build_document_catalog(manifest, pdf_root)

    assert len(documents) == 1
    assert documents[0]["public_url"] == "/api/v1/pdf/bhyt/Nghi_Dinh_146_2018.pdf"
    assert documents[0]["title"] == "Nghị định 146/2018"
    assert documents[0]["category"] == "Nghị định"


def test_catalog_excludes_unregistered_internal_pdf(tmp_path):
    pdf_root = tmp_path / "pdf"
    pdf_root.mkdir()
    (pdf_root / "clinical-report.pdf").write_bytes(b"report")
    manifest = tmp_path / "manifest.json"
    manifest.write_text('{"sources":[]}', encoding="utf-8")

    assert build_document_catalog(manifest, pdf_root) == []


def test_catalog_includes_registered_medical_pdfs_but_not_unregistered_internal_reports(tmp_path):
    from pathlib import Path

    project_root = Path(__file__).resolve().parents[2]
    documents = build_document_catalog(
        project_root / "backend/data/knowledge_base/clinical_source_manifest.json",
        project_root / "public/pdf",
    )
    assert len(documents) == 15
    assert any(document["filename"] == "Duoc_Thu_Quoc_Gia_Viet_Nam.pdf" for document in documents)
    assert any(document["filename"] == "Thong_Tu_36_2018_TT_BYT_GSP.pdf" for document in documents)
    assert not any(document["filename"] == "BAO_CAO_THAM_DINH_LAM_SANG_CPOE_AI.pdf" for document in documents)
    assert not any(document["id"] in {"qd-9999-alpha", "tt-99-2026"} for document in documents)
    assert not any(document["filename"] in {"Huong_Dan_Tanoduoc_Alpha_2026.pdf", "Thong_Tu_99_2026_TT_BYT.pdf"} for document in documents)
