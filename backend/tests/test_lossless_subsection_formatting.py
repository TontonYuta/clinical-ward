import unittest

from app.services.copilot_drug_citation_helper import (
    _format_lossless_subsection_bullets,
    format_flat_field_inquiry,
)


class TestLosslessSubsectionFormatting(unittest.TestCase):
    def test_preserves_all_content_and_structures_subheadings(self) -> None:
        raw = (
            "Cách dùng:\n"
            "Tiêm bắp sâu hoặc tiêm dưới da.\n"
            "Loãng xương sau mãn kinh: Tiêm 100 đơn vị/ngày.\n"
            "Bệnh Paget xương: Tiêm 50 đơn vị cách ngày."
        )
        formatted = _format_lossless_subsection_bullets(raw, nested=False)
        self.assertIn("• **Cách dùng:**", formatted)
        self.assertIn("  - Tiêm bắp sâu hoặc tiêm dưới da.", formatted)
        self.assertIn("• **Loãng xương sau mãn kinh:** Tiêm 100 đơn vị/ngày.", formatted)
        self.assertIn("• **Bệnh Paget xương:** Tiêm 50 đơn vị cách ngày.", formatted)

    def test_flat_field_inquiry_multi_field_keeps_all_sentences(self) -> None:
        out = format_flat_field_inquiry(
            drug_name="Paracetamol",
            drug_inn="Paracetamol",
            field_data=[
                ("contraindications", "Chống chỉ định", "Suy gan nặng."),
                ("precautions", "Thận trọng", "Suy thận: Giảm liều."),
            ],
            source="Dược thư Quốc gia Việt Nam",
        )
        self.assertIn("• **Chống chỉ định:**", out)
        self.assertIn("• **Thận trọng:**", out)
        self.assertIn("**Suy thận:** Giảm liều.", out)


if __name__ == "__main__":
    unittest.main()
