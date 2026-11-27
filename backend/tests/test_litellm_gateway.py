import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from app.services.litellm_gateway import (
    build_router_model_list,
    routed_completion,
    routed_json_completion,
)


class TestLiteLLMGateway(unittest.IsolatedAsyncioTestCase):
    async def test_build_router_model_list_collects_multiple_providers(self) -> None:
        async def fake_vault(provider: str = "gemini"):
            return {
                "gemini": "AIzaDummyGeminiKey12345",
                "groq": "gsk_DummyGroqKey12345",
                "openrouter": "sk-or-DummyOpenRouter12345",
                "mistral": None,
            }.get(provider)

        with patch("app.services.litellm_gateway.get_active_api_key_async", side_effect=fake_vault):
            models = await build_router_model_list()

        tiers = {m["model_name"] for m in models}
        self.assertIn("gemini-tier", tiers)
        self.assertIn("groq-tier", tiers)
        self.assertIn("openrouter-tier", tiers)
        self.assertNotIn("mistral-tier", tiers)

    async def test_routed_json_completion_parses_router_response(self) -> None:
        with (
            patch(
                "app.services.litellm_gateway.build_router_model_list",
                new=AsyncMock(
                    return_value=[
                        {"model_name": "gemini-tier", "litellm_params": {"model": "gemini/gemini-3.5-flash-lite", "api_key": "k1"}},
                        {"model_name": "groq-tier", "litellm_params": {"model": "groq/openai/gpt-oss-120b", "api_key": "k2"}},
                    ]
                ),
            ),
            patch(
                "app.services.litellm_gateway._call_provider_entry",
                new=AsyncMock(side_effect=[None, '{"verdict": "ok", "score": 1}']),
            ) as mock_call,
        ):
            parsed = await routed_json_completion("Return JSON")
            self.assertEqual(parsed, {"verdict": "ok", "score": 1})
            self.assertEqual(mock_call.call_count, 2)

    async def test_routed_completion_returns_empty_when_no_keys(self) -> None:
        with patch("app.services.litellm_gateway.build_router_model_list", new=AsyncMock(return_value=[])):
            res = await routed_completion("Hello")
            self.assertEqual(res, {})

    async def test_ping_test_key_routes_groq_without_calling_google(self) -> None:
        from app.services.admin_key_vault import ping_test_key

        fake_resp = SimpleNamespace(status_code=200, json=lambda: {"data": [{"id": "openai/gpt-oss-120b"}]})
        with patch("app.services.admin_key_vault.httpx.AsyncClient") as mock_client_cls:
            mock_client = mock_client_cls.return_value.__aenter__.return_value
            mock_client.get = AsyncMock(return_value=fake_resp)
            ok, msg, _lat, models = await ping_test_key("gsk_test1234567890", provider="groq")
            self.assertTrue(ok)
            self.assertIn("Groq", msg)
            self.assertEqual(models, ["openai/gpt-oss-120b"])
            called_url = mock_client.get.call_args.args[0]
            self.assertIn("api.groq.com", called_url)

    async def test_query_clinical_llm_falls_back_to_litellm_when_gemini_returns_none(self) -> None:
        from app.services.llm_provider import query_clinical_llm

        with (
            patch("app.services.llm_provider.settings.LLM_PROVIDER", "gemini"),
            patch("app.services.admin_monitoring_service.check_token_budget_gate", return_value=(True, "ok")),
            patch("app.services.llm_provider._call_gemini_api", new=AsyncMock(return_value=None)),
            patch(
                "app.services.litellm_gateway.routed_completion",
                new=AsyncMock(return_value={"text": "Fallback clinical answer", "model": "groq/openai/gpt-oss-120b"}),
            ),
        ):
            out = await query_clinical_llm("Unique test prompt for fallback check 99182")
            self.assertEqual(out, "Fallback clinical answer")


if __name__ == "__main__":
    unittest.main()
