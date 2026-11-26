import os
import re
import sqlite3
import hashlib
import json
from pathlib import Path
from typing import Optional, List, Dict, Any, Tuple
from app.services.rag.types import RagChunk, RetrievedChunk

CREATE_FTS_TABLE_SQL = """
CREATE VIRTUAL TABLE IF NOT EXISTS clinical_rag_fts USING fts5(
    chunk_id UNINDEXED, source_doc, legal_basis, page_or_section,
    title, content, keywords, entity_type UNINDEXED, source_id UNINDEXED, source_version UNINDEXED, tokenize = 'unicode61'
)
"""

def get_fts_db_path() -> str:
    db_env = os.environ.get("DATABASE_URL", "")
    if "sqlite" in db_env:
        clean = re.sub(r"^sqlite(\+aiosqlite)?:///", "", db_env)
        if clean:
            target = Path(clean)
            return str(Path("/") / clean if not target.is_absolute() else target)
    if os.environ.get("VERCEL") or os.environ.get("AWS_LAMBDA_FUNCTION_NAME"):
        return "/tmp/clinical_hospital.db"
    default_path = Path(__file__).resolve().parent.parent.parent.parent / "clinical_hospital.db"
    try:
        if default_path.exists() and os.access(str(default_path), os.W_OK):
            return str(default_path)
        if os.access(str(default_path.parent), os.W_OK):
            return str(default_path)
    except Exception:
        pass
    return "/tmp/clinical_hospital.db"

VIETNAMESE_STOPWORDS = {
    "tôi", "bị", "nên", "uống", "thuốc", "nào", "nhỉ", "cho", "của", "các",
    "và", "là", "có", "không", "với", "được", "trong", "khi", "ở", "gì", "sao",
    "thế", "như", "làm", "để", "ra", "vào", "lại", "đã", "đang", "sẽ", "hay",
    "hoặc", "này", "đó", "đây", "người", "bệnh"
}

def _sanitize_fts_query(query: str) -> str:
    cleaned = re.sub(r"[^\w\s\-]", " ", query, flags=re.UNICODE)
    all_tokens = [t.strip() for t in cleaned.split() if len(t.strip()) >= 2]
    content_tokens = [t for t in all_tokens if t.casefold() not in VIETNAMESE_STOPWORDS]
    tokens = content_tokens if content_tokens else all_tokens
    return " OR ".join(f'"{t}"*' for t in tokens[:8]) if tokens else ""

class SqliteFtsIndex:
    def __init__(self, db_path: Path | str | None = None):
        self.db_path = str(db_path) if db_path else get_fts_db_path()
        self._conn: sqlite3.Connection | None = None
        self._init_fts_table()

    def _get_connection(self) -> sqlite3.Connection:
        if self._conn is None:
            try:
                self._conn = sqlite3.connect(self.db_path, check_same_thread=False)
                self._conn.row_factory = sqlite3.Row
                self._conn.execute("PRAGMA cache_size = -1000;")
            except sqlite3.OperationalError:
                self.db_path = ":memory:"
                self._conn = sqlite3.connect(":memory:", check_same_thread=False)
                self._conn.row_factory = sqlite3.Row
        return self._conn

    def _init_fts_table(self):
        try:
            with self._get_connection() as conn:
                conn.execute(CREATE_FTS_TABLE_SQL)
                columns = {row[1] for row in conn.execute("PRAGMA table_info(clinical_rag_fts)")}
                if not {"source_id", "source_version"}.issubset(columns):
                    conn.execute("DROP TABLE clinical_rag_fts")
                    conn.execute(CREATE_FTS_TABLE_SQL)
                conn.commit()
        except sqlite3.OperationalError:
            self.db_path = ":memory:"
            with self._get_connection() as conn:
                conn.execute(CREATE_FTS_TABLE_SQL)
                conn.commit()

    def sync_chunks(self, chunks: list[RagChunk]):
        with self._get_connection() as conn:
            # Chỉ đồng bộ các chunks tĩnh (DTQG, phác đồ mặc định), giữ nguyên tuyệt đối các chunks PDF do Admin nạp
            count = conn.execute("SELECT COUNT(*) FROM clinical_rag_fts WHERE entity_type != 'regulatory_pdf'").fetchone()[0]
            h = hashlib.sha256()
            for c in chunks:
                h.update(f"{c.chunk_id}|{c.source_doc}|{c.legal_basis}|{c.page_or_section}|{c.title}|{c.content}|{' '.join(c.keywords)}|{c.entity_type}|{c.source_id}|{c.source_version}\n".encode("utf-8"))
            fingerprint = h.hexdigest()
            try:
                row = conn.execute("SELECT value FROM clinical_rag_meta WHERE key = ?", ("chunk_fingerprint",)).fetchone()
            except sqlite3.OperationalError:
                row = None
            if count == len(chunks) and count > 0 and row and row[0] == fingerprint:
                return

            conn.execute("DELETE FROM clinical_rag_fts WHERE entity_type != 'regulatory_pdf'")
            for c in chunks:
                conn.execute(
                    """
                    INSERT INTO clinical_rag_fts(
                        chunk_id, source_doc, legal_basis, page_or_section, title, content, keywords, entity_type, source_id, source_version
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (c.chunk_id, c.source_doc, c.legal_basis, c.page_or_section, c.title, c.content, " ".join(c.keywords), c.entity_type, c.source_id, c.source_version)
                )
            conn.execute("CREATE TABLE IF NOT EXISTS clinical_rag_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)")
            conn.execute(
                "INSERT INTO clinical_rag_meta(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                ("chunk_fingerprint", fingerprint)
            )
            conn.commit()

    def upsert_chunks(self, chunks: list[RagChunk]):
        if not chunks:
            return
        with self._get_connection() as conn:
            for c in chunks:
                conn.execute("DELETE FROM clinical_rag_fts WHERE chunk_id = ?", (c.chunk_id,))
                conn.execute(
                    """
                    INSERT INTO clinical_rag_fts(
                        chunk_id, source_doc, legal_basis, page_or_section, title, content, keywords, entity_type, source_id, source_version
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (c.chunk_id, c.source_doc, c.legal_basis, c.page_or_section, c.title, c.content, " ".join(c.keywords), c.entity_type, c.source_id, c.source_version)
                )
            conn.commit()

    def search_bm25(self, query: str, top_k: int = 5, doc_id_filter: Optional[str] = None) -> list[RetrievedChunk]:
        fts_query = _sanitize_fts_query(query)
        if not fts_query:
            if doc_id_filter:
                return self._fallback_keyword_search_for_doc(query, doc_id_filter, top_k)
            return []

        results: list[RetrievedChunk] = []
        try:
            with self._get_connection() as conn:
                if doc_id_filter:
                    cur = conn.execute(
                        """
                        SELECT chunk_id, source_doc, legal_basis, page_or_section,
                               title, content, keywords, entity_type, source_id, source_version, bm25(clinical_rag_fts) as rank_score
                        FROM clinical_rag_fts
                        WHERE clinical_rag_fts MATCH ? AND (chunk_id LIKE ? OR source_doc LIKE ?)
                        ORDER BY rank_score ASC LIMIT ?
                        """,
                        (fts_query, f"{doc_id_filter}%", f"%{doc_id_filter}%", top_k)
                    )
                else:
                    cur = conn.execute(
                        """
                        SELECT chunk_id, source_doc, legal_basis, page_or_section,
                               title, content, keywords, entity_type, source_id, source_version, bm25(clinical_rag_fts) as rank_score
                        FROM clinical_rag_fts WHERE clinical_rag_fts MATCH ? ORDER BY rank_score ASC LIMIT ?
                        """,
                        (fts_query, top_k)
                    )
                for rank_idx, row in enumerate(cur.fetchall()):
                    raw_score = float(row["rank_score"])
                    results.append(RetrievedChunk(
                        chunk=RagChunk(
                            chunk_id=row["chunk_id"], source_doc=row["source_doc"], legal_basis=row["legal_basis"],
                            page_or_section=row["page_or_section"], title=row["title"], content=row["content"],
                            keywords=row["keywords"].split(), entity_type=row["entity_type"],
                            source_id=row["source_id"], source_version=row["source_version"]
                        ),
                        score=max(0.01, 1.0 / (1.0 + abs(raw_score))),
                        bm25_rank=rank_idx + 1,
                        match_reasons=[f"BM25 match rank #{rank_idx+1}"]
                    ))
        except Exception:
            return self._fallback_like_search(query, top_k, doc_id_filter)

        if not results and doc_id_filter:
            return self._fallback_keyword_search_for_doc(query, doc_id_filter, top_k)

        return results

    def _fallback_keyword_search_for_doc(self, query: str, doc_id: str, top_k: int = 5) -> list[RetrievedChunk]:
        """Tìm kiếm fallback theo tần suất từ khóa trực tiếp trên các chunks của tài liệu doc_id."""
        all_chunks = self.get_chunks_by_prefix(doc_id, limit=200)
        if not all_chunks:
            return []
        words = [w.casefold() for w in re.findall(r"\w+", query) if len(w) >= 2 and w.casefold() not in VIETNAMESE_STOPWORDS]
        if not words:
            return [RetrievedChunk(chunk=c, score=0.5, bm25_rank=i+1, match_reasons=["Direct chunk"]) for i, c in enumerate(all_chunks[:top_k])]

        scored = []
        for c in all_chunks:
            text = f"{c.title} {c.content} {' '.join(c.keywords)}".casefold()
            hits = sum(text.count(w) for w in words)
            if hits > 0:
                scored.append((hits, c))
        scored.sort(key=lambda x: x[0], reverse=True)
        return [
            RetrievedChunk(
                chunk=c,
                score=min(0.95, 0.4 + (hits * 0.1)),
                bm25_rank=idx + 1,
                match_reasons=[f"Keyword frequency match ({hits} hits)"]
            )
            for idx, (hits, c) in enumerate(scored[:top_k])
        ]

    def _fallback_like_search(self, query: str, top_k: int = 5, doc_id_filter: Optional[str] = None) -> list[RetrievedChunk]:
        tokens = [t.strip() for t in query.split() if len(t.strip()) >= 2]
        if not tokens:
            return []
        term = f"%{tokens[0]}%"
        results: list[RetrievedChunk] = []
        with self._get_connection() as conn:
            if doc_id_filter:
                cur = conn.execute(
                    """
                    SELECT chunk_id, source_doc, legal_basis, page_or_section, title, content, keywords, entity_type, source_id, source_version
                    FROM clinical_rag_fts
                    WHERE (title LIKE ? OR content LIKE ?) AND (chunk_id LIKE ? OR source_doc LIKE ?)
                    LIMIT ?
                    """,
                    (term, term, f"{doc_id_filter}%", f"%{doc_id_filter}%", top_k)
                )
            else:
                cur = conn.execute(
                    """
                    SELECT chunk_id, source_doc, legal_basis, page_or_section, title, content, keywords, entity_type, source_id, source_version
                    FROM clinical_rag_fts WHERE title LIKE ? OR content LIKE ? LIMIT ?
                    """,
                    (term, term, top_k)
                )
            for i, row in enumerate(cur.fetchall()):
                results.append(RetrievedChunk(
                    chunk=RagChunk(
                        chunk_id=row["chunk_id"], source_doc=row["source_doc"], legal_basis=row["legal_basis"],
                        page_or_section=row["page_or_section"], title=row["title"], content=row["content"],
                        keywords=row["keywords"].split(), entity_type=row["entity_type"],
                        source_id=row["source_id"], source_version=row["source_version"]
                    ),
                    score=0.5 / (i + 1), bm25_rank=i + 1, match_reasons=["Fallback LIKE search"]
                ))
        return results

    def get_chunks_by_ids(self, chunk_ids: list[str]) -> dict[str, RagChunk]:
        """Truy xuất danh sách RagChunk theo chunk_ids từ bảng FTS."""
        if not chunk_ids:
            return {}
        result: dict[str, RagChunk] = {}
        with self._get_connection() as conn:
            # Query theo batch để tránh vượt quá giới hạn biến SQLite (SQLITE_MAX_VARIABLE_NUMBER)
            batch_size = 500
            for i in range(0, len(chunk_ids), batch_size):
                batch = chunk_ids[i:i + batch_size]
                placeholders = ",".join("?" for _ in batch)
                cur = conn.execute(
                    f"""
                    SELECT chunk_id, source_doc, legal_basis, page_or_section,
                           title, content, keywords, entity_type, source_id, source_version
                    FROM clinical_rag_fts WHERE chunk_id IN ({placeholders})
                    """,
                    batch
                )
                for row in cur.fetchall():
                    cid = row["chunk_id"]
                    result[cid] = RagChunk(
                        chunk_id=cid,
                        source_doc=row["source_doc"],
                        legal_basis=row["legal_basis"],
                        page_or_section=row["page_or_section"],
                        title=row["title"],
                        content=row["content"],
                        keywords=row["keywords"].split() if row["keywords"] else [],
                        entity_type=row["entity_type"],
                        source_id=row["source_id"],
                        source_version=row["source_version"]
                    )
        return result

    def get_chunks_by_prefix(self, prefix: str, limit: int = 100) -> list[RagChunk]:
        """Lấy toàn bộ chunks có chunk_id hoặc source_doc khớp với prefix (VD: doc_id)."""
        clean_pfx = prefix.strip()
        if not clean_pfx:
            return []
        with self._get_connection() as conn:
            cur = conn.execute(
                """
                SELECT chunk_id, source_doc, legal_basis, page_or_section,
                       title, content, keywords, entity_type, source_id, source_version
                FROM clinical_rag_fts WHERE chunk_id LIKE ? OR source_doc LIKE ?
                LIMIT ?
                """,
                (f"{clean_pfx}%", f"%{clean_pfx}%", limit)
            )
            return [
                RagChunk(
                    chunk_id=row["chunk_id"],
                    source_doc=row["source_doc"],
                    legal_basis=row["legal_basis"],
                    page_or_section=row["page_or_section"],
                    title=row["title"],
                    content=row["content"],
                    keywords=row["keywords"].split() if row["keywords"] else [],
                    entity_type=row["entity_type"],
                    source_id=row["source_id"],
                    source_version=row["source_version"]
                )
                for row in cur.fetchall()
            ]

    def delete_chunks_by_source_doc(self, source_doc: str) -> list[str]:
        """Xóa toàn bộ chunks của một tài liệu source_doc và trả về danh sách chunk_id đã xóa."""
        with self._get_connection() as conn:
            cur = conn.execute("SELECT chunk_id FROM clinical_rag_fts WHERE source_doc = ?", (source_doc,))
            deleted_ids = [row["chunk_id"] for row in cur.fetchall()]
            if deleted_ids:
                conn.execute("DELETE FROM clinical_rag_fts WHERE source_doc = ?", (source_doc,))
                conn.commit()
            return deleted_ids

    def delete_chunks_by_prefix(self, prefix: str) -> list[str]:
        """Xóa toàn bộ chunks có chunk_id bắt đầu bằng prefix (VD: doc_id) và trả về danh sách đã xóa."""
        with self._get_connection() as conn:
            cur = conn.execute("SELECT chunk_id FROM clinical_rag_fts WHERE chunk_id LIKE ?", (f"{prefix}%",))
            deleted_ids = [row["chunk_id"] for row in cur.fetchall()]
            if deleted_ids:
                conn.execute("DELETE FROM clinical_rag_fts WHERE chunk_id LIKE ?", (f"{prefix}%",))
                conn.commit()
            return deleted_ids

