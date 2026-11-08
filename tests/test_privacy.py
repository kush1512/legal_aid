import pytest

from app.config import Settings
from app.llm import Generation, LLMOrchestrator, LLMProvider, ProviderError


ALLOWLISTED_USER = "00000000-0000-4000-8000-000000000001"


class FakeExternalProvider(LLMProvider):
    name = "fake-external"
    external = True

    async def generate_text(self, prompt, *, model, max_tokens):
        return Generation("ok", self.name, model)


def make_settings(**overrides):
    values = {
        "llm_provider": "gemini",
        "llm_model": "test-model",
        "gemini_api_key": "not-used",
        "allow_external_llm_for_synthetic": False,
        "allow_external_llm_for_non_sensitive": True,
        "allow_external_llm_for_sensitive": False,
        "synthetic_demo_user_ids": ALLOWLISTED_USER,
        "llm_max_retries": 0,
    }
    values.update(overrides)
    return Settings(**values)


@pytest.mark.asyncio
async def test_synthetic_demo_blocked_when_synthetic_permission_disabled(monkeypatch):
    orchestrator = LLMOrchestrator(make_settings(
        allow_external_llm_for_synthetic=False,
        allow_external_llm_for_non_sensitive=True,
    ))
    initialized = []
    monkeypatch.setattr(orchestrator, "_provider", lambda name: initialized.append(name))
    with pytest.raises(ProviderError, match="synthetic demonstration"):
        await orchestrator.generate_text(
            "synthetic facts", sensitive=False, user_consent=True, synthetic_demo=True
        )
    assert initialized == []


@pytest.mark.asyncio
async def test_synthetic_demo_with_all_permissions_reaches_provider_initialization(monkeypatch):
    orchestrator = LLMOrchestrator(make_settings(allow_external_llm_for_synthetic=True))
    initialized = []
    monkeypatch.setattr(orchestrator, "_provider", lambda name: initialized.append(name) or FakeExternalProvider())
    generation = await orchestrator.generate_text(
        "synthetic facts", sensitive=False, user_consent=True, synthetic_demo=True
    )
    assert initialized == ["gemini"]
    assert generation.provider == "fake-external"


@pytest.mark.asyncio
async def test_non_synthetic_non_sensitive_case_is_permitted(monkeypatch):
    orchestrator = LLMOrchestrator(make_settings())
    initialized = []
    monkeypatch.setattr(orchestrator, "_provider", lambda name: initialized.append(name) or FakeExternalProvider())
    generation = await orchestrator.generate_text(
        "non-sensitive facts", sensitive=False, user_consent=True, synthetic_demo=False
    )
    assert initialized == ["gemini"]
    assert generation.provider == "fake-external"


@pytest.mark.asyncio
async def test_non_sensitive_case_without_consent_is_blocked_before_initialization(monkeypatch):
    orchestrator = LLMOrchestrator(make_settings())
    initialized = []
    monkeypatch.setattr(orchestrator, "_provider", lambda name: initialized.append(name))
    with pytest.raises(ProviderError, match="explicit user consent"):
        await orchestrator.generate_text(
            "facts", sensitive=False, user_consent=False, synthetic_demo=False
        )
    assert initialized == []


@pytest.mark.asyncio
async def test_sensitive_case_with_consent_is_always_blocked(monkeypatch):
    orchestrator = LLMOrchestrator(make_settings(allow_external_llm_for_sensitive=True))
    initialized = []
    monkeypatch.setattr(orchestrator, "_provider", lambda name: initialized.append(name))
    with pytest.raises(ProviderError, match="sensitive or private"):
        await orchestrator.generate_text(
            "private case facts", sensitive=True, user_consent=True, synthetic_demo=False
        )
    assert initialized == []


@pytest.mark.asyncio
async def test_private_conversation_is_blocked(monkeypatch):
    orchestrator = LLMOrchestrator(make_settings())
    initialized = []
    monkeypatch.setattr(orchestrator, "_provider", lambda name: initialized.append(name))
    with pytest.raises(ProviderError, match="sensitive or private"):
        await orchestrator.generate_text(
            "private conversation", sensitive=True, user_consent=True, synthetic_demo=False
        )
    assert initialized == []


@pytest.mark.asyncio
async def test_fallback_provider_cannot_bypass_sensitive_data_gate(monkeypatch):
    settings = make_settings(
        llm_provider="mock",
        fallback_llm_provider="gemini",
        llm_fallback_enabled=True,
    )
    orchestrator = LLMOrchestrator(settings)
    initialized = []
    class FailingMock:
        external = False
        async def generate_text(self, prompt, *, model, max_tokens):
            raise ProviderError("temporary mock failure", transient=True)
    def provider(name):
        initialized.append(name)
        if name == "mock":
            return FailingMock()
        return FakeExternalProvider()
    monkeypatch.setattr(orchestrator, "_provider", provider)
    with pytest.raises(ProviderError, match="sensitive or private"):
        await orchestrator.generate_text(
            "sensitive facts", sensitive=True, user_consent=True, synthetic_demo=False
        )
    assert initialized == ["mock"]


@pytest.mark.asyncio
async def test_mock_provider_continues_without_consent(monkeypatch):
    orchestrator = LLMOrchestrator(make_settings(llm_provider="mock"))
    generation = await orchestrator.generate_text(
        "development case", sensitive=True, user_consent=False, synthetic_demo=False
    )
    assert generation.is_mock is True
    assert generation.provider == "mock"


def test_synthetic_demo_user_allowlist_is_enforced_at_api_boundary(monkeypatch):
    from app import main

    monkeypatch.setattr(main.settings, "allow_external_llm_for_synthetic", True)
    monkeypatch.setattr(main.settings, "synthetic_demo_user_ids", ALLOWLISTED_USER)
    assert main.can_use_external_synthetic_ai(
        {"id": ALLOWLISTED_USER}, True, True
    )
    assert not main.can_use_external_synthetic_ai(
        {"id": "00000000-0000-4000-8000-000000000002"}, True, True
    )
