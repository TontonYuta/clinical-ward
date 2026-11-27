"""
Anti-Hallucination DDI Knowledge Graph Builder.
Populates ddi_graph_nodes and ddi_graph_edges from ClinicalDrugMonograph using:
1. Deterministic base drug/class ingestion + verbatim exact-substring verification.
2. Optional Gemini (temperature=0.0, JSON) relation & class-hierarchy extraction
   with negation polarity ("INTERACTS" | "CONTRAINDICATED" | "NO_INTERACTION").
"""

from __future__ import annotations

import asyncio
import json
import re
from typing import Any, Dict, List, Optional

import httpx

from app.services.admin_key_vault import get_active_api_key_async
from app.services.clinical_ddi_engine.ddi_graph_store import (
    DdiGraphStore,
    normalize_graph_token,
)
from app.services.gemini_model_discovery import get_available_gemini_models_async

_FALLBACK_MODELS = ["gemini-3.5-flash-lite", "gemini-3-flash-preview"]


def build_monograph_graph_prompt(
    inn: str,
    drug_class: str,
    interactions_text: str,
) -> str:
    """Build strict extractive-only prompt for Drug-Class hierarchy & DDI edges."""
    clipped = (interactions_text or "")[:6000]
    return (
        "Bạn là hệ thống trích xuất đồ thị tương tác thuốc y khoa (Extractive-Only).\n"
        f"Thuốc nguồn: {inn}\n"
        f"Nhóm dược lý gốc: {drug_class or 'Chưa rõ'}\n"
        "Văn bản mục Tương tác thuốc (Dược thư Quốc gia):\n"
        f"{clipped}\n\n"
        "Yêu cầu:\n"
        "1. Chuẩn hóa nhóm dược lý của thuốc nguồn thành specific_class và parent_class (ví dụ: specific='Lợi tiểu thiazid', parent='Thuốc lợi tiểu'; nếu không có nhóm cha rộng hơn thì parent='').\n"
        "2. Trích xuất các thực thể tương tác được nhắc tới trong văn bản (tên thuốc, nhóm thuốc, hoặc enzym CYP).\n"
        "3. Phân loại polarity chính xác: 'CONTRAINDICATED' (chống chỉ định/cấm phối hợp), 'INTERACTS' (có tương tác/thận trọng/tăng hoặc giảm tác dụng), hoặc 'NO_INTERACTION' (văn bản khẳng định không tương tác).\n"
        "4. Trường exact_quote BẮT BUỘC phải sao chép NGUYÊN VĂN 1-2 câu từ văn bản trên (không tự viết lại).\n"
        '5. Trả về JSON: {"specific_class": "...", "parent_class": "...", "edges": [{"target": "...", "target_type": "drug|drug_class|enzyme", "polarity": "INTERACTS|CONTRAINDICATED|NO_INTERACTION", "severity": "CONTRAINDICATED|MAJOR|MODERATE", "exact_quote": "..."}]}'
    )


def parse_monograph_graph_json(raw_text: str) -> Dict[str, Any]:
    """Safely parse Gemini JSON output for graph construction."""
    try:
        data = json.loads(raw_text)
    except Exception:
        return {"specific_class": "", "parent_class": "", "edges": []}
    if not isinstance(data, dict):
        return {"specific_class": "", "parent_class": "", "edges": []}
    edges = data.get("edges") if isinstance(data.get("edges"), list) else []
    return {
        "specific_class": str(data.get("specific_class") or "").strip(),
        "parent_class": str(data.get("parent_class") or "").strip(),
        "edges": [e for e in edges if isinstance(e, dict)],
    }


def _extract_pdf_page(mono: Dict[str, Any]) -> int:
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


async def _call_gemini_graph_extractor(
    inn: str,
    drug_class: str,
    interactions_text: str,
    api_key: str,
) -> Dict[str, Any]:
    prompt = build_monograph_graph_prompt(inn, drug_class, interactions_text)
    try:
        discovered = await get_available_gemini_models_async(api_key.strip())
    except Exception:
        discovered = []
    candidate_models = discovered[:2] if discovered else _FALLBACK_MODELS
    headers = {"x-goog-api-key": api_key.strip(), "Content-Type": "application/json"}
    payload = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.0,
            "maxOutputTokens": 4096,
            "responseMimeType": "application/json",
        },
    }
    try:
        async with httpx.AsyncClient(timeout=35.0) as client:
            for model_name in candidate_models:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent"
                for attempt in range(3):
                    r = await client.post(url, headers=headers, json=payload)
                    if r.status_code == 200:
                        raw = (
                            r.json()
                            .get("candidates", [{}])[0]
                            .get("content", {})
                            .get("parts", [{}])[0]
                            .get("text", "")
                        )
                        return parse_monograph_graph_json(raw)
                    if r.status_code in (429, 503) and attempt < 2:
                        await asyncio.sleep(2.0 * (attempt + 1))
                        continue
                    break
    except Exception:
        pass

    # Fallback via multi-provider LiteLLM Router (Groq -> OpenRouter -> Mistral -> Ollama)
    try:
        from app.services.litellm_gateway import routed_json_completion

        routed = await routed_json_completion(
            prompt,
            temperature=0.0,
            max_tokens=4096,
            timeout_sec=35.0,
            preferred_order=["groq-tier", "openrouter-tier", "mistral-tier", "ollama-tier"],
        )
        if routed:
            return parse_monograph_graph_json(json.dumps(routed, ensure_ascii=False))
    except Exception:
        pass
    return {"specific_class": "", "parent_class": "", "edges": []}


def _expand_target_entities(target_name: str, target_type: str) -> List[tuple[str, str]]:
    """Split comma/parenthetical target lists into clean individual nodes without losing class nodes."""
    raw = (target_name or "").strip()
    if not raw:
        return []
    out: List[tuple[str, str]] = []
    # Extract parenthetical drug examples, e.g. "Thuốc ức chế CYP3A4 mạnh (Ketoconazol, Clarithromycin)"
    paren_match = re.search(r"^(.+?)\s*\(([^()]{4,})\)\s*$", raw)
    if paren_match:
        outer = paren_match.group(1).strip()
        inner = paren_match.group(2).strip()
        if outer:
            out.append((outer, target_type))
        if "," in inner or " và " in inner:
            for part in re.split(r"\s*,\s*|\s+và\s+", inner):
                p = part.strip(" .;:")
                if len(p) >= 4:
                    out.append((p, "drug"))
        elif len(inner) >= 4:
            out.append((inner, "drug"))
        return out

    if target_type == "drug" and ("," in raw or " và " in raw):
        for part in re.split(r"\s*,\s*|\s+và\s+", raw):
            p = part.strip(" .;:")
            if len(p) >= 4:
                out.append((p, "drug"))
        return out or [(raw, target_type)]

    return [(raw, target_type)]


def _split_sentence_windows(text: str, window_size: int = 2) -> List[str]:
    clean = re.sub(r"\s+", " ", text or "").strip()
    sents = [s.strip() for s in re.split(r"(?<=[.!?])\s+", clean) if len(s.strip()) >= 12]
    if not sents:
        return []
    if len(sents) <= window_size:
        return [clean]
    return [" ".join(sents[i : i + window_size]) for i in range(len(sents) - window_size + 1)]


async def ingest_monographs_to_graph(
    store: DdiGraphStore,
    monographs: List[Dict[str, Any]],
    *,
    use_gemini: bool = True,
    api_key: Optional[str] = None,
) -> Dict[str, int]:
    """
    Build/incrementally update the DDI Knowledge Graph from ClinicalDrugMonograph rows.
    Guarantees every persisted edge passes exact-substring verification.
    """
    key = api_key or (await get_active_api_key_async("gemini") if use_gemini else None)
    nodes_added = 0
    edges_accepted = 0
    edges_rejected = 0

    # 1. Pre-register all monograph drug nodes so deterministic cross-linking knows canonical INNs
    drug_node_map: Dict[str, str] = {}
    for m in monographs:
        inn = (m.get("inn") or "").strip()
        if not inn:
            continue
        cls_raw = (m.get("drug_class") or "").strip()
        nid = store.upsert_node(
            "drug",
            inn,
            parent_class_name=cls_raw if cls_raw else None,
            monograph_id=str(m.get("id") or ""),
        )
        drug_node_map[normalize_graph_token(inn)] = nid
        nodes_added += 1

    # 2. Extract grounded edges per monograph
    for m in monographs:
        inn = (m.get("inn") or "").strip()
        interactions = (m.get("drug_interactions") or "").strip()
        if not inn or not interactions:
            continue
        src_id = drug_node_map.get(normalize_graph_token(inn))
        if not src_id:
            continue

        doc_source = m.get("source") or "Dược thư Quốc gia Việt Nam"
        doc_source_id = m.get("source_id") or "data/knowledge_base/Duoc_Thu_Quoc_Gia_Viet_Nam.pdf"
        doc_version = m.get("source_version") or "sha256:dtqgvn2-2015"
        pdf_page = _extract_pdf_page(m)

        ran_gemini_ok = False
        if use_gemini and key and len(key.strip()) >= 10:
            parsed = await _call_gemini_graph_extractor(
                inn, (m.get("drug_class") or "").strip(), interactions, key
            )
            if parsed["specific_class"] or parsed["edges"]:
                ran_gemini_ok = True
            if parsed["specific_class"]:
                store.upsert_node(
                    "drug",
                    inn,
                    parent_class_name=parsed["specific_class"],
                    monograph_id=str(m.get("id") or ""),
                )
                if parsed["parent_class"]:
                    store.upsert_node(
                        "drug_class",
                        parsed["specific_class"],
                        parent_class_name=parsed["parent_class"],
                    )
            for e in parsed["edges"]:
                t_name = str(e.get("target") or "").strip()
                t_type = str(e.get("target_type") or "drug").strip()
                if t_type not in {"drug", "drug_class", "enzyme"}:
                    t_type = "drug"
                if not t_name:
                    continue
                for exp_name, exp_type in _expand_target_entities(t_name, t_type):
                    tgt_id = store.upsert_node(exp_type, exp_name)
                    ok = store.upsert_edge(
                        source_node_id=src_id,
                        target_node_id=tgt_id,
                        polarity=str(e.get("polarity") or "INTERACTS").upper(),
                        severity=str(e.get("severity") or "MODERATE").upper(),
                        evidence_excerpt=str(e.get("exact_quote") or ""),
                        source_name=doc_source,
                        source_id=doc_source_id,
                        source_version=doc_version,
                        pdf_page=pdf_page,
                        raw_monograph_text=interactions,
                    )
                    if ok:
                        edges_accepted += 1
                    else:
                        edges_rejected += 1
        if not ran_gemini_ok:
            # Deterministic fallback without LLM (or when Gemini returned empty): match exact monograph INNs in 2-sentence windows
            windows = _split_sentence_windows(interactions, window_size=2)
            for other_norm, other_id in drug_node_map.items():
                if other_id == src_id or len(other_norm) < 4:
                    continue
                for w in windows:
                    if re.search(rf"(?<!\w){re.escape(other_norm)}(?!\w)", w.lower()):
                        ok = store.upsert_edge(
                            source_node_id=src_id,
                            target_node_id=other_id,
                            polarity="INTERACTS",
                            severity="MODERATE",
                            evidence_excerpt=w,
                            source_name=doc_source,
                            source_id=doc_source_id,
                            source_version=doc_version,
                            pdf_page=pdf_page,
                            raw_monograph_text=interactions,
                        )
                        if ok:
                            edges_accepted += 1
                        break

    return {
        "nodes_added": nodes_added,
        "edges_accepted": edges_accepted,
        "edges_rejected": edges_rejected,
    }
