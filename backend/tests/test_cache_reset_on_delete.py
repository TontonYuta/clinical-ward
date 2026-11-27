import unittest

from app.routers.copilot import _clear_all_copilot_caches
from app.schemas.copilot import CopilotResponse
from app.services.cache.clinical_cache import get_clinical_cache
from app.services.rag.gemini_highlight_selector import _CACHE as HIGHLIGHT_CACHE


class TestCacheResetOnDelete(unittest.TestCase):
    def test_clear_all_copilot_caches_purges_clinical_and_highlight_caches(self) -> None:
        cache = get_clinical_cache()
        dummy_resp = CopilotResponse(
            intent="MEDICATION_SAFETY_PROFILE",
            reply_text="Chỉ định của Ciprofloxacin: Nhiễm khuẩn đường tiết niệu.",
            answer_type="grounded_reference",
            citations=[{"source": "Dược thư Quốc gia Việt Nam", "legal_basis": "QĐ 2033/QĐ-BYT"}],
            evidence=[{"evidence_id": "e1", "content": "Nhiễm khuẩn đường tiết niệu"}],
            confidence=0.95,
            rag_grounded=True,
        )
        cache.set("Chỉ định của Ciprofloxacin", "doctor", dummy_resp)
        HIGHLIGHT_CACHE["dummy_key"] = {"drug_anchor": "Ciprofloxacin", "selected_headings": ["Chỉ định"]}

        self.assertIsNotNone(cache.get("Chỉ định của Ciprofloxacin", user_role="doctor"))
        self.assertGreater(len(HIGHLIGHT_CACHE), 0)

        _clear_all_copilot_caches(["session_1"])

        self.assertIsNone(cache.get("Chỉ định của Ciprofloxacin", user_role="doctor"))
        self.assertEqual(len(HIGHLIGHT_CACHE), 0)


if __name__ == "__main__":
    unittest.main()
