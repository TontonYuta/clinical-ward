"""
SQLite Vector Store & In-Memory NumPy Matrix Engine.
Stores float32 binary BLOB embeddings in SQLite and maintains a normalized
in-memory NumPy matrix for ultra-low latency (<1.5ms) cosine similarity search.
"""
import logging
import os
import sqlite3
import time
from pathlib import Path
from typing import List, Optional, Tuple, Dict, Any, Union

import numpy as np

from app.services.rag.sqlite_fts import get_fts_db_path

logger = logging.getLogger("clinical_vector_store")

CREATE_VECTOR_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS clinical_chunk_vectors (
    chunk_id TEXT PRIMARY KEY,
    embedding BLOB NOT NULL,
    dimension INTEGER NOT NULL,
    content_hash TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_chunk_vectors_hash ON clinical_chunk_vectors(content_hash);
"""


class VectorStore:
    """
    Tầng lưu trữ và tìm kiếm vector tối ưu cho kho tri thức y khoa lâm sàng.
    - Lưu trữ bền vững (Persistent Storage): Binary BLOB trong SQLite.
    - Tìm kiếm tức thời (In-Memory Search): Ma trận NumPy chuẩn hóa trên RAM.
    """

    def __init__(
        self,
        db_path: Optional[Union[str, Path]] = None,
        auto_load: bool = True,
        dimension: int = 768
    ):
        self.db_path = str(db_path) if db_path else get_fts_db_path()
        self._conn: Optional[sqlite3.Connection] = None
        self._dimension: int = dimension
        self._init_db()

        # In-Memory Cache cấu trúc ma trận
        self._matrix: Optional[np.ndarray] = None  # shape: (N, dim), unit-normalized
        self._chunk_ids: List[str] = []
        self._id_to_idx: Dict[str, int] = {}

        if auto_load:
            self.load_in_memory_index()

    @property
    def dimension(self) -> int:
        return self._dimension

    def _get_connection(self) -> sqlite3.Connection:
        if self._conn is None:
            db_dir = Path(self.db_path).parent
            db_dir.mkdir(parents=True, exist_ok=True)
            self._conn = sqlite3.connect(self.db_path, check_same_thread=False)
            self._conn.row_factory = sqlite3.Row
        return self._conn

    def _init_db(self) -> None:
        """Khởi tạo bảng clinical_chunk_vectors trong SQLite nếu chưa tồn tại."""
        conn = self._get_connection()
        with conn:
            conn.executescript(CREATE_VECTOR_TABLE_SQL)

    def save_embedding(
        self,
        chunk_id: str,
        embedding: Union[List[float], np.ndarray],
        content_hash: Optional[str] = None
    ) -> None:
        """Lưu một vector embedding vào SQLite."""
        self.save_embeddings([(chunk_id, embedding, content_hash)])

    def save_embeddings(
        self,
        items: List[Tuple[str, Union[List[float], np.ndarray], Optional[str]]],
        auto_reload: bool = True
    ) -> int:
        """
        Lưu hàng loạt vector embeddings vào SQLite bằng executemany.
        items: list of (chunk_id, embedding_vector, content_hash)
        """
        if not items:
            return 0

        conn = self._get_connection()
        records = []
        for chunk_id, vec, chash in items:
            arr = np.asarray(vec, dtype=np.float32)
            blob = arr.tobytes()
            dim = int(arr.shape[0])
            records.append((chunk_id, blob, dim, chash or ""))

        sql = """
        INSERT INTO clinical_chunk_vectors (chunk_id, embedding, dimension, content_hash, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(chunk_id) DO UPDATE SET
            embedding=excluded.embedding,
            dimension=excluded.dimension,
            content_hash=excluded.content_hash,
            updated_at=CURRENT_TIMESTAMP
        """
        with conn:
            conn.executemany(sql, records)

        # Gỡ các chunk_id vừa lưu lại khỏi danh sách đã xóa trong phiên
        deleted_set = getattr(self, "_deleted_chunk_ids", None)
        if deleted_set:
            for chunk_id, _, _ in items:
                deleted_set.discard(chunk_id)

        # Cập nhật lại in-memory index nếu được yêu cầu
        if auto_reload:
            self.load_in_memory_index()
        return len(records)

    def load_in_memory_index(self, prefer_cache: bool = True) -> int:
        """
        Nạp toàn bộ vector từ SQLite (và tùy chọn file cache NPZ cho DB mặc định) lên RAM dưới dạng ma trận NumPy đã chuẩn hóa.
        Luôn hợp nhất mọi dynamic vector mới trong SQLite (như PDF do Admin tải lên) bất kể số lượng dòng SQLite nhỏ hơn NPZ.
        """
        is_default_db = False
        try:
            default_backend_db = (Path(__file__).resolve().parents[4] / "clinical_hospital.db").resolve()
            current_db = Path(self.db_path).resolve()
            is_default_db = (current_db == default_backend_db)
        except Exception:
            pass

        loaded_from_cache = False
        if prefer_cache and is_default_db:
            cache_npz = Path(__file__).resolve().parent / "clinical_embeddings_cache.npz"
            if cache_npz.exists():
                try:
                    if self.import_npz(cache_npz) and len(self._chunk_ids) > 0:
                        loaded_from_cache = True
                except Exception as e:
                    logger.warning(f"[VectorStore] Không thể đọc cache NPZ, fallback sang SQLite: {e}")

        conn = self._get_connection()
        cursor = conn.cursor()

        if loaded_from_cache:
            # Truy vấn nhanh danh sách chunk_id hiện có trong SQLite (chỉ quét PK, <1ms, không đọc BLOB)
            cursor.execute("SELECT chunk_id FROM clinical_chunk_vectors")
            sqlite_ids = [row["chunk_id"] for row in cursor.fetchall()]

            # Lọc bỏ các chunk_id đã bị xóa (nếu có trong bộ theo dõi xóa trong phiên)
            deleted_set = getattr(self, "_deleted_chunk_ids", set())
            if deleted_set and self._matrix is not None:
                keep_indices = [i for i, cid in enumerate(self._chunk_ids) if cid not in deleted_set]
                if len(keep_indices) != len(self._chunk_ids):
                    if keep_indices:
                        self._matrix = np.ascontiguousarray(self._matrix[keep_indices], dtype=np.float16)
                        self._chunk_ids = [self._chunk_ids[i] for i in keep_indices]
                        self._id_to_idx = {cid: idx for idx, cid in enumerate(self._chunk_ids)}
                    else:
                        self._matrix = None
                        self._chunk_ids = []
                        self._id_to_idx = {}

            # Tìm mọi vector mới/cập nhật trong SQLite chưa có trong ma trận RAM NPZ
            missing_ids = [cid for cid in sqlite_ids if cid not in self._id_to_idx]
            if not missing_ids:
                return len(self._chunk_ids)

            new_chunk_ids = []
            new_vectors = []
            batch_size = 500
            for start in range(0, len(missing_ids), batch_size):
                batch = missing_ids[start:start + batch_size]
                placeholders = ",".join("?" for _ in batch)
                cursor.execute(
                    f"SELECT chunk_id, embedding, dimension FROM clinical_chunk_vectors WHERE chunk_id IN ({placeholders})",
                    batch,
                )
                for row in cursor.fetchall():
                    arr = np.frombuffer(row["embedding"], dtype=np.float32)
                    if arr.shape[0] == self._dimension:
                        new_chunk_ids.append(row["chunk_id"])
                        new_vectors.append(arr)

            if new_vectors:
                new_raw = np.vstack(new_vectors).astype(np.float32)
                new_norms = np.linalg.norm(new_raw, axis=1, keepdims=True)
                new_norms[new_norms == 0] = 1.0
                new_normed = (new_raw / new_norms).astype(np.float16)

                combined = np.vstack([self._matrix.astype(np.float16), new_normed]) if self._matrix is not None else new_normed
                self._matrix = np.ascontiguousarray(combined, dtype=np.float16)
                start_idx = len(self._chunk_ids)
                for idx, cid in enumerate(new_chunk_ids):
                    self._chunk_ids.append(cid)
                    self._id_to_idx[cid] = start_idx + idx
                logger.info(f"[VectorStore] Đã hợp nhất thêm {len(new_chunk_ids)} dynamic vectors từ SQLite vào ma trận RAM.")
            return len(self._chunk_ids)

        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT chunk_id, embedding, dimension FROM clinical_chunk_vectors ORDER BY chunk_id ASC")
        rows = cursor.fetchall()

        if not rows:
            self._matrix = None
            self._chunk_ids = []
            self._id_to_idx = {}
            return 0

        chunk_ids = []
        vectors = []
        dim = rows[0]["dimension"]
        self._dimension = dim

        for row in rows:
            chunk_ids.append(row["chunk_id"])
            arr = np.frombuffer(row["embedding"], dtype=np.float32)
            vectors.append(arr)

        raw_matrix = np.vstack(vectors).astype(np.float32)
        # Chuẩn hóa ma trận L2 norm để phép tính Dot Product tương đương Cosine Similarity (lưu float16 giảm 50% RAM)
        norms = np.linalg.norm(raw_matrix, axis=1, keepdims=True)
        norms[norms == 0] = 1.0  # Tránh chia cho 0
        self._matrix = np.ascontiguousarray((raw_matrix / norms).astype(np.float16), dtype=np.float16)
        self._chunk_ids = chunk_ids
        self._id_to_idx = {cid: idx for idx, cid in enumerate(chunk_ids)}

        logger.info(f"[VectorStore] Đã nạp {len(chunk_ids)} vectors (dim={dim}) vào RAM.")
        return len(chunk_ids)

    def search_cosine(
        self,
        query_vector: Union[List[float], np.ndarray],
        top_k: int = 50,
        min_score: float = 0.0,
        id_prefix: Optional[str] = None
    ) -> List[Tuple[str, float]]:
        """
        Tìm kiếm Top-K chunks có độ tương đồng Cosine cao nhất với query vector.
        Hỗ trợ lọc trực tiếp theo id_prefix (VD: doc_id) để ưu tiên văn bản đang kiểm thử.
        """
        if self._matrix is None or len(self._chunk_ids) == 0:
            return []

        q = np.asarray(query_vector, dtype=np.float32)
        norm_q = np.linalg.norm(q)
        if norm_q == 0:
            return []
        q_norm = q / norm_q

        # Ma trận Dot Product: (N, dim) dot (dim,) -> (N,), cast query về dtype của ma trận để không nhân bản RAM
        scores = np.dot(self._matrix, q_norm.astype(self._matrix.dtype)).astype(np.float32)

        if id_prefix:
            clean_pfx = id_prefix.strip().lower()
            matching_indices = [
                i for i, cid in enumerate(self._chunk_ids)
                if cid.lower().startswith(clean_pfx) or clean_pfx in cid.lower()
            ]
            if not matching_indices:
                return []
            matching_scores = [(idx, float(scores[idx])) for idx in matching_indices]
            matching_scores.sort(key=lambda x: x[1], reverse=True)
            results: List[Tuple[str, float]] = []
            for idx, score in matching_scores[:top_k]:
                if score < min_score:
                    break
                results.append((self._chunk_ids[idx], round(score, 4)))
            return results

        n = len(scores)
        k = min(top_k, n)

        if k == n:
            top_indices = np.argsort(-scores)
        else:
            # Thuật toán argpartition O(N) nhanh hơn argsort O(N log N)
            partition_idx = np.argpartition(-scores, k)[:k]
            sorted_order = np.argsort(-scores[partition_idx])
            top_indices = partition_idx[sorted_order]

        results = []
        for idx in top_indices:
            score = float(scores[idx])
            if score < min_score:
                break
            results.append((self._chunk_ids[idx], round(score, 4)))

        return results

    def get_embedding(self, chunk_id: str, normalized: bool = False) -> Optional[np.ndarray]:
        """Lấy vector của 1 chunk_id cụ thể (raw từ CSDL hoặc normalized từ RAM)."""
        if normalized and self._matrix is not None and chunk_id in self._id_to_idx:
            idx = self._id_to_idx[chunk_id]
            return self._matrix[idx]

        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT embedding FROM clinical_chunk_vectors WHERE chunk_id = ?", (chunk_id,))
        row = cursor.fetchone()
        if row:
            arr = np.frombuffer(row["embedding"], dtype=np.float32)
            if normalized:
                norm = np.linalg.norm(arr)
                return arr / norm if norm > 0 else arr
            return arr
        return None

    def get_all_content_hashes(self) -> Dict[str, str]:
        """Lấy danh sách mã hash SHA-256 của toàn bộ chunks đã index trong CSDL."""
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT chunk_id, content_hash FROM clinical_chunk_vectors WHERE content_hash IS NOT NULL AND content_hash != ''")
        return {row["chunk_id"]: row["content_hash"] for row in cursor.fetchall()}

    def count(self) -> int:
        """Đếm tổng số vector lưu trong CSDL."""
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT count(*) FROM clinical_chunk_vectors")
        return int(cursor.fetchone()[0])

    def export_npz(self, file_path: Union[str, Path]) -> None:
        """Xuất ma trận vector và danh sách chunk_ids ra file .npz để sao lưu/tải nhanh."""
        if self._matrix is None or not self._chunk_ids:
            return
        Path(file_path).parent.mkdir(parents=True, exist_ok=True)
        np.savez_compressed(
            file_path,
            matrix=self._matrix.astype(np.float16),
            chunk_ids=np.array(self._chunk_ids, dtype=object)
        )
        logger.info(f"[VectorStore] Đã xuất cache file {file_path}")

    def import_npz(self, file_path: Union[str, Path]) -> bool:
        """Nạp trực tiếp ma trận từ file .npz vào RAM (không cần query SQLite)."""
        p = Path(file_path)
        if not p.exists():
            return False
        data = np.load(p, allow_pickle=True)
        self._matrix = data["matrix"]
        self._chunk_ids = list(data["chunk_ids"])
        self._id_to_idx = {cid: idx for idx, cid in enumerate(self._chunk_ids)}
        self._dimension = int(self._matrix.shape[1])
        logger.info(f"[VectorStore] Đã nạp {len(self._chunk_ids)} vectors từ cache {file_path}")
        return True

    def delete_embeddings(self, chunk_ids: List[str]) -> int:
        """Xóa danh sách vector theo chunk_ids khỏi SQLite và nạp lại RAM."""
        if not chunk_ids:
            return 0
        conn = self._get_connection()
        placeholders = ",".join("?" for _ in chunk_ids)
        with conn:
            conn.execute(f"DELETE FROM clinical_chunk_vectors WHERE chunk_id IN ({placeholders})", chunk_ids)
        if not hasattr(self, "_deleted_chunk_ids"):
            self._deleted_chunk_ids = set()
        self._deleted_chunk_ids.update(chunk_ids)
        # Nạp lại RAM (loại bỏ triệt để chunk_ids đã xóa khỏi ma trận RAM kể cả khi nạp từ NPZ)
        self.load_in_memory_index(prefer_cache=True)
        return len(chunk_ids)

    def clear(self) -> None:
        """Xóa sạch bảng vector (chỉ dùng trong testing)."""
        conn = self._get_connection()
        with conn:
            conn.execute("DELETE FROM clinical_chunk_vectors")
        self._matrix = None
        self._chunk_ids = []
        self._id_to_idx = {}


_default_store: Optional[VectorStore] = None


def get_vector_store(db_path: Optional[str] = None, auto_load: bool = True) -> VectorStore:
    """Singleton getter cho VectorStore toàn hệ thống."""
    global _default_store
    target_path = str(db_path) if db_path else get_fts_db_path()
    if _default_store is None or _default_store.db_path != target_path:
        _default_store = VectorStore(db_path=target_path, auto_load=auto_load)
    return _default_store
