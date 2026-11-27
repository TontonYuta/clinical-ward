"""
Incremental, Resume-Safe DDI Knowledge Graph LLM Sync.
Backfills remaining ClinicalDrugMonograph rows that were previously ingested via
deterministic fallback, using LiteLLM Router (Gemini -> Groq -> OpenRouter) with
TPM-safe pacing (4s between calls) so free-tier limits are respected.
"""

from __future__ import annotations

import argparse
import asyncio
import sqlite3
import sys
import time
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models.registry import ClinicalDrugMonograph
from app.services.clinical_ddi_engine.ddi_graph_builder import (
    _call_gemini_graph_extractor,
    _expand_target_entities,
    _extract_pdf_page,
    build_monograph_graph_prompt,
    parse_monograph_graph_json,
)
from app.services.clinical_ddi_engine.ddi_graph_store import DdiGraphStore, normalize_graph_token
from app.services.admin_key_vault import get_active_api_key_async
from app.services.litellm_gateway import routed_json_completion


def _ensure_status_table(store: DdiGraphStore) -> None:
    with sqlite3.connect(str(store.db_path)) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS ddi_graph_ingest_status (
                monograph_id TEXT PRIMARY KEY,
                inn TEXT NOT NULL,
                mode TEXT NOT NULL,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        # Seed already-LLM-extracted monographs (those having a clean class edge or enzyme edge)
        conn.execute(
            """
            INSERT OR IGNORE INTO ddi_graph_ingest_status (monograph_id, inn, mode)
            SELECT DISTINCT n.monograph_id, n.display_name, 'llm_done'
            FROM ddi_graph_nodes n
            JOIN ddi_graph_edges e ON e.source_node_id = n.node_id
            JOIN ddi_graph_nodes t ON t.node_id = e.target_node_id
            WHERE n.node_type = 'drug'
              AND n.monograph_id IS NOT NULL AND n.monograph_id != ''
              AND t.node_type IN ('drug_class', 'enzyme')
            """
        )
        conn.commit()


async def run_incremental_sync(limit: int = 30, delay_sec: float = 4.0) -> dict:
    store = DdiGraphStore()
    _ensure_status_table(store)

    async with AsyncSessionLocal() as db:
        rows = (await db.execute(select(ClinicalDrugMonograph))).scalars().all()

    with sqlite3.connect(str(store.db_path)) as conn:
        done_ids = {
            r[0]
            for r in conn.execute(
                "SELECT monograph_id FROM ddi_graph_ingest_status WHERE mode = 'llm_done'"
            ).fetchall()
        }

    pending = [
        r
        for r in rows
        if (r.inn or "").strip()
        and (r.drug_interactions or "").strip()
        and str(r.id) not in done_ids
    ]

    total_with_int = sum(1 for r in rows if (r.inn or "").strip() and (r.drug_interactions or "").strip())
    print(f"Status: {len(done_ids)}/{total_with_int} llm_done | {len(pending)} pending", flush=True)
    if not pending:
        return {"done": len(done_ids), "total": total_with_int, "processed": 0, "accepted": 0}

    gemini_key = await get_active_api_key_async("gemini")
    batch = pending[:limit]
    processed = 0
    accepted = 0
    rejected = 0
    consecutive_empty = 0

    for idx, r in enumerate(batch, 1):
        inn = (r.inn or "").strip()
        interactions = (r.drug_interactions or "").strip()
        dclass = (r.drug_class or "").strip()
        src_id = store.upsert_node(
            "drug",
            inn,
            parent_class_name=dclass if (dclass and len(dclass) <= 80) else None,
            monograph_id=str(r.id),
        )

        # Prefer Groq/OpenRouter directly if Gemini daily quota is exhausted; routed_json_completion handles fallbacks
        prompt = build_monograph_graph_prompt(inn, dclass, interactions)
        raw_dict = await routed_json_completion(
            prompt,
            temperature=0.0,
            max_tokens=3000,
            timeout_sec=35.0,
            preferred_order=["gemini-tier", "groq-tier", "openrouter-tier", "mistral-tier"],
        )
        if not raw_dict and gemini_key:
            parsed = await _call_gemini_graph_extractor(inn, dclass, interactions, gemini_key)
        else:
            import json
            parsed = parse_monograph_graph_json(json.dumps(raw_dict, ensure_ascii=False)) if raw_dict else {
                "specific_class": "",
                "parent_class": "",
                "edges": [],
            }

        if not parsed["specific_class"] and not parsed["edges"]:
            consecutive_empty += 1
            print(f"[{idx}/{len(batch)}] {inn}: empty/quota-limited (consecutive={consecutive_empty})", flush=True)
            if consecutive_empty >= 3:
                print("Stopping batch early due to consecutive provider limits; progress preserved.", flush=True)
                break
            await asyncio.sleep(delay_sec)
            continue

        consecutive_empty = 0
        processed += 1
        if parsed["specific_class"] and len(parsed["specific_class"]) <= 80:
            store.upsert_node("drug", inn, parent_class_name=parsed["specific_class"], monograph_id=str(r.id))
            if parsed["parent_class"] and len(parsed["parent_class"]) <= 80:
                store.upsert_node("drug_class", parsed["specific_class"], parent_class_name=parsed["parent_class"])

        pdf_page = _extract_pdf_page({"section_pages": r.section_pages})
        doc_source = r.source or "Dược thư Quốc gia Việt Nam"
        doc_source_id = r.source_id or "data/knowledge_base/Duoc_Thu_Quoc_Gia_Viet_Nam.pdf"
        doc_version = r.source_version or "sha256:dtqgvn2-2015"

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
                    accepted += 1
                else:
                    rejected += 1

        with sqlite3.connect(str(store.db_path)) as conn:
            conn.execute(
                "INSERT OR REPLACE INTO ddi_graph_ingest_status (monograph_id, inn, mode) VALUES (?, ?, 'llm_done')",
                (str(r.id), inn),
            )
            conn.commit()

        print(f"[{idx}/{len(batch)}] {inn}: +{len(parsed['edges'])} raw edges (accepted_total={accepted})", flush=True)
        await asyncio.sleep(delay_sec)

    stats = store.stats()
    print(f"Batch complete: processed={processed}, accepted={accepted}, rejected={rejected} | Graph={stats}", flush=True)
    return {"done": len(done_ids) + processed, "total": total_with_int, "processed": processed, "accepted": accepted}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=30)
    parser.add_argument("--delay", type=float, default=4.0)
    args = parser.parse_args()
    asyncio.run(run_incremental_sync(limit=args.limit, delay_sec=args.delay))
