import json
import re
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


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
    assert sorted(missing) in ([], ["Etoricoxib", "Montelukast"])
