"""
SQLite-backed Drug-Class DDI Knowledge Graph Store.
Stores normalized Drug / DrugClass / Enzyme nodes and verbatim-grounded
interaction edges with exact-substring verification.
"""

from __future__ import annotations

from contextlib import contextmanager
import hashlib
import re
import sqlite3
import unicodedata
from pathlib import Path
from typing import Any, Dict, Iterator, List, Optional

from app.config import settings


def normalize_graph_token(text: str) -> str:
    """Normalize a drug or class name for canonical graph node matching."""
    cleaned = unicodedata.normalize("NFC", str(text or "")).lower().strip()
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned


def normalize_verbatim_ws(text: str) -> str:
    """Collapse whitespace while preserving exact characters for substring verification."""
    return re.sub(r"\s+", " ", unicodedata.normalize("NFC", str(text or ""))).strip()


def _make_node_id(node_type: str, canonical_name: str) -> str:
    digest = hashlib.sha1(f"{node_type}:{canonical_name}".encode("utf-8")).hexdigest()[:16]
    return f"{node_type}:{digest}"


def _resolve_sqlite_path() -> Path:
    url = settings.DATABASE_URL or "sqlite+aiosqlite:///./clinical_ward.db"
    raw_path = url.split("///")[-1]
    p = Path(raw_path)
    if p.exists() or p.is_absolute():
        return p
    return Path(__file__).resolve().parents[3] / raw_path.lstrip("./")


class DdiGraphStore:
    """Lightweight SQLite store for Drug-Class DDI Knowledge Graph."""

    def __init__(self, db_path: Optional[Path] = None) -> None:
        self.db_path = db_path or _resolve_sqlite_path()
        self._ensure_schema()

    @contextmanager
    def _get_conn(self) -> Iterator[sqlite3.Connection]:
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()

    def _ensure_schema(self) -> None:
        with self._get_conn() as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS ddi_graph_nodes (
                    node_id TEXT PRIMARY KEY,
                    node_type TEXT NOT NULL,
                    canonical_name TEXT NOT NULL,
                    display_name TEXT NOT NULL,
                    parent_class_id TEXT,
                    monograph_id TEXT,
                    UNIQUE(node_type, canonical_name)
                );
                CREATE INDEX IF NOT EXISTS idx_ddi_nodes_canonical
                    ON ddi_graph_nodes(canonical_name);

                CREATE TABLE IF NOT EXISTS ddi_graph_edges (
                    edge_id TEXT PRIMARY KEY,
                    source_node_id TEXT NOT NULL,
                    target_node_id TEXT NOT NULL,
                    polarity TEXT NOT NULL,
                    severity TEXT NOT NULL,
                    evidence_excerpt TEXT NOT NULL,
                    source_name TEXT NOT NULL,
                    source_id TEXT NOT NULL,
                    source_version TEXT NOT NULL,
                    pdf_page INTEGER NOT NULL DEFAULT 1,
                    explanation_path TEXT
                );
                CREATE INDEX IF NOT EXISTS idx_ddi_edges_src
                    ON ddi_graph_edges(source_node_id);
                CREATE INDEX IF NOT EXISTS idx_ddi_edges_tgt
                    ON ddi_graph_edges(target_node_id);
                """
            )
            conn.commit()

    def upsert_node(
        self,
        node_type: str,
        display_name: str,
        parent_class_name: Optional[str] = None,
        monograph_id: Optional[str] = None,
    ) -> str:
        canonical = normalize_graph_token(display_name)
        if not canonical:
            raise ValueError("display_name cannot be empty")
        node_id = _make_node_id(node_type, canonical)

        parent_id: Optional[str] = None
        if parent_class_name and normalize_graph_token(parent_class_name) != canonical:
            parent_id = self.upsert_node("drug_class", parent_class_name)

        with self._get_conn() as conn:
            conn.execute(
                """
                INSERT INTO ddi_graph_nodes (node_id, node_type, canonical_name, display_name, parent_class_id, monograph_id)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(node_type, canonical_name) DO UPDATE SET
                    display_name = excluded.display_name,
                    parent_class_id = COALESCE(excluded.parent_class_id, ddi_graph_nodes.parent_class_id),
                    monograph_id = COALESCE(excluded.monograph_id, ddi_graph_nodes.monograph_id)
                """,
                (node_id, node_type, canonical, display_name.strip(), parent_id, monograph_id),
            )
            conn.commit()
        return node_id

    @staticmethod
    def verify_verbatim_excerpt(evidence_excerpt: str, raw_monograph_text: str) -> bool:
        """Strictly verify that evidence_excerpt is an exact substring of the source text."""
        norm_quote = normalize_verbatim_ws(evidence_excerpt).lower()
        norm_source = normalize_verbatim_ws(raw_monograph_text).lower()
        return len(norm_quote) >= 10 and norm_quote in norm_source

    def upsert_edge(
        self,
        source_node_id: str,
        target_node_id: str,
        polarity: str,
        severity: str,
        evidence_excerpt: str,
        source_name: str,
        source_id: str,
        source_version: str,
        pdf_page: int = 1,
        raw_monograph_text: Optional[str] = None,
        explanation_path: Optional[str] = None,
    ) -> bool:
        if polarity not in {"INTERACTS", "CONTRAINDICATED", "NO_INTERACTION"}:
            return False
        clean_excerpt = normalize_verbatim_ws(evidence_excerpt)
        if not clean_excerpt:
            return False
        if raw_monograph_text is not None and not self.verify_verbatim_excerpt(clean_excerpt, raw_monograph_text):
            return False

        edge_key = f"{source_node_id}|{target_node_id}|{polarity}|{clean_excerpt[:80]}"
        edge_id = hashlib.sha1(edge_key.encode("utf-8")).hexdigest()[:20]

        with self._get_conn() as conn:
            conn.execute(
                """
                INSERT INTO ddi_graph_edges (
                    edge_id, source_node_id, target_node_id, polarity, severity,
                    evidence_excerpt, source_name, source_id, source_version, pdf_page, explanation_path
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(edge_id) DO UPDATE SET
                    polarity = excluded.polarity,
                    severity = excluded.severity,
                    evidence_excerpt = excluded.evidence_excerpt,
                    pdf_page = excluded.pdf_page,
                    explanation_path = COALESCE(excluded.explanation_path, ddi_graph_edges.explanation_path)
                """,
                (
                    edge_id,
                    source_node_id,
                    target_node_id,
                    polarity,
                    severity,
                    clean_excerpt,
                    source_name,
                    source_id,
                    source_version,
                    max(1, int(pdf_page or 1)),
                    explanation_path,
                ),
            )
            conn.commit()
        return True

    @staticmethod
    def _morphological_variants(canonical: str) -> List[str]:
        """Generate generic English/Vietnamese trailing '-e' spelling variants per word."""
        words = canonical.split()
        if not words:
            return []
        per_word: List[List[str]] = []
        for w in words:
            opts = [w]
            if len(w) >= 5:
                if w.endswith("e"):
                    opts.append(w[:-1])
                else:
                    opts.append(w + "e")
            per_word.append(opts)

        variants = [canonical]
        # Full-phrase variant with all words toggled or individual words toggled
        from itertools import product
        for combo in product(*per_word):
            v = " ".join(combo)
            if v not in variants:
                variants.append(v)
            if len(variants) >= 8:
                break
        return variants

    def get_node_by_name(self, name: str, node_type: Optional[str] = None) -> List[Dict[str, Any]]:
        canonical = normalize_graph_token(name)
        if not canonical:
            return []
        variants = self._morphological_variants(canonical)
        placeholders = ",".join("?" for _ in variants)
        type_clause = " AND node_type = ?" if node_type else ""
        params_exact: List[Any] = list(variants) + ([node_type] if node_type else [])

        with self._get_conn() as conn:
            rows = conn.execute(
                f"SELECT * FROM ddi_graph_nodes WHERE canonical_name IN ({placeholders}){type_clause} "
                "ORDER BY CASE WHEN monograph_id IS NOT NULL AND monograph_id != '' THEN 0 ELSE 1 END, LENGTH(canonical_name) ASC",
                params_exact,
            ).fetchall()
            if rows:
                return [dict(r) for r in rows]

            # Generic salt/combination prefix match (e.g. 'lithium' -> 'lithium carbonate',
            # 'atorvastatin' -> 'atorvastatin (dưới dạng ...)', 'sulfamethoxazol' -> 'sulfamethoxazole - trimethoprim')
            for v in variants:
                if len(v) < 4:
                    continue
                params_like: List[Any] = [f"{v} %", f"{v} (%"] + ([node_type] if node_type else [])
                rows = conn.execute(
                    f"SELECT * FROM ddi_graph_nodes WHERE (canonical_name LIKE ? OR canonical_name LIKE ?){type_clause} "
                    "ORDER BY CASE WHEN monograph_id IS NOT NULL AND monograph_id != '' THEN 0 ELSE 1 END, LENGTH(canonical_name) ASC",
                    params_like,
                ).fetchall()
                if rows:
                    return [dict(r) for r in rows]
            return []

    def get_related_class_nodes(self, class_name: str) -> List[Dict[str, Any]]:
        """
        Find drug_class nodes whose canonical_name is a whole-word sub-phrase of class_name
        (e.g. 'thuốc lợi tiểu thuộc nhóm thiazid' -> 'thuốc lợi tiểu', 'nitrat' -> 'nitrat hữu cơ').
        """
        norm = normalize_graph_token(class_name)
        if len(norm) < 5 or len(norm) > 80:
            return []
        with self._get_conn() as conn:
            rows = conn.execute(
                "SELECT * FROM ddi_graph_nodes WHERE node_type = 'drug_class' AND LENGTH(canonical_name) <= 80"
            ).fetchall()
        matched: List[Dict[str, Any]] = []
        for r in rows:
            cn = r["canonical_name"]
            if len(cn) < 5 or cn == norm:
                continue
            if re.search(rf"(?<!\w){re.escape(cn)}(?!\w)", norm) or re.search(
                rf"(?<!\w){re.escape(norm)}(?!\w)", cn
            ):
                matched.append(dict(r))
        return matched

    def get_node_by_id(self, node_id: str) -> Optional[Dict[str, Any]]:
        with self._get_conn() as conn:
            row = conn.execute(
                "SELECT * FROM ddi_graph_nodes WHERE node_id = ?",
                (node_id,),
            ).fetchone()
            return dict(row) if row else None

    def get_edges_between(self, node_ids_a: List[str], node_ids_b: List[str]) -> List[Dict[str, Any]]:
        if not node_ids_a or not node_ids_b:
            return []
        pa = ",".join("?" for _ in node_ids_a)
        pb = ",".join("?" for _ in node_ids_b)
        sql = f"""
            SELECT * FROM ddi_graph_edges
            WHERE (source_node_id IN ({pa}) AND target_node_id IN ({pb}))
               OR (source_node_id IN ({pb}) AND target_node_id IN ({pa}))
        """
        params = [*node_ids_a, *node_ids_b, *node_ids_b, *node_ids_a]
        with self._get_conn() as conn:
            rows = conn.execute(sql, params).fetchall()
            return [dict(r) for r in rows]

    def stats(self) -> Dict[str, int]:
        with self._get_conn() as conn:
            n_count = conn.execute("SELECT COUNT(*) FROM ddi_graph_nodes").fetchone()[0]
            e_count = conn.execute("SELECT COUNT(*) FROM ddi_graph_edges").fetchone()[0]
        return {"nodes": int(n_count), "edges": int(e_count)}
