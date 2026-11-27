import tempfile
import unittest
from pathlib import Path

from app.services.clinical_ddi_engine.ddi_graph_retriever import retrieve_graph_ddi_pair
from app.services.clinical_ddi_engine.ddi_graph_store import DdiGraphStore


class TestDdiGraphRetriever(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp_dir = tempfile.TemporaryDirectory()
        self.store = DdiGraphStore(db_path=Path(self.tmp_dir.name) / "test_retriever.db")

    def tearDown(self) -> None:
        self.tmp_dir.cleanup()

    def test_2hop_class_hierarchy_retrieval_lithium_hctz(self) -> None:
        self.store.upsert_node("drug_class", "Lợi tiểu thiazid", parent_class_name="Thuốc lợi tiểu")
        self.store.upsert_node("drug", "Hydrochlorothiazid", parent_class_name="Lợi tiểu thiazid", monograph_id="m-hctz")
        lithium_id = self.store.upsert_node("drug", "Lithium", monograph_id="m-lithium")
        diuretic_nodes = self.store.get_node_by_name("Thuốc lợi tiểu", "drug_class")
        self.assertEqual(len(diuretic_nodes), 1)

        raw = "Thuốc lợi tiểu làm giảm thanh thải lithium qua thận và tăng nguy cơ ngộ độc lithium."
        ok = self.store.upsert_edge(
            source_node_id=lithium_id,
            target_node_id=diuretic_nodes[0]["node_id"],
            polarity="INTERACTS",
            severity="MAJOR",
            evidence_excerpt=raw,
            source_name="Dược thư Quốc gia Việt Nam",
            source_id="dtqg",
            source_version="v2",
            pdf_page=880,
            raw_monograph_text=raw,
        )
        self.assertTrue(ok)

        hit = retrieve_graph_ddi_pair("Lithium", "Hydrochlorothiazid", store=self.store)
        self.assertIsNotNone(hit)
        self.assertEqual(hit["retrieval_mode"], "graph_2hop")
        self.assertEqual(hit["page"], 880)
        self.assertEqual(hit["sentences"], [raw])
        self.assertIn("Lợi tiểu thiazid", hit["explanation_path"])
        self.assertIn("Thuốc lợi tiểu", hit["explanation_path"])

    def test_no_interaction_polarity_is_suppressed(self) -> None:
        lithium_id = self.store.upsert_node("drug", "Lithium", monograph_id="m1")
        para_id = self.store.upsert_node("drug", "Paracetamol", monograph_id="m2")
        raw = "Không có tương tác có ý nghĩa lâm sàng giữa lithium và paracetamol."
        ok = self.store.upsert_edge(
            source_node_id=lithium_id,
            target_node_id=para_id,
            polarity="NO_INTERACTION",
            severity="MINOR",
            evidence_excerpt=raw,
            source_name="Dược thư Quốc gia Việt Nam",
            source_id="dtqg",
            source_version="v2",
            pdf_page=881,
            raw_monograph_text=raw,
        )
        self.assertTrue(ok)

        hit = retrieve_graph_ddi_pair("Lithium", "Paracetamol", store=self.store)
        self.assertIsNone(hit)

    def test_1hop_direct_drug_edge(self) -> None:
        warf_id = self.store.upsert_node("drug", "Warfarin", monograph_id="m1")
        rif_id = self.store.upsert_node("drug", "Rifampicin", monograph_id="m2")
        raw = "Rifampicin làm giảm nồng độ và tác dụng chống đông của warfarin."
        self.store.upsert_edge(
            source_node_id=warf_id,
            target_node_id=rif_id,
            polarity="INTERACTS",
            severity="MAJOR",
            evidence_excerpt=raw,
            source_name="Dược thư Quốc gia Việt Nam",
            source_id="dtqg",
            source_version="v2",
            pdf_page=1200,
            raw_monograph_text=raw,
        )
        hit = retrieve_graph_ddi_pair("Warfarin", "Rifampicin", store=self.store)
        self.assertIsNotNone(hit)
        self.assertEqual(hit["retrieval_mode"], "graph_1hop")
        self.assertEqual(hit["page"], 1200)


if __name__ == "__main__":
    unittest.main()
