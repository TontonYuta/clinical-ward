"""
Unit tests for Step 6: Dynamic PDF Ingestion Pipeline & Provenance Verification.
Verifies that newly uploaded PDFs are extracted, chunked with page awareness,
stored with SHA256 provenance in manifest, and immediately searchable in SQLite FTS.
"""
import io
import tempfile
from pathlib import Path
import pytest
from pypdf import PdfWriter
from fastapi.testclient import TestClient

from app.main import app
from app.services.rag.pdf_ingestion_service import ingest_pdf_bytes
from app.services.rag.sqlite_fts import SqliteFtsIndex


def _create_sample_pdf_bytes(title: str, body: str) -> bytes:
    # Minimal standard valid PDF with real text in content stream
    t_bytes = title.encode("ascii", "ignore")
    b_bytes = body.encode("ascii", "ignore")
    stream_content = b"BT /F1 12 Tf 50 700 Td (" + t_bytes + b") Tj 0 -20 Td (" + b_bytes + b") Tj ET\n"
    stream_len = str(len(stream_content)).encode("ascii")
    
    pdf_content = (
        b"%PDF-1.4\n"
        b"1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n"
        b"2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n"
        b"3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj\n"
        b"4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n"
        b"5 0 obj << /Length " + stream_len + b" >> stream\n" + stream_content + b"endstream\nendobj\n"
        b"xref\n0 6\n0000000000 65535 f \n"
        b"0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000228 00000 n \n0000000299 00000 n \n"
        b"trailer << /Size 6 /Root 1 0 R >>\nstartxref\n470\n%%EOF\n"
    )
    return pdf_content


def test_pdf_ingestion_service_extracts_and_indexes_chunks(monkeypatch, tmp_path):
    from app.services.rag import pdf_ingestion_service
    from app.services.rag.sqlite_fts import SqliteFtsIndex

    monkeypatch.setattr(pdf_ingestion_service, 'MANIFEST_PATH', tmp_path / 'manifest.json')
    monkeypatch.setattr(pdf_ingestion_service, 'KB_DIR', tmp_path / 'kb')
    monkeypatch.setattr(pdf_ingestion_service, 'PUBLIC_PDF_DIR', tmp_path / 'public')
    monkeypatch.setenv('DATABASE_URL', f"sqlite:///{tmp_path / 'upload-test.sqlite'}")
    monkeypatch.setenv('DATABASE_URL', f"sqlite:///{tmp_path / 'test.sqlite'}")
    sample_pdf = _create_sample_pdf_bytes(
        "Huong dan su dung Tanoduoc Alpha",
        "Lieu dung toi da cua Tanoduoc Alpha la 2000mg moi ngay cho nguoi lon."
    )
    res = ingest_pdf_bytes(
        file_bytes=sample_pdf,
        filename="Huong_Dan_Tanoduoc_Alpha_2026.pdf",
        title="Hướng Dẫn Sử Dụng Tân Dược Alpha",
        legal_basis="Quyết định 9999/QĐ-BYT",
        edition_year=2026,
        doc_id="qd-9999-alpha"
    )

    assert res["status"] == "success"
    assert res["doc_id"] == "qd-9999-alpha"
    assert res["total_pages"] == 1
    assert res["extracted_chunks_count"] >= 1
    assert res["sha256"] is not None
    assert res["source_version"].startswith("sha256:")
    assert "Huong_Dan_Tanoduoc_Alpha_2026.pdf" in res["source_id"]

    # Kiểm tra truy vấn FTS tức thì
    fts = SqliteFtsIndex()
    search_res = fts.search_bm25("Tanoduoc Alpha", top_k=5)
    assert len(search_res) > 0
    top = search_res[0]
    assert top.chunk.source_id == res["source_id"]
    assert top.chunk.source_version == res["source_version"]
    assert "qd-9999-alpha" in top.chunk.chunk_id


def test_admin_upload_pdf_api_endpoint(monkeypatch, tmp_path):
    from app.services.rag import pdf_ingestion_service

    monkeypatch.setattr(pdf_ingestion_service, 'MANIFEST_PATH', tmp_path / 'manifest.json')
    monkeypatch.setattr(pdf_ingestion_service, 'KB_DIR', tmp_path / 'kb')
    monkeypatch.setattr(pdf_ingestion_service, 'PUBLIC_PDF_DIR', tmp_path / 'public')
    client = TestClient(app)
    sample_pdf = _create_sample_pdf_bytes(
        "Thong Tu 99 Kiem Soat Lam Sang",
        "Tat ca bac si can kiem tra 5 dung truoc khi phat thuoc."
    )
    files = {
        "file": ("Thong_Tu_99_2026_TT_BYT.pdf", sample_pdf, "application/pdf")
    }
    data = {
        "title": "Thông tư 99/2026/TT-BYT Kiểm Soát Lâm Sàng",
        "legal_basis": "Thông tư 99/2026/TT-BYT",
        "edition_year": "2026",
        "doc_id": "tt-99-2026"
    }
    response = client.post("/api/v1/admin/knowledge/upload-pdf", files=files, data=data)
    assert response.status_code == 200
    res_data = response.json()
    assert res_data["status"] == "success"
    assert res_data["doc_id"] == "tt-99-2026"
    assert res_data["extracted_chunks_count"] >= 1


def test_admin_document_catalog_lists_manifest_records(monkeypatch, tmp_path):
    from app.routers import admin_knowledge

    manifest = tmp_path / "clinical_source_manifest.json"
    manifest.write_text(
        '{"sources":[{"id":"tt-99-2026","title":"Thông tư 99/2026",'
        '"legal_basis":"TT 99/2026","edition_year":2026,"public_path":'
        '"public/pdf/TT_99_2026.pdf","sha256":"abc","bytes":123}]}',
        encoding="utf-8",
    )
    pdf_root = tmp_path / "pdf"
    pdf_root.mkdir()
    (pdf_root / "TT_99_2026.pdf").write_bytes(b"pdf")
    monkeypatch.setattr(admin_knowledge, "_manifest_path", lambda: manifest)
    monkeypatch.setattr(admin_knowledge, "_public_pdf_dir", lambda: pdf_root)

    response = TestClient(app).get("/api/v1/admin/knowledge/documents")

    assert response.status_code == 200
    assert response.json()["documents"] == [{
        "id": "tt-99-2026",
        "title": "Thông tư 99/2026",
        "legal_basis": "TT 99/2026",
        "category": "Văn bản y tế",
        "edition_year": 2026,
        "filename": "TT_99_2026.pdf",
        "public_url": "/api/v1/pdf/TT_99_2026.pdf",
        "sha256": "abc",
        "bytes": 123,
    }]
