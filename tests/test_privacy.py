import pytest
from app.config import Settings
from app.llm import LLMOrchestrator,ProviderError

@pytest.mark.asyncio
async def test_sensitive_payload_is_blocked_before_provider_initialization():
    settings=Settings(
        llm_provider="gemini",llm_model="example-model",
        gemini_api_key="",allow_external_llm_for_sensitive=False,
        fallback_llm_provider="",llm_max_retries=0
    )
    orchestrator=LLMOrchestrator(settings)
    with pytest.raises(ProviderError,match="synthetic demonstration"):
        await orchestrator.generate_text("synthetic placeholder",sensitive=True,user_consent=False)

@pytest.mark.asyncio
async def test_mock_provider_can_process_development_case():
    settings=Settings(llm_provider="mock",llm_model="mock-legal-aid-v1")
    generation=await LLMOrchestrator(settings).generate_text("synthetic facts",sensitive=True)
    assert generation.is_mock is True
    assert generation.provider=="mock"

@pytest.mark.asyncio
async def test_external_provider_is_blocked_without_global_demo_opt_in():
    settings=Settings(
        llm_provider="gemini",llm_model="test-model",gemini_api_key="",
        allow_external_llm_for_synthetic=False,
        synthetic_demo_user_ids="00000000-0000-4000-8000-000000000001"
    )
    orchestrator=LLMOrchestrator(settings)
    with pytest.raises(ProviderError,match="synthetic demonstration"):
        await orchestrator.generate_text(
            "synthetic facts",sensitive=False,user_consent=True,synthetic_demo=True
        )

@pytest.mark.asyncio
async def test_sensitive_external_provider_requires_separate_opt_in_and_consent():
    settings=Settings(
        llm_provider="gemini",llm_model="test-model",gemini_api_key="",
        allow_external_llm_for_synthetic=True,
        allow_external_llm_for_sensitive=False
    )
    orchestrator=LLMOrchestrator(settings)
    with pytest.raises(ProviderError,match="sensitive-data privacy policy"):
        await orchestrator.generate_text(
            "synthetic facts",sensitive=True,user_consent=True,synthetic_demo=True
        )
