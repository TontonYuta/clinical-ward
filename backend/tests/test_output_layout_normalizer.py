import unittest

from app.services.chatbot.output_layout_normalizer import normalize_clinical_markdown_output


class TestOutputLayoutNormalizer(unittest.TestCase):
    def test_heals_pdf_hyphenation_and_soft_line_breaks(self) -> None:
        raw = (
            "Thuốc lợi tiểu làm giảm\n"
            "thanh thải lithium qua thận.\n"
            "• **Kháng sinh:** amino-\n"
            "glycosid và amino- glycosid làm tăng độc tính.\n\n\n\n"
            "### Khuyến cáo\n"
            "- Theo dõi nồng độ huyết thanh."
        )
        out = normalize_clinical_markdown_output(raw)
        self.assertIn("Thuốc lợi tiểu làm giảm thanh thải lithium qua thận.", out)
        self.assertIn("- **Kháng sinh:** aminoglycosid và aminoglycosid làm tăng độc tính.", out)
        self.assertNotIn("\n\n\n", out)
        self.assertIn("\n\n### Khuyến cáo\n- Theo dõi nồng độ huyết thanh.", out)

    def test_preserves_markdown_lists_headings_and_closes_dangling_bold(self) -> None:
        raw = "## Tóm tắt\n- Mục một.\n- Mục **hai chưa đóng"
        out = normalize_clinical_markdown_output(raw)
        self.assertEqual(out, "## Tóm tắt\n- Mục một.\n- Mục **hai chưa đóng**")

    def test_fixes_hr_rule_false_bullet_unit_slashes_and_bracket_headings(self) -> None:
        raw = (
            "[Liều dùng - Trẻ em]\n"
            "*   Liều tối đa: 2,4 g/ ngày hoặc 20 - 30 mg/ kg/ngày.\n"
            "---\n"
            "**Đối chiếu nguyên văn Dược Thư:**\n"
            "- **Liều dùng:** Người bị thoái hóa xương\n\n"
            "- khớp.\n"
        )
        out = normalize_clinical_markdown_output(raw)
        self.assertIn("### Liều dùng - Trẻ em", out)
        self.assertIn("- Liều tối đa: 2,4 g/ngày hoặc 20 - 30 mg/kg/ngày.", out)
        self.assertIn("\n---\n\n**Đối chiếu nguyên văn Dược Thư:**", out)
        self.assertIn("thoái hóa xương - khớp.", out)
        self.assertNotIn("\n- khớp.", out)

    def test_claim_attributor_keeps_headings_and_drops_truncated_tail(self) -> None:
        from app.services.rag.claim_attributor import verify_and_purge_unsupported_claims

        evidence = "Ibuprofen giảm đau 200 mg mỗi 4 - 6 giờ, tối đa 1,2 g/ngày. Trẻ em 20 mg/kg/ngày."
        llm_text = (
            "### Liều dùng người lớn\n"
            "- Giảm đau: 200 mg mỗi 4 - 6 giờ, tối đa 1,2 g/ngày.\n"
            "### Liều dùng trẻ em\n"
            "- Thông thường: 2"
        )
        cleaned, _ = verify_and_purge_unsupported_claims(llm_text, evidence)
        self.assertIn("### Liều dùng người lớn", cleaned)
        self.assertIn("### Liều dùng trẻ em", cleaned)
        self.assertNotIn("Thông thường: 2", cleaned)

    def test_strips_extra_tags_fixes_mismatched_stars_and_keeps_indentation(self) -> None:
        raw = (
            "> [!WARNING] Theo dõi sát bệnh nhân.\n"
            "[Lưu ý an toàn]: Tránh dùng chung.\n"
            "- *1. Phối hợp với Ketorolac:**\n"
            "  - **Mức độ:** `CONTRAINDICATED`\n"
            "  - **Cơ chế:** Hiệp đồng.<br>"
        )
        out = normalize_clinical_markdown_output(raw)
        self.assertNotIn("[!WARNING]", out)
        self.assertNotIn("[Lưu ý an toàn]", out)
        self.assertNotIn("<br>", out)
        self.assertIn("> **Cảnh báo:** Theo dõi sát bệnh nhân.", out)
        self.assertIn("**Lưu ý an toàn:** Tránh dùng chung.", out)
        self.assertIn("- **1. Phối hợp với Ketorolac:**", out)
        self.assertIn("  - **Mức độ:** `CONTRAINDICATED`", out)
        self.assertIn("  - **Cơ chế:** Hiệp đồng.", out)

    def test_clinical_cache_separates_alternative_drug_from_interaction_intent(self) -> None:
        from app.services.cache.clinical_cache import ClinicalLRUCache

        cache = ClinicalLRUCache()
        f_inter = cache.extract_clinical_features("Tương tác đáng chú ý của Ibuprofeno Azevedos")
        f_alt = cache.extract_clinical_features("Thuốc thay thế tránh tương tác với Ibuprofeno Azevedos")
        self.assertNotIn("alternative_drug", f_inter["intent"])
        self.assertIn("alternative_drug", f_alt["intent"])

    def test_strips_answer_claims_and_xml_tags(self) -> None:
        raw = "### Lưu ý\n- Cần theo dõi thêm.\n\n<ANSWER_CLAIMS> []"
        out = normalize_clinical_markdown_output(raw)
        self.assertNotIn("<ANSWER_CLAIMS>", out)
        self.assertEqual(out, "### Lưu ý\n- Cần theo dõi thêm.")


if __name__ == "__main__":
    unittest.main()
