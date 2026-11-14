#!/usr/bin/env python3
"""
Trích xuất toàn bộ chuyên luận Dược Thư Quốc Gia Việt Nam thành JSON chuẩn lâm sàng.
Không bịa đặt thông tin - trích xuất 100% từ text vector của Dược Thư Quốc Gia.
"""

import os
import re
import json
import time
import subprocess
from difflib import SequenceMatcher
import xml.etree.ElementTree as ET
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
PDF_PATH = PROJECT_ROOT / "public/pdf/Duoc_Thu_Quoc_Gia_Viet_Nam.pdf"
OUTPUT_JSON = PROJECT_ROOT / "backend/data/knowledge_base/dtqg_monographs_extracted.json"

def load_pdf_pages(pdf_path: Path = PDF_PATH) -> list[str]:
    """Extract PDF text in content-stream order to preserve multi-column reading flow."""
    text = subprocess.check_output(
        ["pdftotext", "-raw", str(pdf_path), "-"], text=True, encoding="utf-8"
    )
    return text.split("\f")

def load_pdf_layout_pages(pdf_path: Path = PDF_PATH) -> list[str]:
    """Load visual page layout for catalogue entries absent from content-order text."""
    text = subprocess.check_output(
        ["pdftotext", "-layout", str(pdf_path), "-"], text=True, encoding="utf-8"
    )
    return text.split("\f")

def load_pdf_bbox_pages(
    pdf_path: Path = PDF_PATH, page_range: tuple[int, int] | None = None
) -> list[str]:
    """Extract text from Poppler's positioned words, ordered by page columns."""
    command = ["pdftotext", "-bbox-layout"]
    if page_range is not None:
        command.extend(["-f", str(page_range[0]), "-l", str(page_range[1])])
    command.extend([str(pdf_path), "-"])
    output = subprocess.check_output(command, text=True, encoding="utf-8")
    root = ET.fromstring(output)
    ns = {"pdf": "http://www.w3.org/1999/xhtml"}
    pages = []
    for page in root.findall(".//pdf:page", ns):
        blocks = []
        for block in page.findall("pdf:flow/pdf:block", ns):
            lines = []
            for line in block.findall("pdf:line", ns):
                words = [word.text or "" for word in line.findall("pdf:word", ns)]
                if words:
                    lines.append(" ".join(words))
            if lines:
                blocks.append({
                    "x": float(block.get("xMin", "0")),
                    "y": float(block.get("yMin", "0")),
                    "text": "\n".join(lines),
                })
        # Poppler groups blocks by reading order. Sort by visual column and
        # then vertical position, preserving multi-column monograph reading.
        blocks.sort(key=lambda item: (item["x"], item["y"]))
        pages.append("\n".join(block["text"] for block in blocks))
    return pages

def clean_text(text: str) -> str:
    if not text:
        return ""
    # Remove recurring page headers/footers in DTQGVN
    text = re.sub(r'\nDTQGVN\s*2\s*\n', '\n', text)
    text = re.sub(r'\n\d{1,4}\s*\n', '\n', text)
    text = re.sub(r'[ \t]+', ' ', text)
    # PDF text layers can encode a numeric quantity and its following unit or
    # noun as one token even though the visual source contains a word boundary.
    text = re.sub(r'(?<=\d)(?=[a-zà-ỹ])', ' ', text)
    text = re.sub(r'\n\s*\n+', '\n', text)
    return text.strip()

def _compact_text(text: str) -> str:
    return re.sub(r"\s+", "", text or "")

def repair_spacing_from_reference(value: str, reference: str) -> str:
    """Restore PDF word boundaries only when the compact text matches source.

    The positioned PDF text is treated as the authority for whitespace. No
    medical vocabulary or hand-written word substitutions are introduced.
    """
    if not value or not reference:
        return value
    compact_value = _compact_text(value)
    if not compact_value:
        return value
    compact_reference = _compact_text(reference)
    start = compact_reference.find(compact_value)
    if start < 0:
        return value
    source_positions = [i for i, ch in enumerate(reference) if not ch.isspace()]
    left, right = source_positions[start], source_positions[start + len(compact_value) - 1] + 1
    return reference[left:right].strip()

def remove_running_page_headers(value: str) -> str:
    """Remove DTQGVN running headers that leaked into extracted section text."""
    if not value:
        return value
    lines = value.splitlines()
    cleaned = [
        line for line in lines
        if not re.match(
            r"^\s*(?:DTQGVN\s*2(?:\s+\d{1,4})?(?:\s+[^\n]*)?|"
            r"\d{1,4}\s+DTQGVN\s*2(?:\s+[^\n]*)?)\s*$",
            line,
            re.IGNORECASE,
        )
    ]
    return "\n".join(cleaned).strip()

_SECTION_PAGE_SOURCES = {
    "indications": (("Chỉ định",), ("indications",)),
    "contraindications": (("Chống chỉ định",), ("contraindications",)),
    "precautions": (("Thận trọng",), ("precautions",)),
    "adverse_effects": (("Tác dụng không mong muốn",), ("adverse_effects",)),
    "drug_interactions": (("Tương tác thuốc",), ("drug_interactions",)),
    "dosage": (("Liều lượng và cách dùng",), ("adult_dosage", "pediatric_dosage", "renal_adjustment", "hepatic_adjustment")),
    "overdose_treatment": (("Quá liều và xử trí",), ("overdose_treatment",)),
}

def derive_section_pages(
    monograph: dict,
    positioned_pages: list[str],
    first_pdf_page: int = 1,
) -> dict[str, int]:
    """Find section pages where both the source heading and its extracted text occur."""
    return derive_section_pages_with_evidence(
        monograph, positioned_pages, first_pdf_page=first_pdf_page
    )

def derive_section_pages_with_evidence(
    monograph: dict,
    positioned_pages: list[str],
    first_pdf_page: int = 1,
) -> dict[str, dict[str, object]]:
    """Return the matching PDF page and source lines proving each section map."""
    page_text = [(first_pdf_page + offset, _compact_text(page).casefold(), page) for offset, page in enumerate(positioned_pages)]
    result = {}
    for section_key, (headings, fields) in _SECTION_PAGE_SOURCES.items():
        source_lines = [
            _compact_text(line).casefold()
            for field in fields
            for line in str(monograph.get(field) or "").splitlines()
            if len(_compact_text(line)) >= 18
        ]
        if not source_lines:
            continue
        page_matches = []
        for page_number, compact_page, original_page in page_text:
            has_heading = any(_compact_text(heading).casefold() in compact_page for heading in headings)
            matched_lines = [
                line for line in source_lines
                if line in compact_page or SequenceMatcher(None, line, compact_page).ratio() >= 0.72
            ]
            if not matched_lines:
                continue
            original_lines = [
                line_value
                for field in fields
                for line_value in str(monograph.get(field) or "").splitlines()
                if any(
                    _compact_text(line_value).casefold() == matched
                    or SequenceMatcher(None, _compact_text(line_value).casefold(), matched).ratio() >= 0.72
                    for matched in matched_lines
                )
            ]
            if original_lines:
                page_matches.append({
                    "page": page_number,
                    "has_heading": has_heading,
                    "evidence": original_lines,
                })
        anchored_matches = [item for item in page_matches if item["has_heading"]]
        if anchored_matches:
            anchor_page = anchored_matches[0]["page"]
            continuation = [item for item in page_matches if item["page"] >= anchor_page]
            result[section_key] = {
                "page": anchor_page,
                "pages": [item["page"] for item in continuation],
                "evidence": [line for item in continuation for line in item["evidence"]],
                "page_evidence": [
                    {"page": item["page"], "evidence": item["evidence"]}
                    for item in continuation
                ],
            }
    return result

def repair_monograph_spacing(monographs: list[dict], positioned_pages: list[str]) -> int:
    """Repair extracted fields against all PDF pages spanned by each record."""
    repaired_fields = 0
    ordered = sorted(
        (row for row in monographs if str(row.get("start_page", "")).isdigit()),
        key=lambda row: int(row["start_page"]),
    )
    for index, row in enumerate(ordered):
        first_page = max(0, int(row["start_page"]) - 1)
        if index + 1 < len(ordered):
            # Include the next record's first page because a section may
            # continue in the opposite column above that record's heading.
            end_page = min(len(positioned_pages), int(ordered[index + 1]["start_page"]))
        else:
            end_page = min(len(positioned_pages), first_page + 10)
        reference = "\n".join(positioned_pages[first_page:end_page])
        row["section_pages"] = derive_section_pages_with_evidence(
            row, positioned_pages[first_page:end_page], first_pdf_page=first_page + 1
        )
        for key, value in row.items():
            if key in {"source", "inn", "title", "section_pages"} or not isinstance(value, str):
                continue
            cleaned = remove_running_page_headers(value)
            repaired_lines = [repair_spacing_from_reference(line, reference) for line in cleaned.splitlines()]
            repaired = "\n".join(repaired_lines).strip()
            if repaired != value:
                row[key] = repaired
                repaired_fields += 1
    return repaired_fields

def build_index(pages):
    index = []
    tcqt_regex = re.compile(r'Tên chung quốc tế:\s*([^\n\.]+)', re.IGNORECASE)
    atc_regex = re.compile(r'Mã ATC:\s*([^\n\.]+)', re.IGNORECASE)

    for p_num, page in enumerate(pages, 1):
        matches = list(tcqt_regex.finditer(page))
        for m in matches:
            inn = m.group(1).strip()
            if inn.lower().startswith("viết theo"):
                continue
            
            atc_m = atc_regex.search(page[m.start():])
            atc = atc_m.group(1).strip() if atc_m else None
            
            prefix = page[:m.start()].strip().split('\n')
            title = prefix[-1].strip() if prefix else inn
            if title.startswith('(') and len(prefix) >= 2:
                title = prefix[-2].strip() + ' ' + title
            
            index.append({
                "title": title,
                "inn": inn,
                "atc": atc,
                "start_page": p_num,
                "char_offset": m.start()
            })
    return index

def slice_monograph(pages, cur, nxt):
    start_p = cur["start_page"] - 1
    end_p = (nxt["start_page"] - 1) if nxt else min(start_p + 10, len(pages))
    
    text = '\n'.join(pages[start_p:end_p + 1])
    start_token = "Tên chung quốc tế: " + cur["inn"]
    start_pos = text.find(start_token)
    if start_pos == -1:
        start_pos = text.find(cur["inn"])
        
    title_pos = text.rfind(cur["title"], 0, start_pos) if cur["title"] else -1
    actual_start = title_pos if title_pos != -1 else (start_pos if start_pos != -1 else 0)

    # Nếu trên trang đầu có khối "Dược lý và cơ chế tác dụng" của chính thuốc này (trước tiêu đề do pdftotext xáo trộn cột)
    pharm_pos = text.find("Dược lý và cơ chế tác dụng")
    if 0 <= pharm_pos < actual_start:
        snippet = text[pharm_pos:pharm_pos + 500].lower()
        if cur["inn"].lower() in snippet or (cur.get("title") and cur["title"].lower() in snippet):
            actual_start = pharm_pos
    
    if nxt:
        end_token = "Tên chung quốc tế: " + nxt["inn"]
        end_pos = text.find(end_token, actual_start + 100)
        if end_pos != -1:
            next_title_pos = text.rfind(nxt["title"], actual_start, end_pos)
            actual_end = next_title_pos if next_title_pos != -1 else end_pos
            text = text[actual_start:actual_end]
        else:
            text = text[actual_start:]
    else:
        text = text[actual_start:]
        
    return text.strip()

def extract_sections(raw_text: str) -> dict:
    section_patterns = [
        ("atc_code", r'Mã ATC:\s*([^\n]+)'),
        ("drug_class", r'Loại thuốc:\s*([^\n]+(?:\n(?![A-ZĐ][a-zà-ỹA-Z0-9\s]+:)[^\n]+)*)'),
        ("dosage_forms", r'Dạng thuốc và hàm lượng\s*:?\s*\n([\s\S]*?)(?=\nDược lý|\nChỉ định|\nChống chỉ định|\nThận trọng|\Z)'),
        ("pharmacology", r'Dược lý và cơ chế tác dụng\s*:?\s*\n([\s\S]*?)(?=\nDược động học|\nChỉ định|\nChống chỉ định|\Z)'),
        ("pharmacokinetics", r'Dược động học\s*:?\s*\n([\s\S]*?)(?=\nChỉ định|\nChống chỉ định|\nThận trọng|\Z)'),
        ("indications", r'Chỉ định\s*:?\s*\n([\s\S]*?)(?=\nChống chỉ định|\nThận trọng|\nLiều lượng|\Z)'),
        ("contraindications", r'Chống chỉ định\s*:?\s*\n([\s\S]*?)(?=\nThận trọng|\nThời kỳ mang thai|\nLiều lượng|\Z)'),
        ("precautions", r'Thận trọng\s*:?\s*\n([\s\S]*?)(?=\nThời kỳ mang thai|\nThời kỳ cho con bú|\nTác dụng không mong muốn|\Z)'),
        ("pregnancy", r'Thời kỳ mang thai\s*:?\s*\n([\s\S]*?)(?=\nThời kỳ cho con bú|\nTác dụng không mong muốn|\Z)'),
        ("lactation", r'Thời kỳ cho con bú\s*:?\s*\n([\s\S]*?)(?=\nTác dụng không mong muốn|\nLiều lượng|\Z)'),
        ("adverse_effects", r'Tác dụng không mong muốn\s*(?:\(ADR\))?\s*:?\s*\n([\s\S]*?)(?=\nHướng dẫn cách xử trí|\nLiều lượng và cách dùng|\Z)'),
        ("adr_management", r'Hướng dẫn cách xử trí(?:\s*ADR|\s*tác dụng không mong muốn)?\s*:?\s*\n([\s\S]*?)(?=\nLiều lượng và cách dùng|\nLiều lượng|\nTương tác thuốc|\Z)'),
        ("dosage_and_administration", r'Liều lượng và cách dùng\s*:?\s*\n([\s\S]*?)(?=\nTương tác thuốc|\nĐộ ổn định|\nQuá liều|\Z)'),
        ("drug_interactions", r'Tương tác thuốc\s*:?\s*\n([\s\S]*?)(?=\nĐộ ổn định|\nQuá liều và xử trí|\nThông tin qui chế|\Z)'),
        ("incompatibilities", r'Tương kỵ\s*:?\s*\n([\s\S]*?)(?=\nĐộ ổn định|\nQuá liều|\nThông tin qui chế|\Z)'),
        ("storage_stability", r'Độ ổn định và bảo quản\s*:?\s*\n([\s\S]*?)(?=\nTương kỵ|\nQuá liều|\nThông tin qui chế|\Z)'),
        ("overdose_and_treatment", r'Quá liều và xử trí\s*:?\s*\n([\s\S]*?)(?=\nThông tin qui chế|\nTên thương mại|\Z)')
    ]
    
    data = {}
    for key, pattern in section_patterns:
        m = re.search(pattern, raw_text)
        data[key] = clean_text(m.group(1)) if m else None
        
    dosage = data.get("dosage_and_administration") or ""
    
    # Sub-parsing adult dosage (phải neo đầu dòng hoặc hai chấm để tránh match 'ở người lớn' trong văn bản chạy)
    adult_m = re.search(r'(?:^|\n)\s*(?:[-•*]\s*)?(?:Người lớn|Liều người lớn|Liều cho người lớn)\s*[:\n]\s*([\s\S]*?)(?=(?:\n\s*(?:[-•*]\s*)?(?:Trẻ em|Liều trẻ em|Người cao tuổi|Suy thận|Suy gan)\s*[:\n])|\Z)', dosage, re.IGNORECASE)
    data["adult_dosage"] = clean_text(adult_m.group(1)) if adult_m else (clean_text(dosage) if dosage else None)
    
    # Sub-parsing pediatric dosage (phải neo đầu dòng hoặc hai chấm)
    ped_m = re.search(r'(?:^|\n)\s*(?:[-•*]\s*)?(?:Trẻ em|Liều trẻ em|Liều cho trẻ em)\s*[:\n]\s*([\s\S]*?)(?=(?:\n\s*(?:[-•*]\s*)?(?:Người lớn|Liều người lớn|Người cao tuổi|Suy thận|Suy gan)\s*[:\n])|\Z)', dosage, re.IGNORECASE)
    data["pediatric_dosage"] = clean_text(ped_m.group(1)) if ped_m else None
    
    # Sub-parsing renal adjustment
    renal_m = re.search(r'(?:^|\n)\s*(?:[-•*]\s*)?(?:Suy thận|Người bệnh suy thận|Hiệu chỉnh ở người suy thận|Hiệu chỉnh liều ở người suy thận)\s*[:\n]\s*([\s\S]*?)(?=(?:\n\s*(?:[-•*]\s*)?(?:Suy gan|Người cao tuổi|Tương tác|Độ ổn định|Quá liều)\s*[:\n])|\Z)', dosage, re.IGNORECASE)
    data["renal_adjustment"] = clean_text(renal_m.group(1)) if renal_m else None
    
    # Sub-parsing hepatic adjustment
    hepatic_m = re.search(r'(?:^|\n)\s*(?:[-•*]\s*)?(?:Suy gan|Người bệnh suy gan|Hiệu chỉnh ở người suy gan|Hiệu chỉnh liều ở người suy gan)\s*[:\n]\s*([\s\S]*?)(?=(?:\n\s*(?:[-•*]\s*)?(?:Suy thận|Người cao tuổi|Tương tác|Độ ổn định|Quá liều)\s*[:\n])|\Z)', dosage, re.IGNORECASE)
    data["hepatic_adjustment"] = clean_text(hepatic_m.group(1)) if hepatic_m else None
    
    # Identify specific antidote if mentioned in overdose treatment
    overdose = data.get("overdose_and_treatment") or ""
    antidote_m = re.search(r'(?:giải độc|kháng|thuốc đối kháng|thuốc giải độc)[^\.\n]*?(?:là|dùng|bằng)\s+([^\.\n]+)', overdose, re.IGNORECASE)
    data["antidote"] = clean_text(antidote_m.group(1)) if antidote_m else None

    # Merge pregnancy and lactation warning
    preg = data.get("pregnancy") or ""
    lact = data.get("lactation") or ""
    data["pregnancy_warning"] = clean_text(f"Thời kỳ mang thai: {preg}\nThời kỳ cho con bú: {lact}").strip() if (preg or lact) else None

    return data

def main():
    t0 = time.time()
    # Keep content-order extraction as canonical for section parsing. Positioned
    # words are used only to restore spaces when their compact text matches a
    # field exactly, so they cannot introduce or remove clinical content.
    pages = load_pdf_pages()
    index = build_index(pages)
    # Some index headings are arranged in page margins/columns and are not
    # emitted by Poppler in content-stream order. Retain those catalogue rows
    # from layout extraction but parse full records in reading order.
    layout_index = build_index(load_pdf_layout_pages())
    indexed = {(row["inn"].casefold(), row["start_page"]) for row in index}
    index.extend(row for row in layout_index if (row["inn"].casefold(), row["start_page"]) not in indexed)
    index.sort(key=lambda row: (row["start_page"], row["char_offset"]))
    print(f"Loaded {len(pages)} pages. Indexed {len(index)} monographs.")
    
    extracted_monographs = []
    for i, cur in enumerate(index):
        nxt = index[i + 1] if i + 1 < len(index) else None
        raw = slice_monograph(pages, cur, nxt)
        parsed = extract_sections(raw)
        
        entry = {
            "title": cur["title"],
            "inn": cur["inn"],
            "start_page": cur["start_page"],
            "atc_code": parsed.get("atc_code"),
            "drug_class": parsed.get("drug_class"),
            "dosage_forms": parsed.get("dosage_forms"),
            "pharmacodynamics": parsed.get("pharmacology"),
            "pharmacokinetics": parsed.get("pharmacokinetics"),
            "indications": parsed.get("indications"),
            "contraindications": parsed.get("contraindications"),
            "precautions": parsed.get("precautions"),
            "pregnancy_warning": parsed.get("pregnancy_warning"),
            "lactation_warning": parsed.get("lactation"),
            "adverse_effects": parsed.get("adverse_effects"),
            "adr_management": parsed.get("adr_management"),
            "adult_dosage": parsed.get("adult_dosage"),
            "pediatric_dosage": parsed.get("pediatric_dosage"),
            "renal_adjustment": parsed.get("renal_adjustment"),
            "hepatic_adjustment": parsed.get("hepatic_adjustment"),
            "drug_interactions": parsed.get("drug_interactions"),
            "incompatibilities": parsed.get("incompatibilities"),
            "storage_stability": parsed.get("storage_stability"),
            "overdose_treatment": parsed.get("overdose_and_treatment"),
            "antidote": parsed.get("antidote"),
            "source": f"Dược thư Quốc gia Việt Nam (Lần xuất bản II - 2015, QĐ 2033/QĐ-BYT, Trang {cur['start_page']}) • Tệp: Duoc_Thu_Quoc_Gia_Viet_Nam.pdf" if cur.get("start_page") else "Dược thư Quốc gia Việt Nam (Lần xuất bản II - 2015, QĐ 2033/QĐ-BYT) • Tệp: Duoc_Thu_Quoc_Gia_Viet_Nam.pdf"
        }
        extracted_monographs.append(entry)

    # Preserve existing catalogue entries and curated metadata that the PDF
    # text layer cannot reliably index, while refreshing fields from source
    # records that can be matched by their source identity.
    if OUTPUT_JSON.exists():
        with OUTPUT_JSON.open('r', encoding='utf-8') as f:
            existing = json.load(f)
        def record_key(row):
            return (re.sub(r'\W+', '', row.get('inn', '')).casefold(), str(row.get('start_page') or ''))
        extracted_by_key = {record_key(row): row for row in extracted_monographs}
        monographs = []
        for row in existing:
            refreshed = extracted_by_key.pop(record_key(row), None)
            if refreshed:
                row.update({
                    key: value for key, value in refreshed.items()
                    if key not in {"inn", "start_page", "source"}
                    and value is not None and (not isinstance(value, str) or value.strip())
                })
            monographs.append(row)
        monographs.extend(extracted_by_key.values())
    else:
        monographs = extracted_monographs

    positioned_pages = load_pdf_bbox_pages()
    repaired_fields = repair_monograph_spacing(monographs, positioned_pages)
    print(f"Restored source word boundaries in {repaired_fields} exact-match fields.")
        
    os.makedirs(os.path.dirname(OUTPUT_JSON), exist_ok=True)
    with open(OUTPUT_JSON, 'w', encoding='utf-8') as f:
        json.dump(monographs, f, ensure_ascii=False, indent=2)
        
    elapsed = time.time() - t0
    print(f"Successfully extracted {len(monographs)} monographs to {OUTPUT_JSON} in {elapsed:.2f}s")

if __name__ == "__main__":
    main()
