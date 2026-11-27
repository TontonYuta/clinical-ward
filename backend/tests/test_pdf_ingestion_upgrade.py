import unittest
from unittest.mock import AsyncMock, patch

import pymupdf

from app.services.rag.claim_attributor import verify_and_purge_unsupported_claims
from app.services.rag.pdf_ingestion_service import (
    _chunk_page_text,
    _extract_pdf_pages_markdown,
)


def _make_pdf_bytes(text: str = "") -> bytes:
    doc = pymupdf.open()
    page = doc.new_page()
    if text:
        page.insert_text((72, 72), text)
    data = doc.tobytes()
    doc.close()
    return data


class TestPdfIngestionUpgradeAndNumericGuard(unittest.IsolatedAsyncioTestCase):
    def test_heading_aware_chunking_heals_hyphenation(self) -> None:
        md = (
            "### Chỉ định\n"
            "Điều trị nhiễm khuẩn.\n\n"
            "### Tương tác thuốc\n"
            "Tránh phối hợp với amino-\nglycosid vì tăng độc tính thận."
        )
        chunks = _chunk_page_text(md, max_chars=80)
        self.assertGreaterEqual(len(chunks), 2)
        self.assertTrue(any("### Chỉ định" in c for c in chunks))
        self.assertTrue(any("aminoglycosid" in c for c in chunks))

    async def test_extract_pdf_pages_markdown_digital_pdf(self) -> None:
        pdf_bytes = _make_pdf_bytes("Lithium va Thuoc loi tieu thiazid lam giam thanh thai than.")
        total, pages, ocr_used = await _extract_pdf_pages_markdown(pdf_bytes)
        self.assertEqual(total, 1)
        self.assertEqual(ocr_used, 0)
        self.assertEqual(len(pages), 1)
        self.assertIn("Lithium", pages[0][1])

    async def test_extract_pdf_pages_ocr_fallback_for_blank_scan(self) -> None:
        scan_pdf_bytes = _make_pdf_bytes("")  # no text layer -> triggers OCR fallback
        with patch(
            "app.services.llm_provider.query_vision_ocr",
            new=AsyncMock(return_value="### Công văn\nChống chỉ định phối hợp với ketoconazol."),
        ):
            total, pages, ocr_used = await _extract_pdf_pages_markdown(scan_pdf_bytes)
        self.assertEqual(total, 1)
        self.assertEqual(ocr_used, 1)
        self.assertEqual(len(pages), 1)
        self.assertIn("ketoconazol", pages[0][1])

    def test_numeric_unit_fact_guard_rejects_fabricated_dose(self) -> None:
        evidence = "Liều khuyến cáo cho trẻ sơ sinh là 20 mg/kg một liều duy nhất, tối đa 60 mg/kg/ngày."
        llm_text = (
            "- Liều khuyến cáo là 20 mg/kg một liều duy nhất.\n"
            "- Liều tối đa là 200 mg/kg/ngày cho trẻ sơ sinh."
        )
        cleaned, _ = verify_and_purge_unsupported_claims(llm_text, evidence)
        self.assertIn("20 mg/kg", cleaned)
        self.assertNotIn("200 mg/kg", cleaned)


if __name__ == "__main__":
    unittest.main()
