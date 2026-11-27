import unittest

from app.services.clinical_ddi_engine.monograph_ddi_lookup import (
    _extract_class_keywords,
    lookup_monograph_pair_interaction,
)
from app.services.clinical_ddi_engine.multi_drug_matrix import format_multi_ddi_response


class TestMonographDdiLookup(unittest.TestCase):
    def test_extract_class_keywords_from_db_drug_class(self) -> None:
        kws = _extract_class_keywords("Chống trầm cảm ức chế tái thu hồi serotonin (SSRI)")
        self.assertIn("ssri", kws)

    def test_rifampicin_warfarin_resolves_from_monograph(self) -> None:
        hit = lookup_monograph_pair_interaction("Rifampicin", "Warfarin")
        self.assertIsNotNone(hit)
        self.assertGreater(len(hit["sentences"]), 0)

    def test_multi_drug_matrix_uses_monograph_fallback_for_gentamicin_furosemid(self) -> None:
        resp = format_multi_ddi_response(["Gentamicin", "Furosemid"], "Phối hợp Gentamicin và Furosemid")
        self.assertEqual(resp.answer_type, "grounded_reference")
        self.assertGreater(len(resp.citations), 0)
        self.assertIn("Tương tác", resp.reply_text)


if __name__ == "__main__":
    unittest.main()
