"""
1-hop & 2-hop Drug-Class Knowledge Graph Retriever for DDI Lookup.
Traverses Drug -> Specific Class -> Parent Class <-> Target Drug/Class,
enforcing NO_INTERACTION filtering and returning verbatim monograph excerpts.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

from app.services.clinical_ddi_engine.ddi_graph_store import DdiGraphStore

_SEVERITY_RANK = {"CONTRAINDICATED": 4, "MAJOR": 3, "MODERATE": 2, "MINOR": 1}
_POLARITY_RANK = {"CONTRAINDICATED": 2, "INTERACTS": 1}


def _collect_drug_lineage(
    store: DdiGraphStore,
    drug_name: str,
    max_depth: int = 4,
) -> Tuple[List[str], Dict[str, Dict[str, Any]], List[str]]:
    """
    Collect ordered node IDs along the drug's taxonomy lineage:
    [drug_node_id, specific_class_id, parent_class_id, ...]
    """
    nodes = store.get_node_by_name(drug_name, node_type="drug")
    if not nodes:
        nodes = store.get_node_by_name(drug_name)
    if not nodes:
        return [], {}, []

    ordered_ids: List[str] = []
    node_map: Dict[str, Dict[str, Any]] = {}
    labels: List[str] = []
    seen = set()

    for root in nodes:
        cur: Optional[Dict[str, Any]] = root
        depth = 0
        while cur and depth <= max_depth:
            nid = cur["node_id"]
            if nid not in seen:
                seen.add(nid)
                ordered_ids.append(nid)
                node_map[nid] = cur
                labels.append(cur["display_name"])
                if cur.get("node_type") == "drug_class":
                    for rel in store.get_related_class_nodes(cur["display_name"]):
                        rnid = rel["node_id"]
                        if rnid not in seen:
                            seen.add(rnid)
                            ordered_ids.append(rnid)
                            node_map[rnid] = rel
                            labels.append(rel["display_name"])
            parent_id = cur.get("parent_class_id")
            cur = store.get_node_by_id(parent_id) if parent_id else None
            depth += 1

    return ordered_ids, node_map, labels


def _build_explanation_path(
    edge: Dict[str, Any],
    ids_a: List[str],
    map_a: Dict[str, Dict[str, Any]],
    ids_b: List[str],
    map_b: Dict[str, Dict[str, Any]],
) -> str:
    """Construct human-readable graph reasoning path (1-hop or 2-hop)."""
    src = edge["source_node_id"]
    tgt = edge["target_node_id"]

    if src in map_a and tgt in map_b:
        hit_a, hit_b = src, tgt
    else:
        hit_a, hit_b = tgt, src

    idx_a = ids_a.index(hit_a) if hit_a in ids_a else 0
    idx_b = ids_b.index(hit_b) if hit_b in ids_b else 0
    chain_a = " → ".join(map_a[nid]["display_name"] for nid in ids_a[: idx_a + 1])
    chain_b = " ← ".join(map_b[nid]["display_name"] for nid in reversed(ids_b[: idx_b + 1]))
    return f"{chain_a} ↔ {chain_b}"


def _edge_priority(
    edge: Dict[str, Any],
    ids_a: List[str],
    ids_b: List[str],
) -> Tuple[int, int, int]:
    """Higher tuple = better match. Prefer 1-hop direct drug<->drug, then severity."""
    src, tgt = edge["source_node_id"], edge["target_node_id"]
    hop_a = ids_a.index(src) if src in ids_a else ids_a.index(tgt)
    hop_b = ids_b.index(tgt) if tgt in ids_b else ids_b.index(src)
    is_direct = 1 if (hop_a == 0 and hop_b == 0) else 0
    pol = _POLARITY_RANK.get((edge.get("polarity") or "").upper(), 0)
    sev = _SEVERITY_RANK.get((edge.get("severity") or "").upper(), 0)
    return (is_direct, pol, sev, -(hop_a + hop_b))


def retrieve_graph_ddi_pair(
    drug_a: str,
    drug_b: str,
    store: Optional[DdiGraphStore] = None,
) -> Optional[Dict[str, Any]]:
    """
    Retrieve grounded DDI evidence between drug_a and drug_b via 1-hop or 2-hop graph traversal.
    Returns None if no interaction exists or if an explicit NO_INTERACTION edge blocks false positives.
    """
    gstore = store or DdiGraphStore()
    ids_a, map_a, _ = _collect_drug_lineage(gstore, drug_a)
    ids_b, map_b, _ = _collect_drug_lineage(gstore, drug_b)
    if not ids_a or not ids_b:
        return None

    edges = gstore.get_edges_between(ids_a, ids_b)
    if not edges:
        return None

    direct_pair = {ids_a[0], ids_b[0]}
    # If there is an explicit direct NO_INTERACTION edge between the two drugs and no direct positive edge, suppress.
    direct_positive = [
        e for e in edges
        if {e["source_node_id"], e["target_node_id"]} == direct_pair
        and (e.get("polarity") or "").upper() in {"INTERACTS", "CONTRAINDICATED"}
    ]
    direct_negative = [
        e for e in edges
        if {e["source_node_id"], e["target_node_id"]} == direct_pair
        and (e.get("polarity") or "").upper() == "NO_INTERACTION"
    ]
    if direct_negative and not direct_positive:
        return None

    positive_edges = [
        e for e in edges
        if (e.get("polarity") or "").upper() in {"INTERACTS", "CONTRAINDICATED"}
        and (e.get("evidence_excerpt") or "").strip()
    ]
    if not positive_edges:
        return None

    best = max(positive_edges, key=lambda e: _edge_priority(e, ids_a, ids_b))
    explanation_path = _build_explanation_path(best, ids_a, map_a, ids_b, map_b)
    is_direct = {best["source_node_id"], best["target_node_id"]} == direct_pair

    return {
        "drug_a": map_a[ids_a[0]]["display_name"],
        "drug_b": map_b[ids_b[0]]["display_name"],
        "sentences": [best["evidence_excerpt"].strip()],
        "source": best.get("source_name") or "Dược thư Quốc gia Việt Nam",
        "source_id": best.get("source_id") or "data/knowledge_base/Duoc_Thu_Quoc_Gia_Viet_Nam.pdf",
        "source_version": best.get("source_version") or "sha256:dtqgvn2-2015",
        "page": int(best.get("pdf_page") or 1),
        "polarity": best.get("polarity") or "INTERACTS",
        "severity": best.get("severity") or "MODERATE",
        "explanation_path": explanation_path,
        "retrieval_mode": "graph_1hop" if is_direct else "graph_2hop",
    }
