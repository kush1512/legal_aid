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
    with pytest.raises(ProviderError,match="privacy policy"):
        await orchestrator.generate_text("synthetic placeholder",sensitive=True,user_consent=False)

@pytest.mark.asyncio
async def test_mock_provider_can_process_development_case():
    settings=Settings(llm_provider="mock",llm_model="mock-legal-aid-v1")
    generation=await LLMOrchestrator(settings).generate_text("synthetic facts",sensitive=True)
    assert generation.is_mock is True
    assert generation.provider=="mock"
