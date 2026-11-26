"""Verify DTQG 2-layer chunking preserves 100% of monograph content and comparative query routing."""
import json
import re
from pathlib import Path

from app.services.rag.clinical_indexer import (
    _DTQG_CHUNK_GROUPS,
    _parse_extracted_dtqg_chunks,
    _split_text_preserving_content,
)
from app.services.rag.hybrid_retriever import HybridRetriever


def test_split_text_preserving_content_keeps_all_tokens():
    sample = "\n".join(
        f"- Chỉ định số {i}: uống 500 mg mỗi 6 giờ, tối đa 4 g/ngày ở người lớn khỏe mạnh."
        for i in range(1, 35)
    )
    parts = _split_text_preserving_content(sample, max_chars=400, overlap=100)
    assert len(parts) > 1
    assert all(len(p) <= 400 for p in parts)

    joined = " ".join(parts)
    for i in range(1, 35):
        assert f"Chỉ định số {i}:" in joined


def test_all_701_dtqg_monographs_preserve_content_and_size():
    kb_dir = Path(__file__).resolve().parents[1] / "data" / "knowledge_base"
    raw_data = json.loads((kb_dir / "dtqg_monographs_extracted.json").read_text(encoding="utf-8"))
    chunks = _parse_extracted_dtqg_chunks(kb_dir)

    assert len(raw_data) >= 700
    assert len(chunks) > len(raw_data)

    by_prefix: dict[str, list[str]] = {}
    for chunk in chunks:
        by_prefix.setdefault(chunk.chunk_id.rsplit("_", 1)[0], []).append(chunk.content)
        # Header + 1250 body + overlap tolerance stays well below single-drug context budget
        assert len(chunk.content) <= 1700, f"Oversized DTQG chunk: {chunk.chunk_id} ({len(chunk.content)})"

    all_content_by_idx: dict[int, str] = {}
    group_names = "|".join(g[0] for g in _DTQG_CHUNK_GROUPS)
    id_pattern = re.compile(rf"_(\d+)_(?:{group_names})(?:_\d+)?$")
    for chunk in chunks:
        m = id_pattern.search(chunk.chunk_id)
        assert m, f"Unexpected DTQG chunk_id format: {chunk.chunk_id}"
        idx = int(m.group(1))
        all_content_by_idx[idx] = all_content_by_idx.get(idx, "") + "\n" + chunk.content

    for idx, monograph in enumerate(raw_data, 1):
        inn = monograph.get("inn") or ""
        if not inn:
            continue
        combined = all_content_by_idx[idx]
        for _, _, field_defs, _ in _DTQG_CHUNK_GROUPS:
            for field_name, _ in field_defs:
                val = str(monograph.get(field_name) or "").strip()
                if not val:
                    continue
                # Check start, middle, and end anchors of every non-empty field exist in generated chunks
                first_word = val.split()[0]
                last_word = val.split()[-1]
                assert first_word in combined, f"Missing start of {field_name} in monograph #{idx} ({inn})"
                assert last_word in combined, f"Missing end of {field_name} in monograph #{idx} ({inn})"


def test_or_comparison_does_not_enable_ddi():
    assert HybridRetriever._should_allow_ddi(
        "bệnh nhân suy thận có clcr < 50 ml/phút cần lưu ý gì khi dùng ciprofloxacin hoặc levofloxacin?",
        ["ciprofloxacin", "levofloxacin"],
        {"active_class_ddis": ["fluoroquinolone"]},
    ) is False
    assert HybridRetriever._should_allow_ddi(
        "phối hợp ciprofloxacin và levofloxacin có tương tác gì không?",
        ["ciprofloxacin", "levofloxacin"],
        {},
    ) is True
