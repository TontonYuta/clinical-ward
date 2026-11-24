import json
import re
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]

def test_spacing_repair_uses_source_whitespace_without_changing_characters():
    import importlib.util
    import sys

    extractor_path = ROOT / "scripts/extract_all_dtqg_monographs.py"
    spec = importlib.util.spec_from_file_location("dtqg_spacing_test", extractor_path)
    extractor = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = extractor
    spec.loader.exec_module(extractor)

    repaired = extractor.repair_spacing_from_reference(
        "Phảitheodõicẩnthận các dấu hiệu. CYP3A4",
        "Phải theo dõi cẩn thận các dấu hiệu. CYP3A4",
    )

    assert repaired == "Phải theo dõi cẩn thận các dấu hiệu. CYP3A4"
    assert re.sub(r"\s+", "", repaired) == re.sub(r"\s+", "", "Phảitheodõicẩnthận các dấu hiệu. CYP3A4")
    short_join = extractor.repair_spacing_from_reference("kểcảápxenão", "kể cả áp xe não")
    assert short_join == "kể cả áp xe não"
    glyph_split = extractor.repair_spacing_from_reference("cẩnthậncácdấuhiệu", "cẩn thận các dấu hiệu")
    assert glyph_split == "cẩn thận các dấu hiệu"

def test_spacing_repair_skips_fields_that_do_not_match_source_exactly():
    import importlib.util
    import sys

    extractor_path = ROOT / "scripts/extract_all_dtqg_monographs.py"
    spec = importlib.util.spec_from_file_location("dtqg_spacing_guard_test", extractor_path)
    extractor = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = extractor
    spec.loader.exec_module(extractor)

    original = "Dùng thuốc chưa rõ liều và nội dung."
    assert extractor.repair_spacing_from_reference(original, "Dùng thuốc theo hướng dẫn.") == original


def test_monograph_spacing_repair_uses_continuation_pages_and_removes_running_headers():
    import importlib.util
    import sys

    extractor_path = ROOT / "scripts/extract_all_dtqg_monographs.py"
    spec = importlib.util.spec_from_file_location("dtqg_multpage_spacing_test", extractor_path)
    extractor = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = extractor
    spec.loader.exec_module(extractor)

    rows = [
        {"inn": "First record", "start_page": 1,
         "drug_interactions": "Knowntext continues.\nDTQGVN 2 2 Next record\nIsoniazidvà các thuốc chốnglao."},
        {"inn": "Next record", "start_page": 2, "drug_interactions": "Other text."},
    ]
    positioned_pages = [
        "Earlier page text.",
        "Known text continues.\nDTQGVN 2\nIsoniazid và các thuốc chống lao.",
    ]

    extractor.repair_monograph_spacing(rows, positioned_pages)

    assert rows[0]["drug_interactions"] == "Known text continues.\nIsoniazid và các thuốc chống lao."


def test_paracetamol_interaction_continues_cleanly_on_source_page():
    import copy
    import importlib.util
    import sys

    extractor_path = ROOT / "scripts/extract_all_dtqg_monographs.py"
    spec = importlib.util.spec_from_file_location("dtqg_paracetamol_source_test", extractor_path)
    extractor = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = extractor
    spec.loader.exec_module(extractor)

    data_path = ROOT / "backend/data/knowledge_base/dtqg_monographs_extracted.json"
    rows = json.loads(data_path.read_text(encoding="utf-8"))
    ordered = sorted(
        (row for row in rows if str(row.get("start_page", "")).isdigit()),
        key=lambda row: int(row["start_page"]),
    )
    index = next(i for i, row in enumerate(ordered) if row["inn"].casefold() == "paracetamol")
    paracetamol = copy.deepcopy(ordered[index])
    next_record = copy.deepcopy(ordered[index + 1])
    start_page = int(paracetamol["start_page"])
    end_page = int(next_record["start_page"])
    positioned_pages = [""] * (start_page - 1) + extractor.load_pdf_bbox_pages(
        ROOT / "public/pdf/Duoc_Thu_Quoc_Gia_Viet_Nam.pdf",
        page_range=(start_page, end_page),
    )

    extractor.repair_monograph_spacing([paracetamol, next_record], positioned_pages)
    interactions = paracetamol["drug_interactions"]

    compact_interactions = re.sub(r"\s+", " ", interactions)
    assert "Isoniazid và các thuốc chống lao làm tăng độc tính của paracetamol đối với gan." in compact_interactions
    assert "Isoniazidvà" not in interactions
    assert "DTQGVN 2 1121" not in interactions
    assert "Parafin lỏng" not in interactions


def test_section_page_map_follows_field_content_to_its_pdf_page():
    import importlib.util
    import sys

    extractor_path = ROOT / "scripts/extract_all_dtqg_monographs.py"
    spec = importlib.util.spec_from_file_location("dtqg_section_page_test", extractor_path)
    extractor = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = extractor
    spec.loader.exec_module(extractor)

    rows = json.loads((ROOT / "backend/data/knowledge_base/dtqg_monographs_extracted.json").read_text(encoding="utf-8"))
    paracetamol = next(row for row in rows if row["inn"].casefold() == "paracetamol")
    pages = extractor.load_pdf_bbox_pages(
        ROOT / "public/pdf/Duoc_Thu_Quoc_Gia_Viet_Nam.pdf", page_range=(1118, 1121)
    )

    section_pages = extractor.derive_section_pages(paracetamol, pages, first_pdf_page=1118)

    assert section_pages["drug_interactions"]["page"] == 1120


def test_section_page_map_includes_auditable_source_lines_per_page():
    import importlib.util
    import sys

    extractor_path = ROOT / "scripts/extract_all_dtqg_monographs.py"
    spec = importlib.util.spec_from_file_location("dtqg_page_evidence_test", extractor_path)
    extractor = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = extractor
    spec.loader.exec_module(extractor)

    page_map = extractor.derive_section_pages_with_evidence(
        {
            "drug_interactions": "Isoniazid và các thuốc chống lao làm tăng độc tính của paracetamol đối với gan."
        },
        [
            "Dược lý và cơ chế tác dụng\nIsoniazid và các thuốc chống lao làm tăng độc tính của paracetamol đối với gan.",
            "Tương tác thuốc\nIsoniazid và các thuốc chống lao làm tăng độc tính của paracetamol đối với gan.",
        ],
        first_pdf_page=1119,
    )

    assert page_map["drug_interactions"]["page"] == 1120
    assert page_map["drug_interactions"]["evidence"] == [
        "Isoniazid và các thuốc chống lao làm tăng độc tính của paracetamol đối với gan."
    ]


def test_dtqg_extraction_has_unique_stable_ids_and_all_sources():
    rows = json.loads((ROOT / "backend/data/knowledge_base/dtqg_monographs_extracted.json").read_text(encoding="utf-8"))
    ids = [f"DTQG-{index:04d}-{re.sub(r'[^a-zA-Z0-9]', '', row['inn'])[:20]}" for index, row in enumerate(rows, 1)]
    assert len(rows) >= 680
    assert all(row.get("source") for row in rows)
    assert len({row["source"] for row in rows if "Trang" in row["source"]}) > 600
    assert len(ids) == len(set(ids))
    assert sum(row["inn"] == "Salbutamol" for row in rows) == 2


def test_start_page_points_to_pdf_page_for_available_numeric_entries():
    pdf = ROOT / "public/pdf/Duoc_Thu_Quoc_Gia_Viet_Nam.pdf"
    data = json.loads((ROOT / "backend/data/knowledge_base/dtqg_monographs_extracted.json").read_text(encoding="utf-8"))
    pages = subprocess.check_output(["pdftotext", "-layout", str(pdf), "-"], text=True).split("\f")
    missing = []
    for row in data:
        page = row.get("start_page")
        if not page or not str(page).isdigit():
            missing.append(row["inn"])
            continue
        index = int(page) - 1
        if index >= len(pages) or row["inn"].casefold() not in pages[index].casefold():
            # Some two entries have titles too long to fit the source PDF text layer.
            if not row["inn"].startswith("Immunoglobulin, normal human"):
                raise AssertionError(f"Wrong page for {row['inn']}: {page}")
    assert sorted(missing) in ([], ["Etoricoxib", "Montelukast"], ["Carbamazepine"])


def test_extraction_keeps_each_monograph_sections_in_pdf_reading_order():
    import importlib.util
    import sys

    extractor_path = ROOT / "scripts/extract_all_dtqg_monographs.py"
    spec = importlib.util.spec_from_file_location("dtqg_extractor_test", extractor_path)
    extractor = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = extractor
    spec.loader.exec_module(extractor)

    pdf = ROOT / "public/pdf/Duoc_Thu_Quoc_Gia_Viet_Nam.pdf"
    pages = extractor.load_pdf_pages(pdf)
    index = extractor.build_index(pages)
    record_index = next(i for i, item in enumerate(index) if item["inn"].casefold() == "fentanyl")
    raw = extractor.slice_monograph(pages, index[record_index], index[record_index + 1])
    extracted = extractor.extract_sections(raw)

    assert "fenoterol" not in (extracted["drug_interactions"] or "").casefold()
    assert "CYP3A4" in (extracted["drug_interactions"] or "")
    assert "naloxon" in (extracted["overdose_and_treatment"] or "").casefold()


def test_extractor_preserves_word_boundaries_and_column_order_for_clinical_text():
    import importlib.util
    import sys

    extractor_path = ROOT / "scripts/extract_all_dtqg_monographs.py"
    spec = importlib.util.spec_from_file_location("dtqg_word_boundary_test", extractor_path)
    extractor = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = extractor
    spec.loader.exec_module(extractor)

    pages = extractor.load_pdf_bbox_pages(
        ROOT / "public/pdf/Duoc_Thu_Quoc_Gia_Viet_Nam.pdf", page_range=(373, 373)
    )
    assert len(pages) == 1
    page = pages[0]
    extracted = extractor.extract_sections(page)

    assert "Nói chung, ceftriaxon được dung nạp tốt" in extracted["adverse_effects"]
    assert "Tác dụng không mong muốn" in page
    assert "Liều lượng và cách dùng" in page
    assert page.index("Tác dụng không mong muốn") < page.index("Liều lượng và cách dùng")
    assert "4 - 6 giờ" in extractor.clean_text("4 - 6giờ truyền")

def test_section_page_map_tracks_continuation_pages_for_long_sections():
    import importlib.util
    import sys

    extractor_path = ROOT / "scripts/extract_all_dtqg_monographs.py"
    spec = importlib.util.spec_from_file_location("dtqg_continuation_pages_test", extractor_path)
    extractor = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = extractor
    spec.loader.exec_module(extractor)

    interaction = (
        "Thuốc uống chống đông máu làm tăng tác dụng thuốc.\n"
        "Isoniazid và các thuốc chống lao làm tăng độc tính của thuốc đối với gan."
    )
    pages = [
        "Tương tác thuốc\nThuốc uống chống đông máu làm tăng tác dụng thuốc.",
        "Isoniazid và các thuốc chống lao làm tăng độc tính của thuốc đối với gan.",
    ]

    page_map = extractor.derive_section_pages_with_evidence(
        {"drug_interactions": interaction}, pages, first_pdf_page=1120
    )

    assert page_map["drug_interactions"]["page"] == 1120
    assert page_map["drug_interactions"]["pages"] == [1120, 1121]
    assert page_map["drug_interactions"]["page_evidence"][1]["evidence"] == [
        "Isoniazid và các thuốc chống lao làm tăng độc tính của thuốc đối với gan."
    ]
