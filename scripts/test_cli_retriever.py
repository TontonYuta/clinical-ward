#!/usr/bin/env python3
"""
CLI Tool để Bác sĩ / Kỹ sư kiểm thử trực tiếp Bộ Truy Xuất Lai Đa Tầng (Hybrid Dense-Sparse RAG).
Cách dùng:
    .venv/bin/python scripts/test_cli_retriever.py "câu hỏi y khoa của bạn"
Hoặc chạy chế độ tương tác:
    .venv/bin/python scripts/test_cli_retriever.py
"""
import sys
import os
from pathlib import Path

# Thêm thư mục backend vào sys.path
backend_dir = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

from app.services.rag.hybrid_retriever import HybridRetriever
from app.services.clinical_ddi_engine.entity_resolution import resolve_registered_medications


def run_query_inspect(retriever: HybridRetriever, query: str, top_k: int = 5):
    print("=" * 80)
    print(f"🔍 CÂU HỎI TRUY VẤN: \"{query}\"")
    print("=" * 80)

    # 1. Phân tích thực thể thuốc qua Trie
    detected_drugs = resolve_registered_medications(query)
    print(f"💊 Thực thể thuốc nhận diện (Aho-Corasick Trie): {detected_drugs if detected_drugs else 'Không có (Truy vấn triệu chứng / Chuyên đề)'}")

    # 2. Truy xuất tài liệu qua Hybrid Retriever
    results = retriever.retrieve(query, top_k=top_k)

    print(f"\n📚 TÌM THẤY {len(results)} TÀI LIỆU Y VĂN PHÙ HỢP NHẤT:")
    print("-" * 80)

    if not results:
        print("⚠️ Không tìm thấy tài liệu phù hợp trong CSDL.")
        return

    for rank, r in enumerate(results, 1):
        c = r.chunk
        bm25_info = f"#{r.bm25_rank}" if r.bm25_rank else "Không khớp FTS"
        dense_info = f"#{r.semantic_rank}" if r.semantic_rank else "Không khớp Vector"

        print(f"\n[TOP {rank}] {c.title}")
        print(f"   • Chunk ID: {c.chunk_id}")
        print(f"   • Nguồn pháp lý / Căn cứ: {c.legal_basis or c.source_doc} (Mục: {c.page_or_section})")
        print(f"   • Phân loại: {c.entity_type.upper()}")
        print(f"   • Điểm RRF Fusion: {r.score:.5f}")
        print(f"   • Xếp hạng chi tiết: BM25 FTS5={bm25_info} | Dense Vector 768-dim={dense_info}")
        print(f"   • Lý do xếp hạng: {', '.join(r.match_reasons)}")
        
        # In trích đoạn nội dung
        snippet = c.content.strip().replace("\n", " ")
        if len(snippet) > 200:
            snippet = snippet[:200] + "..."
        print(f"   • Trích đoạn y văn: {snippet}")

    print("\n" + "=" * 80 + "\n")


def main():
    print("\n⚡ Đang nạp Bộ Truy Xuất Lai Đa Tầng (Vector In-Memory + SQLite FTS5)...")
    retriever = HybridRetriever()
    print(f"✅ Đã nạp thành công {len(retriever.all_chunks)} chunks y văn & ma trận vector vào RAM.\n")

    if len(sys.argv) > 1:
        query = " ".join(sys.argv[1:])
        run_query_inspect(retriever, query)
    else:
        print("💬 CHẾ ĐỘ TƯƠNG TÁC TRỰC TIẾP (Gõ câu hỏi y khoa hoặc 'exit' để thoát):")
        demo_queries = [
            "Paracetamol cho phụ nữ có thai",
            "liều dùng amoxicillin cho trẻ em",
            "bệnh nhân đau đầu ê ẩm kèm sốt cao cần thuốc hạ nhiệt",
            "cách uống thuốc metformin",
            "tương tác giữa metformin và thuốc cản quang iod"
        ]
        print("💡 Gợi ý một số câu hỏi mẫu:")
        for q in demo_queries:
            print(f"   - {q}")
        print()

        while True:
            try:
                user_input = input("Nhập câu hỏi > ").strip()
                if not user_input:
                    continue
                if user_input.lower() in ("exit", "quit", "q"):
                    print("Tạm biệt!")
                    break
                run_query_inspect(retriever, user_input)
            except (KeyboardInterrupt, EOFError):
                print("\nĐã thoát.")
                break


if __name__ == "__main__":
    main()
