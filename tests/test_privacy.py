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
async def test_sensitive_payload_is_blocked_before_provider_initialization(monkeypatch):
    orchestrator = LLMOrchestrator(make_settings())
    initialized = []
    monkeypatch.setattr(
        orchestrator, "_provider",
        lambda name: initialized.append(name)
    )

    with pytest.raises(ProviderError, match="sensitive case data"):
        await orchestrator.generate_text(
            "synthetic placeholder",
            sensitive=True,
            user_consent=True,
        )

    assert initialized == []


@pytest.mark.asyncio
async def test_mock_provider_can_process_sensitive_development_case():
    settings = make_settings(llm_provider="mock")
    generation = await LLMOrchestrator(settings).generate_text(
        "synthetic facts",
        sensitive=True,
        user_consent=False,
    )

    assert generation.is_mock is True
    assert generation.provider == "mock"


@pytest.mark.asyncio
async def test_non_sensitive_case_requires_explicit_consent(monkeypatch):
    orchestrator = LLMOrchestrator(make_settings())
    initialized = []
    monkeypatch.setattr(
        orchestrator, "_provider",
        lambda name: initialized.append(name)
    )

    with pytest.raises(ProviderError, match="explicit user consent"):
        await orchestrator.generate_text(
            "non-sensitive facts",
            sensitive=False,
            user_consent=False,
        )

    assert initialized == []


@pytest.mark.asyncio
async def test_non_sensitive_case_requires_global_permission(monkeypatch):
    orchestrator = LLMOrchestrator(
        make_settings(allow_external_llm_for_non_sensitive=False)
    )
    initialized = []
    monkeypatch.setattr(
        orchestrator, "_provider",
        lambda name: initialized.append(name)
    )

    with pytest.raises(ProviderError, match="disabled for non-sensitive"):
        await orchestrator.generate_text(
            "non-sensitive facts",
            sensitive=False,
            user_consent=True,
        )

    assert initialized == []


@pytest.mark.asyncio
async def test_non_sensitive_case_is_permitted_with_consent(monkeypatch):
    orchestrator = LLMOrchestrator(make_settings())
    initialized = []
    monkeypatch.setattr(
        orchestrator, "_provider",
        lambda name: initialized.append(name) or FakeExternalProvider()
    )

    generation = await orchestrator.generate_text(
        "non-sensitive facts",
        sensitive=False,
        user_consent=True,
    )

    assert initialized == ["gemini"]
    assert generation.provider == "fake-external"


@pytest.mark.asyncio
async def test_synthetic_case_uses_same_non_sensitive_policy(monkeypatch):
    orchestrator = LLMOrchestrator(
        make_settings(allow_external_llm_for_synthetic=False)
    )
    initialized = []
    monkeypatch.setattr(
        orchestrator, "_provider",
        lambda name: initialized.append(name) or FakeExternalProvider()
    )

    generation = await orchestrator.generate_text(
        "synthetic facts",
        sensitive=False,
        user_consent=True,
        synthetic_demo=True,
    )

    assert initialized == ["gemini"]
    assert generation.provider == "fake-external"


@pytest.mark.asyncio
async def test_sensitive_case_is_blocked_even_with_legacy_sensitive_opt_in():
    orchestrator = LLMOrchestrator(
        make_settings(allow_external_llm_for_sensitive=True)
    )

    with pytest.raises(ProviderError, match="sensitive case data"):
        await orchestrator.generate_text(
            "private case facts",
            sensitive=True,
            user_consent=True,
        )


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

    with pytest.raises(ProviderError, match="sensitive case data"):
        await orchestrator.generate_text(
            "sensitive facts",
            sensitive=True,
            user_consent=True,
        )

    assert initialized == ["mock"]


def test_category_sensitivity_defaults_and_explicit_overrides():
    from app.main import case_requires_protection

    assert case_requires_protection("personal_safety_privacy", None) is True
    assert case_requires_protection("property_real_estate", None) is False
    assert case_requires_protection("marriage_family", None) is False
    assert case_requires_protection("digital_fraud_cybercrime", None) is False
    assert case_requires_protection("personal_safety_privacy", False) is False
    assert case_requires_protection("property_real_estate", True) is True
