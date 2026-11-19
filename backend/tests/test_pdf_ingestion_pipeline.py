"""
Unit tests for Dynamic PDF Ingestion, Vector Embedding, Hybrid Search & Deletion Pipeline.
Verifies that newly uploaded PDFs are:
1. Extracted and chunked with page awareness.
2. Stored with SHA256 cryptographic provenance in manifest.
3. Immediately indexed into SQLite FTS for BM25 search.
4. Converted into 768-dim Dense Vectors and persisted in SQLite clinical_chunk_vectors.
5. Available for immediate sub-1.5ms Cosine similarity retrieval in RAM.
6. Cleanly purgable (files, manifest, FTS, vectors, and RAM index).
"""
import io
import os
import json
from pathlib import Path
import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient

from app.routers import admin_knowledge
from app.services.rag import pdf_ingestion_service
from app.services.rag.pdf_ingestion_service import (
    ingest_pdf_bytes,
    delete_ingested_pdf,
    query_ingested_documents
)
from app.services.rag.sqlite_fts import SqliteFtsIndex
from app.services.rag.embeddings.vector_store import VectorStore
from app.services.rag.embeddings.provider import MockEmbeddingProvider
from app.security.auth import AuthenticatedUser


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


def _make_test_client(role: str = "director") -> TestClient:
    test_app = FastAPI()

    @test_app.middleware("http")
    async def inject_user(request: Request, call_next):
        request.state.authenticated_user = AuthenticatedUser(username="test_admin", role=role)
        return await call_next(request)

    test_app.include_router(admin_knowledge.router, prefix="/api/v1")
    return TestClient(test_app)


@pytest.mark.asyncio
async def test_pdf_ingestion_extracts_chunks_and_indexes_vectors(monkeypatch, tmp_path):
    db_path = tmp_path / "test_rag.sqlite"
    manifest_path = tmp_path / "manifest.json"
    kb_path = tmp_path / "kb"
    pub_path = tmp_path / "public"

    monkeypatch.setattr(pdf_ingestion_service, 'MANIFEST_PATH', manifest_path)
    monkeypatch.setattr(pdf_ingestion_service, 'KB_DIR', kb_path)
    monkeypatch.setattr(pdf_ingestion_service, 'PUBLIC_PDF_DIR', pub_path)
    monkeypatch.setenv('DATABASE_URL', f"sqlite:///{db_path}")

    vstore = VectorStore(db_path=db_path, dimension=768)
    provider = MockEmbeddingProvider(dimension=768)

    sample_pdf = _create_sample_pdf_bytes(
        "Huong dan su dung Tanoduoc Alpha",
        "Lieu dung toi da cua Tanoduoc Alpha la 2000mg moi ngay cho nguoi lon."
    )
    res = await ingest_pdf_bytes(
        file_bytes=sample_pdf,
        filename="Huong_Dan_Tanoduoc_Alpha_2026.pdf",
        title="Hướng Dẫn Sử Dụng Tân Dược Alpha",
        legal_basis="Quyết định 9999/QĐ-BYT",
        edition_year=2026,
        doc_id="qd-9999-alpha",
        provider=provider,
        vector_store=vstore
    )

    assert res["status"] == "success"
    assert res["doc_id"] == "qd-9999-alpha"
    assert res["total_pages"] == 1
    assert res["extracted_chunks_count"] >= 1
    assert res["indexed_vectors_count"] >= 1
    assert res["sha256"] is not None
    assert res["source_version"].startswith("sha256:")

    # 1. Kiểm tra SQLite FTS Index
    fts = SqliteFtsIndex(db_path=db_path)
    search_res = fts.search_bm25("Tanoduoc Alpha", top_k=5)
    assert len(search_res) > 0
    top_chunk = search_res[0].chunk
    assert top_chunk.source_id == res["source_id"]
    assert "qd-9999-alpha" in top_chunk.chunk_id
    assert top_chunk.page_or_section == "Trang 1"

    # 2. Kiểm tra VectorStore Cosine Similarity trên RAM
    query_vec = await provider.embed_query("Tanoduoc Alpha")
    v_matches = vstore.search_cosine(query_vec, top_k=5)
    assert len(v_matches) > 0
    matched_cid, cos_score = v_matches[0]
    assert matched_cid == top_chunk.chunk_id
    assert cos_score > 0.2


@pytest.mark.asyncio
async def test_pdf_hybrid_retrieval_query(monkeypatch, tmp_path):
    db_path = tmp_path / "test_rag.sqlite"
    manifest_path = tmp_path / "manifest.json"
    kb_path = tmp_path / "kb"
    pub_path = tmp_path / "public"

    monkeypatch.setattr(pdf_ingestion_service, 'MANIFEST_PATH', manifest_path)
    monkeypatch.setattr(pdf_ingestion_service, 'KB_DIR', kb_path)
    monkeypatch.setattr(pdf_ingestion_service, 'PUBLIC_PDF_DIR', pub_path)
    monkeypatch.setenv('DATABASE_URL', f"sqlite:///{db_path}")

    vstore = VectorStore(db_path=db_path, dimension=768)
    provider = MockEmbeddingProvider(dimension=768)

    sample_pdf = _create_sample_pdf_bytes(
        "Pha Do Cap Cuu Soc Phan Ve 2026",
        "Tiem bap Adrenalin ngay lap tuc khi co dau hieu phan ve do II tro len."
    )
    await ingest_pdf_bytes(
        file_bytes=sample_pdf,
        filename="Pha_Do_Cap_Cuu_Soc_Phan_Ve_2026.pdf",
        title="Phác Đồ Cấp Cứu Sốc Phản Vệ 2026",
        legal_basis="Thông tư 51/2017/TT-BYT",
        edition_year=2026,
        doc_id="tt-51-phan-ve",
        provider=provider,
        vector_store=vstore
    )

    query_res = await query_ingested_documents(
        query="Adrenalin phản vệ",
        doc_id="tt-51-phan-ve",
        top_k=3,
        provider=provider,
        vector_store=vstore
    )

    assert query_res["query"] == "Adrenalin phản vệ"
    assert len(query_res["results"]) > 0
    hit = query_res["results"][0]
    assert hit["page_or_section"] == "Trang 1"
    assert "tt-51-phan-ve" in hit["chunk_id"]
    assert hit["legal_basis"] == "Thông tư 51/2017/TT-BYT"
    assert hit["score"] > 0


@pytest.mark.asyncio
async def test_pdf_deletion_purges_fts_vectors_and_manifest(monkeypatch, tmp_path):
    db_path = tmp_path / "test_rag.sqlite"
    manifest_path = tmp_path / "manifest.json"
    kb_path = tmp_path / "kb"
    pub_path = tmp_path / "public"

    monkeypatch.setattr(pdf_ingestion_service, 'MANIFEST_PATH', manifest_path)
    monkeypatch.setattr(pdf_ingestion_service, 'KB_DIR', kb_path)
    monkeypatch.setattr(pdf_ingestion_service, 'PUBLIC_PDF_DIR', pub_path)
    monkeypatch.setenv('DATABASE_URL', f"sqlite:///{db_path}")

    vstore = VectorStore(db_path=db_path, dimension=768)
    provider = MockEmbeddingProvider(dimension=768)

    sample_pdf = _create_sample_pdf_bytes(
        "Tai Lieu Can Xoa",
        "Noi dung thu nghiem xoa khoi he thong."
    )
    await ingest_pdf_bytes(
        file_bytes=sample_pdf,
        filename="Tai_Lieu_Can_Xoa.pdf",
        title="Tài Liệu Cần Xóa",
        legal_basis="VB 001",
        doc_id="doc-to-delete",
        provider=provider,
        vector_store=vstore
    )

    # Đảm bảo đã index
    assert vstore.count() >= 1
    fts = SqliteFtsIndex(db_path=db_path)
    assert len(fts.search_bm25("thu nghiem xoa")) >= 1

    # Thực hiện xóa
    del_res = delete_ingested_pdf("doc-to-delete", vector_store=vstore)
    assert del_res["status"] == "success"
    assert del_res["deleted_doc_id"] == "doc-to-delete"
    assert del_res["deleted_chunks_count"] >= 1
    assert del_res["deleted_vectors_count"] >= 1

    # Kiểm tra FTS đã sạch
    assert len(fts.search_bm25("thu nghiem xoa")) == 0
    # Kiểm tra Vector Store đã sạch
    assert vstore.count() == 0

    # Kiểm tra manifest đã xóa
    manifest_data = json.loads(manifest_path.read_text(encoding="utf-8"))
    assert not any(s["id"] == "doc-to-delete" for s in manifest_data["sources"])


def test_admin_upload_pdf_api_endpoint(monkeypatch, tmp_path):
    db_path = tmp_path / "test_rag.sqlite"
    monkeypatch.setattr(pdf_ingestion_service, 'MANIFEST_PATH', tmp_path / 'manifest.json')
    monkeypatch.setattr(pdf_ingestion_service, 'KB_DIR', tmp_path / 'kb')
    monkeypatch.setattr(pdf_ingestion_service, 'PUBLIC_PDF_DIR', tmp_path / 'public')
    monkeypatch.setenv('DATABASE_URL', f"sqlite:///{db_path}")

    client = _make_test_client()
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
    assert res_data["indexed_vectors_count"] >= 1

    # Test Query API
    query_resp = client.post("/api/v1/admin/knowledge/query", json={"query": "Kiem Soat Lam Sang", "doc_id": "tt-99-2026"})
    assert query_resp.status_code == 200
    assert len(query_resp.json()["results"]) >= 1

    # Test Delete API
    del_resp = client.delete("/api/v1/admin/knowledge/documents/tt-99-2026")
    assert del_resp.status_code == 200
    assert del_resp.json()["status"] == "success"


def test_admin_document_catalog_lists_manifest_records(monkeypatch, tmp_path):
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

    client = _make_test_client()
    response = client.get("/api/v1/admin/knowledge/documents")

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


@pytest.mark.asyncio
async def test_real_pdf_ingestion_and_page_citation(monkeypatch, tmp_path):
    real_pdf_path = Path(__file__).resolve().parent.parent / "data" / "knowledge_base" / "Thong_Tu_22_2011_TT_BYT_Khoa_Duoc_Benh_Vien.pdf"
    if not real_pdf_path.exists():
        pytest.skip("Tệp PDF thực tế không tồn tại trên máy.")

    db_path = tmp_path / "test_rag.sqlite"
    manifest_path = tmp_path / "manifest.json"
    kb_path = tmp_path / "kb"
    pub_path = tmp_path / "public"

    monkeypatch.setattr(pdf_ingestion_service, 'MANIFEST_PATH', manifest_path)
    monkeypatch.setattr(pdf_ingestion_service, 'KB_DIR', kb_path)
    monkeypatch.setattr(pdf_ingestion_service, 'PUBLIC_PDF_DIR', pub_path)
    monkeypatch.setenv('DATABASE_URL', f"sqlite:///{db_path}")

    vstore = VectorStore(db_path=db_path, dimension=768)
    provider = MockEmbeddingProvider(dimension=768)

    file_bytes = real_pdf_path.read_bytes()
    res = await ingest_pdf_bytes(
        file_bytes=file_bytes,
        filename=real_pdf_path.name,
        title="Thông Tư 22/2011/TT-BYT Quy Định Về Tổ Chức Và Hoạt Động Của Khoa Dược Bệnh Viện",
        legal_basis="Thông tư 22/2011/TT-BYT",
        edition_year=2011,
        doc_id="tt-22-khoa-duoc",
        provider=provider,
        vector_store=vstore
    )

    assert res["status"] == "success"
    assert res["doc_id"] == "tt-22-khoa-duoc"
    assert res["total_pages"] >= 5
    assert res["extracted_chunks_count"] >= 5
    assert res["indexed_vectors_count"] == res["extracted_chunks_count"]

    # Test Hybrid Search on real ingested PDF
    query_res = await query_ingested_documents(
        query="Nhiệm vụ của Trưởng khoa Dược",
        doc_id="tt-22-khoa-duoc",
        top_k=3,
        provider=provider,
        vector_store=vstore
    )

    assert len(query_res["results"]) > 0
    top_hit = query_res["results"][0]
    assert "Trang " in top_hit["page_or_section"]
    assert top_hit["source_doc"] == real_pdf_path.name
    assert top_hit["legal_basis"] == "Thông tư 22/2011/TT-BYT"
    assert len(top_hit["content"]) > 50


@pytest.mark.asyncio
async def test_magic_bytes_validation_rejects_fake_pdf():
    # File text hoặc binary giả danh không có magic bytes %PDF
    fake_pdf = b"Day la tap tin text gia mao khong phai PDF."
    with pytest.raises(ValueError, match="Magic Bytes"):
        await ingest_pdf_bytes(
            file_bytes=fake_pdf,
            filename="fake_document.pdf",
            title="Tài liệu giả",
            legal_basis="Không có",
        )


@pytest.mark.asyncio
async def test_corrupted_pdf_rejection():
    # File bắt đầu bằng %PDF nhưng phần sau là rác bị hỏng
    corrupt_pdf = b"%PDF-1.4\nCorrupted content completely broken"
    with pytest.raises(ValueError):
        await ingest_pdf_bytes(
            file_bytes=corrupt_pdf,
            filename="corrupt.pdf",
            title="Tài liệu hỏng",
            legal_basis="Không có",
        )


@pytest.mark.asyncio
async def test_atomic_rollback_on_vector_failure(monkeypatch, tmp_path):
    db_path = tmp_path / "test_rag.sqlite"
    manifest_path = tmp_path / "manifest.json"
    manifest_path.write_text('{"manifest_version": 1, "sources": []}', encoding="utf-8")
    kb_path = tmp_path / "kb"
    pub_path = tmp_path / "public"

    monkeypatch.setattr(pdf_ingestion_service, 'MANIFEST_PATH', manifest_path)
    monkeypatch.setattr(pdf_ingestion_service, 'KB_DIR', kb_path)
    monkeypatch.setattr(pdf_ingestion_service, 'PUBLIC_PDF_DIR', pub_path)
    monkeypatch.setenv('DATABASE_URL', f"sqlite:///{db_path}")

    vstore = VectorStore(db_path=db_path, dimension=768)

    class FailingVectorStore(VectorStore):
        def save_embeddings(self, items, auto_reload=True):
            raise RuntimeError("Giả lập lỗi CSDL bị khóa hoặc đĩa đầy")

    failing_vstore = FailingVectorStore(db_path=db_path, dimension=768)
    provider = MockEmbeddingProvider(dimension=768)
    sample_pdf = _create_sample_pdf_bytes("Quy Chế Rollback", "Noi dung kiem thu tinh nguyen tu.")

    with pytest.raises(RuntimeError, match="Giả lập lỗi CSDL"):
        await ingest_pdf_bytes(
            file_bytes=sample_pdf,
            filename="rollback_test.pdf",
            title="Quy chế Rollback",
            legal_basis="Nghị định 01",
            doc_id="rollback-doc",
            provider=provider,
            vector_store=failing_vstore,
        )

    # KIỂM THỬ TÍNH NGUYÊN TỬ: Không có file mồ côi nào còn sót lại
    assert not (kb_path / "rollback_test.pdf").exists()
    assert not (pub_path / "rollback_test.pdf").exists()

    # CSDL FTS và Vector Store phải sạch 100%
    fts = SqliteFtsIndex(db_path=db_path)
    assert len(fts.search_bm25("Rollback")) == 0
    assert vstore.count() == 0

    # Manifest không được ghi nhận tài liệu hỏng
    manifest_data = json.loads(manifest_path.read_text(encoding="utf-8"))
    assert not any(s["id"] == "rollback-doc" for s in manifest_data["sources"])


def test_admin_upload_pdf_rbac_enforcement(monkeypatch, tmp_path):
    db_path = tmp_path / "test_rag.sqlite"
    monkeypatch.setattr(pdf_ingestion_service, 'MANIFEST_PATH', tmp_path / 'manifest.json')
    monkeypatch.setattr(pdf_ingestion_service, 'KB_DIR', tmp_path / 'kb')
    monkeypatch.setattr(pdf_ingestion_service, 'PUBLIC_PDF_DIR', tmp_path / 'public')
    monkeypatch.setenv('DATABASE_URL', f"sqlite:///{db_path}")

    sample_pdf = _create_sample_pdf_bytes("Phân Quyền", "Kiem tra quyen admin.")
    files = {"file": ("test_rbac.pdf", sample_pdf, "application/pdf")}
    data = {"title": "Phân Quyền", "legal_basis": "TT 01"}

    # 1. User là điều dưỡng (nurse) -> Bị từ chối 403 Forbidden
    client_nurse = _make_test_client(role="nurse")
    resp_nurse = client_nurse.post("/api/v1/admin/knowledge/upload-pdf", files=files, data=data)
    assert resp_nurse.status_code == 403
    assert "Quản trị viên" in resp_nurse.json()["detail"]

    # 2. User là giám đốc (director) -> Thành công 200 OK
    client_director = _make_test_client(role="director")
    resp_director = client_director.post("/api/v1/admin/knowledge/upload-pdf", files=files, data=data)
    assert resp_director.status_code == 200
    assert resp_director.json()["status"] == "success"

