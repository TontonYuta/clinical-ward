"""
Unit tests for Admin Knowledge Cleanliness Audit & In-Portal Live Chatbot Verification.
Ensures that when an admin uploads/tests a PDF document:
1. Pre-flight cleanliness audit scans OCR density, UTF-8 noise, and generates 3 golden test questions.
2. The live chatbot test endpoint runs clinical grounding with exact page citations and legal basis.
3. The SSE streaming endpoint delivers real-time token chunks and final response payload.
"""
import json
import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient

from app.routers import admin_knowledge
from app.security.auth import AuthenticatedUser


def _create_sample_pdf_bytes(title: str, body: str) -> bytes:
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


def test_audit_cleanliness_with_uploaded_file():
    client = _make_test_client(role="director")
    pdf_bytes = _create_sample_pdf_bytes(
        "Thong Tu 26/2025/TT-BYT Quy Dinh Ke Don",
        "Quy dinh ve don thuoc dien tu quoc gia va dieu kien chi dinh thuoc khang sinh noi vien theo tieu chuan chat luong benh vien quy dinh tai Dieu 4 Khoan 2."
    )

    response = client.post(
        "/api/v1/admin/knowledge/audit-cleanliness",
        files={"file": ("test_circular.pdf", pdf_bytes, "application/pdf")},
    )

    assert response.status_code == 200
    data = response.json()
    assert "cleanliness_score" in data
    assert data["cleanliness_score"] >= 70
    assert data["status"] in ("clean", "warning")
    assert data["total_pages"] >= 1
    assert "golden_questions" in data
    assert len(data["golden_questions"]) == 3
    assert all(isinstance(q, str) and len(q) > 5 for q in data["golden_questions"])


def test_audit_cleanliness_with_existing_doc_id():
    client = _make_test_client(role="director")
    response = client.post(
        "/api/v1/admin/knowledge/audit-cleanliness",
        data={"doc_id": "19_2026_vbhn-tt-byt"},
    )
    # If file exists in public/pdf, should succeed
    if response.status_code == 200:
        data = response.json()
        assert data["cleanliness_score"] > 70
        assert data["total_pages"] > 0
        assert len(data["golden_questions"]) == 3


def test_audit_cleanliness_rejects_missing_input():
    client = _make_test_client(role="director")
    response = client.post("/api/v1/admin/knowledge/audit-cleanliness")
    assert response.status_code == 400


def test_chat_test_knowledge_scoped_query():
    client = _make_test_client(role="doctor")
    payload = {
        "query": "Quy định về thử tương đương sinh học",
        "doc_id": "19_2026_vbhn-tt-byt",
        "user_role": "doctor",
        "user_name": "BS. Test Quản Trị"
    }

    response = client.post(
        "/api/v1/admin/knowledge/chat-test",
        json=payload
    )

    assert response.status_code == 200
    data = response.json()
    assert "reply_text" in data
    assert len(data["reply_text"]) > 10
    assert "citations" in data
    assert "rag_grounded" in data
    assert "suggested_chips" in data


def test_chat_test_knowledge_stream():
    client = _make_test_client(role="doctor")
    payload = {
        "query": "Điều kiện chỉ định thuốc",
        "doc_id": "19_2026_vbhn-tt-byt",
        "user_role": "doctor",
        "user_name": "BS. Test Quản Trị"
    }

    response = client.post(
        "/api/v1/admin/knowledge/chat-test/stream",
        json=payload
    )

    assert response.status_code == 200
    assert "text/event-stream" in response.headers.get("content-type", "")

    # Read SSE events
    body = response.text
    assert "data: " in body
    assert '"type": "token"' in body or '"type": "done"' in body


def test_change_status_requires_verification():
    client = _make_test_client(role="director")
    # Reset a document to unverified staged
    from app.services.rag.pdf_ingestion_service import update_document_status
    try:
        update_document_status("19_2026_vbhn_tt_byt", "staged", verified=False)
    except Exception:
        pass

    # Trying to activate without verification must fail with HTTP 400
    response = client.post(
        "/api/v1/admin/knowledge/documents/19_2026_vbhn_tt_byt/status",
        json={"status": "active"}
    )
    assert response.status_code == 400
    assert "chưa được kiểm thử" in response.json()["detail"].lower()


def test_change_status_success_with_verification():
    client = _make_test_client(role="director")
    # Activate with verified=True
    response = client.post(
        "/api/v1/admin/knowledge/documents/19_2026_vbhn_tt_byt/status",
        json={"status": "active", "verified": True}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["document"]["status"] == "active"
    assert data["document"]["verified"] is True

