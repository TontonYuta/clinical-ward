"""
Clinical Indexer: Ingestion & Semantic Chunking for Medical Knowledge
Chunking theo từng chuyên luận, điều khoản và tương tác thuốc (<=180 LOC)
"""
import os
import re
from pathlib import Path
from app.services.rag.types import RagChunk

KB_BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent / "data" / "knowledge_base"

def _extract_keywords(text: str) -> list[str]:
    keywords = set()
    matches = re.findall(r"([A-Za-z0-9\-]{3,}|[\w\s]{4,})", text)
    stopwords = {"căn", "cứ", "pháp", "lý", "quy", "định", "theo", "khoản", "điều", "trong", "cho", "của", "các"}
    for m in matches:
        w = m.strip().lower()
        if len(w) >= 3 and w not in stopwords:
            keywords.add(w)
    return list(keywords)[:30]

def _parse_markdown_chunks(file_path: Path, source_doc: str, legal_basis: str, entity_type: str) -> list[RagChunk]:
    if not file_path.exists():
        return []
    content = file_path.read_text(encoding="utf-8")
    sections = re.split(r"\n(?=###\s+)", content)
    chunks: list[RagChunk] = []

    for i, sec in enumerate(sections):
        sec = sec.strip()
        if not sec:
            continue
        lines = sec.split("\n")
        title_line = lines[0].replace("#", "").strip() if lines else "Tài liệu Y tế"
        chunk_id = f"{file_path.stem}_{i+1}"
        keywords = _extract_keywords(title_line + " " + sec[:200])

        chunks.append(
            RagChunk(
                chunk_id=chunk_id,
                source_doc=source_doc,
                legal_basis=legal_basis,
                page_or_section=title_line,
                title=title_line,
                content=sec,
                keywords=keywords,
                entity_type=entity_type
            )
        )
    return chunks

def load_all_clinical_chunks(base_dir: Path = KB_BASE_DIR) -> list[RagChunk]:
    all_chunks: list[RagChunk] = []
    
    # 1. Dược thư Quốc Gia 2022
    mono_path = base_dir / "clinical_pharmacopoeia" / "core_inns_monographs.md"
    all_chunks.extend(_parse_markdown_chunks(
        mono_path,
        source_doc="Dược Thư Quốc Gia Việt Nam 2022",
        legal_basis="Quyết định 3445/QĐ-BYT",
        entity_type="monograph"
    ))

    # 2. Tương tác thuốc chống chỉ định QĐ 5948
    ddi_cardio = base_dir / "ddi_interactions" / "qd_5948_cardiovascular_and_cns.md"
    all_chunks.extend(_parse_markdown_chunks(
        ddi_cardio,
        source_doc="Danh Mục Tương Tác Thuốc Chống Chỉ Định (Tim Mạch & Thần Kinh)",
        legal_basis="Quyết định 5948/QĐ-BYT",
        entity_type="ddi"
    ))
    ddi_anti = base_dir / "ddi_interactions" / "qd_5948_antibiotics_and_antiinflammatory.md"
    all_chunks.extend(_parse_markdown_chunks(
        ddi_anti,
        source_doc="Danh Mục Tương Tác Thuốc Chống Chỉ Định (Kháng Sinh & NSAID)",
        legal_basis="Quyết định 5948/QĐ-BYT",
        entity_type="ddi"
    ))

    # 3. Thông tư cấp cứu phản vệ TT 51/2017
    tt51_path = base_dir / "regulatory_circulars" / "tt51_2017_anaphylaxis_protocol.md"
    all_chunks.extend(_parse_markdown_chunks(
        tt51_path,
        source_doc="Phác Đồ Cấp Cứu Phản Vệ",
        legal_basis="Thông tư 51/2017/TT-BYT",
        entity_type="circular"
    ))

    # 4. Quản lý thuốc gây nghiện TT 20/2017
    tt20_path = base_dir / "regulatory_circulars" / "tt20_2017_narcotics_management.md"
    all_chunks.extend(_parse_markdown_chunks(
        tt20_path,
        source_doc="Quy Chế Quản Lý Thuốc Kiểm Soát Đặc Biệt",
        legal_basis="Thông tư 20/2017/TT-BYT",
        entity_type="circular"
    ))

    # 5. Khoa dược & Tủ trực TT 22/2011
    tt22_path = base_dir / "regulatory_circulars" / "tt22_2011_hospital_pharmacy_ward.md"
    all_chunks.extend(_parse_markdown_chunks(
        tt22_path,
        source_doc="Quy Chế Tủ Thuốc Cấp Cứu & Tủ Trực Khoa Lâm Sàng",
        legal_basis="Thông tư 22/2011/TT-BYT",
        entity_type="circular"
    ))

    return all_chunks
