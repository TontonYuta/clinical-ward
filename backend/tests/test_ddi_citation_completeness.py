import unittest
from types import SimpleNamespace

from app.services.clinical_ddi_engine.multi_drug_matrix import _append_alert_provenance


class TestDdiCitationCompleteness(unittest.TestCase):
    def test_citation_excerpt_matches_full_evidence_content(self) -> None:
        alert = SimpleNamespace(
            rule_id="RULE_CLOPIDOGREL_PPI",
            severity="contraindicated",
            legal_evidence="QĐ 5948/QĐ-BYT (Mục 3.2)",
            title="CLOPIDOGREL + OMEPRAZOL/ESOMEPRAZOL",
            clinical_consequence="Mất hiệu lực bảo vệ tim mạch.",
            mechanism="Omeprazol ức chế CYP2C19.",
            action_recommendation="Thay bằng Pantoprazol 40 mg.",
        )
        citations = []
        evidence = []
        _append_alert_provenance(
            citations,
            evidence,
            "qd-5948:RULE_CLOPIDOGREL_PPI",
            alert,
            "src",
            "v1",
            substitute_advice="Thay Omeprazol bằng Pantoprazol 40 mg.",
        )
        self.assertEqual(citations[0]["excerpt"], evidence[0]["content"])
        self.assertIn("Mức độ an toàn:", citations[0]["excerpt"])
        self.assertIn("Cơ chế:", citations[0]["excerpt"])
        self.assertIn("Xử trí:", citations[0]["excerpt"])
        self.assertIn("Giải pháp thay thế an toàn:", citations[0]["excerpt"])


if __name__ == "__main__":
    unittest.main()
