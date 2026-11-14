from app.services.rag.types import filter_evidence_for_citations


def test_chat_evidence_only_contains_document_chunks_with_returned_citations():
    evidence = [
        {"evidence_type": "document_chunk", "chunk_id": "c1"},
        {"evidence_type": "document_chunk", "chunk_id": "c2"},
        {"evidence_type": "knowledge_graph", "source_id": "curated"},
    ]
    filtered = filter_evidence_for_citations(evidence, [{"chunk_id": "c1"}])
    assert filtered == [evidence[0], evidence[2]]
