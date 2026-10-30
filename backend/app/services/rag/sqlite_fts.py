"""
SQLite FTS5 Sparse BM25 Index Engine
Hỗ trợ BM25 ranking cho tri thức y tế, SĐK và văn bản pháp lý (<=180 LOC)
"""
import re
import sqlite3
from pathlib import Path
from app.services.rag.types import RagChunk, RetrievedChunk

DB_PATH = Path(__file__).resolve().parent.parent.parent.parent / "clinical_hospital.db"

def _sanitize_fts_query(query: str) -> str:
    cleaned = re.sub(r"[^\w\s\-]", " ", query, flags=re.UNICODE)
    tokens = [t.strip() for t in cleaned.split() if len(t.strip()) >= 2]
    if not tokens:
        return ""
    # Kết hợp OR giữa các tokens để tối đa độ bao phủ BM25
    return " OR ".join(f'"{t}"*' for t in tokens[:8])

class SqliteFtsIndex:
    def __init__(self, db_path: Path = DB_PATH):
        self.db_path = str(db_path)
        self._init_fts_table()

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_fts_table(self):
        with self._get_connection() as conn:
            conn.execute("""
                CREATE VIRTUAL TABLE IF NOT EXISTS clinical_rag_fts USING fts5(
                    chunk_id UNINDEXED,
                    source_doc,
                    legal_basis,
                    page_or_section,
                    title,
                    content,
                    keywords,
                    entity_type UNINDEXED,
                    tokenize = 'unicode61'
                )
            """)
            conn.commit()

    def sync_chunks(self, chunks: list[RagChunk]):
        with self._get_connection() as conn:
            count = conn.execute("SELECT COUNT(*) FROM clinical_rag_fts").fetchone()[0]
            if count >= len(chunks) and count > 0:
                return  # Đã đồng bộ trước đó

            conn.execute("DELETE FROM clinical_rag_fts")
            for c in chunks:
                kw_str = " ".join(c.keywords)
                conn.execute(
                    """
                    INSERT INTO clinical_rag_fts(
                        chunk_id, source_doc, legal_basis, page_or_section,
                        title, content, keywords, entity_type
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (c.chunk_id, c.source_doc, c.legal_basis, c.page_or_section,
                     c.title, c.content, kw_str, c.entity_type)
                )
            conn.commit()

    def search_bm25(self, query: str, top_k: int = 5) -> list[RetrievedChunk]:
        fts_query = _sanitize_fts_query(query)
        if not fts_query:
            return []

        results: list[RetrievedChunk] = []
        try:
            with self._get_connection() as conn:
                cur = conn.execute(
                    """
                    SELECT chunk_id, source_doc, legal_basis, page_or_section,
                           title, content, keywords, entity_type,
                           bm25(clinical_rag_fts) as rank_score
                    FROM clinical_rag_fts
                    WHERE clinical_rag_fts MATCH ?
                    ORDER BY rank_score ASC
                    LIMIT ?
                    """,
                    (fts_query, top_k)
                )
                rows = cur.fetchall()
                for rank_idx, row in enumerate(rows):
                    chunk = RagChunk(
                        chunk_id=row["chunk_id"],
                        source_doc=row["source_doc"],
                        legal_basis=row["legal_basis"],
                        page_or_section=row["page_or_section"],
                        title=row["title"],
                        content=row["content"],
                        keywords=row["keywords"].split(),
                        entity_type=row["entity_type"]
                    )
                    # Chuyển đổi bm25 score (âm) sang điểm chuẩn hóa dương
                    raw_score = float(row["rank_score"])
                    norm_score = max(0.01, 1.0 / (1.0 + abs(raw_score)))
                    results.append(RetrievedChunk(
                        chunk=chunk,
                        score=norm_score,
                        bm25_rank=rank_idx + 1,
                        match_reasons=[f"BM25 match rank #{rank_idx+1}"]
                    ))
        except Exception as e:
            # Fallback nếu câu query chứa ký tự đặc biệt gây lỗi syntax FTS
            return self._fallback_like_search(query, top_k)

        return results

    def _fallback_like_search(self, query: str, top_k: int = 5) -> list[RetrievedChunk]:
        tokens = [t.strip() for t in query.split() if len(t.strip()) >= 2]
        if not tokens:
            return []
        term = f"%{tokens[0]}%"
        results: list[RetrievedChunk] = []
        with self._get_connection() as conn:
            cur = conn.execute(
                """
                SELECT chunk_id, source_doc, legal_basis, page_or_section,
                       title, content, keywords, entity_type
                FROM clinical_rag_fts
                WHERE title LIKE ? OR content LIKE ?
                LIMIT ?
                """,
                (term, term, top_k)
            )
            for i, row in enumerate(cur.fetchall()):
                c = RagChunk(
                    chunk_id=row["chunk_id"],
                    source_doc=row["source_doc"],
                    legal_basis=row["legal_basis"],
                    page_or_section=row["page_or_section"],
                    title=row["title"],
                    content=row["content"],
                    keywords=row["keywords"].split(),
                    entity_type=row["entity_type"]
                )
                results.append(RetrievedChunk(
                    chunk=c,
                    score=0.5 / (i + 1),
                    bm25_rank=i + 1,
                    match_reasons=["Fallback LIKE search"]
                ))
        return results
