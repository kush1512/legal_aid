import json
from pathlib import Path
from types import SimpleNamespace

import pytest

from app.config import Settings
from app.llm import GroqProvider, LLMOrchestrator, ProviderError


def test_sample_conversation_benchmark_has_eight_complete_alternating_cases():
    path = Path(__file__).parents[1] / "benchmarks" / "sample_conversations.jsonl"
    cases = [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
    assert len(cases) == 8
    assert len({case["id"] for case in cases}) == 8
    for case in cases:
        assert case["synthetic"] is True
        assert len(case["turns"]) >= 8
        assert case["turns"][0]["role"] == "user"
        assert all(turn["role"] == ("user" if i % 2 == 0 else "assistant")
                   for i, turn in enumerate(case["turns"]))
        assert all(turn["content"].strip() for turn in case["turns"])
        assert case["checkpoints"]


def test_health_reports_provider_configuration_without_exposing_api_key(client, monkeypatch):
    from app.main import settings

    monkeypatch.setattr(settings, "llm_provider", "groq")
    monkeypatch.setattr(settings, "llm_model", "openai/gpt-oss-20b")
    monkeypatch.setattr(settings, "groq_api_key", "test-secret-not-for-response")
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    body = response.json()
    assert body["llm_config"]["provider"] == "groq"
    assert body["llm_config"]["model"] == "openai/gpt-oss-20b"
    assert body["llm_config"]["provider_key_configured"] is True
    assert "test-secret-not-for-response" not in response.text


@pytest.mark.asyncio
async def test_groq_empty_completion_is_a_visible_provider_error(monkeypatch):
    provider = GroqProvider.__new__(GroqProvider)

    async def empty_chat(*args, **kwargs):
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content="  "))])

    monkeypatch.setattr(provider, "_chat", empty_chat)
    with pytest.raises(ProviderError, match="empty response") as exc:
        await provider.generate_text("test prompt", model="openai/gpt-oss-20b", max_tokens=32)
    assert exc.value.error_type == "empty_content"


@pytest.mark.asyncio
async def test_groq_provider_selection_requires_consent_and_non_sensitive_case():
    settings = Settings(
        llm_provider="groq",
        groq_api_key="",
        allow_external_llm_for_non_sensitive=True,
        llm_max_retries=0,
        fallback_llm_provider="",
    )
    orchestrator = LLMOrchestrator(settings)
    with pytest.raises(ProviderError, match="explicit consent"):
        await orchestrator.generate_text("fictional facts", sensitive=False, user_consent=False)
    with pytest.raises(ProviderError, match="sensitive case data"):
        await orchestrator.generate_text("fictional facts", sensitive=True, user_consent=True)
