"""
Tests for Specialty Clinical Knowledge Registry (Phase 2 De-hardcoding).
Verifies:
1. Dynamic loading of 75+ clinical guidelines from JSON.
2. Accurate multi-candidate entity and query matching (raw, lowercase, unaccented).
3. Seamless integration with ConversationalClinicalEngine.
4. RAG chunk indexing consistency.
5. Hot-reload capability.
"""

import pytest
from app.services.chatbot.specialty_knowledge_registry import SpecialtyKnowledgeRegistry
from app.services.chatbot.conversational_clinical_engine import (
    find_clinical_specialty_consultation,
    SPECIALTY_CLINICAL_KNOWLEDGE,
    TOPIC_ANCHORS,
)
from app.services.rag.clinical_indexer import load_all_clinical_chunks


def test_registry_initialization_and_count():
    registry = SpecialtyKnowledgeRegistry.get_instance()
    assert registry.total_topics >= 75
    assert len(registry.get_knowledge_items()) >= 75
    assert len(registry.get_topic_anchors()) >= 70


def test_registry_backward_compatibility_engine():
    # Verify module getattr backward compatibility
    assert len(SPECIALTY_CLINICAL_KNOWLEDGE) >= 75
    assert len(TOPIC_ANCHORS) >= 70
    assert isinstance(SPECIALTY_CLINICAL_KNOWLEDGE, list)
    assert isinstance(TOPIC_ANCHORS, dict)


@pytest.mark.parametrize(
    "query, expected_substring",
    [
        ("paracetamol cho bà bầu", "thai kỳ"),
        ("phụ nữ mang thai dùng paracetamol được không", "thai kỳ"),
        ("lựa chọn thuốc kháng histamin cho phụ nữ cho con bú", "cho con bú"),
        ("paracetamol có an toàn cho con bú sữa mẹ không", "cho con bú"),
        ("lựa chọn vận mạch trong sốc tim noradrenalin hay dopamin", "sốc tim"),
        ("chống chỉ định aspirin ở trẻ em hội chứng reye", "reye"),
        ("lựa chọn siro ho và hạ sốt thảo dược cho trẻ sơ sinh", "hạ sốt"),
        ("ngộ độc paracetamol quá liều và giải độc đặc hiệu", "paracetamol"),
        ("chăm sóc giảm nhẹ quản lý đau ung thư theo who", "ung thư"),
    ],
)
def test_specialty_consultation_queries(query, expected_substring):
    match = find_clinical_specialty_consultation(query)
    assert match is not None, f"Query '{query}' should match a clinical topic"
    assert expected_substring.lower() in match["topic"].lower()
    assert "bluf" in match
    assert "details" in match
    assert len(match["details"]) > 0


def test_unaccented_query_matching():
    # Test query without Vietnamese accents
    raw_query = "paracetamol cho ba bau mang thai"
    match = find_clinical_specialty_consultation(raw_query)
    assert match is not None
    assert "thai kỳ" in match["topic"].lower()


def test_hot_reload():
    registry = SpecialtyKnowledgeRegistry.get_instance()
    initial_count = registry.total_topics
    registry.reload()
    assert registry.total_topics == initial_count


def test_rag_chunk_indexing_of_specialty_guidelines():
    chunks = load_all_clinical_chunks()
    spec_chunks = [c for c in chunks if c.chunk_id.startswith("spec_guideline_")]
    assert len(spec_chunks) >= 75
    for chunk in spec_chunks:
        assert chunk.entity_type == "guideline"
        assert len(chunk.content) > 50
        assert len(chunk.keywords) > 0
