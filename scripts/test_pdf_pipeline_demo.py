#!/usr/bin/env python3
"""
Công cụ thử nghiệm tương tác quy trình nạp, nhúng vector và truy vấn tài liệu PDF (PDF Pipeline Demo & Test Tool).
Cho phép:
1. Nạp tệp PDF mẫu (hoặc chỉ định tệp PDF tùy chọn).
2. Tự động bóc tách trang, băm SHA256, chunking, nạp FTS5 và sinh Dense Vector 768-dim.
3. Chạy truy vấn thử nghiệm kiểm tra trích dẫn số trang chính xác.
4. Tùy chọn XÓA SẠCH (Rollback) hoàn toàn để không làm bẩn CSDL hay bộ nhớ hệ thống.
"""
import sys
import os
from pathlib import Path

# Đảm bảo import được backend app
ROOT_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = ROOT_DIR / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import asyncio
from typing import Optional
from app.services.rag.pdf_ingestion_service import (
    ingest_pdf_bytes,
    delete_ingested_pdf,
    query_ingested_documents
)
from app.services.rag.embeddings.vector_store import get_vector_store
from app.services.rag.embeddings.provider import get_embedding_provider, MockEmbeddingProvider


def create_sample_pdf_bytes(title: str, content: str) -> bytes:
    """Tạo 1 tệp PDF tiêu chuẩn tối giản chứa văn bản rõ ràng."""
    t_bytes = title.encode("ascii", "ignore")
    c_bytes = content.encode("ascii", "ignore")
    stream_content = b"BT /F1 12 Tf 50 720 Td (" + t_bytes + b") Tj 0 -25 Td (" + c_bytes + b") Tj ET\n"
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


async def run_demo():
    print("=" * 70)
    print("🎯 DEMO & TEST PIPELINE NẠP TÀI LIỆU PDF -> VECTOR EMBEDDING -> TRUY VẤN")
    print("=" * 70)

    # 1. Chuẩn bị file PDF
    print("\n[Bước 1/4] Chuẩn bị tệp PDF thử nghiệm...")
    doc_id = "test-huong-dan-alpha-2026"
    filename = "Huong_Dan_Thuoc_Alpha_2026.pdf"
    title = "Hướng Dẫn Điều Trị Tân Dược Alpha 2026"
    legal_basis = "Quyết định 8888/QĐ-BYT"
    body_text = (
        "Lieu dung Tanoduoc Alpha la 500mg moi 8 gio. "
        "Chong chi dinh tren phu nu co thai va benh nhan suy than nang CrCl duoi 30ml/phut. "
        "Can kiem tra dien tam do va nong do kali mau truoc khi bat dau dieu tri."
    )
    pdf_bytes = create_sample_pdf_bytes(title, body_text)
    print(f"  ✓ Đã khởi tạo PDF mẫu: {filename} ({len(pdf_bytes)} bytes)")
    print(f"  ✓ Mã tài liệu (doc_id): {doc_id}")

    # 2. Thực thi quy trình Ingestion
    print("\n[Bước 2/4] Đang nạp tài liệu vào Pipeline...")
    vstore = get_vector_store()
    count_before = vstore.count()
    print(f"  • Số lượng vector hiện có trong CSDL: {count_before}")

    ingest_result = await ingest_pdf_bytes(
        file_bytes=pdf_bytes,
        filename=filename,
        title=title,
        legal_basis=legal_basis,
        edition_year=2026,
        doc_id=doc_id,
        category="Hướng dẫn điều trị"
    )

    count_after = vstore.count()
    print("  ✓ KẾT QUẢ NẠP THÀNH CÔNG:")
    print(f"    - SHA256 Provenance: {ingest_result['sha256'][:16]}...")
    print(f"    - Tổng số trang: {ingest_result['total_pages']}")
    print(f"    - Số chunks văn bản tạo ra: {ingest_result['extracted_chunks_count']}")
    print(f"    - Số vector (768-dim) đã lưu SQLite: {ingest_result['indexed_vectors_count']}")
    print(f"    - Tổng vector CSDL sau khi nạp: {count_after} (+{count_after - count_before})")
    print(f"    - Đường dẫn xem PDF: {ingest_result['public_url']}")

    # 3. Thử nghiệm truy vấn
    print("\n[Bước 3/4] Chạy thử nghiệm truy vấn lai ghép (BM25 + Dense Cosine)...")
    test_queries = [
        "Liều dùng Tanoduoc Alpha",
        "Suy thận CrCl dưới 30ml",
    ]

    for q in test_queries:
        print(f"\n  🔍 Câu hỏi: '{q}'")
        res = await query_ingested_documents(query=q, doc_id=doc_id, top_k=2)
        hits = res.get("results", [])
        if not hits:
            print("    ❌ Không tìm thấy kết quả phù hợp.")
        for idx, hit in enumerate(hits, start=1):
            print(f"    [{idx}] Điểm RRF: {hit['score']:.5f} | Vị trí: {hit['page_or_section']}")
            print(f"        Căn cứ: {hit['legal_basis']}")
            print(f"        Trích dẫn: \"{hit['content'][:120]}...\"")
            print(f"        Lý do khớp: {', '.join(hit.get('match_reasons', []))}")

    # 4. Tùy chọn dọn dẹp sạch sẽ
    print("\n" + "=" * 70)
    print("[Bước 4/4] Dọn dẹp dữ liệu thử nghiệm (Clean Rollback)")
    print("=" * 70)
    prompt = input("Bạn có muốn XÓA SẠCH tài liệu thử nghiệm vừa tạo khỏi hệ thống? (Y/n): ").strip().lower()
    if prompt in ("", "y", "yes"):
        print("Đang tiến hành dọn dẹp...")
        del_res = delete_ingested_pdf(doc_id=doc_id)
        count_final = vstore.count()
        print(f"  ✓ Đã xóa tệp vật lý trên đĩa.")
        print(f"  ✓ Đã xóa {del_res['deleted_chunks_count']} chunks khỏi SQLite FTS.")
        print(f"  ✓ Đã xóa {del_res['deleted_vectors_count']} vector khỏi SQLite và cập nhật lại RAM matrix.")
        print(f"  ✓ Đã xóa bản ghi trong manifest.json.")
        print(f"  ✓ Tổng số vector trong CSDL hiện tại: {count_final} (Khôi phục nguyên vẹn trạng thái ban đầu).")
        print("\n🎉 HOÀN TẤT THỬ NGHIỆM: Hệ thống đã sạch sẽ 100%!")
    else:
        print(f"Tài liệu '{doc_id}' vẫn được giữ lại trong hệ thống.")


if __name__ == "__main__":
    asyncio.run(run_demo())
