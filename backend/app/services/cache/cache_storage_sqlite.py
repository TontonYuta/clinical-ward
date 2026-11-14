"""
Persistent SQLite Storage for Clinical Semantic Cache (GPTCache Paper arXiv:2303.17580).
Lưu trữ bộ nhớ đệm lâm sàng bền vững qua các lần khởi động lại server.
"""
import os
import json
import time
import sqlite3
import logging
from contextlib import contextmanager
from typing import Optional, Dict, Any, List

logger = logging.getLogger("clinical_cache_sqlite")

_DEFAULT_CACHE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../data"))
_DEFAULT_DB_FILE = os.path.join(_DEFAULT_CACHE_DIR, "clinical_copilot_cache.sqlite")

def _serialize_features(features: Dict[str, Any]) -> str:
    serialized = {}
    for k, v in features.items():
        if isinstance(v, (set, frozenset)):
            serialized[k] = sorted(list(v))
        elif hasattr(v, "tolist"):
            serialized[k] = v.tolist()
        else:
            serialized[k] = v
    return json.dumps(serialized, ensure_ascii=False)

def _deserialize_features(raw_json: str) -> Dict[str, Any]:
    data = json.loads(raw_json)
    deserialized = {}
    for k, v in data.items():
        if k == "intent" and isinstance(v, list):
            deserialized[k] = frozenset(v)
        elif k in {"numbers", "tokens", "conditions", "meds", "trigrams"} and isinstance(v, list):
            deserialized[k] = set(v)
        elif k == "vector" and isinstance(v, list) and v:
            import numpy as np
            deserialized[k] = np.array(v, dtype=np.float32)
        else:
            deserialized[k] = v
    return deserialized

class CacheStorageSqlite:
    def __init__(self, db_path: Optional[str] = None):
        self.db_path = db_path or _DEFAULT_DB_FILE
        try:
            os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
            self._init_db()
        except Exception as e:
            logger.warning("Không thể khởi tạo SQLite Cache tại %s: %s", self.db_path, e)

    @contextmanager
    def _get_conn(self):
        conn = sqlite3.connect(self.db_path, timeout=5.0)
        try:
            conn.execute("PRAGMA cache_size = -500;")
            yield conn
        finally:
            conn.close()

    def _init_db(self) -> None:
        with self._get_conn() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS semantic_cache (
                    cache_key TEXT PRIMARY KEY,
                    canonical_query TEXT,
                    user_role TEXT,
                    data_json TEXT,
                    features_json TEXT,
                    created_at REAL,
                    expire_at REAL
                )
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_cache_role ON semantic_cache(user_role)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_cache_expire ON semantic_cache(expire_at)")
            conn.commit()

    def load_active_entries(self, limit: int = 1000) -> List[Dict[str, Any]]:
        now = time.time()
        entries = []
        try:
            with self._get_conn() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT cache_key, canonical_query, user_role, data_json, features_json, created_at, expire_at
                    FROM semantic_cache
                    WHERE expire_at > ?
                    ORDER BY created_at ASC
                    LIMIT ?
                """, (now, limit))
                for row in cursor.fetchall():
                    try:
                        k, can_q, role, d_json, f_json, cr_at, exp_at = row
                        entries.append({
                            "key": k,
                            "canonical_query": can_q,
                            "role": role,
                            "data": json.loads(d_json),
                            "features": _deserialize_features(f_json),
                            "created_at": cr_at,
                            "expire_at": exp_at
                        })
                    except Exception:
                        continue
        except Exception as e:
            logger.debug("Lỗi đọc SQLite cache: %s", e)
        return entries

    def save_entry(self, key: str, entry: Dict[str, Any]) -> None:
        try:
            with self._get_conn() as conn:
                conn.execute("""
                    INSERT OR REPLACE INTO semantic_cache 
                    (cache_key, canonical_query, user_role, data_json, features_json, created_at, expire_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (
                    key,
                    entry.get("canonical_query", ""),
                    entry.get("role", "doctor"),
                    json.dumps(entry.get("data", {}), ensure_ascii=False),
                    _serialize_features(entry.get("features", {})),
                    entry.get("created_at", time.time()),
                    entry.get("expire_at", time.time() + 86400)
                ))
                conn.commit()
        except Exception as e:
            logger.debug("Lỗi lưu SQLite cache: %s", e)

    def delete_entry(self, key: str) -> None:
        try:
            with self._get_conn() as conn:
                conn.execute("DELETE FROM semantic_cache WHERE cache_key = ?", (key,))
                conn.commit()
        except Exception as e:
            logger.debug("Lỗi xóa cache entry không hợp lệ: %s", e)

    def clear_all(self) -> None:
        try:
            with self._get_conn() as conn:
                conn.execute("DELETE FROM semantic_cache")
                conn.commit()
        except Exception as e:
            logger.debug("Lỗi xóa SQLite cache: %s", e)
