import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.rag.gemini_highlight_selector import (
    build_highlight_prompt,
    clear_highlight_selector_cache,
    parse_highlight_response,
    select_highlight_headings_with_gemini,
)


class TestGeminiHighlightSelector(unittest.IsolatedAsyncioTestCase):
    def setUp(self) -> None:
        clear_highlight_selector_cache()

    def test_parse_filters_hallucinations_and_matches_without_colon(self) -> None:
        candidates = ["Chỉ định", "Chống chỉ định", "Thời kỳ mang thai", "Thận trọng"]
        raw = '{"drug_anchor": "Metformin", "selected_headings": ["Thời kỳ mang thai:", "Bịa đặt"]}'
        parsed = parse_highlight_response(raw, candidates)
        self.assertEqual(parsed["drug_anchor"], "Metformin")
        self.assertEqual(parsed["selected_headings"], ["Thời kỳ mang thai"])

    def test_build_prompt_includes_anchor_and_candidates(self) -> None:
        prompt = build_highlight_prompt("Bà bầu dùng được không?", ["Thời kỳ mang thai", "Chỉ định"], drug_anchor="Amoxicillin")
        self.assertIn("Amoxicillin", prompt)
        self.assertIn("Thời kỳ mang thai", prompt)

    async def test_select_with_gemini_and_cache(self) -> None:
        mock_res = MagicMock()
        mock_res.status_code = 200
        mock_res.json.return_value = {
            "candidates": [
                {
                    "content": {
                        "parts": [
                            {"text": '{"drug_anchor": "Amoxicillin", "selected_headings": ["Thời kỳ mang thai"]}'}
                        ]
                    }
                }
            ]
        }
        mock_client = AsyncMock()
        mock_client.__aenter__.return_value.post = AsyncMock(return_value=mock_res)

        with patch("app.services.rag.gemini_highlight_selector.httpx.AsyncClient", return_value=mock_client):
            res1 = await select_highlight_headings_with_gemini(
                "Bà bầu uống được không?",
                ["Chỉ định", "Thời kỳ mang thai", "Thận trọng"],
                drug_anchor="Amoxicillin",
                api_key="test_fake_gemini_key_12345",
            )
            res2 = await select_highlight_headings_with_gemini(
                "Bà bầu uống được không?",
                ["Chỉ định", "Thời kỳ mang thai", "Thận trọng"],
                drug_anchor="Amoxicillin",
                api_key="test_fake_gemini_key_12345",
            )

        self.assertEqual(res1["selected_headings"], ["Thời kỳ mang thai"])
        self.assertFalse(res1["cached"])
        self.assertTrue(res2["cached"])
        self.assertEqual(mock_client.__aenter__.return_value.post.call_count, 1)


if __name__ == "__main__":
    unittest.main()
