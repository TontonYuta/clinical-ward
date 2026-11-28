"""
Clinical Indexer: Ingestion & Semantic Chunking for Medical Knowledge
Chunking theo từng chuyên luận, điều khoản và tương tác thuốc (<=180 LOC)
"""
import gc
import os
import re
import sys
import json
import hashlib
from pathlib import Path
from app.services.rag.types import RagChunk

LOCAL_DOCS_DIR = Path(__file__).resolve().parent / "knowledge_docs"
KB_BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent / "data" / "knowledge_base"

def get_active_kb_dir() -> Path:
    if KB_BASE_DIR.exists() and (KB_BASE_DIR / "clinical_pharmacopoeia").exists():
        return KB_BASE_DIR
    return LOCAL_DOCS_DIR

def _file_sha256(path: Path) -> str | None:
    if not path.is_file():
        return None
    digest = hashlib.sha256()
    with path.open("rb") as source_file:
        for block in iter(lambda: source_file.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()

def _stable_source_id(path: Path) -> str:
    repository_root = Path(__file__).resolve().parents[4]
    try:
        return path.resolve().relative_to(repository_root).as_posix()
    except ValueError:
        return path.resolve().as_posix()

def _manifest_sources(base_dir: Path) -> dict[str, dict]:
    manifest_path = (base_dir / "clinical_source_manifest.json") if base_dir.name == "knowledge_base" else (base_dir.parent / "clinical_source_manifest.json")
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, ValueError, TypeError):
        return {}
    sources = manifest.get("sources", []) if isinstance(manifest, dict) else []
    return {item["id"]: item for item in sources if isinstance(item, dict) and item.get("id")}

def _verified_source_version(base_dir: Path, source_id: str | None) -> str | None:
    if not source_id:
        return None
    source = _manifest_sources(base_dir).get(source_id)
    if not source or not source.get("sha256"):
        return None
    relative_path = source.get("backend_copy")
    if not relative_path:
        return None
    artifact_path = (base_dir.parent.parent.parent / relative_path) if base_dir.name == "knowledge_base" else (Path(__file__).resolve().parents[4] / relative_path)
    actual = _file_sha256(artifact_path)
    expected = str(source["sha256"]).casefold()
    if actual is None or actual.casefold() != expected:
        return None
    return f"sha256:{actual}"

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

def _extract_doc_abbreviations(content: str) -> dict[str, str]:
    """Automatically learn `<Full Phrase> (<ABBR>)` definitions from the document's own text."""
    abbr_map: dict[str, str] = {}
    for m in re.finditer(r"([A-Za-zÀ-ỹĐđ][A-Za-zÀ-ỹĐđ\s-]{6,90}?)\s*\(([A-ZÀ-ỸĐ]{2,10})\)", content):
        phrase = " ".join(m.group(1).split()).strip(" -:,.")
        abbr = m.group(2).strip()
        words = phrase.split()
        # Keep the trailing 2-7 words that actually form the expanded term
        if len(words) >= 2 and abbr not in abbr_map:
            abbr_map[abbr] = " ".join(words[-min(7, len(words)):])
    return abbr_map


def _parse_markdown_chunks(file_path: Path, source_doc: str, legal_basis: str, entity_type: str, *, source_id: str | None = None, source_version: str | None = None) -> list[RagChunk]:
    if not file_path.exists():
        return []
    content = file_path.read_text(encoding="utf-8")
    doc_abbrs = _extract_doc_abbreviations(content)
    sections = (
        re.split(r"\n(?=###\s+)", content)
        if ("\n### " in content or content.startswith("### "))
        else re.split(r"\n(?=##\s+)", content)
    )
    chunks: list[RagChunk] = []
    pending_heading = ""

    for i, sec in enumerate(sections):
        sec = sec.strip()
        if not sec:
            continue
        lines = sec.split("\n")
        title_line = lines[0].replace("#", "").strip() if lines else "Tài liệu Y tế"
        # Clean page-marker & digital-signature watermark noise before chunking.
        cleaned_sec_lines = [
            re.sub(r"\b[a-z0-9_.]+_[A-Za-zÀ-ỹ\s]+_\d{2}/\d{2}/\d{4}\s+\d{2}:\d{2}:\d{2}\b", "", ln.strip()).strip()
            for ln in lines
            if ln.strip()
            and not re.match(r"^##\s+Hướng dẫn\s+.*\(Trang\s+\d+", ln.strip(), re.IGNORECASE)
            and not ln.strip().startswith("**Nguồn:**")
        ]
        cleaned_sec_lines = [ln for ln in cleaned_sec_lines if ln]
        if not cleaned_sec_lines:
            continue
        raw_joined = "\n".join(cleaned_sec_lines)
        # Merge bare heading-only stub sections into the following content section
        # so empty headings/TOC lines never crowd out substantive guideline chunks.
        if len(raw_joined) < 130 and len(cleaned_sec_lines) <= 2 and not re.search(r"[.!?]", raw_joined):
            pending_heading = f"{pending_heading} — {title_line}".strip(" —") if pending_heading else title_line
            continue
        if pending_heading:
            title_line = f"{pending_heading} — {title_line}" if title_line != pending_heading else title_line
            cleaned_sec_lines.insert(0, f"### {pending_heading}")
            pending_heading = ""
        merged_sec: list[str] = []
        for ln in cleaned_sec_lines:
            is_item = ln.startswith("#") or bool(re.match(r"^(?:[-•*]|\d+[.)]|[a-z]\))\s+", ln))
            if is_item or not merged_sec or merged_sec[-1].endswith((".", ":", ";", "!", "?")):
                merged_sec.append(ln)
            else:
                merged_sec[-1] = f"{merged_sec[-1]} {ln}"
        sec = "\n".join(merged_sec)

        # Bound retrieval units by characters while respecting sentence and bullet boundaries.
        pieces: list[str] = []
        current = ""
        for paragraph in re.split(r"\n\s*\n|\n(?=(?:\d+\.\s+[A-ZÀ-Ỹ]|[a-z]\)\s+|#{1,3}\s+))", sec):
            paragraph = paragraph.strip()
            if not paragraph:
                continue
            if len(paragraph) > 1200:
                if current:
                    pieces.append(current)
                    current = ""
                units = re.split(r"(?<=[.!?])\s+|\n(?=[-*•]|\d+[.)]|[a-z]\))", paragraph)
                unit_chunk = ""
                for unit in units:
                    unit = unit.strip()
                    if not unit:
                        continue
                    if len(unit) > 1200:
                        if unit_chunk:
                            pieces.append(unit_chunk)
                            unit_chunk = ""
                        pieces.extend(unit[start:start + 1200] for start in range(0, len(unit), 1200))
                    elif unit_chunk and len(unit_chunk) + len(unit) + 1 > 1200:
                        pieces.append(unit_chunk)
                        unit_chunk = unit
                    else:
                        unit_chunk = f"{unit_chunk}\n{unit}".strip()
                if unit_chunk:
                    pieces.append(unit_chunk)
            elif current and len(current) + len(paragraph) + 2 > 1200:
                pieces.append(current)
                current = paragraph
            else:
                current = f"{current}\n\n{paragraph}".strip()
        if current:
            pieces.append(current)

        for part_idx, part in enumerate(pieces, start=1):
            clean_part = part.strip()
            if not clean_part:
                continue
            chunk_id = f"{file_path.stem}_{i+1}_{part_idx}"
            expanded_terms = " ".join(
                expansion for abbr, expansion in doc_abbrs.items()
                if re.search(rf"\b{re.escape(abbr)}\b", clean_part)
            )
            keywords = _extract_keywords(f"{title_line} {clean_part[:300]} {expanded_terms}")
            chunks.append(RagChunk(
                chunk_id=chunk_id,
                source_doc=source_doc,
                legal_basis=legal_basis,
                page_or_section=title_line,
                title=title_line,
                content=clean_part,
                keywords=keywords,
                entity_type=entity_type,
                source_id=source_id or _stable_source_id(file_path),
                source_version=source_version or _file_sha256(file_path),
            ))
    return chunks

def _split_text_preserving_content(text: str, max_chars: int = 1250, overlap: int = 150) -> list[str]:
    """Split long clinical text at newline/sentence boundaries without dropping any content."""
    clean = (text or "").strip()
    if not clean:
        return []
    if len(clean) <= max_chars:
        return [clean]

    # Tokenize into natural units (lines first, then sentences/clauses if a line is too long)
    units: list[str] = []
    for line in clean.splitlines():
        ln = line.strip()
        if not ln:
            continue
        if len(ln) <= max_chars:
            units.append(ln)
            continue
        for sent in re.split(r"(?<=[.;!?])\s+", ln):
            s = sent.strip()
            if not s:
                continue
            if len(s) <= max_chars:
                units.append(s)
            else:
                # Hard wrap only at whitespace boundaries if a single sentence exceeds max_chars
                words = s.split()
                cur = ""
                for w in words:
                    cand = f"{cur} {w}".strip() if cur else w
                    if len(cand) > max_chars and cur:
                        units.append(cur)
                        cur = w
                    else:
                        cur = cand
                if cur:
                    units.append(cur)

    parts: list[str] = []
    idx = 0
    while idx < len(units):
        buf: list[str] = []
        buf_len = 0
        start_idx = idx
        while idx < len(units):
            u = units[idx]
            add_len = len(u) + (1 if buf else 0)
            if buf and buf_len + add_len > max_chars:
                break
            buf.append(u)
            buf_len += add_len
            idx += 1
        parts.append("\n".join(buf))
        if idx >= len(units):
            break
        # Step back by up to 1 unit (<= overlap chars) so context across boundaries stays intact
        if idx - start_idx > 1 and len(units[idx - 1]) <= overlap:
            idx -= 1
    return parts


_DTQG_CHUNK_GROUPS: tuple[tuple[str, str, tuple[tuple[str, str], ...], str], ...] = (
    (
        "overview",
        "Thông tin chung & Dạng bào chế",
        (("drug_class", "Nhóm dược lý"), ("atc_code", "Mã ATC"), ("dosage_forms", "Dạng bào chế")),
        "nhóm dược lý atc dạng bào chế thành phần",
    ),
    (
        "indications",
        "Chỉ định điều trị",
        (("indications", "Chỉ định điều trị"),),
        "chỉ định điều trị công dụng",
    ),
    (
        "adult_dosage",
        "Liều dùng người lớn",
        (("adult_dosage", "Liều người lớn"),),
        "liều dùng người lớn liều tối đa cách dùng",
    ),
    (
        "pediatric_dosage",
        "Liều dùng trẻ em",
        (("pediatric_dosage", "Liều trẻ em"),),
        "liều dùng trẻ em nhi khoa",
    ),
    (
        "organ_adjustment",
        "Hiệu chỉnh liều suy thận & suy gan",
        (("renal_adjustment", "Hiệu chỉnh liều suy thận"), ("hepatic_adjustment", "Hiệu chỉnh liều suy gan")),
        "hiệu chỉnh liều suy thận clcr egfr suy gan",
    ),
    (
        "contraindications",
        "Chống chỉ định & Thai kỳ",
        (("contraindications", "Chống chỉ định"), ("pregnancy_warning", "Thai kỳ & Cho con bú")),
        "chống chỉ định thai kỳ phụ nữ có thai cho con bú",
    ),
    (
        "precautions",
        "Thận trọng lâm sàng",
        (("precautions", "Thận trọng"),),
        "thận trọng cảnh báo lưu ý",
    ),
    (
        "adr",
        "Tác dụng không mong muốn (ADR)",
        (("adverse_effects", "Tác dụng không mong muốn (ADR)"),),
        "tác dụng phụ tác dụng không mong muốn adr",
    ),
    (
        "interactions",
        "Tương tác thuốc",
        (("drug_interactions", "Tương tác thuốc"),),
        "tương tác thuốc tương kỵ",
    ),
    (
        "overdose",
        "Quá liều & Giải độc",
        (("overdose_treatment", "Xử trí quá liều"), ("antidote", "Thuốc giải độc đặc hiệu")),
        "quá liều ngộ độc xử trí giải độc",
    ),
)


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
        with json_path.open("rb") as f:
            data = json.load(f)
    except Exception:
        return []

    chunks: list[RagChunk] = []
    extracted_version = _file_sha256(json_path)
    source_id = sys.intern(_stable_source_id(json_path))
    source_version = sys.intern(f"sha256:{extracted_version}") if extracted_version else None
    source_doc_name = sys.intern("Dược thư Quốc gia Việt Nam, lần xuất bản II")
    entity_mono = sys.intern("monograph")
    for idx in range(1, len(data) + 1):
        m = data[idx - 1]
        data[idx - 1] = None
        if not isinstance(m, dict):
            continue
        raw_inn = (m.get("inn") or "").strip()
        inn = re.split(r"\s{4,}", raw_inn)[0].strip() if raw_inn else ""
        if not inn:
            continue
        raw_title = (m.get("title") or inn).strip()
        title = re.split(r"\s{4,}", raw_title)[0].strip() or inn
        slug = re.sub(r"[^a-zA-Z0-9]", "_", inn).lower()[:20]
        page = m.get("start_page")
        legal_basis = sys.intern(m.get("source") or (
            f"Dược thư Quốc gia Việt Nam (Lần xuất bản II - 2015, QĐ 2033/QĐ-BYT, Trang {page}) • Tệp: Duoc_Thu_Quoc_Gia_Viet_Nam.pdf"
            if page else
            "Dược thư Quốc gia Việt Nam (Lần xuất bản II - 2015, QĐ 2033/QĐ-BYT) • Tệp: Duoc_Thu_Quoc_Gia_Viet_Nam.pdf"
        ))
        lines = (m.get("drug_class") or "").splitlines()
        drug_class_first = lines[0].strip() if lines else ""

        for group_key, group_label, field_defs, extra_kws in _DTQG_CHUNK_GROUPS:
            section_parts = [
                f"* **{field_label}:** {str(m[field_name]).strip()}"
                for field_name, field_label in field_defs
                if m.get(field_name) and str(m[field_name]).strip()
            ]
            if not section_parts:
                continue

            combined_body = "\n".join(section_parts)
            sub_parts = _split_text_preserving_content(combined_body, max_chars=1250, overlap=150)
            total_parts = len(sub_parts)
            for part_idx, part_body in enumerate(sub_parts, 1):
                part_suffix = f"_{part_idx}" if total_parts > 1 else ""
                part_note = f" (phần {part_idx}/{total_parts})" if total_parts > 1 else ""
                header = f"### {group_label}: {title} (Hoạt chất: {inn}){part_note}"
                content = f"{header}\n{part_body}"
                # Keep compact interned metadata keywords only (content & title already carry full body text)
                kws = [
                    sys.intern(kw) for kw in _extract_keywords(
                        f"{inn} {title} {drug_class_first} {extra_kws}"
                    )[:12]
                ]
                if group_key == "overview" and m.get("atc_code"):
                    kws.append(sys.intern(str(m["atc_code"]).lower()))
                if group_key == "overdose" and m.get("antidote"):
                    kws.append(sys.intern(str(m["antidote"]).lower()))

                page_sec = (
                    f"{title} - {group_label}{part_note} (Trang {page})"
                    if page else f"{title} - {group_label}{part_note}"
                )
                chunks.append(RagChunk(
                    chunk_id=f"dtqg_{slug}_{idx}_{group_key}{part_suffix}",
                    source_doc=source_doc_name,
                    legal_basis=legal_basis,
                    page_or_section=page_sec,
                    title=f"{group_label}: {inn} ({title}){part_note}",
                    content=content,
                    keywords=kws,
                    entity_type=entity_mono,
                    source_id=source_id,
                    source_version=source_version,
                ))

    del data
    gc.collect()
    from app.config import trim_process_memory
    trim_process_memory()
    return chunks

def load_all_clinical_chunks(base_dir: Path | None = None) -> list[RagChunk]:
    active_dir = base_dir or get_active_kb_dir()
    all_chunks: list[RagChunk] = []
    
    # 1. Dược thư Quốc gia Việt Nam, lần xuất bản II (2015) - Toàn bộ 771 Chuyên luận
    all_chunks.extend(_parse_extracted_dtqg_chunks(active_dir))

    # Core stubs bảo tồn tính tương thích ngược
    mono_path = active_dir / "clinical_pharmacopoeia" / "core_inns_monographs.md"
    derived_mono_chunks = _parse_markdown_chunks(
        mono_path,
        source_doc="Chuyên luận nội bộ trích xuất/bổ sung; cần đối chiếu Dược thư bản gốc",
        legal_basis="Nguồn dẫn trong từng bản ghi; không tự coi là văn bản pháp quy",
        entity_type="monograph",
    )
    for chunk in derived_mono_chunks:
        chunk.source_id = _stable_source_id(mono_path)
        chunk.source_version = None
    all_chunks.extend(derived_mono_chunks)

    # 2. Tương tác thuốc chống chỉ định QĐ 5948
    ddi_cardio = active_dir / "ddi_interactions" / "qd_5948_cardiovascular_and_cns.md"
    ddi_manifest_version = _verified_source_version(KB_BASE_DIR, "qd-5948-2021")
    all_chunks.extend(_parse_markdown_chunks(
        ddi_cardio,
        source_doc="Danh Mục Tương Tác Thuốc Chống Chỉ Định (Tim Mạch & Thần Kinh)",
        legal_basis="Quyết định 5948/QĐ-BYT",
        entity_type="ddi",
        source_id="qd-5948-2021",
        source_version=ddi_manifest_version,
    ))
    ddi_anti = active_dir / "ddi_interactions" / "qd_5948_antibiotics_and_antiinflammatory.md"
    all_chunks.extend(_parse_markdown_chunks(
        ddi_anti,
        source_doc="Danh Mục Tương Tác Thuốc Chống Chỉ Định (Kháng Sinh & NSAID)",
        legal_basis="Quyết định 5948/QĐ-BYT",
        entity_type="ddi",
        source_id="qd-5948-2021",
        source_version=ddi_manifest_version,
    ))
    ddi_meta = active_dir / "ddi_interactions" / "qd_5948_metabolic_and_gastrointestinal.md"
    all_chunks.extend(_parse_markdown_chunks(
        ddi_meta,
        source_doc="Danh Mục Tương Tác Thuốc Chống Chỉ Định (Chuyển Hóa & Tiêu Hóa)",
        legal_basis="Quyết định 5948/QĐ-BYT",
        entity_type="ddi",
        source_id="qd-5948-2021",
        source_version=ddi_manifest_version
    ))
    ddi_blood = active_dir / "ddi_interactions" / "qd_5948_anticoagulants_and_hematology.md"
    all_chunks.extend(_parse_markdown_chunks(
        ddi_blood,
        source_doc="Danh Mục Tương Tác Thuốc Chống Chỉ Định (Chống Đông & Huyết Học)",
        legal_basis="Quyết định 5948/QĐ-BYT",
        entity_type="ddi",
        source_id="qd-5948-2021",
        source_version=ddi_manifest_version
    ))

    # 3. Văn bản quy phạm pháp luật & Quy chế chuyên môn (Regulatory Circulars)
    regulatory_circular_specs = [
        (
            "tt51_2017_anaphylaxis_protocol.md",
            "Phác Đồ Cấp Cứu Phản Vệ",
            "Thông tư 51/2017/TT-BYT",
            "tt-51-2017",
        ),
        (
            "tt20_2017_narcotics_management.md",
            "Quy Chế Quản Lý Thuốc Kiểm Soát Đặc Biệt",
            "Thông tư 20/2017/TT-BYT",
            "tt-20-2017",
        ),
        (
            "tt22_2011_hospital_pharmacy_ward.md",
            "Quy Chế Tủ Thuốc Cấp Cứu & Tủ Trực Khoa Lâm Sàng",
            "Thông tư 22/2011/TT-BYT",
            "tt-22-2011",
        ),
        (
            "tt23_2011_drug_usage.md",
            "Hướng Dẫn Sử Dụng Thuốc Trong Cơ Sở Y Tế Có Giường Bệnh",
            "Thông tư 23/2011/TT-BYT",
            "tt-23-2011",
        ),
        (
            "tt26_2025_prescription.md",
            "Quy Định Về Đơn Thuốc Và Kê Đơn Thuốc Ngoại Trú",
            "Thông tư 26/2025/TT-BYT",
            "tt-26-2025",
        ),
        (
            "nd188_2025_bhyt.md",
            "Quy Định Chi Tiết Và Hướng Dẫn Thi Hành Luật Bảo Hiểm Y Tế",
            "Nghị định 188/2025/NĐ-CP",
            "nd-188-2025",
        ),
        (
            "tt20_2022_bhyt_drug_list.md",
            "Danh Mục Và Tỷ Lệ, Điều Kiện Thanh Toán Thuốc BHYT",
            "Thông tư 20/2022/TT-BYT",
            "tt-20-2022",
        ),
        (
            "qd130_2023_xml_bhyt.md",
            "Chuẩn Và Định Dạng Dữ Liệu Đầu Ra Giám Định BHYT (XML)",
            "Quyết định 130/QĐ-BYT",
            "qd-130-2023",
        ),
        (
            "qd3618_2022_giam_dinh_bhyt.md",
            "Quy Trình Giám Định Bảo Hiểm Y Tế",
            "Quyết định 3618/QĐ-BHXH",
            "qd-3618-2022",
        ),
    ]
    for filename, source_doc, legal_basis, source_id in regulatory_circular_specs:
        circ_path = active_dir / "regulatory_circulars" / filename
        circ_version = _verified_source_version(KB_BASE_DIR, source_id)
        all_chunks.extend(_parse_markdown_chunks(
            circ_path,
            source_doc=source_doc,
            legal_basis=legal_basis,
            entity_type="circular",
            source_id=source_id,
            source_version=circ_version,
        ))

    # 5b. Hướng dẫn chẩn đoán và điều trị chuyên khoa Bộ Y tế (Clinical Guidelines)
    clinical_guideline_specs = [
        (
            "qd708_2015_khang_sinh.md",
            "Hướng dẫn sử dụng kháng sinh",
            "Quyết định 708/QĐ-BYT",
            "qd-708-2015",
        ),
        (
            "vpcd_2026_viem_phoi.md",
            "Hướng dẫn chẩn đoán và điều trị viêm phổi mắc phải cộng đồng ở người lớn",
            "Quyết định Bộ Y tế (Cập nhật 2026)",
            "qd-vpmpcd-2026",
        ),
        (
            "qd5481_2020_dai_thao_duong.md",
            "Hướng dẫn chẩn đoán và điều trị đái tháo đường típ 2",
            "Quyết định 5481/QĐ-BYT",
            "qd-5481-2020",
        ),
        (
            "qd2767_2023_copd.md",
            "Hướng dẫn chẩn đoán và điều trị bệnh phổi tắc nghẽn mạn tính (COPD)",
            "Quyết định 2767/QĐ-BYT",
            "qd-2767-2023",
        ),
        (
            "qd1851_2020_hen_phe_quan.md",
            "Hướng dẫn chẩn đoán và điều trị hen phế quản người lớn và trẻ em >= 12 tuổi",
            "Quyết định 1851/QĐ-BYT",
            "qd-1851-2020",
        ),
    ]
    for filename, source_doc, legal_basis, source_id in clinical_guideline_specs:
        guide_path = active_dir / "clinical_guidelines" / filename
        if not guide_path.is_file():
            continue
        guide_version = _verified_source_version(KB_BASE_DIR, source_id)
        all_chunks.extend(_parse_markdown_chunks(
            guide_path,
            source_doc=source_doc,
            legal_basis=legal_basis,
            entity_type="guideline",
            source_id=source_id,
            source_version=guide_version,
        ))

    # 6. Hướng dẫn Dược Lâm Sàng & An Toàn Thuốc Chuyên Sâu (Specialty Clinical Guidelines)
    try:
        from app.services.chatbot.specialty_knowledge_registry import SpecialtyKnowledgeRegistry
        specialty_items = SpecialtyKnowledgeRegistry.get_instance().get_knowledge_items()
        for idx, item in enumerate(specialty_items):
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

            specialty_file = SpecialtyKnowledgeRegistry.get_instance()._data_file
            all_chunks.append(RagChunk(
                chunk_id=f"spec_guideline_{idx}_{clean_slug}",
                source_doc=f"Hướng Dẫn Chuyên Môn Lâm Sàng: {topic}",
                legal_basis=legal,
                page_or_section=topic,
                title=topic,
                content=full_content,
                keywords=unique_kws,
                entity_type="guideline",
                source_id=_stable_source_id(specialty_file),
                source_version=_file_sha256(specialty_file),
            ))
    except Exception:
        pass

    # 7. Đồ Thị Tri Thức Đa Tầng LightRAG (Dual-Level Knowledge Graph Chunks)
    try:
        from app.services.rag.lightrag_graph_builder import build_lightrag_graph_chunks
        graph_chunks = build_lightrag_graph_chunks()
        graph_file = Path(__file__).with_name("lightrag_data.py")
        graph_version = _file_sha256(graph_file)
        for chunk in graph_chunks:
            chunk.source_id = _stable_source_id(graph_file)
            chunk.source_version = graph_version
        all_chunks.extend(graph_chunks)
    except Exception as e:
        pass

    return all_chunks
