import tempfile
import unittest
from pathlib import Path

from app.services.clinical_ddi_engine.ddi_graph_store import DdiGraphStore


class TestDdiGraphStore(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp_dir = tempfile.TemporaryDirectory()
        self.store = DdiGraphStore(db_path=Path(self.tmp_dir.name) / "test_graph.db")

    def tearDown(self) -> None:
        self.tmp_dir.cleanup()

    def test_upsert_node_hierarchy_and_exact_substring_guard(self) -> None:
        cls_id = self.store.upsert_node("drug_class", "Lợi tiểu thiazid", parent_class_name="Thuốc lợi tiểu")
        drug_id = self.store.upsert_node("drug", "Hydrochlorothiazid", parent_class_name="Lợi tiểu thiazid", monograph_id="m1")
        lithium_id = self.store.upsert_node("drug", "Lithium", monograph_id="m2")

        cls_row = self.store.get_node_by_id(cls_id)
        self.assertIsNotNone(cls_row)
        self.assertIsNotNone(cls_row["parent_class_id"])

        raw_text = "Thuốc lợi tiểu làm giảm thanh thải lithium qua thận và tăng nguy cơ ngộ độc lithium."
        # Fabricated quote must be rejected
        rejected = self.store.upsert_edge(
            source_node_id=lithium_id,
            target_node_id=cls_row["parent_class_id"],
            polarity="INTERACTS",
            severity="MAJOR",
            evidence_excerpt="Câu này tự bịa không có trong Dược thư.",
            source_name="Dược thư QG",
            source_id="dtqg",
            source_version="v1",
            pdf_page=880,
            raw_monograph_text=raw_text,
        )
        self.assertFalse(rejected)

        # Verbatim quote must be accepted
        accepted = self.store.upsert_edge(
            source_node_id=lithium_id,
            target_node_id=cls_row["parent_class_id"],
            polarity="INTERACTS",
            severity="MAJOR",
            evidence_excerpt=raw_text,
            source_name="Dược thư QG",
            source_id="dtqg",
            source_version="v1",
            pdf_page=880,
            raw_monograph_text=raw_text,
        )
        self.assertTrue(accepted)
        edges = self.store.get_edges_between([lithium_id], [cls_row["parent_class_id"]])
        self.assertEqual(len(edges), 1)
        self.assertEqual(edges[0]["pdf_page"], 880)


if __name__ == "__main__":
    unittest.main()
