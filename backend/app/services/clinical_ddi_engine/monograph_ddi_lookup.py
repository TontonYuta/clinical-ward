"""
Deterministic Monograph Cross-DDI Lookup (Dược thư Quốc gia Việt Nam).
When QĐ 5948 (633 contraindicated pairs) has no rule or an entity is missing
from the static DDI registry, searches ClinicalDrugMonograph.drug_interactions
for verbatim interaction sentences between the two drugs.
"""

from __future__ import annotations

import json
import re
import sqlite3
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.config import settings

_MONOGRAPH_CACHE: Optional[List[Dict[str, Any]]] = None


def _resolve_sqlite_path() -> Optional[Path]:
    url = settings.DATABASE_URL or ""
    if "sqlite" not in url:
        return None
    raw_path = url.split("///")[-1]
    p = Path(raw_path)
    if p.exists():
        return p
    backend_rel = Path(__file__).resolve().parents[3] / raw_path.lstrip("./")
    return backend_rel if backend_rel.exists() else None


def _load_monographs() -> List[Dict[str, Any]]:
    global _MONOGRAPH_CACHE
    if _MONOGRAPH_CACHE is not None:
        return _MONOGRAPH_CACHE
    db_path = _resolve_sqlite_path()
    if not db_path:
        _MONOGRAPH_CACHE = []
        return _MONOGRAPH_CACHE
    try:
        conn = sqlite3.connect(str(db_path))
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            "SELECT id, inn, title, drug_class, drug_interactions, contraindications, "
            "source, source_id, source_version, section_pages FROM clinical_drug_monographs"
        ).fetchall()
        conn.close()
        _MONOGRAPH_CACHE = [dict(r) for r in rows]
    except Exception:
        _MONOGRAPH_CACHE = []
    return _MONOGRAPH_CACHE


def _normalize_drug_token(name: str) -> str:
    clean = re.sub(r"\(.*?\)", "", (name or "")).strip().lower()
    clean = re.sub(r"\s+(?:hydrochloride|hydroclorid|natri|sodium|sulfate|sulfat|maleat|tartrat)\b", "", clean)
    return re.sub(r"\s+", " ", clean).strip()


def _name_variants(name: str) -> List[str]:
    base = _normalize_drug_token(name)
    if not base:
        return []
    variants = [base]
    # Handle English/Vietnamese spelling pairs (e.g. furosemide/furosemid, fluoxetine/fluoxetin)
    if base.endswith("e") and len(base) >= 5:
        variants.append(base[:-1])
    elif len(base) >= 5:
        variants.append(base + "e")
    return list(dict.fromkeys(v for v in variants if len(v) >= 4))


def _find_monograph(drug_name: str) -> Optional[Dict[str, Any]]:
    norm = _normalize_drug_token(drug_name)
    if not norm:
        return None
    variants = _name_variants(norm)
    monographs = _load_monographs()
    for m in monographs:
        m_inn = _normalize_drug_token(m.get("inn") or "")
        if m_inn == norm or any(v == m_inn for v in variants):
            return m
    for m in monographs:
        m_inn = _normalize_drug_token(m.get("inn") or "")
        if m_inn and any(v in m_inn or m_inn in v for v in variants if len(v) >= 5):
            return m
    return None


def _extract_matching_sentences(text: str, target_variants: List[str]) -> List[str]:
    if not text or not target_variants:
        return []
    clean = re.sub(r"\s+", " ", text).strip()
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", clean) if len(s.strip()) >= 12]
    matched: List[str] = []
    seen = set()
    for s in sentences:
        low = s.lower()
        if any(v in low for v in target_variants):
            if low not in seen:
                seen.add(low)
                matched.append(s)
    return matched[:6]


def _extract_interaction_page(mono: Dict[str, Any]) -> int:
    raw = mono.get("section_pages")
    if isinstance(raw, str) and raw.strip():
        try:
            pages = json.loads(raw)
            if isinstance(pages, dict):
                for k in ("drug_interactions", "interactions", "contraindications", "start"):
                    if isinstance(pages.get(k), int) and pages[k] > 0:
                        return pages[k]
        except Exception:
            pass
    return 1


def _extract_class_keywords(drug_class: Optional[str]) -> List[str]:
    """Derive pharmacological class phrases from ClinicalDrugMonograph.drug_class (zero hardcode)."""
    if not drug_class:
        return []
    raw_parts = re.split(r"[,;/()]+|\bvà\b|\bnhóm\b", drug_class.lower())
    stop = {"thuốc", "kháng", "chống", "điều trị", "tác dụng", "hệ", "dùng", "loại"}
    out: List[str] = []
    for part in raw_parts:
        clean = re.sub(r"\s+", " ", part).strip(" .:-")
        if 4 <= len(clean) <= 40 and clean not in stop:
            out.append(clean)
    return list(dict.fromkeys(out))[:6]


def lookup_monograph_pair_interaction(drug_a: str, drug_b: str) -> Optional[Dict[str, Any]]:
    """
    Search ClinicalDrugMonograph.drug_interactions (and precautions/contraindications)
    bidirectionally using both INN variants and automated drug_class keywords.
    """
    mono_a = _find_monograph(drug_a)
    mono_b = _find_monograph(drug_b)
    if not mono_a and not mono_b:
        return None

    sentences: List[str] = []
    primary_mono = mono_a or mono_b

    if mono_a:
        b_variants = _name_variants(drug_b) + _extract_class_keywords(mono_b.get("drug_class") if mono_b else None)
        found_a = _extract_matching_sentences(mono_a.get("drug_interactions") or "", b_variants)
        if not found_a:
            found_a = _extract_matching_sentences(
                f"{mono_a.get('contraindications') or ''} {mono_a.get('precautions') or ''}",
                _name_variants(drug_b),
            )
        if found_a:
            sentences.extend(found_a)
            primary_mono = mono_a

    if mono_b:
        a_variants = _name_variants(drug_a) + _extract_class_keywords(mono_a.get("drug_class") if mono_a else None)
        found_b = _extract_matching_sentences(mono_b.get("drug_interactions") or "", a_variants)
        if not found_b:
            found_b = _extract_matching_sentences(
                f"{mono_b.get('contraindications') or ''} {mono_b.get('precautions') or ''}",
                _name_variants(drug_a),
            )
        for s in found_b:
            if s.lower() not in {x.lower() for x in sentences}:
                sentences.append(s)
        if found_b and not sentences:
            primary_mono = mono_b

    if not sentences or not primary_mono:
        return None

    return {
        "drug_a": mono_a["inn"] if mono_a else drug_a,
        "drug_b": mono_b["inn"] if mono_b else drug_b,
        "sentences": sentences[:6],
        "source": primary_mono.get("source") or "Dược thư Quốc gia Việt Nam",
        "source_id": primary_mono.get("source_id") or "data/knowledge_base/Duoc_Thu_Quoc_Gia_Viet_Nam.pdf",
        "source_version": primary_mono.get("source_version") or "sha256:dtqgvn2-2015",
        "page": _extract_interaction_page(primary_mono),
    }
