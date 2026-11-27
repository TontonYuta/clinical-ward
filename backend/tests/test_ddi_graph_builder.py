import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

from app.services.clinical_ddi_engine.ddi_graph_builder import (
    ingest_monographs_to_graph,
    parse_monograph_graph_json,
)
from app.services.clinical_ddi_engine.ddi_graph_store import DdiGraphStore


class TestDdiGraphBuilder(unittest.IsolatedAsyncioTestCase):
    def setUp(self) -> None:
        self.tmp_dir = tempfile.TemporaryDirectory()
        self.store = DdiGraphStore(db_path=Path(self.tmp_dir.name) / "test_builder_graph.db")

    def tearDown(self) -> None:
        self.tmp_dir.cleanup()

    def test_parse_monograph_graph_json_handles_valid_and_invalid(self) -> None:
        valid = json.dumps(
            {
                "specific_class": "Lợi tiểu thiazid",
                "parent_class": "Thuốc lợi tiểu",
                "edges": [
                    {
                        "target": "Lithium",
                        "target_type": "drug",
                        "polarity": "INTERACTS",
                        "severity": "MAJOR",
                        "exact_quote": "Thuốc lợi tiểu làm giảm thanh thải lithium qua thận.",
                    }
                ],
            }
        )
        parsed = parse_monograph_graph_json(valid)
        self.assertEqual(parsed["specific_class"], "Lợi tiểu thiazid")
        self.assertEqual(parsed["parent_class"], "Thuốc lợi tiểu")
        self.assertEqual(len(parsed["edges"]), 1)

        invalid = parse_monograph_graph_json("not valid json {")
        self.assertEqual(invalid, {"specific_class": "", "parent_class": "", "edges": []})

    async def test_ingest_with_mocked_gemini_rejects_fabricated_quote_and_keeps_verbatim(self) -> None:
        lithium_text = (
            "Thuốc lợi tiểu làm giảm thanh thải lithium qua thận và tăng nguy cơ ngộ độc lithium. "
            "Không có tương tác có ý nghĩa lâm sàng với paracetamol."
        )
        hctz_text = "Thận trọng khi phối hợp với lithium."
        monographs = [
            {
                "id": "m-lithium",
                "inn": "Lithium",
                "drug_class": "Thuốc chống hưng cảm",
                "drug_interactions": lithium_text,
                "section_pages": json.dumps({"drug_interactions": 880}),
            },
            {
                "id": "m-hctz",
                "inn": "Hydrochlorothiazid",
                "drug_class": "Lợi tiểu thiazid",
                "drug_interactions": hctz_text,
                "section_pages": json.dumps({"drug_interactions": 712}),
            },
        ]

        async def fake_extractor(inn: str, drug_class: str, interactions_text: str, api_key: str):
            if inn == "Lithium":
                return {
                    "specific_class": "Thuốc chống hưng cảm",
                    "parent_class": "",
                    "edges": [
                        {
                            "target": "Thuốc lợi tiểu",
                            "target_type": "drug_class",
                            "polarity": "INTERACTS",
                            "severity": "MAJOR",
                            "exact_quote": "Thuốc lợi tiểu làm giảm thanh thải lithium qua thận và tăng nguy cơ ngộ độc lithium.",
                        },
                        {
                            "target": "Paracetamol",
                            "target_type": "drug",
                            "polarity": "NO_INTERACTION",
                            "severity": "MINOR",
                            "exact_quote": "Không có tương tác có ý nghĩa lâm sàng với paracetamol.",
                        },
                        {
                            "target": "Digoxin",
                            "target_type": "drug",
                            "polarity": "INTERACTS",
                            "severity": "MAJOR",
                            "exact_quote": "Bịa đặt hoàn toàn không có trong văn bản gốc.",
                        },
                    ],
                }
            return {
                "specific_class": "Lợi tiểu thiazid",
                "parent_class": "Thuốc lợi tiểu",
                "edges": [],
            }

        with patch(
            "app.services.clinical_ddi_engine.ddi_graph_builder._call_gemini_graph_extractor",
            new=AsyncMock(side_effect=fake_extractor),
        ):
            stats = await ingest_monographs_to_graph(
                self.store,
                monographs,
                use_gemini=True,
                api_key="dummy-key-123456",
            )

        self.assertEqual(stats["nodes_added"], 2)
        self.assertEqual(stats["edges_accepted"], 2)
        self.assertEqual(stats["edges_rejected"], 1)

        # Verify Hydrochlorothiazid -> Lợi tiểu thiazid -> Thuốc lợi tiểu hierarchy exists
        hctz_nodes = self.store.get_node_by_name("Hydrochlorothiazid", "drug")
        self.assertEqual(len(hctz_nodes), 1)
        specific_cls = self.store.get_node_by_id(hctz_nodes[0]["parent_class_id"])
        self.assertIsNotNone(specific_cls)
        self.assertEqual(specific_cls["display_name"], "Lợi tiểu thiazid")
        parent_cls = self.store.get_node_by_id(specific_cls["parent_class_id"])
        self.assertIsNotNone(parent_cls)
        self.assertEqual(parent_cls["display_name"], "Thuốc lợi tiểu")

        # Verify NO_INTERACTION edge is stored with polarity NO_INTERACTION
        lithium_nodes = self.store.get_node_by_name("Lithium", "drug")
        para_nodes = self.store.get_node_by_name("Paracetamol", "drug")
        no_int_edges = self.store.get_edges_between(
            [lithium_nodes[0]["node_id"]],
            [para_nodes[0]["node_id"]],
        )
        self.assertEqual(len(no_int_edges), 1)
        self.assertEqual(no_int_edges[0]["polarity"], "NO_INTERACTION")

    async def test_ingest_deterministic_fallback_without_gemini(self) -> None:
        monographs = [
            {
                "id": "m-warfarin",
                "inn": "Warfarin",
                "drug_class": "Thuốc chống đông máu",
                "drug_interactions": "Rifampicin làm giảm tác dụng chống đông của warfarin.",
                "section_pages": json.dumps({"drug_interactions": 1200}),
            },
            {
                "id": "m-rifampicin",
                "inn": "Rifampicin",
                "drug_class": "Kháng sinh chống lao",
                "drug_interactions": "Cảm ứng enzym gan mạnh.",
                "section_pages": json.dumps({"drug_interactions": 1020}),
            },
        ]
        stats = await ingest_monographs_to_graph(self.store, monographs, use_gemini=False)
        self.assertEqual(stats["nodes_added"], 2)
        self.assertGreaterEqual(stats["edges_accepted"], 1)
        self.assertEqual(stats["edges_rejected"], 0)


if __name__ == "__main__":
    unittest.main()
