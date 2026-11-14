from app.services.rag.types import EvidenceRecord


def test_rag_result_filters_evidence_to_cited_document_chunks_and_keeps_graph_separate():
    from app.services.rag.types import RagCitation, RagResult

    cited = RagCitation("handbook", "v2", "section", "excerpt", chunk_id="kept")
    result = RagResult(
        query="q", answer="a", citations=[cited],
        evidence=[
            EvidenceRecord("document:kept", "document_chunk", "handbook", "v2", "text", chunk_id="kept").to_dict(),
            EvidenceRecord("document:filtered", "document_chunk", "handbook", "v2", "hidden", chunk_id="filtered").to_dict(),
            EvidenceRecord("graph:curated", "knowledge_graph", "curated", "v3", "graph text").to_dict(),
        ],
    )

    assert [item["evidence_id"] for item in result.to_response_dict()["evidence"]] == ["document:kept", "graph:curated"]
