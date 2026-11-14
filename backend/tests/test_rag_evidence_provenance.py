import pytest
import hashlib
import json
from pathlib import Path

from app.services.rag.types import RagChunk, RetrievedChunk
from app.services.rag import rag_pipeline
from app.services.rag import clinical_indexer
from app.services.rag.sqlite_fts import SqliteFtsIndex


def test_markdown_chunk_retains_content_hash_provenance(tmp_path):
    doc = tmp_path / "guide.md"
    doc.write_text("### Section\n\nEvidence paragraph.", encoding="utf-8")
    chunk = clinical_indexer._parse_markdown_chunks(doc, "Guide", "Basis", "guideline")[0]
    expected = hashlib.sha256(doc.read_bytes()).hexdigest()
    assert chunk.source_id == str(doc.resolve())
    assert chunk.source_version == expected


def test_manifest_pdf_version_only_trusts_matching_artifact(tmp_path, monkeypatch):
    repo = tmp_path
    kb = repo / "backend/data/knowledge_base"
    kb.mkdir(parents=True)
    pdf = kb / "guide.pdf"
    pdf.write_bytes(b"verified source")
    manifest = {"sources": [{"id": "guide", "backend_copy": "backend/data/knowledge_base/guide.pdf", "sha256": hashlib.sha256(pdf.read_bytes()).hexdigest()}]}
    (kb / "clinical_source_manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
    monkeypatch.setattr(clinical_indexer, "KB_BASE_DIR", kb)
    assert clinical_indexer._verified_source_version(kb, "guide") == f"sha256:{hashlib.sha256(pdf.read_bytes()).hexdigest()}"
    pdf.write_bytes(b"changed source")
    assert clinical_indexer._verified_source_version(kb, "guide") is None


def test_sqlite_fts_round_trips_chunk_provenance(tmp_path):
    index = SqliteFtsIndex(tmp_path / "rag.sqlite")
    chunk = RagChunk(
        chunk_id="prov-1", source_doc="Guide", legal_basis="Basis",
        page_or_section="Section", title="Evidence heading", content="evidence query content",
        source_id="source-id", source_version="sha256:abc",
    )
    index.sync_chunks([chunk])
    result = index.search_bm25("evidence", 1)[0].chunk
    assert (result.source_id, result.source_version) == ("source-id", "sha256:abc")


def test_generated_citation_preserves_source_version_and_chunk_identity(monkeypatch):
    from app.services.rag.citation_grounder import build_claim_citations
    chunk = RagChunk(
        chunk_id="citation-chunk", source_doc="Guide", legal_basis="Authority",
        page_or_section="Section 1", title="Evidence", content="Relevant source text",
        source_id="guideline-source", source_version="sha256:verified",
    )
    monkeypatch.setattr(
        "app.services.rag.citation_grounder.resolve_citation_document",
        lambda *args, **kwargs: ("/guide.pdf#page=1", "guide", 1),
    )
    citations = build_claim_citations([RetrievedChunk(chunk=chunk, score=0.5)])
    payload = citations[0].to_dict()
    assert payload["chunk_id"] == "citation-chunk"
    assert payload["source_id"] == "guideline-source"
    assert payload["source_version"] == "sha256:verified"


def test_clinical_index_chunks_use_file_provenance_or_fail_closed(tmp_path):
    doc = tmp_path / "source.md"
    doc.write_text("### Section\n\nRelevant source statement.", encoding="utf-8")
    chunk = clinical_indexer._parse_markdown_chunks(doc, "Source", "Basis", "guideline")[0]
    assert chunk.source_id == str(doc.resolve())
    assert chunk.source_version == hashlib.sha256(doc.read_bytes()).hexdigest()


@pytest.mark.asyncio
async def test_rag_exposes_separate_document_and_graph_evidence_used_for_prompt(monkeypatch):
    chunk = RagChunk(
chunk_id="doc-1", source_doc="Curated handbook", legal_basis="Doc v1",
        page_or_section="section-1", title="Evidence", content="Document evidence text.",
        source_id="fixture-doc", source_version="sha256:fixture",
    )
    retrieved = RetrievedChunk(chunk=chunk, score=0.8)
    captured = {}

    class Retriever:
        async def retrieve_async(self, *args, **kwargs):
            return [retrieved]

    monkeypatch.setattr(rag_pipeline, "get_rag_retriever", lambda: Retriever())
    monkeypatch.setattr(rag_pipeline, "classify_query_complexity", lambda q: type("Budget", (), {"include_graph": True, "top_k": 2, "max_context_chars": 10000})())
    graph = {
        "kg_entities": ["INN:EXAMPLE"], "graph_context_text": "Graph evidence text.",
        "active_ddi_alerts": [], "graph_source": "curated-clinical-graph", "graph_version": "fixture-v1",
    }
    monkeypatch.setattr(rag_pipeline, "expand_clinical_graph", lambda *args, **kwargs: graph)
    monkeypatch.setattr(rag_pipeline, "build_claim_citations", lambda chunks, **kwargs: [])
    monkeypatch.setattr(rag_pipeline, "settings", type("Settings", (), {"GEMINI_API_KEY": ""})())

    async def fake_generate(prompt, key):
        captured["prompt"] = prompt
        return (
            "Document evidence text.\n"
            "<ANSWER_CLAIMS>[{\"claim_id\":\"claim-1\",\"text\":\"Document evidence text.\","
            "\"claim_type\":\"source_fact\",\"evidence_ids\":[\"document:doc-1\"]}]"
            "</ANSWER_CLAIMS>"
        )

    monkeypatch.setattr("app.services.copilot_gemini.query_gemini_models", fake_generate, raising=False)

    from app.services.rag.types import RagCitation
    monkeypatch.setattr(rag_pipeline, "build_claim_citations", lambda chunks, **kwargs: [RagCitation("Curated handbook", "Doc v1", "section-1", "Document evidence", chunk_id="doc-1")])
    from app.services.rag import self_rag_verifier
    original_verify_claims = self_rag_verifier.verify_answer_claims
    def verify_claims(claims, evidence_records):
        captured["verifier_evidence_ids"] = [item["evidence_id"] for item in evidence_records]
        return original_verify_claims(claims, evidence_records)
    monkeypatch.setattr(self_rag_verifier, "verify_answer_claims", verify_claims)
    result = await rag_pipeline.execute_clinical_rag("Document evidence text", api_key="test-api-key-12345")

    assert "Document evidence text." in captured["prompt"]
    assert "Graph evidence text." in captured["prompt"]
    assert captured["verifier_evidence_ids"] == ["graph:curated-clinical-graph", "document:doc-1"]
    response = result.to_response_dict()
    assert [item["evidence_type"] for item in response["evidence"]] == ["document_chunk"]
    assert response["evidence"][0]["source_id"] == "fixture-doc"
