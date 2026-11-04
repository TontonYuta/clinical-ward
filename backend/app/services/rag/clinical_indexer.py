"""
Clinical Indexer: Ingestion & Semantic Chunking for Medical Knowledge
Chunking theo từng chuyên luận, điều khoản và tương tác thuốc (<=180 LOC)
"""
import os
import re
import json
from pathlib import Path
from app.services.rag.types import RagChunk

LOCAL_DOCS_DIR = Path(__file__).resolve().parent / "knowledge_docs"
KB_BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent / "data" / "knowledge_base"

def get_active_kb_dir() -> Path:
    if KB_BASE_DIR.exists() and (KB_BASE_DIR / "clinical_pharmacopoeia").exists():
        return KB_BASE_DIR
    return LOCAL_DOCS_DIR

def _extract_keywords(text: str) -> list[str]:
    tokens = re.findall(r"\w+", text, flags=re.UNICODE)
    stopwords = {
        "căn", "cứ", "pháp", "lý", "quy", "định", "theo", "khoản", "điều", "trong",
        "cho", "của", "các", "thuộc", "được", "người", "bệnh", "những", "khi", "hoặc",
        "dùng", "với", "không", "thành", "phần", "tính", "chất", "tham", "khảo", "thông", "tin",
        "dưới", "đây", "dạng", "dược", "lâm", "sàng", "chuyên", "luận", "thuốc"
    }
    keywords = {t.strip().lower() for t in tokens if len(t.strip()) >= 3 and t.strip().lower() not in stopwords}
    return sorted(list(keywords))[:40]

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
        # Bound retrieval units by characters while respecting paragraph and
        # line boundaries where possible. Carry the section heading as metadata.
        pieces: list[str] = []
        current = ""
        for paragraph in re.split(r"\n\s*\n", sec):
            paragraph = paragraph.strip()
            if not paragraph:
                continue
            if len(paragraph) > 1200:
                if current:
                    pieces.append(current)
                    current = ""
                lines = paragraph.splitlines()
                line_chunk = ""
                for line in lines:
                    line = line.strip()
                    if len(line) > 1200:
                        if line_chunk:
                            pieces.append(line_chunk)
                            line_chunk = ""
                        pieces.extend(line[start:start + 1200] for start in range(0, len(line), 1200))
                    elif line_chunk and len(line_chunk) + len(line) + 1 > 1200:
                        pieces.append(line_chunk)
                        line_chunk = line
                    else:
                        line_chunk = f"{line_chunk}\n{line}".strip()
                if line_chunk:
                    pieces.append(line_chunk)
            elif current and len(current) + len(paragraph) + 2 > 1200:
                pieces.append(current)
                current = paragraph
            else:
                current = f"{current}\n\n{paragraph}".strip()
        if current:
            pieces.append(current)

        for part_idx, part in enumerate(pieces, start=1):
            chunk_id = f"{file_path.stem}_{i+1}_{part_idx}"
            keywords = _extract_keywords(title_line + " " + part[:300])
            chunks.append(RagChunk(
                chunk_id=chunk_id,
                source_doc=source_doc,
                legal_basis=legal_basis,
                page_or_section=title_line,
                title=title_line,
                content=part,
                keywords=keywords,
                entity_type=entity_type
            ))
    return chunks

def _parse_extracted_dtqg_chunks(base_dir: Path) -> list[RagChunk]:
    candidates = (
        base_dir / "dtqg_monographs_extracted.json",
        base_dir / "data" / "knowledge_base" / "dtqg_monographs_extracted.json",
        Path(__file__).resolve().parents[3] / "data" / "knowledge_base" / "dtqg_monographs_extracted.json",
        Path(__file__).resolve().parents[2] / "data" / "knowledge_base" / "dtqg_monographs_extracted.json",
    )
    json_path = next((c for c in candidates if c.exists()), None)
    if not json_path:
        return []

    try:
        data = json.loads(json_path.read_text(encoding="utf-8"))
    except Exception:
        return []

    chunks: list[RagChunk] = []
    for idx, m in enumerate(data, 1):
        inn = m.get("inn") or ""
        if not inn:
            continue
        title = m.get("title") or inn
        slug = re.sub(r"[^a-zA-Z0-9]", "_", inn).lower()[:20]
        page = m.get("start_page")
        legal_basis = m.get("source") or (f"Dược thư Quốc gia Việt Nam (Lần xuất bản II - 2015, QĐ 2033/QĐ-BYT, Trang {page}) • Tệp: Duoc_Thu_Quoc_Gia_Viet_Nam.pdf" if page else "Dược thư Quốc gia Việt Nam (Lần xuất bản II - 2015, QĐ 2033/QĐ-BYT) • Tệp: Duoc_Thu_Quoc_Gia_Viet_Nam.pdf")
        page_sec = f"{title} (Trang {page})" if page else title
        lines = (m.get("drug_class") or "").splitlines()
        drug_class_first = lines[0].strip() if lines else ""

        # 1. Chunk Chỉ định & Liều lượng
        dosage_parts = []
        if m.get("drug_class"): dosage_parts.append(f"* **Nhóm dược lý:** {m['drug_class']}")
        if m.get("atc_code"): dosage_parts.append(f"* **Mã ATC:** {m['atc_code']}")
        if m.get("dosage_forms"): dosage_parts.append(f"* **Dạng bào chế:** {m['dosage_forms']}")
        if m.get("indications"): dosage_parts.append(f"* **Chỉ định điều trị:** {m['indications']}")
        if m.get("adult_dosage"): dosage_parts.append(f"* **Liều người lớn:** {m['adult_dosage']}")
        if m.get("pediatric_dosage"): dosage_parts.append(f"* **Liều trẻ em:** {m['pediatric_dosage']}")
        if m.get("renal_adjustment"): dosage_parts.append(f"* **Hiệu chỉnh liều suy thận:** {m['renal_adjustment']}")
        if m.get("hepatic_adjustment"): dosage_parts.append(f"* **Hiệu chỉnh liều suy gan:** {m['hepatic_adjustment']}")
        if dosage_parts:
            content_a = f"### Chỉ định & Liều dùng: {title} (Hoạt chất: {inn})\n" + "\n".join(dosage_parts)
            kws_a = _extract_keywords(f"{inn} {title} {drug_class_first} {(m.get('indications') or '')[:300]} chỉ định liều dùng người lớn trẻ em suy thận suy gan")
            if m.get("atc_code"): kws_a.append(m["atc_code"].lower())
            dosage_title = f"Chỉ định & Liều lượng: {inn} ({title}) - {drug_class_first}" if drug_class_first else f"Chỉ định & Liều lượng: {inn} ({title})"
            chunks.append(RagChunk(
                chunk_id=f"dtqg_{slug}_{idx}_dosage",
                source_doc="Dược thư Quốc gia Việt Nam, lần xuất bản II",
                legal_basis=legal_basis,
                page_or_section=page_sec,
                title=dosage_title,
                content=content_a,
                keywords=kws_a,
                entity_type="monograph"
            ))

        # 2. Chunk Chống chỉ định & Thận trọng
        safety_parts = []
        if m.get("contraindications"): safety_parts.append(f"* **Chống chỉ định:** {m['contraindications']}")
        if m.get("precautions"): safety_parts.append(f"* **Thận trọng:** {m['precautions']}")
        if m.get("pregnancy_warning"): safety_parts.append(f"* **Thai kỳ & Cho con bú:** {m['pregnancy_warning']}")
        if safety_parts:
            content_b = f"### Chống chỉ định & An toàn lâm sàng: {title} (Hoạt chất: {inn})\n" + "\n".join(safety_parts)
            kws_b = _extract_keywords(f"{inn} {title} {(m.get('contraindications') or '')[:200]} {(m.get('precautions') or '')[:200]} chống chỉ định thận trọng cảnh báo thai kỳ phụ nữ có thai cho con bú")
            chunks.append(RagChunk(
                chunk_id=f"dtqg_{slug}_{idx}_safety",
                source_doc="Dược thư Quốc gia Việt Nam, lần xuất bản II",
                legal_basis=legal_basis,
                page_or_section=f"{title} - An toàn lâm sàng (Trang {page})" if page else f"{title} - An toàn lâm sàng",
                title=f"Chống chỉ định & Thận trọng: {inn} ({title})",
                content=content_b,
                keywords=kws_b,
                entity_type="monograph"
            ))

        # 3. Chunk Tác dụng phụ, Tương tác & Quá liều
        inter_parts = []
        if m.get("adverse_effects"): inter_parts.append(f"* **Tác dụng không mong muốn (ADR):** {m['adverse_effects']}")
        if m.get("drug_interactions"): inter_parts.append(f"* **Tương tác thuốc:** {m['drug_interactions']}")
        if m.get("overdose_treatment"): inter_parts.append(f"* **Xử trí quá liều:** {m['overdose_treatment']}")
        if m.get("antidote"): inter_parts.append(f"* **Thuốc giải độc đặc hiệu:** {m['antidote']}")
        if inter_parts:
            content_c = f"### Tác dụng phụ, Tương tác & Quá liều: {title} (Hoạt chất: {inn})\n" + "\n".join(inter_parts)
            kws_c = _extract_keywords(f"{inn} {title} {(m.get('adverse_effects') or '')[:200]} {(m.get('drug_interactions') or '')[:200]} tác dụng phụ tác dụng không mong muốn adr tương tác thuốc quá liều ngộ độc giải độc")
            if m.get("antidote"): kws_c.append(m["antidote"].lower())
            chunks.append(RagChunk(
                chunk_id=f"dtqg_{slug}_{idx}_inter",
                source_doc="Dược thư Quốc gia Việt Nam, lần xuất bản II",
                legal_basis=legal_basis,
                page_or_section=f"{title} - Tương tác & Quá liều (Trang {page})" if page else f"{title} - Tương tác & Quá liều",
                title=f"Tác dụng phụ, Tương tác & Quá liều: {inn} ({title})",
                content=content_c,
                keywords=kws_c,
                entity_type="monograph"
            ))

    return chunks

def load_all_clinical_chunks(base_dir: Path | None = None) -> list[RagChunk]:
    active_dir = base_dir or get_active_kb_dir()
    all_chunks: list[RagChunk] = []
    
    # 1. Dược thư Quốc gia Việt Nam, lần xuất bản II (2015) - Toàn bộ 771 Chuyên luận
    all_chunks.extend(_parse_extracted_dtqg_chunks(active_dir))

    # Core stubs bảo tồn tính tương thích ngược
    mono_path = active_dir / "clinical_pharmacopoeia" / "core_inns_monographs.md"
    all_chunks.extend(_parse_markdown_chunks(
        mono_path,
        source_doc="Chuyên luận nội bộ trích xuất/bổ sung; cần đối chiếu Dược thư bản gốc",
        legal_basis="Nguồn dẫn trong từng bản ghi; không tự coi là văn bản pháp quy",
        entity_type="monograph"
    ))

    # 2. Tương tác thuốc chống chỉ định QĐ 5948
    ddi_cardio = active_dir / "ddi_interactions" / "qd_5948_cardiovascular_and_cns.md"
    all_chunks.extend(_parse_markdown_chunks(
        ddi_cardio,
        source_doc="Danh Mục Tương Tác Thuốc Chống Chỉ Định (Tim Mạch & Thần Kinh)",
        legal_basis="Quyết định 5948/QĐ-BYT",
        entity_type="ddi"
    ))
    ddi_anti = active_dir / "ddi_interactions" / "qd_5948_antibiotics_and_antiinflammatory.md"
    all_chunks.extend(_parse_markdown_chunks(
        ddi_anti,
        source_doc="Danh Mục Tương Tác Thuốc Chống Chỉ Định (Kháng Sinh & NSAID)",
        legal_basis="Quyết định 5948/QĐ-BYT",
        entity_type="ddi"
    ))
    ddi_meta = active_dir / "ddi_interactions" / "qd_5948_metabolic_and_gastrointestinal.md"
    all_chunks.extend(_parse_markdown_chunks(
        ddi_meta,
        source_doc="Danh Mục Tương Tác Thuốc Chống Chỉ Định (Chuyển Hóa & Tiêu Hóa)",
        legal_basis="Quyết định 5948/QĐ-BYT",
        entity_type="ddi"
    ))
    ddi_blood = active_dir / "ddi_interactions" / "qd_5948_anticoagulants_and_hematology.md"
    all_chunks.extend(_parse_markdown_chunks(
        ddi_blood,
        source_doc="Danh Mục Tương Tác Thuốc Chống Chỉ Định (Chống Đông & Huyết Học)",
        legal_basis="Quyết định 5948/QĐ-BYT",
        entity_type="ddi"
    ))

    # 3. Thông tư cấp cứu phản vệ TT 51/2017
    tt51_path = active_dir / "regulatory_circulars" / "tt51_2017_anaphylaxis_protocol.md"
    all_chunks.extend(_parse_markdown_chunks(
        tt51_path,
        source_doc="Phác Đồ Cấp Cứu Phản Vệ",
        legal_basis="Thông tư 51/2017/TT-BYT",
        entity_type="circular"
    ))

    # 4. Quản lý thuốc gây nghiện TT 20/2017
    tt20_path = active_dir / "regulatory_circulars" / "tt20_2017_narcotics_management.md"
    all_chunks.extend(_parse_markdown_chunks(
        tt20_path,
        source_doc="Quy Chế Quản Lý Thuốc Kiểm Soát Đặc Biệt",
        legal_basis="Thông tư 20/2017/TT-BYT",
        entity_type="circular"
    ))

    # 5. Khoa dược & Tủ trực TT 22/2011
    tt22_path = active_dir / "regulatory_circulars" / "tt22_2011_hospital_pharmacy_ward.md"
    all_chunks.extend(_parse_markdown_chunks(
        tt22_path,
        source_doc="Quy Chế Tủ Thuốc Cấp Cứu & Tủ Trực Khoa Lâm Sàng",
        legal_basis="Thông tư 22/2011/TT-BYT",
        entity_type="circular"
    ))

    # 6. Hướng dẫn Dược Lâm Sàng & An Toàn Thuốc Chuyên Sâu (Specialty Clinical Guidelines)
    try:
        from app.services.chatbot.conversational_clinical_engine import SPECIALTY_CLINICAL_KNOWLEDGE
        for idx, item in enumerate(SPECIALTY_CLINICAL_KNOWLEDGE):
            topic = item.get("topic", "Hướng dẫn Lâm sàng")
            bluf = item.get("bluf", "")
            details_list = item.get("details", [])
            details_text = "\n".join(details_list)
            warnings = item.get("warnings", "")
            legal = item.get("legal", "Dược thư Quốc gia Việt Nam DĐVN V & Hướng dẫn Bộ Y tế")
            clean_slug = re.sub(r"[^\w]+", "_", topic.lower())[:35]

            body_lines = [
                f"### Hướng Dẫn Dược Lâm Sàng: {topic}",
                f"**Kết luận lâm sàng chính (Core Clinical Guidance):**\n{bluf}",
                f"**Chi tiết thực hành & Cơ sở dược lý học:**\n{details_text}"
            ]
            if warnings:
                body_lines.append(f"**Cảnh báo an toàn quan trọng:** {warnings}")

            full_content = "\n\n".join(body_lines)
            kw_pool = item.get("keywords", []) + _extract_keywords(f"{topic} {bluf} {details_text}")
            unique_kws = sorted(list(set(kw.strip().lower() for kw in kw_pool if len(kw.strip()) >= 2)))

            all_chunks.append(RagChunk(
                chunk_id=f"spec_guideline_{idx}_{clean_slug}",
                source_doc=f"Hướng Dẫn Chuyên Môn Lâm Sàng: {topic}",
                legal_basis=legal,
                page_or_section=topic,
                title=topic,
                content=full_content,
                keywords=unique_kws,
                entity_type="guideline"
            ))
    except Exception:
        pass

    return all_chunks
