"""
End-to-End Verification Test:
Đảm bảo tài liệu nạp mới vào CSDL đạt 100% độ chính xác, truy xuất Top 1,
trích dẫn chính xác số trang/văn bản và trả về đúng nội dung cần thiết cho người dùng
như các chuyên luận có sẵn ban đầu.
"""
import io
import pytest
from pathlib import Path
from pypdf import PdfWriter

from app.services.rag.types import RagChunk
from app.services.rag.sqlite_fts import SqliteFtsIndex
from app.services.rag.embeddings.vector_store import VectorStore
from app.services.rag.embeddings.provider import MockEmbeddingProvider
from app.services.rag.hybrid_retriever import HybridRetriever
from app.services.rag.rag_pipeline import execute_clinical_rag, reload_rag_retriever
from app.services.rag import pdf_ingestion_service
from app.services.chatbot.pure_rag_handler import handle_deep_rag_consultation


def _create_icu_protocol_pdf() -> bytes:
    writer = PdfWriter()
    writer.add_blank_page(width=595, height=842)
    stream = io.BytesIO()
    writer.write(stream)
    stream.seek(0)
    pdf_bytes = stream.getvalue()

    protocol_text = (
        "QUY TRINH KIEM SOAT NHIEM KHUAN VA BAO QUAN THIET BI THO ICU\n"
        "Dieu 12. Quy trinh tiet trung bo day may tho va mang loc khuan:\n"
        "1. Toan bo day tho silicon phai duoc ngam trong dung dich khuan Cloramin B 0.5% trong 30 phut.\n"
        "2. Mang loc khuan HEPA phai duoc thay the moi 48 gio hoac ngay khi co dau hieu tac nghen ap luc.\n"
        "3. Nhiet do bao quan thiet bi tho du phong tai phong dem ICU duy tri tu 20 den 25 do C, do am duoi 60%."
    )
    # Patch text extraction for test
    from unittest.mock import MagicMock
    return pdf_bytes, protocol_text


@pytest.mark.asyncio
async def test_end_to_end_ingested_knowledge_retrieval_and_copilot_chat(monkeypatch, tmp_path):
    db_path = tmp_path / "test_clinical.sqlite"
    manifest_path = tmp_path / "clinical_source_manifest.json"
    kb_path = tmp_path / "kb"
    pub_path = tmp_path / "public"

    monkeypatch.setattr(pdf_ingestion_service, 'MANIFEST_PATH', manifest_path)
    monkeypatch.setattr(pdf_ingestion_service, 'KB_DIR', kb_path)
    monkeypatch.setattr(pdf_ingestion_service, 'PUBLIC_PDF_DIR', pub_path)
    monkeypatch.setenv('DATABASE_URL', f"sqlite:///{db_path}")

    # Patch manifest path in source_resolver to use our test manifest
    import app.services.rag.source_resolver as sr
    monkeypatch.setattr(sr, '_SOURCE_MANIFEST_PATH', manifest_path)

    vstore = VectorStore(db_path=db_path, dimension=768)
    provider = MockEmbeddingProvider(dimension=768)

    # 1. Chuẩn bị file PDF mẫu và nạp vào CSDL
    pdf_raw_bytes, protocol_content = _create_icu_protocol_pdf()

    import pypdf
    class MockPdfPage:
        def extract_text(self):
            return protocol_content
    class MockPdfReader:
        def __init__(self, stream):
            self.pages = [MockPdfPage()]

    monkeypatch.setattr(pypdf, 'PdfReader', MockPdfReader)

    ingest_result = await pdf_ingestion_service.ingest_pdf_bytes(
        file_bytes=pdf_raw_bytes,
        filename="Quy_Trinh_Bao_Quan_May_Tho_ICU_2026.pdf",
        title="Quy Trình Bảo Quản Thiết Bị Thở ICU 2026",
        legal_basis="Thông tư 88/2026/TT-BYT",
        edition_year=2026,
        doc_id="tt-88-icu-ventilator",
        category="Quy trình hồi sức cấp cứu",
        provider=provider,
        vector_store=vstore
    )

    assert ingest_result["status"] == "success"
    assert ingest_result["extracted_chunks_count"] >= 1
    assert ingest_result["indexed_vectors_count"] >= 1

    # 2. Khởi tạo HybridRetriever với cùng vstore và provider
    fts = SqliteFtsIndex(db_path=db_path)
    retriever = HybridRetriever(
        fts_index=fts,
        vector_store=vstore,
        embedding_provider=provider
    )

    # 3. Test Truy Xuất Đạt 100% Top #1 (Hybrid Retrieval Performance)
    test_query = "Theo Thông tư 88/2026 quy định tiệt trùng bộ dây máy thở ICU như thế nào?"
    retrieved = retriever.retrieve(query=test_query, top_k=5)

    assert len(retrieved) > 0, "Phải truy xuất được tài liệu mới nạp"
    top_hit = retrieved[0]
    assert "tt-88-icu-ventilator" in top_hit.chunk.chunk_id
    assert top_hit.chunk.legal_basis == "Thông tư 88/2026/TT-BYT"
    assert top_hit.chunk.page_or_section == "Trang 1"
    assert top_hit.chunk.entity_type == "regulatory_pdf"
    assert "Cloramin B" in top_hit.chunk.content or "ngam trong dung dich" in top_hit.chunk.content

    # 4. Test RAG Pipeline Execution & Citation Grounding
    import app.services.rag.rag_pipeline as rp
    monkeypatch.setattr(rp, "get_rag_retriever", lambda: retriever)

    rag_result = await execute_clinical_rag(
        query=test_query,
        user_role="nurse"
    )

    assert rag_result.rag_grounded is True, "Kết quả RAG phải grounded 100%"
    assert len(rag_result.citations) >= 1
    citation = rag_result.citations[0]
    assert citation.legal_basis == "Thông tư 88/2026/TT-BYT"
    assert citation.section == "Trang 1"
    assert citation.page == 1
    assert "Quy_Trinh_Bao_Quan_May_Tho_ICU_2026.pdf" in citation.url
    assert citation.url.endswith("#page=1")

    # 5. Test Chatbot Pure RAG Handler End-to-End
    copilot_resp = await handle_deep_rag_consultation(
        query=test_query,
        lower_query=test_query.casefold(),
        user_role="nurse",
        history="",
        session_id="test_session_icu_123",
        user_name="Điều dưỡng Hoa",
        is_deep_pharmacology=False
    )

    assert copilot_resp is not None
    assert copilot_resp.rag_grounded is True
    assert copilot_resp.answer_type == "grounded_reference"
    assert len(copilot_resp.citations) >= 1
    assert copilot_resp.citations[0]["legal_basis"] == "Thông tư 88/2026/TT-BYT"
    assert copilot_resp.citations[0]["page"] == 1
    assert "Cloramin B" in copilot_resp.reply_text or "máy thở" in copilot_resp.reply_text.casefold() or "dây thở" in copilot_resp.reply_text.casefold()
